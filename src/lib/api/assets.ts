export interface WorkspaceAsset {
  id: string;
  org_id: string;
  created_by: string;
  request_key: string | null;
  storage_path: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  source: 'upload' | 'generate' | 'edit';
  prompt: string | null;
  provider: string | null;
  alt_text: string | null;
  original_filename: string | null;
  archived_at: string | null;
  created_at: string;
  url: string;
}

export interface AssetUsage {
  count: number;
  limit: number;
  remaining: number;
  period: string;
}

export interface ListWorkspaceAssetsResponse {
  assets: WorkspaceAsset[];
  usage: AssetUsage;
}

async function parseError(res: Response): Promise<Error> {
  const body = await res.json().catch(() => ({}));
  return Object.assign(new Error(body.message ?? body.error ?? `http_${res.status}`), {
    code: body.error ?? 'request_failed',
    status: res.status,
  });
}

export async function listWorkspaceAssets(
  slug: string,
  options?: { q?: string; includeArchived?: boolean },
): Promise<ListWorkspaceAssetsResponse> {
  const params = new URLSearchParams();
  if (options?.q) params.set('q', options.q);
  if (options?.includeArchived) params.set('includeArchived', 'true');
  const qs = params.toString();
  const res = await fetch(`/api/workspaces/${slug}/assets${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function archiveWorkspaceAsset(slug: string, assetId: string): Promise<{ asset: WorkspaceAsset }> {
  const res = await fetch(`/api/workspaces/${slug}/assets/${assetId}`, { method: 'PATCH' });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function uploadWorkspaceAsset(
  slug: string,
  file: File,
  altText?: string,
): Promise<{ assetId: string; url: string; width: number | null; height: number | null; originalFilename: string | null }> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('workspaceSlug', slug);
  if (altText?.trim()) fd.append('altText', altText.trim());
  const res = await fetch('/api/workspace-assets/upload', { method: 'POST', body: fd });
  if (!res.ok) throw await parseError(res);
  return res.json();
}
