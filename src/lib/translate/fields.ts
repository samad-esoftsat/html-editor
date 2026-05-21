import type { ProjectData } from '@/lib/editor/types';
import { findHeader, findFooter, productSections } from '@/lib/editor/blocks';

type StringMap = Record<string, string>;

function add(out: StringMap, key: string, value: unknown): void {
  if (typeof value === 'string' && value.length > 0) {
    out[key] = value;
  }
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

  return out;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function isUsableString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
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
    const t = translations[`sections.${i}.title`];
    if (isUsableString(t)) s.title = t;
    const ia = translations[`sections.${i}.imageAlt`];
    if (isUsableString(ia)) s.imageAlt = ia;
    const ct = translations[`sections.${i}.ctaText`];
    if (isUsableString(ct)) s.ctaText = ct;
    s.bullets.forEach((_, j) => {
      const b = translations[`sections.${i}.bullets.${j}`];
      if (isUsableString(b)) s.bullets[j] = b;
    });
  });

  if (isUsableString(translations['footer.bannerAlt'])) footer.bannerAlt = translations['footer.bannerAlt'];
  if (isUsableString(translations['footer.companyName'])) footer.companyName = translations['footer.companyName'];
  if (isUsableString(translations['footer.address'])) footer.address = translations['footer.address'];
  footer.websites.forEach((w, i) => {
    const lab = translations[`footer.websites.${i}.label`];
    if (isUsableString(lab)) w.label = lab;
  });

  return out;
}
