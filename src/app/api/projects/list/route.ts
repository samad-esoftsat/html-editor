import { NextResponse } from 'next/server';
import { findWorkspace } from '@/lib/auth/workspace';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug') ?? '';
  const workspace = slug ? await findWorkspace(slug) : null;
  if (!workspace) return NextResponse.json({ error: 'workspace_not_found' }, { status: 404 });

  const { data, error } = await supabase
    .from('projects')
    .select('id, name, updated_at')
    .eq('org_id', workspace.org.id)
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
