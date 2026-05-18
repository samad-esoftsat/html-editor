# Download Export — HTML / Offline HTML / PDF

**Date:** 2026-05-18
**Status:** Approved for implementation

## Problem

The editor today only exports email-compatible HTML with image URLs intact. Users want:

1. A printable A4 PDF that preserves all images.
2. A self-contained HTML they can share or print offline.

Server-side PDF tools they tried lost the images because the renderer couldn't fetch the remote URLs. Image hosting is Supabase Storage (`project-assets` bucket) plus a few remote social icons (`app-rsrc.getbee.io`).

## Goals

- Add two new download modes alongside the existing one, surfaced from the editor's Topbar.
- PDF generation that preserves images, with A4 fidelity.
- Self-contained offline HTML with images embedded as base64 `data:` URIs.
- No new server runtime dependencies.

## Non-goals

- Server-side headless Chromium / Puppeteer.
- ZIP exports.
- Print-specific styling beyond setting paper size (CTA buttons and links render the same as on screen).
- Server-side caching of embedded image bytes (exports are infrequent).
- Toast UI for embed failures (info carried by an HTTP header for now).

## UX

The existing single "Download HTML" button in `src/components/editor/Topbar.tsx` becomes a dropdown labeled **Download** with three items:

1. **HTML (for email)** — current behavior. Email-compatible, smallest file, image URLs intact.
2. **HTML (offline, with images)** — server fetches every `<img>` URL and inlines as `data:` URI. Single self-contained file.
3. **PDF (for printing)** — opens a new tab styled for A4 and auto-triggers the browser's print dialog. User picks "Save as PDF."

Each item is a plain link (the menu is just a popover of anchors). No additional toasts, modals, or progress UI in v1.

## Architecture

### New files

- `src/lib/export/embedImages.ts` — pure helper:
  ```ts
  export interface EmbedResult { html: string; failures: string[] }
  export async function embedImagesInHtml(html: string, fetchImpl?: typeof fetch): Promise<EmbedResult>;
  ```
  - Parses HTML with cheerio (already a project dependency).
  - Collects unique `<img src="...">` URLs.
  - For each URL: fetches with a 5s timeout, rejects if the response exceeds 5MB, base64-encodes the bytes, replaces the src with `data:<mime>;base64,...`.
  - Mime detection from `Content-Type` header; fallback `image/jpeg` if missing.
  - Concurrency cap: 6 parallel fetches.
  - SSRF guard: only `http:` / `https:` schemes; reject hostnames that match `localhost`, or that start with `127.`, `10.`, `192.168.`, `169.254.`, or `172.{16-31}.`.
  - On any per-image failure: leaves the original URL in the HTML, appends the URL to `failures[]`.

