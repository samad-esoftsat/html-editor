import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { renderEmail } from '@/lib/export/renderEmail';
import { embedImagesInHtml } from '@/lib/export/embedImages';
import type { ProjectData } from '@/lib/editor/types';

interface Ctx {
  params: Promise<{ id: string }>;
}

function slugify(name: string): string {
  const slug = (name || '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
  return slug || 'campaign';
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, data')
    .eq('id', id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const embed = req.nextUrl.searchParams.get('embed') === '1';
  let html = renderEmail(data.data as ProjectData);
  let failures = 0;
  if (embed) {
    const result = await embedImagesInHtml(html);
    html = result.html;
    failures = result.failures.length;
  }

  const slug = slugify(data.name as string);
  const filename = embed ? `${slug}-offline.html` : `${slug}.html`;

  const headers: Record<string, string> = {
    'content-type': 'text/html; charset=utf-8',
    'content-disposition': `attachment; filename="${filename}"`,
    'cache-control': 'no-store',
  };
  if (embed) headers['x-embed-failures'] = String(failures);

  return new NextResponse(html, { status: 200, headers });
}
