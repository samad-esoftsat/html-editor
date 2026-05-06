import { NextResponse, type NextRequest } from 'next/server';
import type { ProjectData } from '@/lib/editor/types';
import { createClient } from '@/lib/supabase/server';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
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
  const ifUnmodifiedSince = req.headers.get('x-if-unmodified-since');

  const body = (await req.json()) as { name?: string; data?: ProjectData };
  const update: Record<string, unknown> = {};
  if (typeof body.name === 'string') update.name = body.name.trim().slice(0, 200);
  if (body.data) update.data = body.data;
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
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