- `src/app/w/[slug]/p/[id]/print/route.ts` — Next route handler (GET):
  - Auth via `createClient` (must be a workspace member for the project's org). On unauthorized / missing: return 404 with a tiny HTML page saying "Project not found."
  - Loads the project, renders the email via `renderEmail(data)`.
  - Injects two snippets into the rendered HTML before responding:
    - A `<style>` block with `@page { size: A4 portrait; margin: 12mm; }` and `@media print { body { background: white; } .no-print { display: none !important; } }`.
    - A `<script>` that runs once on `window.load`, waits two animation frames, then calls `window.print()`. This lets images start loading before the print dialog opens.
    - A small `.no-print` toolbar at the top of the body with a single "Print / Save as PDF" button that calls `window.print()` (so the user can re-trigger if needed). The toolbar uses inline styles so we don't depend on Tailwind in the standalone HTML.
  - Returns `text/html; charset=utf-8` with `Cache-Control: no-store`. No `Content-Disposition` — this renders inline, not as a download.

- `src/components/editor/DownloadMenu.tsx` — client component:
  - Small button that opens a popover menu with three anchors:
    - `<a href="/api/projects/{id}/export" download>HTML (for email)</a>`
    - `<a href="/api/projects/{id}/export?embed=1" download>HTML (offline, with images)</a>`
    - `<a href="/w/{slug}/p/{id}/print" target="_blank" rel="noopener">PDF (for printing)</a>`
  - Visual matches the existing primary-button styling for parity with the current button.
  - Closes on outside click and Escape.
  - Receives `projectId` and `slug` as props.

### Modified files

- `src/app/api/projects/[id]/export/route.ts`:
  - Read `?embed` from the URL. When `embed=1`, call `embedImagesInHtml(html)` before responding.
  - In embed mode, the filename gets a `-offline` suffix: `campaign-offline.html`.
  - In embed mode, set response header `X-Embed-Failures: <count>` (zero or positive integer).

- `src/components/editor/Topbar.tsx`:
  - Replace the existing `<a href="/api/projects/{projectId}/export" download>...</a>` with `<DownloadMenu projectId={projectId} slug={slug} />`.
  - `slug` is already available as a prop on the Topbar.

## Data flow

**HTML (email)** — unchanged.

**HTML (offline)**:
1. Click the menu item → browser opens `GET /api/projects/[id]/export?embed=1`.
2. Server loads project, renders email HTML, calls `embedImagesInHtml`.
3. Helper fetches each unique image URL (parallel, capped), inlines successes, leaves failures as URLs.
4. Server responds with `Content-Disposition: attachment; filename="<slug>-offline.html"` and `X-Embed-Failures` header.
5. Browser downloads the file with its own progress UI.

**PDF (print)**:
1. Click the menu item → new tab at `/w/[slug]/p/[id]/print`.
2. Route handler loads project, renders email, injects print `<style>` + auto-print `<script>` + toolbar.
3. Browser loads the standalone HTML page and fetches images via normal `<img src>` semantics.
4. After `load`, the injected script calls `window.print()` once.
5. User picks "Save as PDF" in the native dialog. A4 is preset via `@page`.
6. If the user dismisses the auto-prompt, the "Print / Save as PDF" toolbar button is still available.

## Print CSS

Only what's necessary:

```css
@page { size: A4 portrait; margin: 12mm; }
@media print {
  body { background: white; }
  .no-print { display: none !important; }
}
```

No restyling of CTA buttons, links, or hover states. The email renders the same way it does on screen.

## Security

- SSRF: `embedImagesInHtml` only follows `http(s):` and rejects private/loopback hostnames before issuing the fetch. Image URLs in project data are user-supplied (via uploads or arbitrary URL fields), so this matters.
- Auth: print page uses the same `createClient` server-side check as other project pages. RLS handles unauthorized access (a non-member sees a 404).
- Per-image timeout (5s) and size cap (5MB) prevent slow or malicious endpoints from stalling the export.

## Errors

- Project not found / unauthorized on export route — existing 404/401 behavior unchanged.
- `embedImagesInHtml` is best-effort: never throws on per-image failure. A failed fetch leaves the URL in place. If the entire HTML render fails (shouldn't happen but defensively), return 500 like the existing route.
- Print route handler: if project is missing, return 404 with a minimal HTML body ("Project not found.").

## Testing

Unit (Vitest):

- `embedImagesInHtml`:
  - No `<img>` tags → returns input unchanged, no failures.
  - One `<img>`, fetch returns PNG bytes + `Content-Type: image/png` → src becomes `data:image/png;base64,...`.
  - Multiple `<img>`, mix of success and failure → embedded sources replaced, failed URLs untouched, failures array contains the failed URL.
  - Oversize response (Content-Length > 5MB or accumulated bytes exceed cap) → URL kept.
  - Timeout (mock that never resolves) → URL kept after 5s.
  - Non-http(s) scheme (e.g. `file://`, `data:`) → URL kept, no fetch attempted. (data URIs left alone — they're already inline.)
  - Private hostname (`127.0.0.1`, `localhost`, `10.x.x.x`) → URL kept, no fetch attempted.
  - Duplicate URLs across `<img>` tags → fetched once, replaced everywhere.

Manual:

- All three menu items work.
- Offline HTML opens correctly with WiFi turned off; images render.
- Print preview shows A4-sized output; saving as PDF produces a file with all images.
- One broken image URL in the source data doesn't break either export.

## Out of scope

- Customizing the PDF (cover page, page breaks per section, header/footer).
- Multi-page print layouts beyond what the browser naturally produces.
- Persisting export history.
- Async export with email-on-completion.
