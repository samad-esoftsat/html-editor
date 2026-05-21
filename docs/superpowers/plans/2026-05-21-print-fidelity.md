# Print + Edit-Mode Fidelity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix PDF pagination (header + footer in @page margin boxes via PagedJS) and audit + repair edit-mode visual fidelity so the canvas matches preview output.

**Architecture:** A new `renderPrintDocument(data)` produces a self-contained print-optimized HTML document with header and footer in `position: running()` named regions; `buildPrintHtml(data)` wraps it with the vendored PagedJS polyfill + auto-print toolbar; the existing `/print` route calls the new wrapper. Independently, six edit-only affordances are moved out of normal flow (absolute positioning, opacity-reveal on hover) so the canvas always renders at preview dimensions.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, React, vitest, jsdom, PagedJS (vendored polyfill).

**Spec reference:** `docs/superpowers/specs/2026-05-21-print-fidelity-design.md` (commit `487a82c`).

---

## File Structure

**New files (create):**

- `public/vendor/paged.polyfill.js` — vendored PagedJS bundle (binary asset)
- `public/vendor/paged.polyfill.LICENSE.txt` — license attribution
- `src/lib/export/renderPrintDocument.ts` — pure render: `ProjectData → HTML document` for paged printing
- `src/lib/export/__fixtures__/print-baseline-blank.html` — snapshot baseline
- `src/lib/export/__fixtures__/print-baseline-globaltt.html` — snapshot baseline
- `src/lib/export/__fixtures__/print-baseline-newsletter.html` — snapshot baseline
- `src/lib/export/__fixtures__/print-baseline-announcement.html` — snapshot baseline
- `src/lib/export/__fixtures__/print-baseline-event-invite.html` — snapshot baseline
- `tests/unit/renderPrintDocument.test.ts` — unit tests
- `src/lib/export/renderPrintDocument.snapshot.test.ts` — snapshot parity tests
- `tests/unit/EditModeFidelity.test.tsx` — bounding-box invariants between edit and preview modes

**Files to modify:**

- `src/lib/export/buildPrintHtml.ts` — signature changes to `(data: ProjectData) => string`; calls renderPrintDocument
- `src/app/w/[slug]/p/[id]/print/route.ts` — call site update
- `tests/unit/buildPrintHtml.test.ts` — assertions updated for new signature + PagedJS injection
- `scripts/capture-render-baseline.ts` — also captures print baselines
- `src/components/editor/editable/EditableBulletList.tsx` — bullet-grip out of flow; unified `<ul>` padding
- `src/components/editor/editable/EditableLink.tsx` — wrap in a `position: absolute` container revealed on hover
- `src/components/editor/blocks/ProductSectionView.tsx` — add `position: relative` and a `.cta-button` class to the CTA `<a>` (anchor for the absolute EditableLink)
- `src/components/editor/blocks/HeroBlockView.tsx` — same CTA-wrap update
- `src/components/editor/blocks/ArticleView.tsx` — same CTA-wrap update
- `src/components/editor/blocks/CTABannerView.tsx` — same CTA-wrap update
- `src/components/editor/canvas/SectionInsertBar.tsx` — zero-flow-height shell + absolute visible bar + hit region
- `src/components/editor/editable/EditableImage.tsx` — alt-text overlay becomes absolute
- `src/app/globals.css` — CSS rules for new positioning patterns
- `.gitattributes` — register `paged.polyfill.js` as a binary file

**Tasks T1–T15 below; each ends in a commit.**

---

## Task 1: Vendor the PagedJS polyfill

**Files:**
- Create: `public/vendor/paged.polyfill.js`
- Create: `public/vendor/paged.polyfill.LICENSE.txt`
- Modify: `.gitattributes`

- [ ] **Step 1: Download the PagedJS UMD bundle to `public/vendor/`**

PagedJS publishes a UMD distribution suitable for direct `<script>` usage. Pin to version `0.4.3` (current stable as of May 2026):

```bash
mkdir -p public/vendor
curl -L -o public/vendor/paged.polyfill.js "https://unpkg.com/pagedjs@0.4.3/dist/paged.polyfill.js"
curl -L -o public/vendor/paged.polyfill.LICENSE.txt "https://raw.githubusercontent.com/pagedjs/pagedjs/v0.4.3/LICENSE.md"
```

If `curl` is unavailable, use `Invoke-WebRequest` (PowerShell) or download manually from the URLs above and save into `public/vendor/`.

Verify the file is present and non-empty:

```bash
ls -lh public/vendor/paged.polyfill.js
```

Expected: file exists, size between 100KB and 200KB (UMD bundle).

- [ ] **Step 2: Append a binary marker to `.gitattributes`**

The repo root has `.gitattributes`. Read it first to check the current contents. Then append:

```
public/vendor/paged.polyfill.js binary
public/vendor/paged.polyfill.LICENSE.txt text eol=lf
```

The `binary` flag suppresses any CRLF/LF normalization (and any diff noise) for the vendored bundle.

- [ ] **Step 3: Sanity-check the bundle**

Confirm the bundle exports the expected globals by grepping its content:

```bash
grep -o "PagedConfig\|class Previewer\|Polyfill" public/vendor/paged.polyfill.js | head -5
```

Expected output includes at least one match for `PagedConfig` or `Previewer` — confirms this is a real PagedJS bundle.

- [ ] **Step 4: Commit**

```bash
git add public/vendor/paged.polyfill.js public/vendor/paged.polyfill.LICENSE.txt .gitattributes
git commit -m "chore: vendor PagedJS 0.4.3 polyfill bundle"
```

---

## Task 2: renderPrintDocument scaffold + head + structural tests

**Files:**
- Create: `src/lib/export/renderPrintDocument.ts`
- Create: `tests/unit/renderPrintDocument.test.ts`

- [ ] **Step 1: Write failing structural tests**

Create `tests/unit/renderPrintDocument.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { renderPrintDocument } from '@/lib/export/renderPrintDocument';
import { createDefaultProject } from '@/lib/editor/defaultProject';
import { createBlankProject } from '@/lib/editor/templates';

describe('renderPrintDocument — document structure', () => {
  it('returns a string starting with <!doctype html>', () => {
    const html = renderPrintDocument(createDefaultProject());
    expect(html.startsWith('<!doctype html>')).toBe(true);
  });

  it('closes with </html>', () => {
    const html = renderPrintDocument(createDefaultProject());
    expect(html.trimEnd().endsWith('</html>')).toBe(true);
  });

  it('declares lang="en" on <html>', () => {
    const html = renderPrintDocument(createDefaultProject());
    expect(html).toMatch(/<html[^>]*lang="en"/);
  });

  it('has <head> with charset utf-8 and viewport meta', () => {
    const html = renderPrintDocument(createDefaultProject());
    expect(html).toMatch(/<meta charset="utf-8"/i);
    expect(html).toMatch(/<meta name="viewport"/i);
  });

  it('includes @page rule with @top-center and @bottom-center', () => {
    const html = renderPrintDocument(createDefaultProject());
    expect(html).toContain('@page');
    expect(html).toContain('@top-center');
    expect(html).toContain('@bottom-center');
  });

  it('declares .running-header with position: running(header-region)', () => {
    const html = renderPrintDocument(createDefaultProject());
    expect(html).toMatch(/\.running-header\s*\{[^}]*position:\s*running\(header-region\)/);
  });

  it('declares .running-footer with position: running(footer-region)', () => {
    const html = renderPrintDocument(createDefaultProject());
    expect(html).toMatch(/\.running-footer\s*\{[^}]*position:\s*running\(footer-region\)/);
  });

  it('declares .print-block with break-inside: avoid', () => {
    const html = renderPrintDocument(createDefaultProject());
    expect(html).toMatch(/\.print-block\s*\{[^}]*break-inside:\s*avoid/);
  });

  it('body contains a .running-header div and a .running-footer div', () => {
    const html = renderPrintDocument(createDefaultProject());
    expect(html).toMatch(/<div class="running-header">/);
    expect(html).toMatch(/<div class="running-footer">/);
  });

  it('body contains a <main> element', () => {
    const html = renderPrintDocument(createDefaultProject());
    expect(html).toContain('<main>');
    expect(html).toContain('</main>');
  });

  it('the blank template (empty content) still produces a valid document', () => {
    const html = renderPrintDocument(createBlankProject());
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html.trimEnd().endsWith('</html>')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderPrintDocument.test.ts`
Expected: FAIL — module `@/lib/export/renderPrintDocument` does not exist.

