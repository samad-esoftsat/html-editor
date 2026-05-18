const LANGUAGES_RAW = [
  { code: 'en', label: 'English', abbrev: 'EN' },
  { code: 'fr', label: 'French', abbrev: 'FR' },
  { code: 'es', label: 'Spanish', abbrev: 'ES' },
  { code: 'pt-BR', label: 'Portuguese (Brazilian)', abbrev: 'pt-BR' },
  { code: 'pt-PT', label: 'Portuguese (European)', abbrev: 'pt-PT' },
  { code: 'it', label: 'Italian', abbrev: 'IT' },
  { code: 'de', label: 'German', abbrev: 'DE' },
  { code: 'nl', label: 'Dutch', abbrev: 'NL' },
  { code: 'yue', label: 'Cantonese', abbrev: 'yue' },
  { code: 'zh-CN', label: 'Mandarin (Simplified)', abbrev: 'zh-CN' },
  { code: 'zh-TW', label: 'Mandarin (Traditional)', abbrev: 'zh-TW' },
  { code: 'ja', label: 'Japanese', abbrev: 'JA' },
] as const;

export type LanguageCode = typeof LANGUAGES_RAW[number]['code'];

export interface Language {
  code: LanguageCode;
  label: string;
  abbrev: string;
}

export const LANGUAGES: readonly Language[] = LANGUAGES_RAW;

const CODE_SET = new Set<string>(LANGUAGES.map((l) => l.code));

export function isLanguageCode(value: unknown): value is LanguageCode {
  return typeof value === 'string' && CODE_SET.has(value);
}

export function getLanguage(code: LanguageCode): Language {
  const found = LANGUAGES.find((l) => l.code === code);
  if (!found) throw new Error(`unknown language code: ${code}`);
  return found;
}
