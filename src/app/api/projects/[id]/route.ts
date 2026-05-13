import { NextResponse, type NextRequest } from 'next/server';
import type { ProjectData } from '@/lib/editor/types';
import { createClient } from '@/lib/supabase/server';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const ifUnmodifiedSince = req.headers.get('x-if-unmodified-since');

  const body = (await req.json()) as {
    name?: string;
    data?: ProjectData;
    brand_kit_id?: string | null;
  };
  const update: Record<string, unknown> = {};
  if (typeof body.name === 'string') update.name = body.name.trim().slice(0, 200);
  if (body.data) update.data = body.data;
  if (body.brand_kit_id !== undefined) {
    if (body.brand_kit_id === null) {
      update.brand_kit_id = null;
    } else if (typeof body.brand_kit_id === 'string' && body.brand_kit_id.length > 0) {
      const { data: project } = await supabase
        .from('projects')
        .select('org_id')
        .eq('id', id)
        .maybeSingle();
      if (!project) return NextResponse.json({ error: 'not_found' }, { status: 404 });
      const { data: kit, error: kitErr } = await supabase
        .from('brand_kits')
        .select('id')
        .eq('id', body.brand_kit_id)
        .eq('org_id', project.org_id)
        .maybeSingle();
      if (kitErr) return NextResponse.json({ error: kitErr.message }, { status: 500 });
      if (!kit) return NextResponse.json({ error: 'invalid_brand_kit' }, { status: 400 });
      update.brand_kit_id = body.brand_kit_id;
    }
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'empty_patch' }, { status: 400 });
  }

  if (ifUnmodifiedSince) {
    const { data: current } = await supabase
      .from('projects')
      .select('updated_at')
      .eq('id', id)
      .maybeSingle();
    if (current && current.updated_at !== ifUnmodifiedSince) {
      return NextResponse.json({ error: 'conflict' }, { status: 409 });
    }
  }

  const { data, error } = await supabase
    .from('projects')
    .update(update)
    .eq('id', id)
    .select('id, name, updated_at')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
