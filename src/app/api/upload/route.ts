import { NextResponse, type NextRequest } from 'next/server';
import { v4 as uuid } from 'uuid';
import { createClient } from '@/lib/supabase/server';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file');
  const projectId = form.get('projectId');
  if (!(file instanceof File)) return NextResponse.json({ error: 'no_file' }, { status: 400 });
  if (typeof projectId !== 'string') return NextResponse.json({ error: 'no_project' }, { status: 400 });
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: 'bad_type' }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'too_large' }, { status: 413 });

  const { data: row } = await supabase.from('projects').select('id').eq('id', projectId).maybeSingle();
  if (!row) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/webp' ? 'webp' : 'gif';
  const path = `${user.id}/${projectId}/${uuid()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage.from('project-assets').upload(path, buf, { contentType: file.type, upsert: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: { publicUrl } } = supabase.storage.from('project-assets').getPublicUrl(path);
  return NextResponse.json({ publicUrl });
}
