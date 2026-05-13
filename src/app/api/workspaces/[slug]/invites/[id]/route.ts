import { NextResponse, type NextRequest } from 'next/server';
import { findWorkspace, resolveMinRole } from '@/lib/auth/workspace';
import { createClient } from '@/lib/supabase/server';

interface Ctx {
  params: Promise<{ slug: string; id: string }>;
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { slug, id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const workspace = await findWorkspace(slug);
  if (!workspace) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!resolveMinRole(workspace.role, 'owner')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('organization_invites')
    .delete()
    .eq('id', id)
    .eq('org_id', workspace.org.id)
    .select('id')
    .maybeSingle();

  if (error) {
    if (error.code === '42501') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return new NextResponse(null, { status: 204 });
}
