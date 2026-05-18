import * as cheerio from 'cheerio';

export interface EmbedResult {
  html: string;
  failures: string[];
}

const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 5_000;
const CONCURRENCY = 6;

export function isFetchableImageUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  let host = url.hostname.toLowerCase();
  if (host.startsWith('[')) return false;
  host = host.replace(/\.$/, '');
  if (host === 'localhost') return false;
  if (host.startsWith('127.')) return false;
  if (host.startsWith('10.')) return false;
  if (host.startsWith('192.168.')) return false;
  if (host.startsWith('169.254.')) return false;
  const m172 = host.match(/^172\.(\d+)\./);
  if (m172) {
    const second = Number(m172[1]);
    if (second >= 16 && second <= 31) return false;
  }
  return true;
}

async function fetchAsDataUri(url: string, fetchImpl: typeof fetch): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, { signal: controller.signal, redirect: 'error' });
    if (!res.ok) return null;
    const declared = res.headers.get('content-length');
    if (declared && Number(declared) > MAX_BYTES) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) return null;
    const mime = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim() || 'image/jpeg';
    const b64 = Buffer.from(buf).toString('base64');
    return `data:${mime};base64,${b64}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function embedImagesInHtml(html: string, fetchImpl: typeof fetch = fetch): Promise<EmbedResult> {
  // Short-circuit before invoking cheerio so the input is byte-identical when there is nothing to do.
  if (!/<img\b/i.test(html)) return { html, failures: [] };
  const $ = cheerio.load(html);
  const imgs = $('img');

  const urls = new Set<string>();
  imgs.each((_, el) => {
    const src = $(el).attr('src');
    if (src) urls.add(src);
  });

  const failures: string[] = [];
  const replacements = new Map<string, string>();

  const list = Array.from(urls);
  await mapWithConcurrency(list, CONCURRENCY, async (url) => {
    if (url.startsWith('data:')) return;
    if (!isFetchableImageUrl(url)) {
      failures.push(url);
      return;
    }
    const dataUri = await fetchAsDataUri(url, fetchImpl);
    if (dataUri) {
      replacements.set(url, dataUri);
    } else {
      failures.push(url);
    }
  });

  imgs.each((_, el) => {
    const src = $(el).attr('src');
    if (src && replacements.has(src)) {
      $(el).attr('src', replacements.get(src));
    }
  });

  return { html: $.html(), failures };
}
