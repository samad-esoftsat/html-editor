import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { findWorkspace, resolveMinRole } from '@/lib/auth/workspace';
import { ASSET_BUCKET, assetUrlFromPath, buildAssetPath } from '@/lib/images/assets';
import { asProviderError, ProviderError } from '@/lib/images/errors';
import { getImageProvider } from '@/lib/images';
import type { AspectRatio, ReferenceImage } from '@/lib/images/provider';
import { validateRequestKey } from '@/lib/images/request-key';
import { createClient } from '@/lib/supabase/server';

const COUNTS = new Set([1, 2, 4]);
const RATIOS = new Set<AspectRatio>(['1:1', '4:3', '9:16', '16:9']);
const MAX_REFERENCES = 3;
const REFERENCE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

type RequestRow = {
  org_id: string;
  request_key: string;
  created_by: string;
  kind: 'generate';
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

  const body = (await req.json().catch(() => ({}))) as {
    prompt?: unknown;
    aspectRatio?: unknown;
    count?: unknown;
    workspaceSlug?: unknown;
    requestKey?: unknown;
    referenceAssetIds?: unknown;
    useGoogleSearch?: unknown;
  };

  if (typeof body.prompt !== 'string' || !body.prompt.trim()) {
    return NextResponse.json({ error: 'invalid_prompt' }, { status: 400 });
  }
  if (typeof body.workspaceSlug !== 'string' || !body.workspaceSlug) {
    return NextResponse.json({ error: 'invalid_workspace' }, { status: 400 });
  }
  if (typeof body.requestKey !== 'string') {
    return NextResponse.json({ error: 'invalid_request_key' }, { status: 400 });
  }
  if (typeof body.aspectRatio !== 'string' || !RATIOS.has(body.aspectRatio as AspectRatio)) {
    return NextResponse.json({ error: 'invalid_aspect_ratio' }, { status: 400 });
  }
  if (typeof body.count !== 'number' || !COUNTS.has(body.count)) {
    return NextResponse.json({ error: 'invalid_count' }, { status: 400 });
  }

  let referenceAssetIds: string[] = [];
  if (body.referenceAssetIds !== undefined && body.referenceAssetIds !== null) {
    if (!Array.isArray(body.referenceAssetIds) || !body.referenceAssetIds.every((v) => typeof v === 'string')) {
      return NextResponse.json({ error: 'invalid_reference_asset_ids' }, { status: 400 });
    }
    if (body.referenceAssetIds.length > MAX_REFERENCES) {
      return NextResponse.json({ error: 'too_many_references' }, { status: 400 });
    }
    referenceAssetIds = body.referenceAssetIds as string[];
  }

  const useGoogleSearch = body.useGoogleSearch === true;

  const workspace = await findWorkspace(body.workspaceSlug);
  if (!workspace) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!resolveMinRole(workspace.role, 'editor')) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const requestKey = validateRequestKey(body.requestKey);
  const count = body.count as 1 | 2 | 4;
  const aspectRatio = body.aspectRatio as AspectRatio;
  const prompt = body.prompt.trim();

  const { data: existingRequest, error: existingError } = await supabase
    .from('image_generation_requests')
    .select('*')
    .eq('org_id', workspace.org.id)
    .eq('request_key', requestKey)
    .maybeSingle<RequestRow>();
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });

  if (existingRequest?.status === 'completed' && existingRequest.asset_id) {
    const { data: assets, error: assetError } = await supabase
      .from('assets')
      .select('*')
      .eq('org_id', workspace.org.id)
      .eq('request_key', requestKey)
      .order('created_at', { ascending: true });
    if (assetError) return NextResponse.json({ error: assetError.message }, { status: 500 });
    return NextResponse.json((assets ?? []).map((asset) => ({
      assetId: asset.id,
      url: assetUrlFromPath(asset.storage_path),
      width: asset.width,
      height: asset.height,
    })));
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
        kind: 'generate',
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

  const generatedPaths: string[] = [];

  try {
    const references = await loadReferenceImages(supabase, workspace.org.id, referenceAssetIds);
    const provider = getImageProvider();
    const images = await provider.generate({ prompt, aspectRatio, count, references, useGoogleSearch });

    const results = [];
    for (const image of images) {
      const id = randomUUID();
      const path = buildAssetPath(workspace.org.id, id, image.mimeType);
      generatedPaths.push(path);

      const { error: uploadError } = await supabase.storage
        .from(ASSET_BUCKET)
        .upload(path, image.bytes, { contentType: image.mimeType, upsert: false });
      if (uploadError) throw new Error(uploadError.message);

      const { data: asset, error: assetError } = await supabase
        .from('assets')
        .insert({
          id,
          org_id: workspace.org.id,
          created_by: user.id,
          request_key: requestKey,
          storage_path: path,
          mime_type: image.mimeType,
          width: image.width,
          height: image.height,
          source: 'generate',
          prompt,
          provider: provider.name,
          alt_text: null,
          original_filename: null,
        })
        .select('*')
        .single();
      if (assetError) throw new Error(assetError.message);

      results.push(asset);
    }

    await supabase
      .from('image_generation_requests')
      .update({
        status: 'completed',
        asset_id: results[0]?.id ?? null,
        error_code: null,
        updated_at: new Date().toISOString(),
      })
      .eq('org_id', workspace.org.id)
      .eq('request_key', requestKey);

    return NextResponse.json(results.map((asset) => ({
      assetId: asset.id,
      url: assetUrlFromPath(asset.storage_path),
      width: asset.width,
      height: asset.height,
    })));
  } catch (error) {
    await supabase.rpc('refund_image_quota', { p_org_id: workspace.org.id });
    if (generatedPaths.length > 0) {
      await supabase.storage.from(ASSET_BUCKET).remove(generatedPaths);
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

async function loadReferenceImages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  assetIds: string[],
): Promise<ReferenceImage[]> {
  if (assetIds.length === 0) return [];

  const { data: assets, error } = await supabase
    .from('assets')
    .select('id, storage_path, mime_type')
    .eq('org_id', orgId)
    .in('id', assetIds);
  if (error) throw new ProviderError(error.message, 500, 'reference_lookup_failed');
  if (!assets || assets.length !== assetIds.length) {
    throw new ProviderError('Reference asset not found.', 404, 'reference_not_found');
  }

  const byId = new Map(assets.map((a) => [a.id, a]));
  const references: ReferenceImage[] = [];
  for (const id of assetIds) {
    const asset = byId.get(id);
    if (!asset) throw new ProviderError('Reference asset not found.', 404, 'reference_not_found');
    if (!REFERENCE_MIME_TYPES.has(asset.mime_type)) {
      throw new ProviderError('Reference image type not supported.', 400, 'reference_invalid_type');
    }
    const { data: blob, error: downloadError } = await supabase.storage
      .from(ASSET_BUCKET)
      .download(asset.storage_path);
    if (downloadError || !blob) {
      throw new ProviderError(downloadError?.message ?? 'Reference download failed.', 500, 'reference_download_failed');
    }
    const bytes = Buffer.from(await blob.arrayBuffer());
    references.push({ bytes, mimeType: asset.mime_type });
  }
  return references;
}
