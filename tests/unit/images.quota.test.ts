import { describe, expect, it } from 'vitest';
import { aspectRatioDimensions, buildAssetPath, extensionFromMimeType, getImageDimensions } from '@/lib/images/assets';

const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+yN7sAAAAASUVORK5CYII=',
  'base64',
);

describe('image asset helpers', () => {
  it('maps supported MIME types to storage extensions', () => {
    expect(extensionFromMimeType('image/png')).toBe('png');
    expect(extensionFromMimeType('image/jpeg')).toBe('jpg');
    expect(extensionFromMimeType('image/webp')).toBe('webp');
    expect(extensionFromMimeType('image/gif')).toBe('gif');
  });

  it('builds workspace asset paths under the assets prefix', () => {
    expect(buildAssetPath('org-1', 'asset-1', 'image/png')).toBe('org-1/assets/asset-1.png');
  });

  it('returns fallback dimensions for supported aspect ratios', () => {
    expect(aspectRatioDimensions('1:1')).toEqual({ width: 2048, height: 2048 });
    expect(aspectRatioDimensions('16:9')).toEqual({ width: 2752, height: 1536 });
  });

  it('extracts PNG dimensions when available', () => {
    expect(getImageDimensions(PNG_BYTES, 'image/png')).toEqual({ width: 1, height: 1 });
  });
});
