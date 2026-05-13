import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: src, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!src) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data, error: insErr } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      org_id: src.org_id,
      name: `${src.name} (copy)`,
      data: src.data,
      template_source: src.template_source,
      raw_html_path: src.raw_html_path,
      brand_kit_id: src.brand_kit_id,
    })
    .select('id')
    .single();

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
