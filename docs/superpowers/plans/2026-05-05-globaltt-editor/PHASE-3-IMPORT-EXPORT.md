# Phase 3 — HTML Import & Export

> Read [`SPEC.md`](./SPEC.md) §8 (export) and §9 (import) before starting. Both are pure functions and TDD-driven.

**Phase goal:** A user can download a Nutshell-ready HTML file from any project, and can import any reasonable HTML email into a new project (with a review step). Default project, when exported, matches the reference template.

---

## Task 1 — HTML escaping helpers

**Files:**
- Create: `src/lib/export/escape.ts`
- Test: `tests/unit/escape.test.ts`

- [ ] **Step 1: Failing test `tests/unit/escape.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { htmlEscape, attrEscape, urlSafe } from '@/lib/export/escape';

describe('htmlEscape', () => {
  it('escapes & < > " \'', () => {
    expect(htmlEscape('<a href="x">A&B \'c\'</a>'))
      .toBe('&lt;a href=&quot;x&quot;&gt;A&amp;B &#39;c&#39;&lt;/a&gt;');
  });
  it('passes plain text through', () => {
    expect(htmlEscape('Hello world')).toBe('Hello world');
  });
});

describe('attrEscape', () => {
  it('escapes quotes and ampersand', () => {
    expect(attrEscape('a "b" & c')).toBe('a &quot;b&quot; &amp; c');
  });
});

describe('urlSafe', () => {
  it('passes http/https/mailto/tel through', () => {
    expect(urlSafe('https://x.com')).toBe('https://x.com');
    expect(urlSafe('mailto:a@b.com')).toBe('mailto:a@b.com');
    expect(urlSafe('tel:+123')).toBe('tel:+123');
  });
  it('blocks javascript:', () => {
    expect(urlSafe('javascript:alert(1)')).toBe('#');
  });
  it('blocks data:', () => {
    expect(urlSafe('data:text/html,<script>')).toBe('#');
  });
  it('treats relative urls as #', () => {
    expect(urlSafe('foo/bar')).toBe('#');
  });
});
```

- [ ] **Step 2: Run — expect fail**

```powershell
npm test
```

- [ ] **Step 3: Implement `src/lib/export/escape.ts`**

```typescript
export function htmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function attrEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

const ALLOWED_PROTOCOLS = /^(https?|mailto|tel):/i;

export function urlSafe(url: string): string {
  if (!url) return '#';
  if (ALLOWED_PROTOCOLS.test(url)) return url;
  return '#';
}
```

- [ ] **Step 4: Run — expect pass**

```powershell
npm test
```

- [ ] **Step 5: Commit**

```powershell
git add src/lib/export/escape.ts tests/unit/escape.test.ts
git commit -m "feat(export): html, attr, and url escaping"
```

---

## Task 2 — Render head and body skeleton

**Files:**
- Create: `src/lib/export/renderEmail.ts`
- Test: `tests/unit/export.test.ts`

- [ ] **Step 1: Failing test for the skeleton**

`tests/unit/export.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { renderEmail } from '@/lib/export/renderEmail';
import { createDefaultProject } from '@/lib/editor/defaultProject';

describe('renderEmail — skeleton', () => {
  it('starts with DOCTYPE and html tag', () => {
    const out = renderEmail(createDefaultProject());
    expect(out.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(out).toContain('<html');
    expect(out.endsWith('</html>')).toBe(true);
  });

  it('includes mso/xmlns attributes on <html>', () => {
    const out = renderEmail(createDefaultProject());
    expect(out).toContain('xmlns:v="urn:schemas-microsoft-com:vml"');
    expect(out).toContain('xmlns:o="urn:schemas-microsoft-com:office:office"');
  });

  it('body background-color reflects global.backgroundColor', () => {
    const data = createDefaultProject();
    data.global.backgroundColor = '#abcdef';
    const out = renderEmail(data);
    expect(out).toContain('background-color: #abcdef');
  });
});
```

- [ ] **Step 2: Run — expect fail**

```powershell
npm test
```

- [ ] **Step 3: Implement renderEmail skeleton + helpers**

`src/lib/export/renderEmail.ts`:

```typescript
import type { ProjectData } from '@/lib/editor/types';
import { attrEscape, htmlEscape, urlSafe } from './escape';

export function renderEmail(data: ProjectData): string {
  return [
    '<!DOCTYPE html>',
    '<html xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="en">',
    renderHead(),
    renderBody(data),
    '</html>',
  ].join('\n');
}

function renderHead(): string {
  return [
    '<head>',
    '<title></title>',
    '<meta http-equiv="Content-Type" content="text/html; charset=utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '<style>',
    '* { box-sizing: border-box; }',
    'body { margin: 0; padding: 0; }',
    'a[x-apple-data-detectors] { color: inherit !important; text-decoration: inherit !important; }',
    '#MessageViewBody a { color: inherit; text-decoration: none; }',
    'p { line-height: inherit }',
    '.desktop_hide, .desktop_hide table { mso-hide: all; display: none; max-height: 0px; overflow: hidden; }',
    '@media (max-width:730px) {',
    '  .row-content { width: 100% !important; }',
    '  .stack .column { width: 100%; display: block; }',
    '  .reverse { display: table; width: 100%; }',
    '  .reverse .column.first { display: table-footer-group !important; }',
    '  .reverse .column.last { display: table-header-group !important; }',
    '}',
    '</style>',
    '</head>',
  ].join('\n');
}

function renderBody(data: ProjectData): string {
  const bg = attrEscape(data.global.backgroundColor);
  return [
    `<body style="background-color: ${bg}; margin: 0; padding: 0;">`,
    `<table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background-color: ${bg};">`,
    '<tbody><tr><td>',
    renderHeader(data),
    ...data.sections.map((s, i) => renderSection(s, i, data)),
    renderFooter(data),
    '</td></tr></tbody></table>',
    '</body>',
  ].join('\n');
}

