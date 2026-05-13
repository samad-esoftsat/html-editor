import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { findWorkspace, resolveMinRole } from '@/lib/auth/workspace';
import { ASSET_BUCKET, assetUrlFromPath, buildAssetPath } from '@/lib/images/assets';
import { asProviderError } from '@/lib/images/errors';
import { getImageProvider } from '@/lib/images';
import { validateRequestKey } from '@/lib/images/request-key';
import { createClient } from '@/lib/supabase/server';

type RequestRow = {
  org_id: string;
  request_key: string;
  created_by: string;
  kind: 'edit' | 'remove_bg';
  status: 'processing' | 'completed' | 'failed';
  asset_id: string | null;
  error_code: string | null;
  created_at: string;
  updated_at: string;
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const form = await req.formData();
  const image = form.get('image');
  const mask = form.get('mask');
  const promptValue = form.get('prompt');
  const workspaceSlug = form.get('workspaceSlug');
  const requestKeyValue = form.get('requestKey');
  const modeValue = form.get('mode');

  if (!(image instanceof File)) return NextResponse.json({ error: 'invalid_image' }, { status: 400 });
  if (!(mask instanceof File)) return NextResponse.json({ error: 'invalid_mask' }, { status: 400 });
  if (typeof workspaceSlug !== 'string' || !workspaceSlug) return NextResponse.json({ error: 'invalid_workspace' }, { status: 400 });
  if (typeof requestKeyValue !== 'string') return NextResponse.json({ error: 'invalid_request_key' }, { status: 400 });
  if (modeValue !== 'inpaint' && modeValue !== 'remove_bg') return NextResponse.json({ error: 'invalid_mode' }, { status: 400 });

  const prompt = modeValue === 'remove_bg'
    ? 'remove the background, output transparent PNG'
    : typeof promptValue === 'string' && promptValue.trim()
      ? promptValue.trim()
      : '';
  if (!prompt) return NextResponse.json({ error: 'invalid_prompt' }, { status: 400 });

  const workspace = await findWorkspace(workspaceSlug);
  if (!workspace) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!resolveMinRole(workspace.role, 'editor')) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const requestKey = validateRequestKey(requestKeyValue);
  const kind = modeValue === 'remove_bg' ? 'remove_bg' : 'edit';

  const { data: existingRequest, error: existingError } = await supabase
    .from('image_generation_requests')
    .select('*')
    .eq('org_id', workspace.org.id)
    .eq('request_key', requestKey)
    .maybeSingle<RequestRow>();
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });

  if (existingRequest?.status === 'completed' && existingRequest.asset_id) {
    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .select('*')
      .eq('id', existingRequest.asset_id)
      .eq('org_id', workspace.org.id)
      .maybeSingle();
    if (assetError) return NextResponse.json({ error: assetError.message }, { status: 500 });
    if (!asset) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({
      assetId: asset.id,
      url: assetUrlFromPath(asset.storage_path),
      width: asset.width,
      height: asset.height,
    });
  }

  if (existingRequest?.status === 'processing') {
    return NextResponse.json({ error: 'still_processing' }, { status: 409 });
  }

  if (existingRequest?.status === 'failed') {
    const { error } = await supabase
      .from('image_generation_requests')
      .update({ status: 'processing', error_code: null, updated_at: new Date().toISOString() })
      .eq('org_id', workspace.org.id)
      .eq('request_key', requestKey);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase
      .from('image_generation_requests')
      .insert({
        org_id: workspace.org.id,
        request_key: requestKey,
        created_by: user.id,
        kind,
        status: 'processing',
      });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('image_quota_monthly')
    .eq('id', workspace.org.id)
    .single();
  if (orgError) return failRequest(supabase, workspace.org.id, requestKey, orgError.message, 500);

  const { data: quotaData, error: quotaError } = await supabase
    .rpc('consume_image_quota', { p_org_id: workspace.org.id, p_limit: org.image_quota_monthly })
    .maybeSingle<{ ok: boolean; remaining: number; quota_period: string }>();
  if (quotaError) return failRequest(supabase, workspace.org.id, requestKey, quotaError.message, 500);
  if (!quotaData?.ok) {
    await markRequestFailed(supabase, workspace.org.id, requestKey, 'quota_exhausted');
    return NextResponse.json({ error: 'quota_exhausted', resetsOn: quotaData?.quota_period }, { status: 429 });
  }

  let path: string | null = null;

  try {
    const provider = getImageProvider();
    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const maskBuffer = modeValue === 'remove_bg'
      ? Buffer.from(await image.arrayBuffer())
      : Buffer.from(await mask.arrayBuffer());

    const result = await provider.edit({
      image: imageBuffer,
      mask: maskBuffer,
      prompt,
    });

    const id = randomUUID();
    path = buildAssetPath(workspace.org.id, id, result.mimeType);
    const { error: uploadError } = await supabase.storage
      .from(ASSET_BUCKET)
      .upload(path, result.bytes, { contentType: result.mimeType, upsert: false });
    if (uploadError) throw new Error(uploadError.message);

    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .insert({
        id,
        org_id: workspace.org.id,
        created_by: user.id,
        request_key: requestKey,
        storage_path: path,
        mime_type: result.mimeType,
        width: result.width,
        height: result.height,
        source: 'edit',
        prompt,
        provider: provider.name,
        alt_text: null,
        original_filename: null,
      })
      .select('*')
      .single();
    if (assetError) throw new Error(assetError.message);

    await supabase
      .from('image_generation_requests')
      .update({
        status: 'completed',
        asset_id: asset.id,
        error_code: null,
        updated_at: new Date().toISOString(),
      })
      .eq('org_id', workspace.org.id)
      .eq('request_key', requestKey);

    return NextResponse.json({
      assetId: asset.id,
      url: assetUrlFromPath(asset.storage_path),
      width: asset.width,
      height: asset.height,
    });
  } catch (error) {
    await supabase.rpc('refund_image_quota', { p_org_id: workspace.org.id });
    if (path) {
      await supabase.storage.from(ASSET_BUCKET).remove([path]);
    }
    const providerError = asProviderError(error);
    await markRequestFailed(supabase, workspace.org.id, requestKey, providerError.code);
    return NextResponse.json({ error: providerError.code, message: providerError.message }, { status: providerError.status });
  }
}

async function markRequestFailed(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  requestKey: string,
  code: string,
) {
  await supabase
    .from('image_generation_requests')
    .update({ status: 'failed', error_code: code, updated_at: new Date().toISOString() })
    .eq('org_id', orgId)
    .eq('request_key', requestKey);
}

async function failRequest(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  requestKey: string,
  message: string,
  status: number,
) {
  await markRequestFailed(supabase, orgId, requestKey, 'server_error');
  return NextResponse.json({ error: message }, { status });
}
