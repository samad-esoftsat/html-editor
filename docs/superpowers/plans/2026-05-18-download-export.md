# Download Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two new export modes (offline HTML with embedded images, browser-print PDF) alongside the existing email-compatible HTML export, surfaced through a dropdown menu in the editor Topbar.

**Architecture:** A pure `embedImagesInHtml` helper using cheerio fetches and base64-inlines `<img>` URLs server-side (with SSRF guards, timeouts, and a size cap). The existing export route gains an `embed=1` mode. A new route handler at `/w/[slug]/p/[id]/print` returns the rendered email HTML with print CSS and an auto-`window.print()` script injected. A small popover `DownloadMenu` component replaces the current single-button anchor in the Topbar.

**Tech Stack:** Next.js 15 (App Router route handlers + server components), React 19, TypeScript, cheerio (already a dep), Vitest, Supabase server client for auth.

**Spec:** `docs/superpowers/specs/2026-05-18-download-export-design.md`

---

## File Structure

**New:**
- `src/lib/export/embedImages.ts` — pure helper: walks `<img>` tags via cheerio, fetches each unique remote URL, inlines as `data:` URI; returns `{ html, failures }`.
- `src/lib/export/buildPrintHtml.ts` — pure helper: takes rendered email HTML, injects print `<style>`, auto-print `<script>`, and the "no-print" toolbar into the document.
- `src/app/w/[slug]/p/[id]/print/route.ts` — GET handler that auths, loads project, calls `renderEmail` + `buildPrintHtml`, returns text/html.
- `src/components/editor/DownloadMenu.tsx` — popover with three anchors.
- `tests/unit/embedImages.test.ts` — unit tests for the embed helper (mocked fetch).
- `tests/unit/buildPrintHtml.test.ts` — unit tests for the print HTML builder.

**Modified:**
- `src/app/api/projects/[id]/export/route.ts` — read `?embed=1`, call `embedImagesInHtml`, change filename suffix and add `X-Embed-Failures` header.
- `src/components/editor/Topbar.tsx` — replace the existing `<a>...Download HTML</a>` with `<DownloadMenu projectId={projectId} slug={slug} />`.

---

## Task 1: SSRF guard helper

**Files:**
- Create: `src/lib/export/embedImages.ts` (partial — just the SSRF guard for now)
- Test: `tests/unit/embedImages.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/embedImages.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/unit/embedImages.test.ts`
Expected: FAIL — module `@/lib/export/embedImages` does not exist.

- [ ] **Step 3: Implement the SSRF guard**

Create `src/lib/export/embedImages.ts`:

```ts
export function isFetchableImageUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase();
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/unit/embedImages.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/export/embedImages.ts tests/unit/embedImages.test.ts
git commit -m "feat(export): add SSRF guard for embed-image fetches"
```

---

## Task 2: `embedImagesInHtml` — happy path with cheerio

**Files:**
- Modify: `src/lib/export/embedImages.ts`
- Modify: `tests/unit/embedImages.test.ts`

- [ ] **Step 1: Add new failing tests for the public API**

Append to `tests/unit/embedImages.test.ts`:

```ts
import { embedImagesInHtml } from '@/lib/export/embedImages';

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
    return new Response(entry.body, {
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
      return new Response(pngBytes(), { status: 200, headers: { 'content-type': 'image/png' } });
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
```

- [ ] **Step 2: Run new tests to verify they fail**

Run: `npm test -- tests/unit/embedImages.test.ts`
Expected: FAIL — `embedImagesInHtml` is not exported.

- [ ] **Step 3: Implement the embed helper**

Replace `src/lib/export/embedImages.ts` with (keeping the existing `isFetchableImageUrl`):

```ts
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
  const host = url.hostname.toLowerCase();
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
    const res = await fetchImpl(url, { signal: controller.signal });
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
```

- [ ] **Step 4: Run all tests in this file**

Run: `npm test -- tests/unit/embedImages.test.ts`
Expected: PASS — original 6 SSRF tests + 7 new embed tests = 13 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/export/embedImages.ts tests/unit/embedImages.test.ts
git commit -m "feat(export): embedImagesInHtml inlines remote images as data URIs"
```

---

## Task 3: Wire `?embed=1` into the export route

**Files:**
- Modify: `src/app/api/projects/[id]/export/route.ts`

- [ ] **Step 1: Read the current route**

Run: `cat src/app/api/projects/[id]/export/route.ts` to confirm the current shape (or open in an editor).

- [ ] **Step 2: Update the route**

Replace `src/app/api/projects/[id]/export/route.ts` with:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { renderEmail } from '@/lib/export/renderEmail';
import { embedImagesInHtml } from '@/lib/export/embedImages';
import type { ProjectData } from '@/lib/editor/types';

interface Ctx {
  params: Promise<{ id: string }>;
}

function slugify(name: string): string {
  const slug = (name || '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
  return slug || 'campaign';
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, data')
    .eq('id', id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const embed = req.nextUrl.searchParams.get('embed') === '1';
  let html = renderEmail(data.data as ProjectData);
  let failures = 0;
  if (embed) {
    const result = await embedImagesInHtml(html);
    html = result.html;
    failures = result.failures.length;
  }

  const slug = slugify(data.name as string);
  const filename = embed ? `${slug}-offline.html` : `${slug}.html`;

  const headers: Record<string, string> = {
    'content-type': 'text/html; charset=utf-8',
    'content-disposition': `attachment; filename="${filename}"`,
    'cache-control': 'no-store',
  };
  if (embed) headers['x-embed-failures'] = String(failures);

  return new NextResponse(html, { status: 200, headers });
}
```

