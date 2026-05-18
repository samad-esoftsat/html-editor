import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { findWorkspace } from '@/lib/auth/workspace';
import { renderEmail } from '@/lib/export/renderEmail';
import { buildPrintHtml } from '@/lib/export/buildPrintHtml';
import type { ProjectData } from '@/lib/editor/types';

interface Ctx {
  params: Promise<{ slug: string; id: string }>;
}

const NOT_FOUND_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>Not found</title></head><body style="font-family:sans-serif;padding:32px">Project not found.</body></html>`;

function notFoundResponse(): NextResponse {
  return new NextResponse(NOT_FOUND_HTML, {
    status: 404,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { slug, id } = await params;
  const workspace = await findWorkspace(slug);
  if (!workspace) return notFoundResponse();

  const supabase = await createClient();
  const { data } = await supabase
    .from('projects')
    .select('id, name, data')
    .eq('id', id)
    .eq('org_id', workspace.org.id)
    .maybeSingle();

  if (!data) return notFoundResponse();

  const emailHtml = renderEmail(data.data as ProjectData);
  const printHtml = buildPrintHtml(emailHtml);

  return new NextResponse(printHtml, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
