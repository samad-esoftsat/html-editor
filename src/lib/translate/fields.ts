import type {
  ArticleBlock, Block, CTABannerBlock, HeroBlock, ProjectData,
} from '@/lib/editor/types';
import { findHeader, findFooter, productSections } from '@/lib/editor/blocks';

type StringMap = Record<string, string>;

function add(out: StringMap, key: string, value: unknown): void {
  if (typeof value === 'string' && value.length > 0) {
    out[key] = value;
  }
}

function extractHero(out: StringMap, i: number, b: HeroBlock): void {
  add(out, `blocks.${i}.hero.title`, b.title);
  add(out, `blocks.${i}.hero.subtitle`, b.subtitle);
  add(out, `blocks.${i}.hero.imageAlt`, b.imageAlt);
  add(out, `blocks.${i}.hero.ctaText`, b.ctaText);
}

function extractArticle(out: StringMap, i: number, b: ArticleBlock): void {
  add(out, `blocks.${i}.article.title`, b.title);
  add(out, `blocks.${i}.article.body`, b.body);
  add(out, `blocks.${i}.article.imageAlt`, b.imageAlt);
  add(out, `blocks.${i}.article.ctaText`, b.ctaText);
}

function extractCTABanner(out: StringMap, i: number, b: CTABannerBlock): void {
  add(out, `blocks.${i}.ctaBanner.title`, b.title);
  add(out, `blocks.${i}.ctaBanner.subtitle`, b.subtitle);
  add(out, `blocks.${i}.ctaBanner.ctaText`, b.ctaText);
}

export function extractTranslatable(data: ProjectData): StringMap {
  const out: StringMap = {};
  const header = findHeader(data.blocks);
  const footer = findFooter(data.blocks);
  const sections = productSections(data.blocks);

  add(out, 'header.title', header.title);
  add(out, 'header.sectionHeading', header.sectionHeading);
  add(out, 'header.logoAlt', header.logoAlt);
  add(out, 'header.bannerAlt', header.bannerAlt);

  sections.forEach((s, i) => {
    add(out, `sections.${i}.title`, s.title);
    add(out, `sections.${i}.imageAlt`, s.imageAlt);
    add(out, `sections.${i}.ctaText`, s.ctaText);
    s.bullets.forEach((b, j) => add(out, `sections.${i}.bullets.${j}`, b));
  });

  add(out, 'footer.bannerAlt', footer.bannerAlt);
  add(out, 'footer.companyName', footer.companyName);
  add(out, 'footer.address', footer.address);
  footer.websites.forEach((w, i) => add(out, `footer.websites.${i}.label`, w.label));

  data.blocks.forEach((block, i) => {
    if (block.type === 'hero') extractHero(out, i, block);
    else if (block.type === 'article') extractArticle(out, i, block);
    else if (block.type === 'cta-banner') extractCTABanner(out, i, block);
  });

  return out;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function isUsableString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function applyHero(b: HeroBlock, i: number, t: StringMap): void {
  const title = t[`blocks.${i}.hero.title`]; if (isUsableString(title)) b.title = title;
  const sub = t[`blocks.${i}.hero.subtitle`]; if (isUsableString(sub)) b.subtitle = sub;
  const alt = t[`blocks.${i}.hero.imageAlt`]; if (isUsableString(alt)) b.imageAlt = alt;
  const cta = t[`blocks.${i}.hero.ctaText`]; if (isUsableString(cta)) b.ctaText = cta;
}

function applyArticle(b: ArticleBlock, i: number, t: StringMap): void {
  const title = t[`blocks.${i}.article.title`]; if (isUsableString(title)) b.title = title;
  const body = t[`blocks.${i}.article.body`]; if (isUsableString(body)) b.body = body;
  const alt = t[`blocks.${i}.article.imageAlt`]; if (isUsableString(alt)) b.imageAlt = alt;
  const cta = t[`blocks.${i}.article.ctaText`]; if (isUsableString(cta)) b.ctaText = cta;
}

function applyCTABanner(b: CTABannerBlock, i: number, t: StringMap): void {
  const title = t[`blocks.${i}.ctaBanner.title`]; if (isUsableString(title)) b.title = title;
  const sub = t[`blocks.${i}.ctaBanner.subtitle`]; if (isUsableString(sub)) b.subtitle = sub;
  const cta = t[`blocks.${i}.ctaBanner.ctaText`]; if (isUsableString(cta)) b.ctaText = cta;
}

export function applyTranslations(data: ProjectData, translations: StringMap): ProjectData {
  const out: ProjectData = deepClone(data);
  const header = findHeader(out.blocks);
  const footer = findFooter(out.blocks);
  const sections = productSections(out.blocks);

  if (isUsableString(translations['header.title'])) header.title = translations['header.title'];
  if (isUsableString(translations['header.sectionHeading'])) header.sectionHeading = translations['header.sectionHeading'];
  if (isUsableString(translations['header.logoAlt'])) header.logoAlt = translations['header.logoAlt'];
  if (isUsableString(translations['header.bannerAlt'])) header.bannerAlt = translations['header.bannerAlt'];

  sections.forEach((s, i) => {
    const t = translations[`sections.${i}.title`]; if (isUsableString(t)) s.title = t;
    const ia = translations[`sections.${i}.imageAlt`]; if (isUsableString(ia)) s.imageAlt = ia;
    const ct = translations[`sections.${i}.ctaText`]; if (isUsableString(ct)) s.ctaText = ct;
    s.bullets.forEach((_, j) => {
      const b = translations[`sections.${i}.bullets.${j}`];
      if (isUsableString(b)) s.bullets[j] = b;
    });
  });

  if (isUsableString(translations['footer.bannerAlt'])) footer.bannerAlt = translations['footer.bannerAlt'];
  if (isUsableString(translations['footer.companyName'])) footer.companyName = translations['footer.companyName'];
  if (isUsableString(translations['footer.address'])) footer.address = translations['footer.address'];
  footer.websites.forEach((w, i) => {
    const lab = translations[`footer.websites.${i}.label`]; if (isUsableString(lab)) w.label = lab;
  });

  out.blocks.forEach((block: Block, i) => {
    if (block.type === 'hero') applyHero(block, i, translations);
    else if (block.type === 'article') applyArticle(block, i, translations);
    else if (block.type === 'cta-banner') applyCTABanner(block, i, translations);
  });

  return out;
}