function renderHeader(data: ProjectData): string {
  const { header, global } = data;
  return [
    '<table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">',
    '<tbody><tr><td>',
    `<table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width: 710px; margin: 0 auto;" width="710"><tbody><tr><td class="column" width="100%" style="vertical-align: top;">`,
    '<div style="height:20px;line-height:20px;font-size:1px;">&#8202;</div>',
    header.logoSrc ? `<div align="center" style="line-height:10px"><div style="max-width: ${header.logoWidth}px;"><img src="${attrEscape(header.logoSrc)}" alt="${attrEscape(header.logoAlt)}" width="${header.logoWidth}" style="display:block;height:auto;border:0;width:100%;"></div></div>` : '',
    '<div style="height:20px;line-height:20px;font-size:1px;">&#8202;</div>',
    header.title ? `<h1 style="margin:0;color:${attrEscape(global.textColor)};font-family:${attrEscape(global.fontFamily)};font-size:${header.titleFontSize}px;font-weight:400;line-height:120%;text-align:center;">${htmlEscape(header.title)}</h1>` : '',
    '<div style="height:20px;line-height:20px;font-size:1px;">&#8202;</div>',
    header.bannerSrc ? `<div align="center" style="line-height:10px"><div style="max-width:710px;"><img src="${attrEscape(header.bannerSrc)}" alt="${attrEscape(header.bannerAlt)}" width="710" style="display:block;height:auto;border:0;width:100%;"></div></div>` : '',
    header.sectionHeading ? `<h3 style="margin:0;color:${attrEscape(global.textColor)};font-family:${attrEscape(global.fontFamily)};font-size:${header.sectionHeadingFontSize}px;font-weight:400;line-height:120%;text-align:center;">${htmlEscape(header.sectionHeading)}</h3>` : '',
    '</td></tr></tbody></table>',
    '</td></tr></tbody></table>',
  ].filter(Boolean).join('\n');
}

function renderSection(s: ProjectData['sections'][number], idx: number, data: ProjectData): string {
  const g = data.global;
  const titleSize = s.titleFontSize ?? g.headingFontSize;
  const bulletSize = s.bulletFontSize ?? g.baseFontSize;
  const textColor = s.textColor ?? g.textColor;
  const buttonColor = s.buttonColor ?? g.buttonColor;
  const ctaUrl = urlSafe(s.ctaUrl ?? g.contactUrl);
  const reverse = idx % 2 === 1;

  const imageCell = `<td class="column${reverse ? ' last' : ''}" width="50%" style="vertical-align: middle; padding: 20px;">${s.imageSrc ? `<div align="center"><div style="max-width: 355px;"><img src="${attrEscape(s.imageSrc)}" alt="${attrEscape(s.imageAlt)}" width="355" style="display:block;height:auto;border:0;width:100%;"></div></div>` : ''}</td>`;
  const textCell = `<td class="column${reverse ? ' first' : ''}" width="50%" style="vertical-align: middle; padding: 20px;">
<h1 style="margin:0;color:${attrEscape(textColor)};font-family:${attrEscape(g.fontFamily)};font-size:${titleSize}px;line-height:120%;text-align:left;">${htmlEscape(s.title)}</h1>
<ul style="color:${attrEscape(textColor)};font-family:${attrEscape(g.fontFamily)};font-size:${bulletSize}px;line-height:150%;text-align:left;">
${s.bullets.map(b => `<li>${htmlEscape(b)}</li>`).join('\n')}
</ul>
<div align="left"><a href="${attrEscape(ctaUrl)}" target="_blank" style="background-color:${attrEscape(buttonColor)};border-radius:10px;color:${attrEscape(g.buttonTextColor)};display:inline-block;font-family:${attrEscape(g.fontFamily)};font-size:16px;font-weight:700;padding:10px 30px;text-decoration:none;">${htmlEscape(s.ctaText)}</a></div>
</td>`;

  const cells = reverse ? `${textCell}${imageCell}` : `${imageCell}${textCell}`;
  const trClass = reverse ? ' class="reverse"' : '';
  const sectionBg = s.backgroundColor ? ` style="background-color: ${attrEscape(s.backgroundColor)};"` : '';

  return `<table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"${sectionBg}><tbody><tr><td><table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:710px;margin:0 auto;" width="710"><tbody><tr${trClass}>${cells}</tr></tbody></table></td></tr></tbody></table>`;
}