- [ ] **Step 3: Create `src/lib/export/renderPrintDocument.ts` (scaffold only)**

```ts
import type { ProjectData } from '@/lib/editor/types';
import { attrEscape } from './escape';

const PRINT_CSS = `
@page {
  size: A4 portrait;
  margin: 32mm 12mm 32mm 12mm;
  @top-center    { content: element(header-region); }
  @bottom-center { content: element(footer-region); }
}

* { box-sizing: border-box; }
body { margin: 0; padding: 0; }

.running-header { position: running(header-region); }
.running-footer { position: running(footer-region); }
.running-header, .running-footer { display: none; }

.print-block {
  break-inside: avoid;
  page-break-inside: avoid;
  margin: 0 auto;
  max-width: 710px;
}

main { width: 100%; }
`.trim();

function renderHead(data: ProjectData): string {
  const family = attrEscape(data.global.fontFamily);
  return `<head>
<title>Print preview</title>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
${PRINT_CSS}
body { font-family: ${family}; font-size: ${data.global.baseFontSize}px; color: ${attrEscape(data.global.textColor)}; background: ${attrEscape(data.global.backgroundColor)}; }
</style>
</head>`;
}

export function renderPrintDocument(data: ProjectData): string {
  return `<!doctype html>
<html lang="en">
${renderHead(data)}
<body>
<div class="running-header"></div>
<div class="running-footer"></div>
<main>
</main>
</body>
</html>`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/renderPrintDocument.test.ts`
Expected: ALL PASS.

