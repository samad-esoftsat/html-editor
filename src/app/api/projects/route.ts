import { NextResponse, type NextRequest } from 'next/server';
import { getTemplate } from '@/lib/editor/templates';
import { findWorkspace, resolveMinRole } from '@/lib/auth/workspace';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const slug = typeof body.slug === 'string' ? body.slug : '';
  const workspace = slug ? await findWorkspace(slug) : null;
  if (!workspace) return NextResponse.json({ error: 'workspace_not_found' }, { status: 404 });
  if (!resolveMinRole(workspace.role, 'editor')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const name = typeof body.name === 'string' && body.name.trim().length > 0
    ? body.name.trim().slice(0, 200)
    : 'Untitled project';
  const template = getTemplate(typeof body.template === 'string' ? body.template : null);

  const brandKitId = typeof body.brand_kit_id === 'string' && body.brand_kit_id.length > 0
    ? body.brand_kit_id
    : null;
  if (brandKitId) {
    const { data: kit, error: kitErr } = await supabase
      .from('brand_kits')
      .select('id')
      .eq('id', brandKitId)
      .eq('org_id', workspace.org.id)
      .maybeSingle();
    if (kitErr) return NextResponse.json({ error: kitErr.message }, { status: 500 });
    if (!kit) return NextResponse.json({ error: 'invalid_brand_kit' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      org_id: workspace.org.id,
      name,
      data: template.factory(),
      template_source: template.id,
      brand_kit_id: brandKitId,
    })
    .select('id, name, updated_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