function renderFooter(data: ProjectData): string {
  const { footer, global } = data;
  const bg = attrEscape(footer.backgroundColor ?? global.footerBackgroundColor);
  const fg = attrEscape(footer.textColor ?? global.footerTextColor);
  const link = attrEscape(global.accentColor);

  const websiteHtml = footer.websites.map((w, i) => {
    const sep = i > 0 ? ' &amp; ' : '';
    return `${sep}<a href="${attrEscape(urlSafe(w.url))}" style="text-decoration:none;color:${link};">${htmlEscape(w.label)}</a>`;
  }).join('');

  const socialIconUrl: Record<string, string> = {
    facebook: 'https://app-rsrc.getbee.io/public/resources/social-networks-icon-sets/t-only-logo-white/facebook@2x.png',
    linkedin: 'https://app-rsrc.getbee.io/public/resources/social-networks-icon-sets/t-only-logo-white/linkedin@2x.png',
    twitter:  'https://app-rsrc.getbee.io/public/resources/social-networks-icon-sets/t-only-logo-white/twitter@2x.png',
    youtube:  'https://app-rsrc.getbee.io/public/resources/social-networks-icon-sets/t-only-logo-white/youtube@2x.png',
    instagram:'https://app-rsrc.getbee.io/public/resources/social-networks-icon-sets/t-only-logo-white/instagram@2x.png',
  };
  const socialsHtml = footer.socials.map(s =>
    `<td style="padding:0 10px;"><a href="${attrEscape(urlSafe(s.url))}" target="_blank"><img src="${socialIconUrl[s.platform]}" width="32" height="32" alt="${s.platform}" style="display:block;height:auto;border:0;"></a></td>`
  ).join('');

  return `<table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background-color:${bg};"><tbody><tr><td>
<table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background-color:${bg};width:710px;margin:0 auto;" width="710"><tbody><tr><td class="column" width="100%" style="vertical-align:top;">
<div style="height:20px;line-height:20px;font-size:1px;">&#8202;</div>
${footer.bannerSrc ? `<div align="center" style="line-height:10px"><div style="max-width:710px;"><img src="${attrEscape(footer.bannerSrc)}" alt="${attrEscape(footer.bannerAlt)}" width="710" style="display:block;height:auto;border:0;width:100%;"></div></div>` : ''}
<div style="color:${fg};font-family:${attrEscape(global.fontFamily)};font-size:15px;line-height:150%;text-align:center;">
<p style="margin:0;"><strong>${htmlEscape(footer.companyName)}</strong></p>
<p style="margin:0;">${footer.address.split('\n').map(htmlEscape).join('<br>')}</p>
</div>
<div style="height:20px;line-height:20px;font-size:1px;">&#8202;</div>
<div style="color:${fg};font-family:${attrEscape(global.fontFamily)};font-size:15px;line-height:150%;text-align:center;">
<p style="margin:0;">Tel: <a href="tel:${attrEscape(footer.phoneTel)}" style="text-decoration:none;color:${link};">${htmlEscape(footer.phone)}</a></p>
<p style="margin:0;">Email: <a href="mailto:${attrEscape(footer.email)}" style="text-decoration:none;color:${link};">${htmlEscape(footer.email)}</a></p>
${footer.websites.length ? `<p style="margin:0;">Website: ${websiteHtml}</p>` : ''}
</div>
${footer.socials.length ? `<table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation"><tr><td style="text-align:center;padding-top:20px;"><table width="${footer.socials.length * 52}px" border="0" cellpadding="0" cellspacing="0" role="presentation" style="display:inline-block;"><tr>${socialsHtml}</tr></table></td></tr></table>` : ''}
<div style="height:20px;line-height:20px;font-size:1px;">&#8202;</div>
</td></tr></tbody></table>
</td></tr></tbody></table>`;
}
```

- [ ] **Step 4: Run — expect skeleton tests pass**

```powershell
npm test
```

- [ ] **Step 5: Commit**

```powershell
git add src/lib/export/renderEmail.ts tests/unit/export.test.ts
git commit -m "feat(export): renderEmail skeleton with header, sections, footer"
```

---

## Task 3 — Snapshot test against the reference template

**Files:**
- Modify: `tests/unit/export.test.ts`

The default project, when rendered, should be byte-equivalent (after whitespace normalisation) to `reference/globaltt-email.html`. We do NOT enforce exact whitespace match — that would be too brittle — instead we compare structural tokens.

- [ ] **Step 1: Append test that asserts critical content fragments are present**

Append to `tests/unit/export.test.ts`:

```typescript
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('renderEmail — default template content', () => {
  const out = renderEmail(createDefaultProject());
  const ref = readFileSync(resolve(__dirname, '../../reference/globaltt-email.html'), 'utf8');

  // Helpers
  const norm = (s: string) => s.replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim();

  it('contains header logo URL', () => {
    expect(out).toContain('https://36af7d465b.imgdist.com/pub/bfra/wpnsx7uw/j2q/4ah/ptb/logo%20%282%29.png');
  });

  it('contains all 8 product titles', () => {
    [
      'Starlink Solutions', 'V-Sat GEO Satellite Ku-Band', 'V-Sat Satellite PRO',
      'V-Sat GEO Satellite Ka-Band', 'BGAN/Thuraya-IP', 'Iridium GO Exec',
      'Iridium PTT', 'Wi-Fi Long Range',
    ].forEach(t => expect(out).toContain(t));
  });

  it('contains the GlobalTT contact URL on every CTA', () => {
    const matches = out.match(/href="https:\/\/www\.globaltt\.com\/en\/quickContact-GlobalTT\.html"/g);
    expect(matches?.length).toBe(8);
  });

  it('uses class="reverse" on alternating rows', () => {
    const reverseCount = (out.match(/class="reverse"/g) ?? []).length;
    expect(reverseCount).toBe(4); // sections 1, 3, 5, 7
  });

  it('contains footer company name and email', () => {
    expect(out).toContain('GlobalTT Satellite Teleport');
    expect(out).toContain('mailto:info@globaltt.com');
  });

  it('escapes user-supplied content', () => {
    const data = createDefaultProject();
    data.sections[0].title = '<script>alert(1)</script>';
    const evil = renderEmail(data);
    expect(evil).not.toContain('<script>alert(1)</script>');
    expect(evil).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('reference file shares the same critical fragments', () => {
    expect(norm(ref)).toContain('GlobalTT Satellite Teleport');
    expect(norm(ref)).toContain('Starlink Solutions');
  });
});
```

- [ ] **Step 2: Run**

```powershell
npm test
```

If a fragment fails, fix the renderer until it passes. Do NOT lower the assertion to make the test green.

- [ ] **Step 3: Commit**

```powershell
git add tests/unit/export.test.ts
git commit -m "test(export): default project content matches reference fragments"
```

---

## Task 4 — Download endpoint + Topbar wiring

**Files:**
- Create: `src/app/api/projects/[id]/export/route.ts`
- Modify: `src/components/editor/Topbar.tsx`

- [ ] **Step 1: Create the export route**

```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { renderEmail } from '@/lib/export/renderEmail';
import type { ProjectData } from '@/lib/editor/types';

interface Ctx { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from('projects').select('*').eq('id', id).maybeSingle();
  if (!project) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const html = renderEmail(project.data as ProjectData);
  const filename = `${(project.name as string).replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'campaign'}.html`;
  return new NextResponse(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  });
}
```

- [ ] **Step 2: Wire the topbar download button**

In `src/components/editor/Topbar.tsx`, add a `projectId` selector near the existing `useEditor` calls:

```typescript
const projectId = useEditor((s) => s.projectId);
```

Then replace the disabled placeholder button:

```typescript
<Button disabled title="Phase 3 — HTML export">⬇ Download HTML</Button>
```

with a real download link:

```typescript
<a
  href={`/api/projects/${projectId}/export`}
  download
  className="inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium bg-brand text-white hover:opacity-90"
>⬇ Download HTML</a>
```

- [ ] **Step 3: Manual test**

Open editor. Click "Download HTML". Save the file. Open it in a browser — should look like the reference email. Open in a Gmail draft → paste → looks correct.

- [ ] **Step 4: Commit**

```powershell
git add src/app/api/projects/[id]/export src/components/editor/Topbar.tsx
git commit -m "feat(export): /api/projects/[id]/export downloads HTML; topbar Download button"
```

---

## Task 5 — Detectors for the import parser

**Files:**
- Create: `src/lib/import/detectors.ts`
- Test: `tests/unit/detectors.test.ts`

- [ ] **Step 1: Failing tests**

`tests/unit/detectors.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { isLogoImg, isBannerImg, extractBgColor, parseInlineStyle } from '@/lib/import/detectors';

function img(html: string): HTMLImageElement {
  return new JSDOM(`<!doctype html><html><body>${html}</body></html>`).window.document.querySelector('img')!;
}

describe('isLogoImg', () => {
  it('matches alt containing "logo"', () => {
    expect(isLogoImg(img('<img src="x" alt="Company Logo">'))).toBe(true);
  });
  it('matches small width attr', () => {
    expect(isLogoImg(img('<img src="x" alt="" width="200">'))).toBe(true);
  });
  it('rejects large alt-less images', () => {
    expect(isLogoImg(img('<img src="x" alt="" width="710">'))).toBe(false);
  });
});

describe('isBannerImg', () => {
  it('matches large width attr', () => {
    expect(isBannerImg(img('<img src="x" width="710">'))).toBe(true);
  });
  it('rejects small images', () => {
    expect(isBannerImg(img('<img src="x" width="200">'))).toBe(false);
  });
});

describe('parseInlineStyle', () => {
  it('returns map of declarations', () => {
    expect(parseInlineStyle('color: red; font-size: 16px ;'))
      .toEqual({ color: 'red', 'font-size': '16px' });
  });
  it('handles empty', () => {
    expect(parseInlineStyle('')).toEqual({});
  });
});

describe('extractBgColor', () => {
  it('picks bgcolor attr', () => {
    const dom = new JSDOM('<table bgcolor="#abc"></table>');
    expect(extractBgColor(dom.window.document.querySelector('table')!)).toBe('#abc');
  });
  it('picks inline style background-color', () => {
    const dom = new JSDOM('<table style="background-color: #fff;"></table>');
    expect(extractBgColor(dom.window.document.querySelector('table')!)).toBe('#fff');
  });
  it('returns null when missing', () => {
    const dom = new JSDOM('<table></table>');
    expect(extractBgColor(dom.window.document.querySelector('table')!)).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect fail**

```powershell
npm test
```

- [ ] **Step 3: Implement `src/lib/import/detectors.ts`**

```typescript
export function parseInlineStyle(style: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!style) return out;
  for (const decl of style.split(';')) {
    const idx = decl.indexOf(':');
    if (idx === -1) continue;
    const k = decl.slice(0, idx).trim().toLowerCase();
    const v = decl.slice(idx + 1).trim();
    if (k && v) out[k] = v;
  }
  return out;
}

