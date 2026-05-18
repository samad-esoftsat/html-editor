import { describe, expect, it } from 'vitest';
import { isFetchableImageUrl } from '@/lib/export/embedImages';

describe('isFetchableImageUrl', () => {
  it('accepts public https URLs', () => {
    expect(isFetchableImageUrl('https://example.com/a.png')).toBe(true);
    expect(isFetchableImageUrl('http://cdn.example.org/x.jpg')).toBe(true);
  });

  it('rejects data: URIs (already inline)', () => {
    expect(isFetchableImageUrl('data:image/png;base64,abc')).toBe(false);
  });

  it('rejects non-http schemes', () => {
    expect(isFetchableImageUrl('file:///etc/passwd')).toBe(false);
    expect(isFetchableImageUrl('ftp://example.com/x.png')).toBe(false);
    expect(isFetchableImageUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects loopback and private hostnames', () => {
    expect(isFetchableImageUrl('http://localhost/x.png')).toBe(false);
    expect(isFetchableImageUrl('http://127.0.0.1/x.png')).toBe(false);
    expect(isFetchableImageUrl('http://10.0.0.1/x.png')).toBe(false);
    expect(isFetchableImageUrl('http://192.168.1.5/x.png')).toBe(false);
    expect(isFetchableImageUrl('http://169.254.169.254/meta')).toBe(false);
    expect(isFetchableImageUrl('http://172.16.0.1/x.png')).toBe(false);
    expect(isFetchableImageUrl('http://172.31.255.255/x.png')).toBe(false);
  });

  it('accepts non-private 172.x addresses', () => {
    expect(isFetchableImageUrl('http://172.15.0.1/x.png')).toBe(true);
    expect(isFetchableImageUrl('http://172.32.0.1/x.png')).toBe(true);
  });

  it('rejects invalid URLs', () => {
    expect(isFetchableImageUrl('not a url')).toBe(false);
    expect(isFetchableImageUrl('')).toBe(false);
  });
});
