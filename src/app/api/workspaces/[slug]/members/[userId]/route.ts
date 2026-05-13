import { NextResponse, type NextRequest } from 'next/server';
import { findWorkspace, resolveMinRole } from '@/lib/auth/workspace';
import { createClient } from '@/lib/supabase/server';

interface Ctx {
  params: Promise<{ slug: string; userId: string }>;
}

type Role = 'owner' | 'editor' | 'viewer';

function mapRpcError(message: string, code: string | undefined) {
  if (code === '28000') return { status: 401, error: 'unauthorized' };
  if (code === '42501') return { status: 403, error: 'forbidden' };
  if (code === 'P0002') return { status: 404, error: 'member_not_found' };
  if (code === 'P0001') {
    if (message.includes('last_owner')) return { status: 409, error: 'last_owner' };
    if (message.includes('invalid_role')) return { status: 400, error: 'invalid_role' };
    return { status: 400, error: message };
  }
  return { status: 500, error: message };
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { slug, userId } = await params;
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

  const body = (await req.json().catch(() => ({}))) as { role?: unknown };
  if (body.role !== 'owner' && body.role !== 'editor' && body.role !== 'viewer') {
    return NextResponse.json({ error: 'invalid_role' }, { status: 400 });
  }
  const role = body.role as Role;

  const { data, error } = await supabase
    .rpc('update_member_role', {
      p_org: workspace.org.id,
      p_user: userId,
      p_role: role,
    })
    .returns<Array<{ user_id: string; role: Role }>>();

  if (error) {
    const mapped = mapRpcError(error.message, error.code);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }

  const row = Array.isArray(data) ? data[0] : null;
  return NextResponse.json({ user_id: row?.user_id ?? userId, role: row?.role ?? role });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { slug, userId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const workspace = await findWorkspace(slug);
  if (!workspace) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const isSelf = userId === workspace.userId;
  if (!isSelf && !resolveMinRole(workspace.role, 'owner')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { error } = await supabase.rpc('remove_member', {
    p_org: workspace.org.id,
    p_user: userId,
  });

  if (error) {
    const mapped = mapRpcError(error.message, error.code);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }

  return new NextResponse(null, { status: 204 });
}