export function isLogoImg(el: HTMLImageElement): boolean {
  const alt = (el.getAttribute('alt') ?? '').toLowerCase();
  if (alt.includes('logo')) return true;
  const w = parseInt(el.getAttribute('width') ?? '', 10);
  if (Number.isFinite(w) && w > 0 && w <= 500 && alt.length > 0) return true;
  return false;
}

export function isBannerImg(el: HTMLImageElement): boolean {
  const w = parseInt(el.getAttribute('width') ?? '', 10);
  return Number.isFinite(w) && w >= 600;
}

export function extractBgColor(el: Element): string | null {
  const bgcolor = el.getAttribute('bgcolor');
  if (bgcolor) return bgcolor;
  const style = parseInlineStyle(el.getAttribute('style') ?? '');
  return style['background-color'] ?? style['background'] ?? null;
}

export function looksDark(color: string): boolean {
  if (!color) return false;
  const c = color.trim().toLowerCase();
  if (c === '#000' || c === '#000000' || c === 'black') return true;
  // Hex #abc / #aabbcc
  const m = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (m) {
    const hex = m[1].length === 3 ? m[1].split('').map(x => x + x).join('') : m[1];
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) < 80;
  }
  return false;
}
```

- [ ] **Step 4: Run — expect pass**

```powershell
npm test
```

- [ ] **Step 5: Commit**

```powershell
git add src/lib/import/detectors.ts tests/unit/detectors.test.ts
git commit -m "feat(import): element detectors and inline-style parser"
```

---

## Task 6 — parseHtml main function

**Files:**
- Create: `src/lib/import/parseHtml.ts`
- Test: `tests/unit/import.test.ts`

- [ ] **Step 1: Failing tests**

`tests/unit/import.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseHtml } from '@/lib/import/parseHtml';

