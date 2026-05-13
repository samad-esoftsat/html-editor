import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { findWorkspace, resolveMinRole } from '@/lib/auth/workspace';
import { ASSET_BUCKET, assetUrlFromPath, buildAssetPath, getImageDimensions } from '@/lib/images/assets';
import { createClient } from '@/lib/supabase/server';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file');
  const workspaceSlug = form.get('workspaceSlug');
  const altText = form.get('altText');

  if (!(file instanceof File)) return NextResponse.json({ error: 'no_file' }, { status: 400 });
  if (typeof workspaceSlug !== 'string') return NextResponse.json({ error: 'no_workspace' }, { status: 400 });
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: 'bad_type' }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'too_large' }, { status: 413 });

  const workspace = await findWorkspace(workspaceSlug);
  if (!workspace) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!resolveMinRole(workspace.role, 'editor')) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const id = randomUUID();
  const path = buildAssetPath(workspace.org.id, id, file.type);
  const bytes = Buffer.from(await file.arrayBuffer());
  const dimensions = getImageDimensions(bytes, file.type);
  const { error: uploadError } = await supabase.storage
    .from(ASSET_BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: false });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const insert = {
    id,
    org_id: workspace.org.id,
    created_by: user.id,
    request_key: null,
    storage_path: path,
    mime_type: file.type,
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
    source: 'upload',
    prompt: null,
    provider: null,
    alt_text: typeof altText === 'string' && altText.trim() ? altText.trim() : null,
    original_filename: file.name || null,
  };

  const { data, error } = await supabase
    .from('assets')
    .insert(insert)
    .select('*')
    .single();

  if (error) {
    await supabase.storage.from(ASSET_BUCKET).remove([path]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    assetId: data.id,
    url: assetUrlFromPath(data.storage_path),
    width: data.width,
    height: data.height,
    originalFilename: data.original_filename,
  }, { status: 201 });
}
