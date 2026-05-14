import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { findWorkspace, resolveMinRole } from '@/lib/auth/workspace';
import { ASSET_BUCKET, assetUrlFromPath, buildAssetPath } from '@/lib/images/assets';
import { asProviderError, ProviderError } from '@/lib/images/errors';
import { getImageProvider } from '@/lib/images';
import type { ChatTurn } from '@/lib/images/provider';
import { validateRequestKey } from '@/lib/images/request-key';
import { createClient } from '@/lib/supabase/server';

const MAX_TURNS = 20;
const REFERENCE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

type WireTurn =
  | { role: 'user'; text: string }
  | { role: 'model'; assetId: string };

type RequestRow = {
  org_id: string;
  request_key: string;
  created_by: string;
  kind: 'generate' | 'edit' | 'remove_bg';
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
    workspaceSlug?: unknown;
    requestKey?: unknown;
    turns?: unknown;
  };

  if (typeof body.workspaceSlug !== 'string' || !body.workspaceSlug) {
    return NextResponse.json({ error: 'invalid_workspace' }, { status: 400 });
  }
  if (typeof body.requestKey !== 'string') {
    return NextResponse.json({ error: 'invalid_request_key' }, { status: 400 });
  }

  const turns = parseTurns(body.turns);
  if (!turns) {
    return NextResponse.json({ error: 'invalid_turns' }, { status: 400 });
  }

  const workspace = await findWorkspace(body.workspaceSlug);
  if (!workspace) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!resolveMinRole(workspace.role, 'editor')) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const requestKey = validateRequestKey(body.requestKey);

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
        kind: 'edit',
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
    const providerTurns = await materializeTurns(supabase, workspace.org.id, turns);
    const provider = getImageProvider();
    const result = await provider.chatEdit({ turns: providerTurns });

    const id = randomUUID();
    path = buildAssetPath(workspace.org.id, id, result.mimeType);
    const { error: uploadError } = await supabase.storage
      .from(ASSET_BUCKET)
      .upload(path, result.bytes, { contentType: result.mimeType, upsert: false });
    if (uploadError) throw new Error(uploadError.message);

    const lastUserPrompt = [...turns].reverse().find((t) => t.role === 'user') as { role: 'user'; text: string } | undefined;
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
        prompt: lastUserPrompt?.text ?? null,
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

function parseTurns(raw: unknown): WireTurn[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length === 0 || raw.length > MAX_TURNS) return null;
  const turns: WireTurn[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null;
    const t = item as Record<string, unknown>;
    if (t.role === 'user') {
      if (typeof t.text !== 'string' || !t.text.trim()) return null;
      turns.push({ role: 'user', text: t.text.trim() });
    } else if (t.role === 'model') {
      if (typeof t.assetId !== 'string' || !t.assetId) return null;
      turns.push({ role: 'model', assetId: t.assetId });
    } else {
      return null;
    }
  }
  if (turns[turns.length - 1].role !== 'user') return null;
  return turns;
}

async function materializeTurns(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  turns: WireTurn[],
): Promise<ChatTurn[]> {
  const assetIds = Array.from(new Set(turns.filter((t) => t.role === 'model').map((t) => (t as { assetId: string }).assetId)));
  let assetsById = new Map<string, { id: string; storage_path: string; mime_type: string }>();
  if (assetIds.length > 0) {
    const { data: assets, error } = await supabase
      .from('assets')
      .select('id, storage_path, mime_type')
      .eq('org_id', orgId)
      .in('id', assetIds);
    if (error) throw new ProviderError(error.message, 500, 'reference_lookup_failed');
    if (!assets || assets.length !== assetIds.length) {
      throw new ProviderError('Conversation asset not found.', 404, 'reference_not_found');
    }
    assetsById = new Map(assets.map((a) => [a.id, a]));
  }

  const out: ChatTurn[] = [];
  for (const turn of turns) {
    if (turn.role === 'user') {
      out.push({ role: 'user', text: turn.text });
      continue;
    }
    const asset = assetsById.get(turn.assetId);
    if (!asset) throw new ProviderError('Conversation asset not found.', 404, 'reference_not_found');
    if (!REFERENCE_MIME_TYPES.has(asset.mime_type)) {
      throw new ProviderError('Conversation image type not supported.', 400, 'reference_invalid_type');
    }
    const { data: blob, error: downloadError } = await supabase.storage
      .from(ASSET_BUCKET)
      .download(asset.storage_path);
    if (downloadError || !blob) {
      throw new ProviderError(downloadError?.message ?? 'Reference download failed.', 500, 'reference_download_failed');
    }
    const bytes = Buffer.from(await blob.arrayBuffer());
    out.push({ role: 'model', image: { bytes, mimeType: asset.mime_type } });
  }
  return out;
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
