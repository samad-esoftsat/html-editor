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

  try {
  const body = doc.body;
  const bg = body ? extractBgColor(body) : null;
  if (bg) data.global.backgroundColor = bg;
  else warnings.push({ kind: 'no_bg_color', severity: 'info', message: 'Background color not detected; using default.' });

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

  const firstH1 = doc.querySelector('h1');
  if (firstH1?.textContent) data.header.title = firstH1.textContent.trim();
  const firstSubHeading = doc.querySelector('h3, h2');
  if (firstSubHeading?.textContent && firstSubHeading.textContent.trim() !== data.header.title) {
    data.header.sectionHeading = firstSubHeading.textContent.trim();
  }

  const rows = Array.from(doc.querySelectorAll('table.row, table[class*="row"]')) as HTMLTableElement[];
  const candidates = rows.length > 0 ? rows : Array.from(doc.querySelectorAll('table')) as HTMLTableElement[];

  const usedHeadings = new Set<Element>();
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
    if (usedHeadings.has(heading)) continue;
    usedHeadings.add(heading);
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

    if (data.sections.length === 0) {
      if (btnStyle['background-color']) data.global.buttonColor = btnStyle['background-color'];
      if (headingStyle['font-family']) data.global.fontFamily = headingStyle['font-family'];
    }

    data.sections.push(section);
  }

  if (data.sections.length === 0) {
    warnings.push({ kind: 'no_sections', severity: 'error', message: 'No product sections detected.' });
  }

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
  } catch (error) {
    console.error('html_import_extraction_failed', error);
    warnings.push({
      kind: 'extraction_failed',
      severity: 'error',
      message: 'Some HTML could not be read; imported the parts that were detected.',
    });
  }

  return { data, warnings };
}

function extractFooter(root: HTMLTableElement, footer: Footer) {
  const strongs = root.querySelectorAll('strong');
  if (strongs[0]?.textContent) footer.companyName = strongs[0].textContent.trim();

  const paragraphs = Array.from(root.querySelectorAll('p')).map(p => (p.textContent ?? '').trim()).filter(Boolean);
  if (paragraphs.length > 1) footer.address = paragraphs[1].replace(/\s*\n?/g, '\n').replace(/\n+/g, '\n').trim();

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
