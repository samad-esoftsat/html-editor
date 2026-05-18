import { describe, expect, it } from 'vitest';
import { LANGUAGES, isLanguageCode, getLanguage, type LanguageCode } from '@/lib/translate/languages';

describe('languages', () => {
  it('exports a non-empty list', () => {
    expect(LANGUAGES.length).toBeGreaterThan(0);
  });

  it('has unique codes', () => {
    const codes = LANGUAGES.map((l) => l.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('has non-empty labels and abbrevs', () => {
    for (const l of LANGUAGES) {
      expect(l.label.length).toBeGreaterThan(0);
      expect(l.abbrev.length).toBeGreaterThan(0);
    }
  });

  it('includes the spec languages', () => {
    const codes: LanguageCode[] = ['en', 'fr', 'es', 'pt-BR', 'pt-PT', 'it', 'de', 'nl', 'yue', 'zh-CN', 'zh-TW', 'ja'];
    for (const c of codes) {
      expect(isLanguageCode(c)).toBe(true);
    }
  });

  it('isLanguageCode rejects unknown codes', () => {
    expect(isLanguageCode('xx')).toBe(false);
    expect(isLanguageCode('')).toBe(false);
    expect(isLanguageCode('FR')).toBe(false);
  });

  it('getLanguage returns the entry for a valid code', () => {
    const fr = getLanguage('fr');
    expect(fr.code).toBe('fr');
    expect(fr.label).toBe('French');
    expect(fr.abbrev).toBe('FR');
  });
});
