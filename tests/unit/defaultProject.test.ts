import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '@/lib/editor/defaultProject';
import { SCHEMA_VERSION } from '@/lib/editor/types';
import { findFooter, productSections } from '@/lib/editor/blocks';

describe('createDefaultProject', () => {
  it('returns schemaVersion 1', () => {
    expect(createDefaultProject().schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('has 8 product sections matching the reference template titles', () => {
    const expected = [
      'Starlink Solutions',
      'V-Sat GEO Satellite Ku-Band',
      'V-Sat Satellite PRO',
      'V-Sat GEO Satellite Ka-Band',
      'BGAN/Thuraya-IP',
      'Iridium GO Exec',
      'Iridium PTT',
      'Wi-Fi Long Range',
    ];
    const titles = productSections(createDefaultProject().blocks).map((section) => section.title);
    expect(titles).toEqual(expected);
  });

  it('section index 1 has titleFontSize 21', () => {
    expect(productSections(createDefaultProject().blocks)[1].titleFontSize).toBe(21);
  });

  it('section index 6 has bulletFontSize 14', () => {
    expect(productSections(createDefaultProject().blocks)[6].bulletFontSize).toBe(14);
  });

  it('section ids are unique uuids', () => {
    const ids = productSections(createDefaultProject().blocks).map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id).toMatch(/^[0-9a-f-]{36}$/i));
  });

  it('global defaults match the reference', () => {
    const global = createDefaultProject().global;
    expect(global.backgroundColor).toBe('#d0d0d0');
    expect(global.buttonColor).toBe('#f1592a');
    expect(global.fontFamily).toBe('Arial, Helvetica Neue, Helvetica, sans-serif');
  });

  it('footer carries default GlobalTT contact info', () => {
    const footer = findFooter(createDefaultProject().blocks);
    expect(footer.companyName).toBe('GlobalTT Satellite Teleport');
    expect(footer.email).toBe('info@globaltt.com');
    expect(footer.socials.length).toBe(2);
  });
});