Also run `npx tsc --noEmit`. Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/export/renderPrintDocument.ts tests/unit/renderPrintDocument.test.ts
git commit -m "feat(export): renderPrintDocument scaffold with @page + running-region CSS"
```

---

## Task 3: Header + Footer print render functions

**Files:**
- Modify: `src/lib/export/renderPrintDocument.ts`
- Modify: `tests/unit/renderPrintDocument.test.ts`

- [ ] **Step 1: Append failing tests**

Append to `tests/unit/renderPrintDocument.test.ts`:

```ts
describe('renderPrintDocument — header and footer content', () => {
  it('running-header div contains the header logo image', () => {
    const html = renderPrintDocument(createDefaultProject());
    expect(html).toContain('https://36af7d465b.imgdist.com/pub/bfra/wpnsx7uw/j2q/4ah/ptb/logo%20%282%29.png');
  });

  it('running-header div contains the header title', () => {
    const html = renderPrintDocument(createDefaultProject());
    expect(html).toContain('Critical communication');
  });

  it('running-header div contains the section heading', () => {
    const html = renderPrintDocument(createDefaultProject());
    expect(html).toContain('Satellite High Throughput Connectivity');
  });

  it('running-footer div contains the company name', () => {
    const html = renderPrintDocument(createDefaultProject());
    expect(html).toContain('GlobalTT Satellite Teleport');
  });

  it('running-footer div contains the email link', () => {
    const html = renderPrintDocument(createDefaultProject());
    expect(html).toContain('mailto:info@globaltt.com');
  });

  it('escapes XSS in header title', () => {
    const data = createDefaultProject();
    const header = data.blocks[0];
    if (header.type !== 'header') throw new Error('expected header');
    header.title = '<script>alert(1)</script>';
    const html = renderPrintDocument(data);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `npx vitest run tests/unit/renderPrintDocument.test.ts -t "header and footer content"`
Expected: FAIL — the running-header and running-footer divs are empty.

- [ ] **Step 3: Add header and footer render functions to `src/lib/export/renderPrintDocument.ts`**

Update the file. Add imports at the top:

```ts
import type { HeaderBlock, FooterBlock, ProjectData, SocialPlatform } from '@/lib/editor/types';
import { findHeader, findFooter } from '@/lib/editor/blocks';
import { attrEscape, htmlEscape, urlSafe } from './escape';
```

Add the SOCIAL_ICON map (copy-paste from `renderEmail.ts` — same icon URLs):

```ts
const SOCIAL_ICON: Record<SocialPlatform, { url: string; alt: string }> = {
  facebook: { url: 'https://app-rsrc.getbee.io/public/resources/social-networks-icon-sets/circle-color/facebook@2x.png', alt: 'Facebook' },
  linkedin: { url: 'https://app-rsrc.getbee.io/public/resources/social-networks-icon-sets/circle-color/linkedin@2x.png', alt: 'LinkedIn' },
  twitter: { url: 'https://app-rsrc.getbee.io/public/resources/social-networks-icon-sets/circle-color/twitter@2x.png', alt: 'Twitter' },
  youtube: { url: 'https://app-rsrc.getbee.io/public/resources/social-networks-icon-sets/circle-color/youtube@2x.png', alt: 'YouTube' },
  instagram: { url: 'https://app-rsrc.getbee.io/public/resources/social-networks-icon-sets/circle-color/instagram@2x.png', alt: 'Instagram' },
};
```

Add the render functions before `renderPrintDocument`:

```ts
function renderHeaderForPrint(header: HeaderBlock, data: ProjectData): string {
  const logoSrc = urlSafe(header.logoSrc);
  const bannerSrc = urlSafe(header.bannerSrc);
  const contactUrl = urlSafe(data.global.contactUrl);
  const logoWidth = Math.min(header.logoWidth, 600);

  const logo = logoSrc
    ? `<a href="${attrEscape(contactUrl)}" target="_blank"><img src="${attrEscape(logoSrc)}" alt="${attrEscape(header.logoAlt)}" width="${logoWidth}" style="display: block; max-width: 100%; height: auto; margin: 0 auto;"></a>`
    : '';
  const title = header.title
    ? `<div style="text-align: center; padding: 6px 0; font-size: ${header.titleFontSize}px; font-weight: bold;">${htmlEscape(header.title)}</div>`
    : '';
  const banner = bannerSrc
    ? `<img src="${attrEscape(bannerSrc)}" alt="${attrEscape(header.bannerAlt)}" style="display: block; max-width: 100%; height: auto; margin: 4px auto;">`
    : '';
  const sectionHeading = header.sectionHeading
    ? `<div style="text-align: center; padding: 6px 0; font-size: ${header.sectionHeadingFontSize}px; font-weight: bold;">${htmlEscape(header.sectionHeading)}</div>`
    : '';

  return `<div class="print-header" style="text-align: center; max-width: 710px; margin: 0 auto;">${logo}${title}${banner}${sectionHeading}</div>`;
}

function renderFooterForPrint(footer: FooterBlock, data: ProjectData): string {
  const bg = footer.backgroundColor ?? data.global.footerBackgroundColor;
  const fg = footer.textColor ?? data.global.footerTextColor;
  const bannerSrc = urlSafe(footer.bannerSrc);

  const banner = bannerSrc
    ? `<img src="${attrEscape(bannerSrc)}" alt="${attrEscape(footer.bannerAlt)}" style="display: block; max-width: 100%; height: auto; margin: 0 auto 6px;">`
    : '';
  const address = (footer.address || '')
    .split('\n')
    .map((line) => `<div style="margin: 0; color: ${attrEscape(fg)};">${htmlEscape(line)}</div>`)
    .join('');
  const phone = footer.phone
    ? `<div style="margin: 4px 0 0 0;"><a href="${attrEscape(urlSafe('tel:' + (footer.phoneTel || '')))}" style="color: ${attrEscape(fg)}; text-decoration: none;">${htmlEscape(footer.phone)}</a></div>`
    : '';
  const email = footer.email
    ? `<div style="margin: 2px 0 0 0;"><a href="${attrEscape(urlSafe('mailto:' + footer.email))}" style="color: ${attrEscape(fg)}; text-decoration: none;">${htmlEscape(footer.email)}</a></div>`
    : '';
  const websites = footer.websites && footer.websites.length
    ? `<div style="margin: 4px 0 0 0;">${footer.websites.map((w) => `<a href="${attrEscape(urlSafe(w.url))}" target="_blank" style="color: ${attrEscape(fg)}; text-decoration: none;">${htmlEscape(w.label)}</a>`).join(' &amp; ')}</div>`
    : '';
  const socials = footer.socials && footer.socials.length
    ? `<div style="margin: 6px 0 0 0;">${footer.socials.map((s) => {
        const icon = SOCIAL_ICON[s.platform];
        if (!icon) return '';
        return `<a href="${attrEscape(urlSafe(s.url))}" target="_blank" style="display: inline-block; margin-right: 4px;"><img src="${attrEscape(icon.url)}" alt="${attrEscape(icon.alt)}" width="24" height="24" style="border: 0; display: inline-block;"></a>`;
      }).join('')}</div>`
    : '';

  return `<div class="print-footer" style="text-align: center; max-width: 710px; margin: 0 auto; background-color: ${attrEscape(bg)}; color: ${attrEscape(fg)}; padding: 8px 12px;">
${banner}
<div style="font-weight: bold;">${htmlEscape(footer.companyName)}</div>
${address}
${phone}
${email}
${websites}
${socials}
</div>`;
}
```

Then update `renderPrintDocument` to call these:

```ts
export function renderPrintDocument(data: ProjectData): string {
  const header = findHeader(data.blocks);
  const footer = findFooter(data.blocks);
  return `<!doctype html>
<html lang="en">
${renderHead(data)}
<body>
<div class="running-header">${renderHeaderForPrint(header, data)}</div>
<div class="running-footer">${renderFooterForPrint(footer, data)}</div>
<main>
</main>
</body>
</html>`;
}
```

- [ ] **Step 4: Run tests to verify PASS**

Run: `npx vitest run tests/unit/renderPrintDocument.test.ts`
Expected: ALL PASS.

Also `npx tsc --noEmit`. Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/export/renderPrintDocument.ts tests/unit/renderPrintDocument.test.ts
git commit -m "feat(export): print render for header and footer in running regions"
```

---

## Task 4: Product Section print render

**Files:**
- Modify: `src/lib/export/renderPrintDocument.ts`
- Modify: `tests/unit/renderPrintDocument.test.ts`

- [ ] **Step 1: Append failing tests**

```ts
describe('renderPrintDocument — product sections', () => {
  it('renders each product section wrapped in a .print-block div', () => {
    const html = renderPrintDocument(createDefaultProject());
    // GlobalTT has 8 product sections
    const matches = html.match(/<div class="print-block">/g) || [];
    expect(matches.length).toBe(8);
  });

  it('renders product section titles', () => {
    const html = renderPrintDocument(createDefaultProject());
    expect(html).toContain('Starlink Solutions');
    expect(html).toContain('V-Sat GEO Satellite Ku-Band');
  });

  it('renders product section bullets', () => {
    const html = renderPrintDocument(createDefaultProject());
    expect(html).toContain('NEW - Worldwide satellite internet.');
  });

  it('renders product section CTAs with the contact URL', () => {
    const html = renderPrintDocument(createDefaultProject());
    expect(html).toContain('https://www.globaltt.com/en/quickContact-GlobalTT.html');
  });

  it('alternates image-text order using middle-slice index', () => {
    // For an all-product-section middle, idx 0 => image-left, idx 1 => image-right (reverse).
    // Render output should include both orientations.
    const html = renderPrintDocument(createDefaultProject());
    expect(html).toMatch(/product-section.*reverse/);
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `npx vitest run tests/unit/renderPrintDocument.test.ts -t "product sections"`
Expected: FAIL — middle blocks not yet rendered.

- [ ] **Step 3: Add product section print render**

In `src/lib/export/renderPrintDocument.ts`, add a new import:

```ts
import type { Block, HeaderBlock, FooterBlock, ProductSectionBlock, ProjectData, SocialPlatform } from '@/lib/editor/types';
```

Add the function before `renderPrintDocument`:

```ts
function renderProductSectionForPrint(section: ProductSectionBlock, idx: number, data: ProjectData): string {
  const reverse = idx % 2 === 1;
  const titleSize = section.titleFontSize ?? 22;
  const bulletSize = section.bulletFontSize ?? 16;
  const textColor = section.textColor ?? data.global.textColor;
  const buttonColor = section.buttonColor ?? data.global.buttonColor;
  const bg = section.backgroundColor ?? '';
  const ctaUrl = urlSafe(section.ctaUrl ?? data.global.contactUrl);
  const imageSrc = urlSafe(section.imageSrc);

  const bulletsHtml = section.bullets
    .map((b) => `<li style="margin: 4px 0; font-size: ${bulletSize}px; color: ${attrEscape(textColor)};">${htmlEscape(b)}</li>`)
    .join('');

  const imageCol = `<div style="flex: 0 0 50%; padding: 12px;"><img src="${attrEscape(imageSrc)}" alt="${attrEscape(section.imageAlt)}" style="display: block; max-width: 100%; height: auto;"></div>`;
  const textCol = `<div style="flex: 0 0 50%; padding: 12px;">
<h2 style="margin: 0 0 6px 0; font-size: ${titleSize}px; color: ${attrEscape(textColor)};">${htmlEscape(section.title)}</h2>
<ul style="margin: 0 0 10px 0; padding-left: 20px;">${bulletsHtml}</ul>
<a href="${attrEscape(ctaUrl)}" target="_blank" style="display: inline-block; padding: 8px 16px; background-color: ${attrEscape(buttonColor)}; color: ${attrEscape(data.global.buttonTextColor)}; text-decoration: none; border-radius: 4px; font-weight: bold;">${htmlEscape(section.ctaText)}</a>
</div>`;

  const cells = reverse ? `${textCol}${imageCol}` : `${imageCol}${textCol}`;
  const reverseClass = reverse ? ' reverse' : '';
  const bgStyle = bg ? ` background-color: ${attrEscape(bg)};` : '';
  return `<section class="product-section${reverseClass}" style="display: flex; flex-direction: row;${bgStyle}">${cells}</section>`;
}
```

Update `renderPrintDocument` to dispatch over the middle slice:

```ts
function renderBlockForPrint(block: Block, idx: number, data: ProjectData): string {
  switch (block.type) {
    case 'product-section':
      return renderProductSectionForPrint(block, idx, data);
    case 'hero':
    case 'article':
    case 'cta-banner':
      return ''; // implemented in Task 5
    case 'header':
    case 'footer':
      return '';
  }
}

export function renderPrintDocument(data: ProjectData): string {
  const header = findHeader(data.blocks);
  const footer = findFooter(data.blocks);
  const middle = data.blocks.slice(1, -1);
  const middleHtml = middle
    .map((b, i) => `<div class="print-block">${renderBlockForPrint(b, i, data)}</div>`)
    .join('\n');

  return `<!doctype html>
<html lang="en">
${renderHead(data)}
<body>
<div class="running-header">${renderHeaderForPrint(header, data)}</div>
<div class="running-footer">${renderFooterForPrint(footer, data)}</div>
<main>
${middleHtml}
</main>
</body>
</html>`;
}
```

- [ ] **Step 4: Run to verify PASS**

Run: `npx vitest run tests/unit/renderPrintDocument.test.ts`
Expected: ALL PASS.

`npx tsc --noEmit`. Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/export/renderPrintDocument.ts tests/unit/renderPrintDocument.test.ts
git commit -m "feat(export): print render for product-section blocks"
```

---

## Task 5: Hero, Article, CTA-Banner print renders

**Files:**
- Modify: `src/lib/export/renderPrintDocument.ts`
- Modify: `tests/unit/renderPrintDocument.test.ts`

- [ ] **Step 1: Append failing tests**

```ts
describe('renderPrintDocument — Phase 2 block types', () => {
  function projectWithMiddle(middle: import('@/lib/editor/types').Block[]) {
    const base = createDefaultProject();
    const header = base.blocks[0];
    const footer = base.blocks[base.blocks.length - 1];
    return { ...base, blocks: [header, ...middle, footer] };
  }

  it('renders a hero block with image, title, subtitle, CTA', () => {
    const hero: import('@/lib/editor/types').HeroBlock = {
      type: 'hero', id: 'h', imageSrc: 'https://example.com/h.png', imageAlt: 'pic',
      title: 'Big news', subtitle: 'Some sub', ctaText: 'Learn more', ctaUrl: 'https://example.com/x',
    };
    const html = renderPrintDocument(projectWithMiddle([hero]));
    expect(html).toContain('Big news');
    expect(html).toContain('Some sub');
    expect(html).toContain('https://example.com/h.png');
    expect(html).toContain('https://example.com/x');
    expect(html).toContain('Learn more');
  });

  it('renders an article block with all imagePosition variants', () => {
    const top: import('@/lib/editor/types').ArticleBlock = {
      type: 'article', id: 't', imageSrc: '', imageAlt: '', title: 'Top', body: 'Line 1\nLine 2', ctaText: 'Read', imagePosition: 'top',
    };
    const left: import('@/lib/editor/types').ArticleBlock = {
      type: 'article', id: 'l', imageSrc: '', imageAlt: '', title: 'Left', body: 'B', ctaText: 'Read', imagePosition: 'left',
    };
    const right: import('@/lib/editor/types').ArticleBlock = {
      type: 'article', id: 'r', imageSrc: '', imageAlt: '', title: 'Right', body: 'B', ctaText: 'Read', imagePosition: 'right',
    };
    const html = renderPrintDocument(projectWithMiddle([top, left, right]));
    expect(html).toContain('Top');
    expect(html).toContain('Left');
    expect(html).toContain('Right');
    expect(html).toContain('Line 1');
    expect(html).toContain('Line 2');
  });

  it('renders a cta-banner block with align', () => {
    const c: import('@/lib/editor/types').CTABannerBlock = {
      type: 'cta-banner', id: 'c', title: 'Ready?', subtitle: 'Sub', ctaText: 'Go', align: 'center',
    };
    const html = renderPrintDocument(projectWithMiddle([c]));
    expect(html).toContain('Ready?');
    expect(html).toContain('Sub');
    expect(html).toContain('text-align: center');
  });

  it('XSS-escapes hero title', () => {
    const hero: import('@/lib/editor/types').HeroBlock = {
      type: 'hero', id: 'h', imageSrc: '', imageAlt: '', title: '<script>x()</script>', subtitle: '', ctaText: 'Go',
    };
    const html = renderPrintDocument(projectWithMiddle([hero]));
    expect(html).not.toContain('<script>x()</script>');
    expect(html).toContain('&lt;script&gt;x()&lt;/script&gt;');
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `npx vitest run tests/unit/renderPrintDocument.test.ts -t "Phase 2 block types"`
Expected: FAIL — hero/article/cta-banner cases return `''` in `renderBlockForPrint`.

- [ ] **Step 3: Update imports + add three render functions**

In `src/lib/export/renderPrintDocument.ts`, extend the imports:

```ts
import type { ArticleBlock, Block, CTABannerBlock, FooterBlock, HeaderBlock, HeroBlock, ProductSectionBlock, ProjectData, SocialPlatform } from '@/lib/editor/types';
```

Add the three functions before `renderBlockForPrint`:

```ts
function renderHeroForPrint(block: HeroBlock, data: ProjectData): string {
  const bg = block.backgroundColor ?? data.global.backgroundColor;
  const fg = block.textColor ?? data.global.textColor;
  const buttonColor = block.buttonColor ?? data.global.buttonColor;
  const buttonTextColor = data.global.buttonTextColor;
  const titleSize = block.titleFontSize ?? Math.max(data.global.headingFontSize, 28);
  const subtitleSize = block.subtitleFontSize ?? data.global.baseFontSize;
  const ctaUrl = urlSafe(block.ctaUrl ?? data.global.contactUrl);

  const imageHtml = block.imageSrc
    ? `<img src="${attrEscape(urlSafe(block.imageSrc))}" alt="${attrEscape(block.imageAlt)}" style="display: block; max-width: 100%; height: auto; margin: 0 auto 12px;">`
    : '';
  const subtitleHtml = block.subtitle
    ? `<p style="font-size: ${subtitleSize}px; color: ${attrEscape(fg)}; margin: 0 0 18px;">${htmlEscape(block.subtitle)}</p>`
    : '';
  return `<section class="hero" style="background-color: ${attrEscape(bg)}; padding: 24px 16px; text-align: center; color: ${attrEscape(fg)};">
${imageHtml}
<h1 style="font-size: ${titleSize}px; font-weight: 700; margin: 0 0 8px; color: ${attrEscape(fg)};">${htmlEscape(block.title)}</h1>
${subtitleHtml}
<a href="${attrEscape(ctaUrl)}" target="_blank" style="display: inline-block; padding: 10px 22px; background-color: ${attrEscape(buttonColor)}; color: ${attrEscape(buttonTextColor)}; text-decoration: none; font-weight: 600; border-radius: 4px;">${htmlEscape(block.ctaText)}</a>
</section>`;
}

function renderArticleForPrint(block: ArticleBlock, data: ProjectData): string {
  const bg = block.backgroundColor ?? data.global.backgroundColor;
  const fg = block.textColor ?? data.global.textColor;
  const titleSize = block.titleFontSize ?? data.global.headingFontSize;
  const bodySize = block.bodyFontSize ?? data.global.baseFontSize;
  const ctaUrl = urlSafe(block.ctaUrl ?? data.global.contactUrl);

  const imgHtml = block.imageSrc
    ? `<img src="${attrEscape(urlSafe(block.imageSrc))}" alt="${attrEscape(block.imageAlt)}" style="display: block; max-width: 100%; height: auto;">`
    : '';
  const titleHtml = `<h2 style="margin: 0 0 6px; font-size: ${titleSize}px; color: ${attrEscape(fg)};">${htmlEscape(block.title)}</h2>`;
  const bodyHtml = `<p style="margin: 0 0 12px; font-size: ${bodySize}px; color: ${attrEscape(fg)}; white-space: pre-wrap;">${htmlEscape(block.body)}</p>`;
  const ctaHtml = block.ctaText
    ? `<a href="${attrEscape(ctaUrl)}" target="_blank" style="color: ${attrEscape(data.global.buttonColor)}; font-weight: 600; text-decoration: none;">${htmlEscape(block.ctaText)}</a>`
    : '';

  if (block.imagePosition === 'top') {
    return `<section class="article article-top" style="background-color: ${attrEscape(bg)}; padding: 16px;">
${imgHtml ? `<div style="margin-bottom: 12px;">${imgHtml}</div>` : ''}
${titleHtml}${bodyHtml}${ctaHtml}
</section>`;
  }
  const flexDir = block.imagePosition === 'left' ? 'row' : 'row-reverse';
  return `<section class="article article-${block.imagePosition}" style="background-color: ${attrEscape(bg)}; display: flex; flex-direction: ${flexDir}; gap: 12px; padding: 16px;">
<div style="flex: 0 0 40%;">${imgHtml}</div>
<div style="flex: 1;">${titleHtml}${bodyHtml}${ctaHtml}</div>
</section>`;
}

function renderCTABannerForPrint(block: CTABannerBlock, data: ProjectData): string {
  const bg = block.backgroundColor ?? data.global.backgroundColor;
  const fg = block.textColor ?? data.global.textColor;
  const buttonColor = block.buttonColor ?? data.global.buttonColor;
  const buttonTextColor = data.global.buttonTextColor;
  const titleSize = block.titleFontSize ?? data.global.headingFontSize;
  const ctaUrl = urlSafe(block.ctaUrl ?? data.global.contactUrl);

  const titleHtml = block.title
    ? `<h2 style="margin: 0 0 6px; font-size: ${titleSize}px; color: ${attrEscape(fg)};">${htmlEscape(block.title)}</h2>`
    : '';
  const subtitleHtml = block.subtitle
    ? `<p style="margin: 0 0 12px; color: ${attrEscape(fg)};">${htmlEscape(block.subtitle)}</p>`
    : '';

  return `<section class="cta-banner" style="background-color: ${attrEscape(bg)}; padding: 20px 16px; text-align: ${block.align};">
${titleHtml}
${subtitleHtml}
<a href="${attrEscape(ctaUrl)}" target="_blank" style="display: inline-block; padding: 10px 20px; background-color: ${attrEscape(buttonColor)}; color: ${attrEscape(buttonTextColor)}; text-decoration: none; font-weight: 600; border-radius: 4px;">${htmlEscape(block.ctaText)}</a>
</section>`;
}
```

Then update `renderBlockForPrint` to dispatch to them:

```ts
function renderBlockForPrint(block: Block, idx: number, data: ProjectData): string {
  switch (block.type) {
    case 'product-section':
      return renderProductSectionForPrint(block, idx, data);
    case 'hero':
      return renderHeroForPrint(block, data);
    case 'article':
      return renderArticleForPrint(block, data);
    case 'cta-banner':
      return renderCTABannerForPrint(block, data);
    case 'header':
    case 'footer':
      return '';
  }
}
```

- [ ] **Step 4: Run to verify PASS**

Run: `npx vitest run tests/unit/renderPrintDocument.test.ts`
Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/export/renderPrintDocument.ts tests/unit/renderPrintDocument.test.ts
git commit -m "feat(export): print render for hero, article, and cta-banner blocks"
```

---

## Task 6: buildPrintHtml refactor + print route update

**Files:**
- Modify: `src/lib/export/buildPrintHtml.ts`
- Modify: `tests/unit/buildPrintHtml.test.ts`
- Modify: `src/app/w/[slug]/p/[id]/print/route.ts`

These three files are bundled into one commit so the tree compiles cleanly between commits. (The signature change to `buildPrintHtml` would otherwise leave the route uncompilable until the next task.)

- [ ] **Step 1: Replace `tests/unit/buildPrintHtml.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { buildPrintHtml } from '@/lib/export/buildPrintHtml';
import { createDefaultProject } from '@/lib/editor/defaultProject';
import { createBlankProject } from '@/lib/editor/templates';

describe('buildPrintHtml', () => {
  it('accepts a ProjectData and returns a complete HTML document', () => {
    const out = buildPrintHtml(createDefaultProject());
    expect(out.startsWith('<!doctype html>')).toBe(true);
    expect(out.trimEnd().endsWith('</html>')).toBe(true);
  });

  it('includes the @page rule from renderPrintDocument', () => {
    const out = buildPrintHtml(createDefaultProject());
    expect(out).toContain('@page');
    expect(out).toContain('@top-center');
    expect(out).toContain('@bottom-center');
  });

  it('injects the PagedJS polyfill script before </body>', () => {
    const out = buildPrintHtml(createDefaultProject());
    expect(out).toContain('<script src="/vendor/paged.polyfill.js"></script>');
    expect(out.indexOf('<script src="/vendor/paged.polyfill.js"')).toBeLessThan(out.indexOf('</body>'));
  });

  it('injects a no-print toolbar with a Print button as first child of <body>', () => {
    const out = buildPrintHtml(createDefaultProject());
    expect(out).toContain('class="no-print pagedjs_not_pageable"');
    expect(out).toContain('>Print / Save as PDF<');
  });

  it('hides .no-print in print media via injected CSS', () => {
    const out = buildPrintHtml(createDefaultProject());
    expect(out).toMatch(/@media print[\s\S]*?\.no-print[\s\S]*?display:\s*none/);
  });

  it('injects an auto-print script that hooks PagedConfig.after', () => {
    const out = buildPrintHtml(createDefaultProject());
    expect(out).toContain('window.PagedConfig');
    expect(out).toContain('window.print()');
  });

  it('renders blank template without throwing', () => {
    expect(() => buildPrintHtml(createBlankProject())).not.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `npx vitest run tests/unit/buildPrintHtml.test.ts`
Expected: FAIL — old signature still accepts a string; the test now passes `createDefaultProject()`.

- [ ] **Step 3: Replace `src/lib/export/buildPrintHtml.ts`**

```ts
import type { ProjectData } from '@/lib/editor/types';
import { renderPrintDocument } from './renderPrintDocument';

const TOOLBAR_CSS = `<style>
@media print {
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

const TOOLBAR_HTML = `<div class="no-print pagedjs_not_pageable"><button type="button" onclick="window.print()">Print / Save as PDF</button></div>`;

const PAGED_SCRIPT = `<script src="/vendor/paged.polyfill.js"></script>`;

const AUTO_PRINT_SCRIPT = `<script>
window.addEventListener('load', function () {
  if (window.PagedConfig) {
    window.PagedConfig.after = function () {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { window.print(); });
      });
    };
  } else {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { window.print(); });
    });
  }
});
</script>`;

export function buildPrintHtml(data: ProjectData): string {
  const document = renderPrintDocument(data);
  // Inject TOOLBAR_CSS before </head>
  const withCss = document.replace('</head>', `${TOOLBAR_CSS}</head>`);
  // Inject TOOLBAR_HTML right after <body>
  const withToolbar = withCss.replace(/<body([^>]*)>/, (_match, attrs) => `<body${attrs}>${TOOLBAR_HTML}`);
  // Inject PAGED_SCRIPT + AUTO_PRINT_SCRIPT before </body>
  return withToolbar.replace('</body>', `${PAGED_SCRIPT}${AUTO_PRINT_SCRIPT}</body>`);
}
```

- [ ] **Step 4: Update the print route**

Replace `src/app/w/[slug]/p/[id]/print/route.ts` body with:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { findWorkspace } from '@/lib/auth/workspace';
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

  const printHtml = buildPrintHtml(data.data as ProjectData);

  return new NextResponse(printHtml, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
```

The only semantic change: `buildPrintHtml(renderEmail(data.data as ProjectData))` becomes `buildPrintHtml(data.data as ProjectData)`. The `renderEmail` import is removed.

- [ ] **Step 5: Run full type-check + tests**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: ALL PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/export/buildPrintHtml.ts tests/unit/buildPrintHtml.test.ts src/app/w/[slug]/p/[id]/print/route.ts
git commit -m "feat(export): buildPrintHtml accepts ProjectData; injects PagedJS; route updated"
```

---

## Task 7: Print snapshot baselines + snapshot tests

**Files:**
- Modify: `scripts/capture-render-baseline.ts`
- Create: `src/lib/export/renderPrintDocument.snapshot.test.ts`
- Create: `src/lib/export/__fixtures__/print-baseline-blank.html`
- Create: `src/lib/export/__fixtures__/print-baseline-globaltt.html`
- Create: `src/lib/export/__fixtures__/print-baseline-newsletter.html`
- Create: `src/lib/export/__fixtures__/print-baseline-announcement.html`
- Create: `src/lib/export/__fixtures__/print-baseline-event-invite.html`

- [ ] **Step 1: Update `scripts/capture-render-baseline.ts`**

Replace with:

```ts
import { writeFileSync, mkdirSync } from 'node:fs';
import { renderEmail } from '../src/lib/export/renderEmail';
import { renderPrintDocument } from '../src/lib/export/renderPrintDocument';
import { createDefaultProject } from '../src/lib/editor/defaultProject';
import {
  createBlankProject,
  createNewsletterTemplate,
  createAnnouncementTemplate,
  createEventInviteTemplate,
} from '../src/lib/editor/templates';

mkdirSync('src/lib/export/__fixtures__', { recursive: true });

// Email baselines
writeFileSync('src/lib/export/__fixtures__/baseline-globaltt.html',     renderEmail(createDefaultProject()));
writeFileSync('src/lib/export/__fixtures__/baseline-blank.html',        renderEmail(createBlankProject()));
writeFileSync('src/lib/export/__fixtures__/baseline-newsletter.html',   renderEmail(createNewsletterTemplate()));
writeFileSync('src/lib/export/__fixtures__/baseline-announcement.html', renderEmail(createAnnouncementTemplate()));
writeFileSync('src/lib/export/__fixtures__/baseline-event-invite.html', renderEmail(createEventInviteTemplate()));

// Print baselines
writeFileSync('src/lib/export/__fixtures__/print-baseline-globaltt.html',     renderPrintDocument(createDefaultProject()));
writeFileSync('src/lib/export/__fixtures__/print-baseline-blank.html',        renderPrintDocument(createBlankProject()));
writeFileSync('src/lib/export/__fixtures__/print-baseline-newsletter.html',   renderPrintDocument(createNewsletterTemplate()));
writeFileSync('src/lib/export/__fixtures__/print-baseline-announcement.html', renderPrintDocument(createAnnouncementTemplate()));
writeFileSync('src/lib/export/__fixtures__/print-baseline-event-invite.html', renderPrintDocument(createEventInviteTemplate()));

console.log('Wrote baselines');
```

- [ ] **Step 2: Generate baselines**

```bash
npx tsx scripts/capture-render-baseline.ts
```

Expected output: `Wrote baselines`. Verify with `git status` — five new `print-baseline-*.html` files appear; the five `baseline-*.html` files must show **no diff** (email render unchanged).

- [ ] **Step 3: Append `.gitattributes` rule for the new print baselines**

The repo's `.gitattributes` already pins `src/lib/export/__fixtures__/*.html` to LF — confirm. If not, append:

```
src/lib/export/__fixtures__/*.html -text eol=lf
```

- [ ] **Step 4: Create `src/lib/export/renderPrintDocument.snapshot.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderPrintDocument } from './renderPrintDocument';
import { createDefaultProject } from '../editor/defaultProject';
import {
  createBlankProject,
  createNewsletterTemplate,
  createAnnouncementTemplate,
  createEventInviteTemplate,
} from '../editor/templates';

describe('renderPrintDocument snapshot parity', () => {
  it('GlobalTT print template renders byte-equal to baseline', () => {
    const baseline = readFileSync('src/lib/export/__fixtures__/print-baseline-globaltt.html', 'utf8');
    expect(renderPrintDocument(createDefaultProject())).toBe(baseline);
  });

  it('Blank print template renders byte-equal to baseline', () => {
    const baseline = readFileSync('src/lib/export/__fixtures__/print-baseline-blank.html', 'utf8');
    expect(renderPrintDocument(createBlankProject())).toBe(baseline);
  });

  it('Newsletter print template renders byte-equal to baseline', () => {
    const baseline = readFileSync('src/lib/export/__fixtures__/print-baseline-newsletter.html', 'utf8');
    expect(renderPrintDocument(createNewsletterTemplate())).toBe(baseline);
  });

  it('Announcement print template renders byte-equal to baseline', () => {
    const baseline = readFileSync('src/lib/export/__fixtures__/print-baseline-announcement.html', 'utf8');
    expect(renderPrintDocument(createAnnouncementTemplate())).toBe(baseline);
  });

  it('Event Invite print template renders byte-equal to baseline', () => {
    const baseline = readFileSync('src/lib/export/__fixtures__/print-baseline-event-invite.html', 'utf8');
    expect(renderPrintDocument(createEventInviteTemplate())).toBe(baseline);
  });
});
```

- [ ] **Step 5: Run all tests**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: ALL PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/capture-render-baseline.ts src/lib/export/renderPrintDocument.snapshot.test.ts src/lib/export/__fixtures__/print-baseline-*.html
git commit -m "test(export): print snapshot baselines for all five templates"
```

---

## Task 8: Bullet grip absolute positioning + unified `<ul>` padding

**Files:**
- Modify: `src/components/editor/editable/EditableBulletList.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Update CSS in `src/app/globals.css`**

Find the existing `.bullet-row .bullet-grip` rule (around line 164–166) and replace with:

```css
.bullet-row {
  position: relative;
}
.bullet-row .bullet-grip {
  position: absolute;
  left: -24px;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0;
  transition: opacity 100ms;
}
.bullet-row:hover .bullet-grip,
.bullet-row:focus-within .bullet-grip,
.bullet-grip:focus-visible { opacity: 1; }
```

- [ ] **Step 2: Update `src/components/editor/editable/EditableBulletList.tsx`**

Find the edit-mode `<ul>` open tag (around line 145):

```tsx
style={{ margin: 0, paddingLeft: '20px' }}
```

Change `paddingLeft: '20px'` to `paddingLeft: '40px'` so it matches the preview-mode `<ul>` (which already uses `40` via `.preview-canvas ul { padding-inline-start: 40px }` in `globals.css`).

Find the `<button class="bullet-grip ...">` inside `SortableBulletItem` (around line 207). Update the className to drop the inline-flex sizing and rely on the new CSS for positioning:

Existing:
```tsx
className="bullet-grip inline-flex items-center justify-center cursor-grab active:cursor-grabbing text-ed-ink-3 hover:text-brand p-1 min-w-[28px] min-h-[28px] align-middle"
```

Replace with:
```tsx
className="bullet-grip inline-flex items-center justify-center cursor-grab active:cursor-grabbing text-ed-ink-3 hover:text-brand p-1"
```

(Dropped: `min-w-[28px] min-h-[28px] align-middle`. The grip is now absolutely positioned and sized by its icon + padding only.)

- [ ] **Step 3: Update `EditModeFidelity` will be added in Task 14. For now, smoke-check that existing tests still pass:**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/components/editor/editable/EditableBulletList.tsx
git commit -m "fix(canvas): bullet grip absolute-positioned in gutter; unified <ul> padding"
```

---

## Task 9: EditableLink absolute positioning + ProductSectionView CTA wrap

**Files:**
- Modify: `src/components/editor/editable/EditableLink.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/components/editor/blocks/ProductSectionView.tsx`

- [ ] **Step 1: Update CSS in `src/app/globals.css`**

Find `.editable-link-icon` (around line 147) and replace with:

```css
.editable-link-icon {
  position: absolute;
  right: -28px;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0;
  pointer-events: none;
  transition: opacity 100ms;
}
.cta-edit-anchor:hover .editable-link-icon,
.cta-edit-anchor:focus-within .editable-link-icon,
.editable-link-icon:focus-visible {
  opacity: 1;
  pointer-events: auto;
}
```

(Replaces the old `.inline-link-wrap:hover` selector. The new pattern uses a wrapping `.cta-edit-anchor` class on the CTA `<a>`. We need to add `position: relative` to that anchor too — see step 3.)

- [ ] **Step 2: Update `src/components/editor/editable/EditableLink.tsx`**

Find the conditional className (around line 56):

```ts
const visibilityClass = alwaysVisible ? 'opacity-100' : 'editable-link-icon';
```

The trigger button is what gets the visibility class. The wrapping `<span>` was previously `position: relative inline-flex items-center`. We want the trigger to BE the absolutely positioned element. Replace the body of the return with:

```tsx
return (
  <span ref={rootRef} className={`relative inline-flex items-center ${className ?? ''}`}>
    <Tooltip open={open ? false : undefined}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={openPopover}
          aria-label={ariaLabel}
          className={`${visibilityClass} inline-flex items-center justify-center rounded p-0.5 text-ed-ink-3 hover:text-brand hover:bg-ed-panel`}
        >
          <LinkIcon size={14} />
        </button>
      </TooltipTrigger>
      <TooltipContent>Edit link</TooltipContent>
    </Tooltip>
    {open && (
      <span className="absolute z-50 left-0 top-full mt-1 inline-flex items-center gap-2 rounded-md border border-ed-rule-strong bg-ed-panel-2 p-2 shadow-lg whitespace-nowrap">
        <input
          type="text"
          role="textbox"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); save(); }
            if (e.key === 'Escape') { e.preventDefault(); cancel(); }
          }}
          className="rounded border border-ed-rule-strong bg-ed-panel px-2 py-1 text-xs text-ed-ink outline-none focus:border-brand"
          placeholder="https://"
        />
        <button type="button" onClick={save} className="rounded bg-brand px-2 py-1 text-xs text-white">Save</button>
        <button type="button" onClick={cancel} className="rounded border border-ed-rule-strong px-2 py-1 text-xs text-ed-ink">Cancel</button>
      </span>
    )}
  </span>
);
```

The structure is unchanged from before — the only change is that the `.editable-link-icon` CSS rules now use absolute positioning instead of just opacity, taking the icon out of normal flow. The trigger button is the absolutely-positioned element when `editable-link-icon` is applied.

- [ ] **Step 3: Update `src/components/editor/blocks/ProductSectionView.tsx`**

Find the CTA `<a>` (around line 85):

```tsx
<a
  href={block.ctaUrl ?? g.contactUrl}
  target="_blank"
  rel="noreferrer"
  onClick={blockNav}
  style={{
    display: 'inline-block', background: buttonColor, color: g.buttonTextColor,
    padding: '10px 30px', borderRadius: 10, fontWeight: 700, fontSize: 16, textDecoration: 'none',
  }}
>
  <span className="inline-link-wrap inline-flex items-center gap-1">
```

Update the `<a>` to add `className="cta-edit-anchor"` and `position: 'relative'` in the style; and change the inner `<span>` to drop `inline-link-wrap` (which is no longer needed) and `gap-1`:

```tsx
<a
  href={block.ctaUrl ?? g.contactUrl}
  target="_blank"
  rel="noreferrer"
  onClick={blockNav}
  className="cta-edit-anchor"
  style={{
    display: 'inline-block', position: 'relative', background: buttonColor, color: g.buttonTextColor,
    padding: '10px 30px', borderRadius: 10, fontWeight: 700, fontSize: 16, textDecoration: 'none',
  }}
>
  <span className="inline-flex items-center">
```

The closing `</span></a>` and inner `<EditableText>` + `<EditableLink>` stay the same.

- [ ] **Step 4: Run type-check + tests**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/components/editor/editable/EditableLink.tsx src/components/editor/blocks/ProductSectionView.tsx
git commit -m "fix(canvas): EditableLink absolute-positioned outside CTA flow"
```

---

## Task 10: Apply CTA-edit-anchor wrap to Hero, Article, CTABanner views

**Files:**
- Modify: `src/components/editor/blocks/HeroBlockView.tsx`
- Modify: `src/components/editor/blocks/ArticleView.tsx`
- Modify: `src/components/editor/blocks/CTABannerView.tsx`

For each of the three files, find the CTA `<a>` and add `className="cta-edit-anchor"` plus `position: 'relative'` in its style. Then drop the `inline-link-wrap` class on the inner `<span>` (replace with just `inline-flex items-center`).

- [ ] **Step 1: Update `HeroBlockView.tsx`**

Find the CTA `<a>` (around line 100). The current style includes:
```tsx
style={{
  display: 'inline-block', background: buttonColor, color: g.buttonTextColor,
  padding: '14px 28px', borderRadius: 4, fontWeight: 600, textDecoration: 'none',
}}
```

Add `className="cta-edit-anchor"` to the `<a>` and `position: 'relative'` to the style:

```tsx
className="cta-edit-anchor"
style={{
  display: 'inline-block', position: 'relative', background: buttonColor, color: g.buttonTextColor,
  padding: '14px 28px', borderRadius: 4, fontWeight: 600, textDecoration: 'none',
}}
```

Change the inner `<span className="inline-link-wrap inline-flex items-center gap-1">` to `<span className="inline-flex items-center">`.

- [ ] **Step 2: Update `ArticleView.tsx`**

The CTA `<a>` in ArticleView is inline-style without a button background. Around line 110:
```tsx
<a
  href={block.ctaUrl ?? g.contactUrl}
  ...
  style={{ color: g.buttonColor, fontWeight: 600, textDecoration: 'none' }}
>
  <span className="inline-link-wrap inline-flex items-center gap-1">
```

Update:
```tsx
<a
  href={block.ctaUrl ?? g.contactUrl}
  ...
  className="cta-edit-anchor"
  style={{ position: 'relative', color: g.buttonColor, fontWeight: 600, textDecoration: 'none' }}
>
  <span className="inline-flex items-center">
```

- [ ] **Step 3: Update `CTABannerView.tsx`**

Around line 110:
```tsx
<a
  href={block.ctaUrl ?? g.contactUrl}
  ...
  style={{
    display: 'inline-block', background: buttonColor, color: g.buttonTextColor,
    padding: '12px 24px', borderRadius: 4, fontWeight: 600, textDecoration: 'none',
  }}
>
  <span className="inline-link-wrap inline-flex items-center gap-1">
```

Update:
```tsx
<a
  href={block.ctaUrl ?? g.contactUrl}
  ...
  className="cta-edit-anchor"
  style={{
    display: 'inline-block', position: 'relative', background: buttonColor, color: g.buttonTextColor,
    padding: '12px 24px', borderRadius: 4, fontWeight: 600, textDecoration: 'none',
  }}
>
  <span className="inline-flex items-center">
```

- [ ] **Step 4: Run type-check + tests**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/blocks/HeroBlockView.tsx src/components/editor/blocks/ArticleView.tsx src/components/editor/blocks/CTABannerView.tsx
git commit -m "fix(canvas): apply cta-edit-anchor to Hero, Article, CTABanner CTAs"
```

---

## Task 11: SectionInsertBar zero-flow-height with hit region

**Files:**
- Modify: `src/components/editor/canvas/SectionInsertBar.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Update `SectionInsertBar.tsx`**

Replace the existing return with:

```tsx
return (
  <div className="section-insert-bar">
    <button
      type="button"
      aria-label="Add section"
      onClick={() => store.getState().addSection(atIndex)}
      className="section-insert-btn inline-flex items-center gap-1 rounded-full border border-ed-rule-strong bg-ed-panel-2 px-3 py-1 text-xs text-ed-ink-2 transition-colors hover:border-brand hover:text-brand"
    >
      <Plus size={12} /> Add section
    </button>
  </div>
);
```

(The previous version used `relative h-3 my-1` with `absolute inset-0 flex` wrapper. The new version uses a single bar whose layout is driven entirely by CSS in step 2.)

- [ ] **Step 2: Update CSS in `src/app/globals.css`**

Find the existing `.section-insert-bar` rules (around line 156–158) and replace with:

```css
.section-insert-bar {
  position: relative;
  height: 0;
}
.section-insert-bar::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: -12px;
  height: 24px;
}
.section-insert-bar .section-insert-btn {
  position: absolute;
  left: 50%;
  top: -12px;
  transform: translateX(-50%);
  opacity: 0;
  transition: opacity 100ms;
  z-index: 5;
}
.section-insert-bar:hover .section-insert-btn,
.section-insert-bar:focus-within .section-insert-btn,
.section-insert-btn:focus-visible { opacity: 1; }
```

The `::before` is the 24px-tall transparent hit region centered on the gap; the button itself is absolutely positioned to overlay the gap when revealed. Total flow height: 0.

- [ ] **Step 3: Update the existing test**

`tests/unit/SectionInsertBar.test.tsx` exists. Read it. If it asserts the old DOM structure (e.g. presence of `relative h-3 my-1` classes, or a wrapping `flex` container), update those assertions to match the new simpler structure (a single `.section-insert-bar` containing a `.section-insert-btn` button). Behavior assertions (the button calls `addSection(atIndex)` on click; aria label is "Add section") should be unchanged.

- [ ] **Step 4: Run type-check + tests**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/canvas/SectionInsertBar.tsx src/app/globals.css tests/unit/SectionInsertBar.test.tsx
git commit -m "fix(canvas): SectionInsertBar zero-flow-height with hit region"
```

---

## Task 12: EditableImage alt-text overlay absolute positioning

**Files:**
- Modify: `src/components/editor/editable/EditableImage.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Update CSS in `src/app/globals.css`**

Find `.editable-image-alt` and `.editable-image-wrap` rules (around line 152–154). Replace with:

```css
.editable-image-wrap {
  position: relative;
  display: inline-block;
}
.editable-image-alt {
  position: absolute;
  left: 0;
  right: 0;
  bottom: -22px;
  text-align: left;
  opacity: 0;
  pointer-events: none;
  transition: opacity 100ms;
}
.editable-image-wrap:hover .editable-image-alt,
.editable-image-wrap:focus-within .editable-image-alt {
  opacity: 1;
  pointer-events: auto;
}
```

- [ ] **Step 2: Update `src/components/editor/editable/EditableImage.tsx`**

Find (around line 56):

```tsx
return (
  <span className="editable-image-wrap inline-flex flex-col items-stretch">
    {img}
    <span className="editable-image-alt block text-[12px] text-ed-ink-3 mt-1 px-1">
      Alt:{' '}
      <EditableText
        value={alt}
        onChange={onAltChange}
        singleLine
        placeholder="click to add"
        ariaLabel={altLabel ?? 'Image alt text'}
      />
    </span>
  </span>
);
```

Replace with:

```tsx
return (
  <span className="editable-image-wrap">
    {img}
    <span className="editable-image-alt text-[12px] text-ed-ink-3 px-1">
      Alt:{' '}
      <EditableText
        value={alt}
        onChange={onAltChange}
        singleLine
        placeholder="click to add"
        ariaLabel={altLabel ?? 'Image alt text'}
      />
    </span>
  </span>
);
```

(Dropped: `inline-flex flex-col items-stretch` from the wrap, and `block mt-1` from the alt span. The wrap is now block-positioned with the alt overlay sitting below the image, absolutely positioned out of flow.)

- [ ] **Step 3: Run type-check + tests**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/components/editor/editable/EditableImage.tsx
git commit -m "fix(canvas): EditableImage alt-text as absolute overlay below image"
```

---

## Task 13: EditModeFidelity test

**Files:**
- Create: `tests/unit/EditModeFidelity.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { EditorModeProvider, useEditorMode } from '@/components/editor/EditorModeProvider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { EditableBulletList } from '@/components/editor/editable/EditableBulletList';
import { EditableText } from '@/components/editor/editable/EditableText';
import { EditableLink } from '@/components/editor/editable/EditableLink';

function SetMode({ mode }: { mode: 'edit' | 'preview' }) {
  const { setMode } = useEditorMode();
  React.useEffect(() => { setMode(mode); }, [mode, setMode]);
  return null;
}

function Wrap({ mode, children }: { mode: 'edit' | 'preview'; children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <EditorModeProvider>
        <SetMode mode={mode} />
        {children}
      </EditorModeProvider>
    </TooltipProvider>
  );
}

describe('Edit vs Preview layout fidelity', () => {
  it('CTA button width is identical between edit and preview mode', () => {
    function Cta() {
      const [text, setText] = React.useState('Contact Us');
      const [url, setUrl] = React.useState('https://example.com');
      return (
        <a
          href={url}
          className="cta-edit-anchor"
          data-testid="cta"
          style={{ display: 'inline-block', position: 'relative', padding: '10px 30px', textDecoration: 'none' }}
        >
          <span className="inline-flex items-center">
            <EditableText value={text} onChange={setText} singleLine ariaLabel="cta text" />
            <EditableLink value={url} onChange={setUrl} ariaLabel="edit link" />
          </span>
        </a>
      );
    }

    const editRender = render(<Wrap mode="edit"><Cta /></Wrap>);
    const editWidth = editRender.getByTestId('cta').getBoundingClientRect().width;
    editRender.unmount();

    const previewRender = render(<Wrap mode="preview"><Cta /></Wrap>);
    const previewWidth = previewRender.getByTestId('cta').getBoundingClientRect().width;
    previewRender.unmount();

    expect(Math.abs(editWidth - previewWidth)).toBeLessThanOrEqual(2);
  });

  it('Bullet text left position is identical between edit and preview mode', () => {
    function Bullets() {
      const [bullets, setBullets] = React.useState(['First bullet', 'Second bullet']);
      return (
        <div data-testid="bullets">
          <EditableBulletList
            bullets={bullets}
            onChange={setBullets}
            ariaLabel="bullets"
          />
        </div>
      );
    }

    const editRender = render(<Wrap mode="edit"><Bullets /></Wrap>);
    const editFirstLi = editRender.getByTestId('bullets').querySelector('li');
    expect(editFirstLi).not.toBeNull();
    const editLeft = editFirstLi!.getBoundingClientRect().left;
    editRender.unmount();

    const previewRender = render(<Wrap mode="preview"><Bullets /></Wrap>);
    const previewFirstLi = previewRender.getByTestId('bullets').querySelector('li');
    expect(previewFirstLi).not.toBeNull();
    const previewLeft = previewFirstLi!.getBoundingClientRect().left;
    previewRender.unmount();

    expect(Math.abs(editLeft - previewLeft)).toBeLessThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run the new test**

```bash
npx vitest run tests/unit/EditModeFidelity.test.tsx
```

Expected: BOTH PASS. jsdom's layout engine is imperfect, but the assertions use a 2px tolerance which should accommodate it. If a test fails by more than 2px, that's a real signal — investigate.

If the bullets test fails because jsdom doesn't apply CSS pseudo-element positioning correctly, lower the bar to "the `<ul>` padding-left is the same in both modes" by querying computed style instead of bounding rect — but try the bounding-rect form first since it's the more meaningful invariant.

- [ ] **Step 3: Full test suite**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add tests/unit/EditModeFidelity.test.tsx
git commit -m "test(canvas): edit vs preview bounding-box fidelity invariants"
```

---

## Task 14: Final verification — EditableText audit, type-check, lint, full test + manual smoke checklist

**Files:** none (verification only)

- [ ] **Step 1: EditableText layout audit (per spec §3.4)**

Read `src/components/editor/editable/EditableText.tsx` and `src/app/globals.css` rules for `.inline-editable*`. Verify:

- `.inline-editable` default state has **no** `padding`, **no** `border`, **no** `margin` properties that affect bounding box.
- Only `outline` is used for hover/focus states (which doesn't affect layout).
- The `[data-empty='true']::before` placeholder shows text inside the element via the `attr()` content; it doesn't create extra layout-affecting elements.
- In preview mode, `EditableText` returns a plain `<PreviewTag>{value}</PreviewTag>` (no wrappers).

If all four are true, EditableText is already fidelity-correct — no code change needed. Record the result of this audit in the commit message of step 4 of this task (no file changes; just confirms the spec audit item is satisfied).

If any of the four is FALSE, add a follow-up task and report — but based on the current state of the code at the start of this work, all four are expected to be true.

- [ ] **Step 2: Run all checks**

```bash
npx tsc --noEmit && npm run lint && npx vitest run
```

Expected: ALL GREEN. Report any failures.

- [ ] **Step 3: Document the manual smoke checklist for the merger**

The implementer should NOT do manual smoke; that's the human reviewer's job. But this task records the checklist in a comment on the PR (or in the merge commit message):

```
Manual smoke checklist for Print + Edit Fidelity:

1. Edit-mode side-by-side with preview-mode at 100% zoom, for each block type:
   - Product section: bullet text aligns at the same X position; CTA button is the same width.
   - Hero: CTA button is the same width.
   - Article (left/right): no flow difference.
   - CTA banner: button is the same width.
   - Section insert bars: no vertical gaps in edit mode that aren't in preview.

2. Print preview, for each of the 5 templates (Blank, GlobalTT, Newsletter, Announcement, Event Invite):
   - Open /w/<slug>/p/<id>/print in a browser.
   - Wait for PagedJS to paginate (a few seconds).
   - Browser print preview should show:
     - Header at top of every page (including last).
     - Footer at bottom of every page (including last).
     - No section split across two pages.
     - Footer is pinned to the page margin, not floating mid-page on the last page.
   - Save as PDF and confirm the saved PDF matches the preview.

3. Edit-fidelity regression spot-check: type into a bullet → no jitter in surrounding layout. Click the CTA pencil → URL editor opens; no layout shift.
```

- [ ] **Step 4: If any failures, file follow-up tasks; otherwise this task is complete with no commit.**

---

## Self-review notes

(Filled in as part of writing this plan; spec coverage and type-consistency check pass.)
