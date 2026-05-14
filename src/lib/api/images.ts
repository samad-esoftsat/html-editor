import { createRequestKey } from '@/lib/images/request-key';

export class ImageApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'ImageApiError';
    this.code = code;
    this.status = status;
  }
}

export interface GeneratedAsset {
  assetId: string;
  url: string;
  width: number | null;
  height: number | null;
}

export type GenerateImagePayload = {
  prompt: string;
  aspectRatio: '1:1' | '16:9' | '9:16' | '4:3';
  count: 1 | 2 | 4;
  workspaceSlug: string;
  requestKey?: string;
  referenceAssetIds?: string[];
  useGoogleSearch?: boolean;
  timeoutMs?: number;
};

function makeAbortSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
  controller.signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
  return controller.signal;
}

async function parseImageResponse<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ImageApiError(
      body.message ?? body.error ?? `http_${res.status}`,
      body.error ?? 'request_failed',
      res.status,
    );
  }
  return body as T;
}

export async function generateImage(payload: GenerateImagePayload): Promise<{ requestKey: string; assets: GeneratedAsset[] }> {
  const requestKey = payload.requestKey ?? createRequestKey();
  const res = await fetch('/api/images/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt: payload.prompt,
      aspectRatio: payload.aspectRatio,
      count: payload.count,
      workspaceSlug: payload.workspaceSlug,
      requestKey,
      referenceAssetIds: payload.referenceAssetIds ?? [],
      useGoogleSearch: payload.useGoogleSearch === true,
    }),
    signal: makeAbortSignal(payload.timeoutMs ?? 45000),
  });
  const assets = await parseImageResponse<GeneratedAsset[]>(res);
  return { requestKey, assets };
}

export type ChatEditWireTurn =
  | { role: 'user'; text: string }
  | { role: 'model'; assetId: string };

export async function chatEditImage(options: {
  turns: ChatEditWireTurn[];
  workspaceSlug: string;
  requestKey?: string;
  timeoutMs?: number;
}): Promise<{ requestKey: string; asset: GeneratedAsset }> {
  const requestKey = options.requestKey ?? createRequestKey();
  const res = await fetch('/api/images/chat-edit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      workspaceSlug: options.workspaceSlug,
      requestKey,
      turns: options.turns,
    }),
    signal: makeAbortSignal(options.timeoutMs ?? 45000),
  });
  const asset = await parseImageResponse<GeneratedAsset>(res);
  return { requestKey, asset };
}

export async function editImage(options: {
  image: File;
  mask: Blob;
  prompt: string;
  workspaceSlug: string;
  mode: 'inpaint' | 'remove_bg';
  requestKey?: string;
  timeoutMs?: number;
}): Promise<{ requestKey: string; asset: GeneratedAsset }> {
  const requestKey = options.requestKey ?? createRequestKey();
  const fd = new FormData();
  fd.append('image', options.image);
  fd.append('mask', new File([options.mask], 'mask.png', { type: 'image/png' }));
  fd.append('prompt', options.prompt);
  fd.append('workspaceSlug', options.workspaceSlug);
  fd.append('requestKey', requestKey);
  fd.append('mode', options.mode);

  const res = await fetch('/api/images/edit', {
    method: 'POST',
    body: fd,
    signal: makeAbortSignal(options.timeoutMs ?? 45000),
  });
  const asset = await parseImageResponse<GeneratedAsset>(res);
  return { requestKey, asset };
}
