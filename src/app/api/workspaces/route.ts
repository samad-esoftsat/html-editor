import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface MembershipRow {
  role: 'owner' | 'editor' | 'viewer';
  organizations: {
    id: string;
    slug: string;
    name: string;
  } | null;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('organization_members')
    .select('role, organizations!inner(id, slug, name)')
    .eq('user_id', user.id)
    .order('slug', { foreignTable: 'organizations', ascending: true })
    .returns<MembershipRow[]>();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const workspaces = (data ?? [])
    .filter((row) => row.organizations !== null)
    .map((row) => ({
      id: row.organizations!.id,
      slug: row.organizations!.slug,
      name: row.organizations!.name,
      role: row.role,
    }));

  return NextResponse.json({ workspaces });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { slug?: unknown; name?: unknown };
  const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';

  if (slug.length < 3 || slug.length > 40 || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug)) {
    return NextResponse.json({ error: 'invalid_slug' }, { status: 400 });
  }
  if (name.length === 0) {
    return NextResponse.json({ error: 'invalid_name' }, { status: 400 });
  }

  const { data, error } = await supabase
    .rpc('create_workspace', { p_slug: slug, p_name: name })
    .single<{ id: string; slug: string; name: string }>();

  if (error) {
    if (error.code === '23505' || error.message.includes('slug_taken')) {
      return NextResponse.json({ error: 'slug_taken' }, { status: 409 });
    }
    if (error.code === '28000') {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    if (error.code === 'P0001') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { id: data.id, slug: data.slug, name: data.name, role: 'owner' as const },
    { status: 201 },
  );
}
