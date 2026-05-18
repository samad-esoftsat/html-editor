import type { ProjectData } from '@/lib/editor/types';

type StringMap = Record<string, string>;

function add(out: StringMap, key: string, value: unknown): void {
  if (typeof value === 'string' && value.length > 0) {
    out[key] = value;
  }
}

export function extractTranslatable(data: ProjectData): StringMap {
  const out: StringMap = {};

  add(out, 'header.title', data.header.title);
  add(out, 'header.sectionHeading', data.header.sectionHeading);
  add(out, 'header.logoAlt', data.header.logoAlt);
  add(out, 'header.bannerAlt', data.header.bannerAlt);

  data.sections.forEach((s, i) => {
    add(out, `sections.${i}.title`, s.title);
    add(out, `sections.${i}.imageAlt`, s.imageAlt);
    add(out, `sections.${i}.ctaText`, s.ctaText);
    s.bullets.forEach((b, j) => add(out, `sections.${i}.bullets.${j}`, b));
  });

  add(out, 'footer.bannerAlt', data.footer.bannerAlt);
  add(out, 'footer.companyName', data.footer.companyName);
  add(out, 'footer.address', data.footer.address);
  data.footer.websites.forEach((w, i) => add(out, `footer.websites.${i}.label`, w.label));

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

  if (isUsableString(translations['header.title'])) out.header.title = translations['header.title'];
  if (isUsableString(translations['header.sectionHeading'])) out.header.sectionHeading = translations['header.sectionHeading'];
  if (isUsableString(translations['header.logoAlt'])) out.header.logoAlt = translations['header.logoAlt'];
  if (isUsableString(translations['header.bannerAlt'])) out.header.bannerAlt = translations['header.bannerAlt'];

  out.sections.forEach((s, i) => {
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

  if (isUsableString(translations['footer.bannerAlt'])) out.footer.bannerAlt = translations['footer.bannerAlt'];
  if (isUsableString(translations['footer.companyName'])) out.footer.companyName = translations['footer.companyName'];
  if (isUsableString(translations['footer.address'])) out.footer.address = translations['footer.address'];
  out.footer.websites.forEach((w, i) => {
    const lab = translations[`footer.websites.${i}.label`];
    if (isUsableString(lab)) w.label = lab;
  });

  return out;
}
