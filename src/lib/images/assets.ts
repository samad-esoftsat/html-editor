import { createHash } from 'node:crypto';
import type { AspectRatio } from './provider';

export const ASSET_BUCKET = 'project-assets';

export interface AssetRow {
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
}

export interface AssetResponse extends AssetRow {
  url: string;
}

export interface ImageUsageSummary {
  count: number;
  limit: number;
  remaining: number;
  period: string;
}

const ASPECT_RATIO_DIMENSIONS: Record<AspectRatio, { width: number; height: number }> = {
  '1:1': { width: 2048, height: 2048 },
  '4:3': { width: 2400, height: 1792 },
  '9:16': { width: 1536, height: 2752 },
  '16:9': { width: 2752, height: 1536 },
};

export function buildAssetPath(orgId: string, id: string, mimeType: string): string {
  return `${orgId}/assets/${id}.${extensionFromMimeType(mimeType)}`;
}

export function extensionFromMimeType(mimeType: string): string {
  switch (mimeType) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    default:
      return 'bin';
  }
}

export function aspectRatioDimensions(aspectRatio: AspectRatio): { width: number; height: number } {
  return ASPECT_RATIO_DIMENSIONS[aspectRatio];
}

export function assetUrlFromPath(path: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) {
    return path;
  }
  const encoded = path
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
  return `${baseUrl}/storage/v1/object/public/${ASSET_BUCKET}/${encoded}`;
}

export function inferMimeType(buffer: Buffer): string {
  if (buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) return 'image/png';

  if (buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) return 'image/jpeg';

  if (buffer.length >= 6 && buffer.subarray(0, 6).toString('ascii') === 'GIF89a') return 'image/gif';
  if (buffer.length >= 6 && buffer.subarray(0, 6).toString('ascii') === 'GIF87a') return 'image/gif';

  if (buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) return 'image/webp';

  return 'application/octet-stream';
}

export function getImageDimensions(buffer: Buffer, mimeType: string): { width: number; height: number } | null {
  try {
    switch (mimeType) {
      case 'image/png':
        if (buffer.length >= 24) {
          return {
            width: buffer.readUInt32BE(16),
            height: buffer.readUInt32BE(20),
          };
        }
        return null;
      case 'image/gif':
        if (buffer.length >= 10) {
          return {
            width: buffer.readUInt16LE(6),
            height: buffer.readUInt16LE(8),
          };
        }
        return null;
      case 'image/jpeg':
        return parseJpegDimensions(buffer);
      case 'image/webp':
        return parseWebpDimensions(buffer);
      default:
        return null;
    }
  } catch {
    return null;
  }
}

function parseJpegDimensions(buffer: Buffer): { width: number; height: number } | null {
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (!marker || marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const size = buffer.readUInt16BE(offset + 2);
    if (size < 2) return null;
    if (
      marker === 0xc0 ||
      marker === 0xc1 ||
      marker === 0xc2 ||
      marker === 0xc3 ||
      marker === 0xc5 ||
      marker === 0xc6 ||
      marker === 0xc7 ||
      marker === 0xc9 ||
      marker === 0xca ||
      marker === 0xcb ||
      marker === 0xcd ||
      marker === 0xce ||
      marker === 0xcf
    ) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + size;
  }
  return null;
}

function parseWebpDimensions(buffer: Buffer): { width: number; height: number } | null {
  const chunk = buffer.subarray(12, 16).toString('ascii');
  if (chunk === 'VP8X' && buffer.length >= 30) {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }
  if (chunk === 'VP8 ' && buffer.length >= 30) {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }
  if (chunk === 'VP8L' && buffer.length >= 25) {
    const b0 = buffer[21];
    const b1 = buffer[22];
    const b2 = buffer[23];
    const b3 = buffer[24];
    return {
      width: 1 + (((b1 & 0x3f) << 8) | b0),
      height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
    };
  }
  return null;
}

export function startOfCurrentUtcMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

export function storagePathFromPublicUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const marker = `/storage/v1/object/public/${ASSET_BUCKET}/`;
    const index = parsed.pathname.indexOf(marker);
    if (index === -1) return null;
    const encoded = parsed.pathname.slice(index + marker.length);
    if (!encoded) return null;
    return encoded
      .split('/')
      .map((part) => decodeURIComponent(part))
      .join('/');
  } catch {
    return null;
  }
}

export function filenameFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    const last = parts.at(-1);
    return last ? decodeURIComponent(last) : null;
  } catch {
    return null;
  }
}

export function extensionFromUrl(url: string): string | null {
  const filename = filenameFromUrl(url);
  if (!filename) return null;
  const match = filename.match(/\.([A-Za-z0-9]+)$/);
  return match ? match[1].toLowerCase() : null;
}

export function legacyExternalAssetPath(orgId: string, url: string, mimeType?: string | null): string {
  const ext = mimeType
    ? extensionFromMimeType(mimeType)
    : extensionFromUrl(url) ?? 'bin';
  const digest = createHash('sha256').update(url).digest('hex').slice(0, 24);
  return `${orgId}/assets/legacy-${digest}.${ext}`;
}