const REFERENCE = readFileSync(resolve(__dirname, '../../reference/globaltt-email.html'), 'utf8');

describe('parseHtml — round-trip on the reference', () => {
  it('detects schema version 1', () => {
    const { data } = parseHtml(REFERENCE);
    expect(data.schemaVersion).toBe(1);
  });

  it('detects 8 product sections', () => {
    const { data } = parseHtml(REFERENCE);
    expect(data.sections.length).toBe(8);
  });

  it('detects the right product titles', () => {
    const { data } = parseHtml(REFERENCE);
    expect(data.sections.map(s => s.title)).toEqual([
      'Starlink Solutions',
      'V-Sat GEO Satellite Ku-Band',
      'V-Sat Satellite PRO',
      'V-Sat GEO Satellite Ka-Band',
      'BGAN/Thuraya-IP',
      'Iridium GO Exec',
      'Iridium PTT',
      'Wi-Fi Long Range',
    ]);
  });

  it('detects logo and banner images', () => {
    const { data } = parseHtml(REFERENCE);
    expect(data.header.logoSrc).toContain('logo');
    expect(data.header.bannerSrc).toContain('Untitled-11x');
  });

  it('detects background color #d0d0d0', () => {
    const { data } = parseHtml(REFERENCE);
    expect(data.global.backgroundColor.toLowerCase()).toBe('#d0d0d0');
  });

  it('detects button color', () => {
    const { data } = parseHtml(REFERENCE);
    expect(data.global.buttonColor.toLowerCase()).toBe('#f1592a');
  });

  it('captures bullets per section', () => {
    const { data } = parseHtml(REFERENCE);
    expect(data.sections[0].bullets[0]).toBe('NEW - Worldwide satellite internet.');
    expect(data.sections[0].bullets.length).toBe(5);
  });

  it('detects footer email', () => {
    const { data } = parseHtml(REFERENCE);
    expect(data.footer.email).toBe('info@globaltt.com');
  });

  it('warns nothing for the reference', () => {
    const { warnings } = parseHtml(REFERENCE);
    // Reference is well-formed; we expect zero or only minor warnings (e.g. no socials matched if format differs)
    expect(warnings.filter(w => w.severity === 'error')).toEqual([]);
  });
});

