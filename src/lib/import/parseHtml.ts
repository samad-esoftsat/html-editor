import * as cheerio from 'cheerio';
import type { Cheerio, CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import { v4 as uuid } from 'uuid';
import type { ProjectData, HeaderBlock, FooterBlock, SocialPlatform } from '@/lib/editor/types';
import { createDefaultProject } from '@/lib/editor/defaultProject';
import { migrate } from '@/lib/editor/migrate';
import { looksDark, parseInlineStyle } from './detectors';

interface V1ParseData {
  schemaVersion: 1;
  global: ProjectData['global'];
  header: {
    logoSrc: string; logoAlt: string; logoWidth: number;
    title: string; titleFontSize: number;
    bannerSrc: string; bannerAlt: string;
    sectionHeading: string; sectionHeadingFontSize: number;
  };
  sections: Array<{
    id: string;
    title: string;
    bullets: string[];
    imageSrc: string; imageAlt: string;
    ctaText: string;
    ctaUrl?: string;
    titleFontSize?: number; bulletFontSize?: number;
    textColor?: string; buttonColor?: string; backgroundColor?: string;
  }>;
  footer: {
    bannerSrc: string; bannerAlt: string;
    companyName: string; address: string; phone: string; phoneTel: string;
    email: string;
    websites: { label: string; url: string }[];
    socials: { platform: 'facebook' | 'linkedin' | 'twitter' | 'youtube' | 'instagram'; url: string }[];
    backgroundColor?: string; textColor?: string;
  };
}

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
  const seedHeaderBlock = seed.blocks.find((b): b is HeaderBlock => b.type === 'header')!;
  const seedFooterBlock = seed.blocks.find((b): b is FooterBlock => b.type === 'footer')!;
  const { type: _seedHt, id: _seedHi, locked: _seedHl, ...seedHeaderFields } = seedHeaderBlock;
  const { type: _seedFt, id: _seedFi, locked: _seedFl, ...seedFooterFields } = seedFooterBlock;
  const v1: V1ParseData = {
    schemaVersion: 1,
    global: { ...seed.global },
    header: { ...seedHeaderFields, logoSrc: '', bannerSrc: '', sectionHeading: '', title: '' },
    sections: [],
    footer: { ...seedFooterFields, websites: [], socials: [] },
  };

  let $: CheerioAPI;
  try {
    $ = cheerio.load(html);
  } catch {
    warnings.push({ kind: 'parse_error', severity: 'error', message: 'Could not parse HTML.' });
    return { data: migrate(v1), warnings };
  }

  try {
    const body = $('body').first();
    const bg = body.length ? extractBgColor($, body) : null;
    if (bg) v1.global.backgroundColor = bg;
    else warnings.push({ kind: 'no_bg_color', severity: 'info', message: 'Background color not detected; using default.' });

    const allImgs = $('img').toArray();
    const logo = allImgs.find((el) => isLogoImg($, el));
    const banner = allImgs.find((el) => el !== logo && isBannerImg($, el));
    if (logo) {
      const logoEl = $(logo);
      v1.header.logoSrc = logoEl.attr('src') ?? '';
      v1.header.logoAlt = logoEl.attr('alt') ?? '';
      const w = parseInt(logoEl.attr('width') ?? '', 10);
      if (Number.isFinite(w) && w > 0) v1.header.logoWidth = w;
    } else {
      warnings.push({ kind: 'no_logo', severity: 'warn', message: 'Logo image not detected.' });
    }
    if (banner) {
      const bannerEl = $(banner);
      v1.header.bannerSrc = bannerEl.attr('src') ?? '';
      v1.header.bannerAlt = bannerEl.attr('alt') ?? '';
    } else {
      warnings.push({ kind: 'no_banner', severity: 'warn', message: 'Banner image not detected.' });
    }

    const firstH1 = $('h1').first();
    if (firstH1.length && firstH1.text()) v1.header.title = firstH1.text().trim();
    const firstSubHeading = $('h3, h2').first();
    if (firstSubHeading.length && firstSubHeading.text().trim() !== v1.header.title) {
      v1.header.sectionHeading = firstSubHeading.text().trim();
    }

    const rows = $('table.row, table[class*="row"]').toArray();
    const candidates = rows.length > 0 ? rows : $('table').toArray();
    const usedHeadingHtml = new Set<string>();

    for (const tbl of candidates) {
      const table = $(tbl);
      const headings = table.find('h1, h2');
      const lists = table.find('ul');
      const imgs = table.find('img');
      const buttons = table.find('a').toArray().filter((a) => {
        const s = parseInlineStyle($(a).attr('style') ?? '');
        return s['background-color'] || s.background;
      });
      if (!headings.length || !lists.length || !imgs.length || !buttons.length) continue;

      const heading = headings.first();
      const headingKey = $.html(heading);
      if (usedHeadingHtml.has(headingKey)) continue;
      usedHeadingHtml.add(headingKey);

      const list = lists.first();
      const img = imgs.first();
      const btn = $(buttons[0]);
      const headingStyle = parseInlineStyle(heading.attr('style') ?? '');
      const listStyle = parseInlineStyle(list.attr('style') ?? '');
      const btnStyle = parseInlineStyle(btn.attr('style') ?? '');

      const section: V1ParseData['sections'][number] = {
        id: uuid(),
        title: heading.text().trim(),
        bullets: list.find('li').toArray().map((li) => $(li).text().trim()),
        imageSrc: img.attr('src') ?? '',
        imageAlt: img.attr('alt') ?? '',
        ctaText: btn.text().trim() || 'Contact Us',
        ctaUrl: btn.attr('href') ?? undefined,
      };

      const titlePx = parseInt((headingStyle['font-size'] ?? '').replace('px', ''), 10);
      if (Number.isFinite(titlePx)) section.titleFontSize = titlePx;
      const bulletPx = parseInt((listStyle['font-size'] ?? '').replace('px', ''), 10);
      if (Number.isFinite(bulletPx)) section.bulletFontSize = bulletPx;

      if (v1.sections.length === 0) {
        if (btnStyle['background-color']) v1.global.buttonColor = btnStyle['background-color'];
        if (headingStyle['font-family']) v1.global.fontFamily = headingStyle['font-family'];
      }

      v1.sections.push(section);
    }

    if (v1.sections.length === 0) {
      warnings.push({ kind: 'no_sections', severity: 'error', message: 'No product sections detected.' });
    }

    const allTables = $('table').toArray();
    const darkFooter = [...allTables].reverse().find((t) => {
      const c = extractBgColor($, $(t));
      return c && looksDark(c);
    });
    if (darkFooter) {
      const footer = $(darkFooter);
      extractFooter($, footer, v1.footer);
      const c = extractBgColor($, footer);
      if (c) v1.footer.backgroundColor = c;
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

  return { data: migrate(v1), warnings };
}

function isLogoImg($: CheerioAPI, el: Element): boolean {
  const img = $(el);
  const alt = (img.attr('alt') ?? '').toLowerCase();
  if (alt.includes('logo')) return true;
  const w = parseInt(img.attr('width') ?? '', 10);
  return Number.isFinite(w) && w > 0 && w <= 500 && alt.length > 0;
}

function isBannerImg($: CheerioAPI, el: Element): boolean {
  const w = parseInt($(el).attr('width') ?? '', 10);
  return Number.isFinite(w) && w >= 600;
}

function extractBgColor($: CheerioAPI, el: Cheerio<Element>): string | null {
  const bgcolor = el.attr('bgcolor');
  if (bgcolor) return bgcolor;
  const style = parseInlineStyle(el.attr('style') ?? '');
  return style['background-color'] ?? style.background ?? null;
}

function extractFooter($: CheerioAPI, root: Cheerio<Element>, footer: V1ParseData['footer']) {
  const strongs = root.find('strong');
  const firstStrong = strongs.first();
  if (firstStrong.length && firstStrong.text()) footer.companyName = firstStrong.text().trim();

  const paragraphs = root.find('p').toArray().map((p) => textWithLineBreaks($, $(p))).filter(Boolean);
  if (paragraphs.length > 1) footer.address = normalizeFooterAddress(paragraphs[1]);

  const links = root.find('a').toArray();
  for (const a of links) {
    const link = $(a);
    const href = link.attr('href') ?? '';
    if (href.startsWith('tel:')) {
      footer.phoneTel = href.replace(/^tel:/, '');
      footer.phone = link.text().trim();
    } else if (href.startsWith('mailto:')) {
      footer.email = href.replace(/^mailto:/, '');
    } else if (href.startsWith('http') && !detectSocialPlatform(href)) {
      footer.websites.push({ label: (link.text() || href).trim(), url: href });
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
    const href = $(a).attr('href') ?? '';
    for (const { regex, platform } of platformDetectors) {
      if (regex.test(href) && !seen.has(href)) {
        footer.socials.push({ platform, url: href });
        seen.add(href);
      }
    }
  }
}

function detectSocialPlatform(href: string): SocialPlatform | null {
  if (/facebook/i.test(href)) return 'facebook';
  if (/linkedin/i.test(href)) return 'linkedin';
  if (/twitter|x\.com/i.test(href)) return 'twitter';
  if (/youtube/i.test(href)) return 'youtube';
  if (/instagram/i.test(href)) return 'instagram';
  return null;
}

function normalizeFooterAddress(value: string) {
  return value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

function textWithLineBreaks($: CheerioAPI, el: Cheerio<Element>) {
  const clone = el.clone();
  clone.find('br').replaceWith('\n');
  return normalizeFooterAddress(clone.text());
}
