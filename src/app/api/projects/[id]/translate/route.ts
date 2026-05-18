import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { extractTranslatable, applyTranslations } from '@/lib/translate/fields';
import { translateStrings } from '@/lib/translate/gemini';
import { isLanguageCode, getLanguage } from '@/lib/translate/languages';
import type { ProjectData } from '@/lib/editor/types';

interface Ctx {
  params: Promise<{ id: string }>;
}

interface Body {
  name?: unknown;
  language?: unknown;
  tone?: unknown;
}

async function readBody(req: NextRequest): Promise<Body> {
  try {
    const body = await req.json();
    if (body && typeof body === 'object' && !Array.isArray(body)) return body as Body;
  } catch {
    // empty / invalid JSON
  }
  return {};
}

function resolveTranslatedName(requested: unknown, sourceName: string, abbrev: string): string {
  if (typeof requested === 'string') {
    const trimmed = requested.trim();
    if (trimmed.length > 0) return trimmed.slice(0, 200);
  }
  return `${sourceName} (${abbrev})`.slice(0, 200);
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await readBody(req);
  if (!isLanguageCode(body.language)) {
    return NextResponse.json({ error: 'invalid_language' }, { status: 400 });
  }
  const language = getLanguage(body.language);
  const tone = typeof body.tone === 'string' ? body.tone : undefined;

  const { data: src, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!src) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const sourceData = src.data as ProjectData;
  const strings = extractTranslatable(sourceData);

  let translations: Record<string, string>;
  try {
    translations = await translateStrings({
      strings,
      targetLanguageLabel: language.label,
      tone,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'translation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const translatedData = applyTranslations(sourceData, translations);

  const name = resolveTranslatedName(body.name, src.name as string, language.abbrev);

  // Log usage for future quota work (see plan deviation note). No DB table in v1.
  const characterCount = Object.values(strings).reduce((n, s) => n + s.length, 0);
  console.info('[translate]', JSON.stringify({
    org_id: src.org_id,
    user_id: user.id,
    source_project_id: id,
    target_language: language.code,
    character_count: characterCount,
  }));

  const { data: inserted, error: insErr } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      org_id: src.org_id,
      name,
      data: translatedData,
      template_source: src.template_source,
      raw_html_path: src.raw_html_path,
      brand_kit_id: src.brand_kit_id,
    })
    .select('id, name')
    .single();

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  return NextResponse.json(inserted, { status: 201 });
}
