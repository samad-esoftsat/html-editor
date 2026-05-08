import { NextResponse, type NextRequest } from 'next/server';
import { getTemplate } from '@/lib/editor/templates';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === 'string' && body.name.trim().length > 0
    ? body.name.trim().slice(0, 200)
    : 'Untitled project';
  const template = getTemplate(typeof body.template === 'string' ? body.template : null);

  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      name,
      data: template.factory(),
      template_source: template.id,
    })
    .select('id, name, updated_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
