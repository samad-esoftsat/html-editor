import { describe, expect, it } from 'vitest';
import { isFetchableImageUrl } from '@/lib/export/embedImages';
import { embedImagesInHtml } from '@/lib/export/embedImages';

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

  it('rejects IPv6 literals', () => {
    expect(isFetchableImageUrl('http://[::1]/x.png')).toBe(false);
    expect(isFetchableImageUrl('http://[::ffff:127.0.0.1]/x.png')).toBe(false);
    expect(isFetchableImageUrl('http://[fe80::1]/x.png')).toBe(false);
    expect(isFetchableImageUrl('http://[fc00::1]/x.png')).toBe(false);
    expect(isFetchableImageUrl('https://[2001:db8::1]/x.png')).toBe(false);
  });

  it('rejects hostnames with a trailing dot variant of localhost/127.x', () => {
    expect(isFetchableImageUrl('http://localhost./x.png')).toBe(false);
    expect(isFetchableImageUrl('http://127.0.0.1./x.png')).toBe(false);
  });
});

function pngBytes(): Uint8Array {
  // 1x1 transparent PNG
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
    0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x62, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
}

function makeFetch(map: Record<string, { body: Uint8Array; contentType?: string; status?: number }>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : input.url);
    const entry = map[url];
    if (!entry) return new Response('not found', { status: 404 });
    return new Response(entry.body as BodyInit, {
      status: entry.status ?? 200,
      headers: entry.contentType ? { 'content-type': entry.contentType } : undefined,
    });
  }) as typeof fetch;
}

describe('embedImagesInHtml', () => {
  it('returns input unchanged when there are no <img> tags', async () => {
    const html = '<!doctype html><html><body><p>hi</p></body></html>';
    const result = await embedImagesInHtml(html);
    expect(result.html).toBe(html);
    expect(result.failures).toEqual([]);
  });

  it('replaces a single <img src> with a data URI on success', async () => {
    const html = '<img src="https://example.com/a.png">';
    const fetchImpl = makeFetch({
      'https://example.com/a.png': { body: pngBytes(), contentType: 'image/png' },
    });
    const result = await embedImagesInHtml(html, fetchImpl);
    expect(result.html).toContain('src="data:image/png;base64,');
    expect(result.html).not.toContain('https://example.com/a.png');
    expect(result.failures).toEqual([]);
  });

  it('replaces duplicate URLs across multiple <img> tags with the same data URI, fetching once', async () => {
    const html = '<img src="https://example.com/a.png"><img src="https://example.com/a.png">';
    let calls = 0;
    const fetchImpl = (async (input: RequestInfo | URL) => {
      calls += 1;
      return new Response(pngBytes() as BodyInit, { status: 200, headers: { 'content-type': 'image/png' } });
    }) as typeof fetch;
    const result = await embedImagesInHtml(html, fetchImpl);
    expect(calls).toBe(1);
    const matches = result.html.match(/data:image\/png;base64,/g) ?? [];
    expect(matches.length).toBe(2);
  });

  it('keeps the original src when fetch fails (non-2xx)', async () => {
    const html = '<img src="https://example.com/a.png">';
    const fetchImpl = makeFetch({
      'https://example.com/a.png': { body: new Uint8Array(), status: 404 },
    });
    const result = await embedImagesInHtml(html, fetchImpl);
    expect(result.html).toContain('https://example.com/a.png');
    expect(result.html).not.toContain('data:image');
    expect(result.failures).toEqual(['https://example.com/a.png']);
  });

  it('leaves data: URIs alone and does not call fetch for them', async () => {
    const html = '<img src="data:image/png;base64,AAAA">';
    let called = false;
    const fetchImpl = (async () => { called = true; return new Response(); }) as typeof fetch;
    const result = await embedImagesInHtml(html, fetchImpl);
    expect(called).toBe(false);
    expect(result.html).toContain('data:image/png;base64,AAAA');
    expect(result.failures).toEqual([]);
  });

  it('keeps the original src for private hostnames without fetching', async () => {
    const html = '<img src="http://localhost/secret.png">';
    let called = false;
    const fetchImpl = (async () => { called = true; return new Response(); }) as typeof fetch;
    const result = await embedImagesInHtml(html, fetchImpl);
    expect(called).toBe(false);
    expect(result.html).toContain('http://localhost/secret.png');
    expect(result.failures).toEqual(['http://localhost/secret.png']);
  });

  it('falls back to image/jpeg when Content-Type is missing', async () => {
    const html = '<img src="https://example.com/a">';
    const fetchImpl = makeFetch({
      'https://example.com/a': { body: pngBytes() },
    });
    const result = await embedImagesInHtml(html, fetchImpl);
    expect(result.html).toContain('src="data:image/jpeg;base64,');
  });
});