describe('parseHtml — degenerate inputs', () => {
  it('returns defaults + warnings on empty string', () => {
    const { data, warnings } = parseHtml('');
    expect(data.sections.length).toBe(0);
    expect(warnings.some(w => w.kind === 'no_sections')).toBe(true);
  });

  it('does not throw on garbage', () => {
    expect(() => parseHtml('<<>>')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run — expect fail**

```powershell
npm test
```

- [ ] **Step 3: Implement `src/lib/import/parseHtml.ts`**

```typescript
import { JSDOM } from 'jsdom';
import { v4 as uuid } from 'uuid';
import type { ProjectData, ProductSection, Footer } from '@/lib/editor/types';
import { SCHEMA_VERSION } from '@/lib/editor/types';
import { createDefaultProject } from '@/lib/editor/defaultProject';
import {
  isLogoImg, isBannerImg, extractBgColor, parseInlineStyle, looksDark,
} from './detectors';

export interface ImportWarning {
  kind: string;
  severity: 'info' | 'warn' | 'error';
  message: string;
}

export interface ImportResult {
  data: ProjectData;
  warnings: ImportWarning[];
}

export function parseHtml(html: string): ImportResult {
  const warnings: ImportWarning[] = [];
  const seed = createDefaultProject();
  const data: ProjectData = {
    schemaVersion: SCHEMA_VERSION,
    global: { ...seed.global },
    header: { ...seed.header, logoSrc: '', bannerSrc: '', sectionHeading: '', title: '' },
    sections: [],
    footer: { ...seed.footer, websites: [], socials: [] },
  };

  let dom: JSDOM;
  try { dom = new JSDOM(html); } catch {
    warnings.push({ kind: 'parse_error', severity: 'error', message: 'Could not parse HTML.' });
    return { data, warnings };
  }
  const doc = dom.window.document;

  // Background color
  const body = doc.body;
  const bg = body ? extractBgColor(body) : null;
  if (bg) data.global.backgroundColor = bg;
  else warnings.push({ kind: 'no_bg_color', severity: 'info', message: 'Background color not detected; using default.' });

  // Header logo + banner
  const allImgs = Array.from(doc.querySelectorAll('img')) as HTMLImageElement[];
  const logo = allImgs.find(isLogoImg);
  const banner = allImgs.find(i => i !== logo && isBannerImg(i));
  if (logo) {
    data.header.logoSrc = logo.getAttribute('src') ?? '';
    data.header.logoAlt = logo.getAttribute('alt') ?? '';
    const w = parseInt(logo.getAttribute('width') ?? '', 10);
    if (Number.isFinite(w) && w > 0) data.header.logoWidth = w;
  } else {
    warnings.push({ kind: 'no_logo', severity: 'warn', message: 'Logo image not detected.' });
  }
  if (banner) {
    data.header.bannerSrc = banner.getAttribute('src') ?? '';
    data.header.bannerAlt = banner.getAttribute('alt') ?? '';
  } else {
    warnings.push({ kind: 'no_banner', severity: 'warn', message: 'Banner image not detected.' });
  }

  // Header titles — first <h1> and first <h3> (or <h2>) before the first product section
  const firstH1 = doc.querySelector('h1');
  if (firstH1?.textContent) data.header.title = firstH1.textContent.trim();
  const firstSubHeading = doc.querySelector('h3, h2');
  if (firstSubHeading?.textContent && firstSubHeading.textContent.trim() !== data.header.title) {
    data.header.sectionHeading = firstSubHeading.textContent.trim();
  }

  // Product sections — find row tables containing <h1>, <ul>, <img>, <a> with bg styling
  const rows = Array.from(doc.querySelectorAll('table.row, table[class*="row"]')) as HTMLTableElement[];
  // Fallback for inputs that don't use class="row"
  const candidates = rows.length > 0 ? rows : Array.from(doc.querySelectorAll('table')) as HTMLTableElement[];

  for (const tbl of candidates) {
    const headings = tbl.querySelectorAll('h1, h2');
    const lists = tbl.querySelectorAll('ul');
    const imgs = tbl.querySelectorAll('img');
    const buttons = Array.from(tbl.querySelectorAll('a')).filter(a => {
      const s = parseInlineStyle(a.getAttribute('style') ?? '');
      return s['background-color'] || s['background'];
    });
    if (!headings.length || !lists.length || !imgs.length || !buttons.length) continue;

    const heading = headings[0] as HTMLHeadingElement;
    const list = lists[0] as HTMLUListElement;
    const img = imgs[0] as HTMLImageElement;
    const btn = buttons[0] as HTMLAnchorElement;

    const headingStyle = parseInlineStyle(heading.getAttribute('style') ?? '');
    const listStyle = parseInlineStyle(list.getAttribute('style') ?? '');
    const btnStyle = parseInlineStyle(btn.getAttribute('style') ?? '');

    const section: ProductSection = {
      id: uuid(),
      title: heading.textContent?.trim() ?? '',
      bullets: Array.from(list.querySelectorAll('li')).map(li => (li.textContent ?? '').trim()),
      imageSrc: img.getAttribute('src') ?? '',
      imageAlt: img.getAttribute('alt') ?? '',
      ctaText: btn.textContent?.trim() || 'Contact Us',
      ctaUrl: btn.getAttribute('href') ?? undefined,
    };

    const titlePx = parseInt((headingStyle['font-size'] ?? '').replace('px', ''), 10);
    if (Number.isFinite(titlePx)) section.titleFontSize = titlePx;
    const bulletPx = parseInt((listStyle['font-size'] ?? '').replace('px', ''), 10);
    if (Number.isFinite(bulletPx)) section.bulletFontSize = bulletPx;

    // Pull global button + font from the first encountered
    if (data.sections.length === 0) {
      if (btnStyle['background-color']) data.global.buttonColor = btnStyle['background-color'];
      if (headingStyle['font-family']) data.global.fontFamily = headingStyle['font-family'];
    }

    data.sections.push(section);
  }

  if (data.sections.length === 0) {
    warnings.push({ kind: 'no_sections', severity: 'error', message: 'No product sections detected.' });
  }

  // Footer — last table whose direct background is dark
  const allTables = Array.from(doc.querySelectorAll('table')) as HTMLTableElement[];
  const darkFooter = [...allTables].reverse().find(t => {
    const c = extractBgColor(t);
    return c && looksDark(c);
  });
  if (darkFooter) {
    extractFooter(darkFooter, data.footer);
    const c = extractBgColor(darkFooter);
    if (c) data.footer.backgroundColor = c;
  } else {
    warnings.push({ kind: 'no_footer', severity: 'warn', message: 'Footer not detected; using defaults.' });
  }

  return { data, warnings };
}

function extractFooter(root: HTMLTableElement, footer: Footer) {
  // company + address
  const strongs = root.querySelectorAll('strong');
  if (strongs[0]?.textContent) footer.companyName = strongs[0].textContent.trim();

  const paragraphs = Array.from(root.querySelectorAll('p')).map(p => (p.textContent ?? '').trim()).filter(Boolean);
  // address is usually the next non-empty paragraph after company
  if (paragraphs.length > 1) footer.address = paragraphs[1].replace(/\s*\n?/g, '\n').replace(/\n+/g, '\n').trim();

  // phone, email
  const links = Array.from(root.querySelectorAll('a')) as HTMLAnchorElement[];
  for (const a of links) {
    const href = a.getAttribute('href') ?? '';
    if (href.startsWith('tel:')) {
      footer.phoneTel = href.replace(/^tel:/, '');
      footer.phone = (a.textContent ?? '').trim();
    } else if (href.startsWith('mailto:')) {
      footer.email = href.replace(/^mailto:/, '');
    } else if (href.startsWith('http')) {
      footer.websites.push({ label: (a.textContent ?? href).trim(), url: href });
    }
  }

  // socials — image links to known social hosts
  const platformDetectors: Array<{ regex: RegExp; platform: 'facebook' | 'linkedin' | 'twitter' | 'youtube' | 'instagram' }> = [
    { regex: /facebook/i, platform: 'facebook' },
    { regex: /linkedin/i, platform: 'linkedin' },
    { regex: /twitter|x\.com/i, platform: 'twitter' },
    { regex: /youtube/i, platform: 'youtube' },
    { regex: /instagram/i, platform: 'instagram' },
  ];
  const seen = new Set<string>();
  for (const a of links) {
    const href = a.getAttribute('href') ?? '';
    for (const { regex, platform } of platformDetectors) {
      if (regex.test(href) && !seen.has(href)) {
        footer.socials.push({ platform, url: href });
        seen.add(href);
      }
    }
  }
}

```

- [ ] **Step 4: Install `jsdom` if not already (it was installed in Phase 1 Task 2)**

Already pulled in via test deps. If a missing-module error appears, run:

```powershell
npm install --save-dev jsdom
```

For server-side use of `parseHtml`, we use the same `jsdom` import — Next.js will bundle it for server routes only. To prevent bundling on the client, `parseHtml` is only imported by `/api/import/route.ts` (next task), never by client code.

- [ ] **Step 5: Run — expect pass**

```powershell
npm test
```

If a section count is off (e.g. 7 vs 8), inspect the failing test output, walk the candidate-loop heuristics, adjust until 8 sections detected on the reference. Acceptable to relax the "ul required" rule if needed; document any change in `SPEC.md` §9.

- [ ] **Step 6: Commit**

```powershell
git add src/lib/import/parseHtml.ts tests/unit/import.test.ts
git commit -m "feat(import): parseHtml round-trips the reference template"
```

---

## Task 7 — Import API route

**Files:**
- Create: `src/app/api/import/route.ts`

- [ ] **Step 1: Create route**

```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseHtml } from '@/lib/import/parseHtml';

const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'no_file' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'too_large' }, { status: 413 });
  if (!/\.html?$/i.test(file.name) && file.type !== 'text/html') {
    return NextResponse.json({ error: 'bad_type' }, { status: 415 });
  }

  const html = await file.text();
  const result = parseHtml(html);
  return NextResponse.json(result);
}
```

- [ ] **Step 2: Commit**

```powershell
git add src/app/api/import
git commit -m "feat(api): /api/import parses uploaded HTML, returns data + warnings"
```

---

## Task 8 — Import wizard UI

**Files:**
- Create: `src/components/dashboard/ImportButton.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: `src/components/dashboard/ImportButton.tsx`**

```typescript
'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { ProjectData } from '@/lib/editor/types';

type Stage = 'idle' | 'analysing' | 'review' | 'naming' | 'creating';

interface ParseResponse {
  data: ProjectData;
  warnings: { kind: string; severity: 'info' | 'warn' | 'error'; message: string }[];
}

export function ImportButton() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [parsed, setParsed] = useState<ParseResponse | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  function pick() { inputRef.current?.click(); }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setStage('analysing');
    setError(null);
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/import', { method: 'POST', body: fd });
    if (!res.ok) {
      setError('Could not analyse this HTML file.');
      setStage('idle');
      return;
    }
    const result = (await res.json()) as ParseResponse;
    setParsed(result);
    setName(file.name.replace(/\.html?$/i, ''));
    setStage('review');
  }

  async function confirm() {
    if (!parsed) return;
    setStage('creating');
    // Create a new project, then PATCH with imported data so we control name + data.
    const create = await fetch('/api/projects', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: name || 'Imported campaign' }),
    });
    if (!create.ok) { setError('Could not create project.'); setStage('review'); return; }
    const { id } = await create.json();
    const patch = await fetch(`/api/projects/${id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data: parsed.data }),
    });
    if (!patch.ok) { setError('Could not save imported data.'); setStage('review'); return; }
    router.push(`/p/${id}`);
  }

  return (
    <>
      <Button variant="secondary" onClick={pick} disabled={stage === 'analysing' || stage === 'creating'}>
        <Upload size={14} /> Import HTML
      </Button>
      <input ref={inputRef} type="file" hidden accept=".html,text/html" onChange={onFile} />

      {stage === 'review' && parsed && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6">
          <div className="bg-panel border border-border-strong rounded-xl p-6 w-[560px] max-h-[85vh] overflow-auto">
            <div className="text-xs uppercase tracking-widest text-brand mb-2">Step 2 of 3 — Review</div>
            <h2 className="text-lg font-bold mb-4">We found:</h2>
            <ul className="text-sm space-y-1.5 mb-6">
              <Found ok={!!parsed.data.header.logoSrc} label="Logo image" />
              <Found ok={!!parsed.data.header.bannerSrc} label="Banner image" />
              <Found ok={!!parsed.data.header.title} label="Header title" />
              <Found ok={parsed.data.sections.length > 0} label={`${parsed.data.sections.length} product sections`} />
              <Found ok={!!parsed.data.footer.email} label="Footer details" />
              <Found ok={!!parsed.data.global.backgroundColor} label={`Background colour ${parsed.data.global.backgroundColor}`} />
              <Found ok={!!parsed.data.global.buttonColor} label={`Button colour ${parsed.data.global.buttonColor}`} />
            </ul>
            {parsed.warnings.length > 0 && (
              <div className="mb-4">
                <div className="text-xs uppercase tracking-widest text-muted-2 mb-1">Warnings</div>
                <ul className="text-xs text-muted space-y-1">
                  {parsed.warnings.map((w, i) => (
                    <li key={i} className={w.severity === 'error' ? 'text-danger' : ''}>· {w.message}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="text-xs uppercase tracking-widest text-brand mb-2">Step 3 of 3 — Name</div>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" className="mb-4" />
            {error && <div className="text-danger text-xs mb-3">{error}</div>}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setStage('idle')}>Cancel</Button>
              <Button onClick={confirm} disabled={stage === 'creating' || parsed.data.sections.length === 0}>
                {stage === 'creating' ? 'Creating…' : 'Open in Editor →'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {stage === 'analysing' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 text-fg text-sm">Analysing file…</div>
      )}
    </>
  );
}

function Found({ ok, label }: { ok: boolean; label: string }) {
  return <li className={ok ? 'text-success' : 'text-danger'}>{ok ? '✓' : '✗'} {label}</li>;
}
```

- [ ] **Step 2: Wire into dashboard**

In `src/app/page.tsx`, add the import button next to "+ New Project":

```typescript
// add near other imports
import { ImportButton } from '@/components/dashboard/ImportButton';

// inside the header div, before <NewProjectButton />:
<ImportButton />
```

- [ ] **Step 3: Manual test**

`npm run dev`. Sign in. From dashboard, click Import HTML, pick `reference/globaltt-email.html`. Wizard opens with all green ticks, 8 sections detected. Confirm name, click "Open in Editor". Editor opens with the imported data. Reload — persisted. Stop.

- [ ] **Step 4: Commit**

```powershell
git add src/components/dashboard/ImportButton.tsx src/app/page.tsx
git commit -m "feat(import): dashboard wizard with upload, review, name, confirm"
```

---

## Task 9 — Round-trip E2E

**Files:**
- Create: `tests/e2e/import-export.spec.ts`

- [ ] **Step 1: Create test**

```typescript
import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';

test('export the default project and round-trip via import', async ({ page, context }) => {
  // Sign in
  await page.goto('/login');
  await page.getByPlaceholder('Email address').fill(process.env.E2E_EMAIL!);
  await page.getByPlaceholder('Password').fill(process.env.E2E_PASSWORD!);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL('/');

  // Create + open + download
  await page.getByRole('button', { name: /new project/i }).click();
  await expect(page).toHaveURL(/\/p\//);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: /download html/i }).click();
  const download = await downloadPromise;
  const tmp = resolve(__dirname, `_tmp-${Date.now()}.html`);
  await download.saveAs(tmp);

  // Back to dashboard, import the just-downloaded file
  await page.goto('/');
  await page.getByRole('button', { name: /import html/i }).click();
  // Set the file on the hidden input directly
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(tmp);
  await expect(page.getByText(/8 product sections/)).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: /open in editor/i }).click();
  await expect(page).toHaveURL(/\/p\//);
  await expect(page.getByRole('button', { name: /Starlink Solutions/ })).toBeVisible();
});
```

- [ ] **Step 2: Run**

```powershell
npm run e2e
```

- [ ] **Step 3: Commit**

```powershell
git add tests/e2e/import-export.spec.ts
git commit -m "test(e2e): export then import round-trip"
```

---

## Phase 3 acceptance

- ☑ Click Download HTML → `<project-name>.html` downloads, opens in a browser, looks like the reference email.
- ☑ Click Import HTML, pick the reference file (or any GlobalTT-style email): wizard opens, all checks green, 8 sections detected; Open in Editor → loaded project matches.
- ☑ Round-trip test green: export → import → 8 sections preserved, titles preserved, button colour preserved.
- ☑ XSS attempts in any text field render escaped in the export, not as live HTML.
- ☑ `npm test` and `npm run e2e` green.

**Phase complete. Move to `PHASE-4-POLISH-DEPLOY.md`.**