- [ ] **Step 3: Typecheck and run the full test suite**

Run: `npm run typecheck && npm test`
Expected: clean typecheck, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/projects/[id]/export/route.ts
git commit -m "feat(export): export route supports ?embed=1 for offline HTML"
```

---

## Task 4: `buildPrintHtml` helper

**Files:**
- Create: `src/lib/export/buildPrintHtml.ts`
- Test: `tests/unit/buildPrintHtml.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/buildPrintHtml.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildPrintHtml } from '@/lib/export/buildPrintHtml';

const SAMPLE = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><p>hello</p></body></html>';

describe('buildPrintHtml', () => {
  it('injects an @page A4 style block into <head>', () => {
    const out = buildPrintHtml(SAMPLE);
    expect(out).toContain('@page { size: A4 portrait; margin: 12mm; }');
    expect(out.indexOf('@page')).toBeLessThan(out.indexOf('</head>'));
  });

  it('injects a window.print() script that fires on load', () => {
    const out = buildPrintHtml(SAMPLE);
    expect(out).toContain('window.print()');
    expect(out).toContain("addEventListener('load'");
  });

  it('injects a no-print toolbar with a Print button into <body>', () => {
    const out = buildPrintHtml(SAMPLE);
    expect(out).toContain('class="no-print"');
    expect(out).toContain('>Print / Save as PDF<');
  });

  it('hides .no-print elements in print media via injected CSS', () => {
    const out = buildPrintHtml(SAMPLE);
    expect(out).toMatch(/@media print[^}]*\.no-print[^}]*display:\s*none/);
  });

  it('leaves the original email body content intact', () => {
    const out = buildPrintHtml(SAMPLE);
    expect(out).toContain('<p>hello</p>');
  });

  it('throws if input has no </head>', () => {
    expect(() => buildPrintHtml('<html><body></body></html>')).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/unit/buildPrintHtml.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the builder**

Create `src/lib/export/buildPrintHtml.ts`:

```ts
const PRINT_STYLE = `<style>
@page { size: A4 portrait; margin: 12mm; }
@media print {
  body { background: white; }
  .no-print { display: none !important; }
}
.no-print {
  position: sticky;
  top: 0;
  z-index: 1000;
  background: #1f2937;
  color: white;
  padding: 8px 16px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}
.no-print button {
  background: #4f46e5;
  color: white;
  border: 0;
  border-radius: 4px;
  padding: 6px 12px;
  font-weight: 600;
  cursor: pointer;
}
.no-print button:hover { background: #4338ca; }
</style>`;

const PRINT_SCRIPT = `<script>
(function () {
  window.addEventListener('load', function () {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { window.print(); });
    });
  });
})();
</script>`;

const TOOLBAR = `<div class="no-print"><button type="button" onclick="window.print()">Print / Save as PDF</button></div>`;

export function buildPrintHtml(emailHtml: string): string {
  if (!emailHtml.includes('</head>')) {
    throw new Error('buildPrintHtml: input must contain a </head> tag');
  }
  const withHead = emailHtml.replace('</head>', `${PRINT_STYLE}${PRINT_SCRIPT}</head>`);
  // Insert toolbar as the first child of <body>. Match the opening <body ...> tag.
  return withHead.replace(/<body([^>]*)>/, (_match, attrs) => `<body${attrs}>${TOOLBAR}`);
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/unit/buildPrintHtml.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/export/buildPrintHtml.ts tests/unit/buildPrintHtml.test.ts
git commit -m "feat(export): buildPrintHtml injects print CSS, script, and toolbar"
```

---

## Task 5: Print route handler

**Files:**
- Create: `src/app/w/[slug]/p/[id]/print/route.ts`

- [ ] **Step 1: Create the handler**

Create `src/app/w/[slug]/p/[id]/print/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { findWorkspace } from '@/lib/auth/workspace';
import { renderEmail } from '@/lib/export/renderEmail';
import { buildPrintHtml } from '@/lib/export/buildPrintHtml';
import type { ProjectData } from '@/lib/editor/types';

interface Ctx {
  params: Promise<{ slug: string; id: string }>;
}

const NOT_FOUND_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>Not found</title></head><body style="font-family:sans-serif;padding:32px">Project not found.</body></html>`;

