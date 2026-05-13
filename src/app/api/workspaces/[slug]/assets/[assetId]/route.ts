import { NextResponse, type NextRequest } from 'next/server';
import { findWorkspace, resolveMinRole } from '@/lib/auth/workspace';
import { assetUrlFromPath } from '@/lib/images/assets';
import { createClient } from '@/lib/supabase/server';

interface Ctx {
  params: Promise<{ slug: string; assetId: string }>;
}

export async function PATCH(_req: NextRequest, { params }: Ctx) {
  const { slug, assetId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const workspace = await findWorkspace(slug);
  if (!workspace) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!resolveMinRole(workspace.role, 'editor')) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { data, error } = await supabase
    .from('assets')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', assetId)
    .eq('org_id', workspace.org.id)
    .is('archived_at', null)
    .select('*')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json({
    asset: {
      ...data,
      url: assetUrlFromPath(data.storage_path),
    },
  });
}
