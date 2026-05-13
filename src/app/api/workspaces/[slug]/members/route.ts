import { NextResponse, type NextRequest } from 'next/server';
import { findWorkspace } from '@/lib/auth/workspace';
import { createClient } from '@/lib/supabase/server';

interface Ctx {
  params: Promise<{ slug: string }>;
}

interface MemberRow {
  user_id: string;
  email: string;
  role: 'owner' | 'editor' | 'viewer';
  created_at: string;
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const workspace = await findWorkspace(slug);
  if (!workspace) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data, error } = await supabase
    .rpc('list_org_members', { p_org: workspace.org.id })
    .returns<MemberRow[]>();

  if (error) {
    if (error.code === '28000') {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    if (error.code === '42501') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ members: data ?? [] });
}