function notFoundResponse(): NextResponse {
  return new NextResponse(NOT_FOUND_HTML, {
    status: 404,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { slug, id } = await params;
  const workspace = await findWorkspace(slug);
  if (!workspace) return notFoundResponse();

  const supabase = await createClient();
  const { data } = await supabase
    .from('projects')
    .select('id, name, data')
    .eq('id', id)
    .eq('org_id', workspace.org.id)
    .maybeSingle();

  if (!data) return notFoundResponse();

  const emailHtml = renderEmail(data.data as ProjectData);
  const printHtml = buildPrintHtml(emailHtml);

  return new NextResponse(printHtml, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/w/[slug]/p/[id]/print/route.ts
git commit -m "feat(export): add /print route handler for PDF via browser print"
```

---

## Task 6: DownloadMenu component

**Files:**
- Create: `src/components/editor/DownloadMenu.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/editor/DownloadMenu.tsx`:

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { fade } from '@/lib/motion';

interface Props {
  projectId: string;
  slug: string;
}

export function DownloadMenu({ projectId, slug }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium bg-brand text-white shadow-sm shadow-brand/20 hover:bg-brand/90 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Download size={14} /> Download <ChevronDown size={14} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            variants={fade}
            initial="hidden"
            animate="show"
            exit="exit"
            className="absolute right-0 top-full mt-1 w-64 rounded-md border border-border-strong bg-panel shadow-lg shadow-black/30 overflow-hidden z-50"
            role="menu"
          >
            <a
              href={`/api/projects/${projectId}/export`}
              download
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm text-fg hover:bg-panel-2"
              role="menuitem"
            >
              <div className="font-medium">HTML (for email)</div>
              <div className="text-xs text-muted-2">Image URLs intact, smallest file.</div>
            </a>
            <a
              href={`/api/projects/${projectId}/export?embed=1`}
              download
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm text-fg hover:bg-panel-2 border-t border-border"
              role="menuitem"
            >
              <div className="font-medium">HTML (offline, with images)</div>
              <div className="text-xs text-muted-2">Self-contained, larger file.</div>
            </a>
            <a
              href={`/w/${slug}/p/${projectId}/print`}
              target="_blank"
              rel="noopener"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm text-fg hover:bg-panel-2 border-t border-border"
              role="menuitem"
            >
              <div className="font-medium">PDF (for printing)</div>
              <div className="text-xs text-muted-2">Opens print preview in a new tab.</div>
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/DownloadMenu.tsx
git commit -m "feat(editor): DownloadMenu popover with three export modes"
```

---

## Task 7: Mount DownloadMenu in Topbar

**Files:**
- Modify: `src/components/editor/Topbar.tsx`

- [ ] **Step 1: Replace the anchor with the menu**

In `src/components/editor/Topbar.tsx`:

1. Add to the imports section (after the existing `Workspace*` import):
   ```tsx
   import { DownloadMenu } from './DownloadMenu';
   ```

2. Replace the existing `<a href={\`/api/projects/${projectId}/export\`} download ...>...</a>` block (the entire "Download HTML" anchor at the bottom of the topbar) with:
   ```tsx
           <DownloadMenu projectId={projectId} slug={slug} />
   ```

3. Remove the `Download` import from `lucide-react` (it's no longer used in this file — `Loader2`, `Check`, `AlertCircle`, `ArrowLeft`, `Redo2`, `Undo2` are still needed; `Download` is not).

- [ ] **Step 2: Typecheck and run full test suite**

Run: `npm run typecheck && npm test`
Expected: clean typecheck, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/Topbar.tsx
git commit -m "feat(editor): swap Download HTML button for DownloadMenu"
```

---

## Task 8: Manual verification

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`. Open a project in the editor.

- [ ] **Step 2: HTML (for email)**

- Click Download → "HTML (for email)".
- Expected: downloads `<slug>.html` immediately. Open it — images load via URLs (need internet).

- [ ] **Step 3: HTML (offline, with images)**

- Click Download → "HTML (offline, with images)".
- Expected: a slightly longer pause (server fetches images), then `<slug>-offline.html` downloads.
- Disconnect WiFi, open the file. Images still appear because they're inline.
- Check response headers in DevTools: `X-Embed-Failures: 0` (or a small number).

- [ ] **Step 4: PDF (for printing)**

- Click Download → "PDF (for printing)".
- A new tab opens, displays the email styled for A4, and Chrome's print dialog opens automatically.
- Confirm A4 paper size is preselected. Choose "Save as PDF" and save.
- Open the PDF: all images present, layout matches the editor preview.
- Close the print dialog without printing; click the "Print / Save as PDF" button in the toolbar at the top of the page — the print dialog reopens.

- [ ] **Step 5: Broken image fallback**

- Edit a project to use a deliberately bad image URL (e.g. `https://example.invalid/missing.png`).
- Run the offline export again. Expected: file downloads with `X-Embed-Failures: 1`. The bad URL remains in the HTML (browser will show a broken image, but the rest of the export is fine).

- [ ] **Step 6: Unauthorized access**

- While logged in as a member of workspace A, manually visit `/w/<A-slug>/p/<B-project-id>/print` where project B is in workspace B.
- Expected: 404 page that says "Project not found."

- [ ] **Step 7: Menu UX**

- Click outside the open menu → menu closes.
- Press Escape with menu open → menu closes.
- Tab through the menu — buttons reachable, focusable.
