import { NextResponse, type NextRequest } from 'next/server';
import { findWorkspace, resolveMinRole } from '@/lib/auth/workspace';
import { createClient } from '@/lib/supabase/server';

interface Ctx {
  params: Promise<{ slug: string }>;
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { slug } = await params;
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

  const body = (await req.json().catch(() => ({}))) as { slug?: unknown; name?: unknown };
  const update: { slug?: string; name?: string } = {};

  if (typeof body.slug === 'string') {
    const next = body.slug.trim().toLowerCase();
    if (next.length < 3 || next.length > 40 || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(next)) {
      return NextResponse.json({ error: 'invalid_slug' }, { status: 400 });
    }
    update.slug = next;
  }

  if (typeof body.name === 'string') {
    const next = body.name.trim();
    if (next.length === 0) {
      return NextResponse.json({ error: 'invalid_name' }, { status: 400 });
    }
    update.name = next.slice(0, 200);
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'empty_patch' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('organizations')
    .update(update)
    .eq('id', workspace.org.id)
    .select('id, slug, name')
    .maybeSingle();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'slug_taken' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json({ ...data, role: workspace.role });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { slug } = await params;
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

  const { count, error: countError } = await supabase
    .from('organization_members')
    .select('org_id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });
  if ((count ?? 0) <= 1) {
    return NextResponse.json({ error: 'last_workspace' }, { status: 409 });
  }

  const { error } = await supabase.from('organizations').delete().eq('id', workspace.org.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return new NextResponse(null, { status: 204 });
}
