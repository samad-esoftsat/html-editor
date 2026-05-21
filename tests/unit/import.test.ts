import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseHtml } from '@/lib/import/parseHtml';
import { findHeader, findFooter, productSections } from '@/lib/editor/blocks';

const REFERENCE = readFileSync(resolve(__dirname, '../../reference/globaltt-email.html'), 'utf8');

describe('parseHtml — round-trip on the reference', () => {
  it('detects schema version 2', () => {
    const { data } = parseHtml(REFERENCE);
    expect(data.schemaVersion).toBe(2);
  });

  it('detects 8 product sections', () => {
    const { data } = parseHtml(REFERENCE);
    expect(productSections(data.blocks).length).toBe(8);
  });

  it('detects the right product titles', () => {
    const { data } = parseHtml(REFERENCE);
    expect(productSections(data.blocks).map((s) => s.title)).toEqual([
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
    const header = findHeader(data.blocks);
    expect(header.logoSrc).toContain('logo');
    expect(header.bannerSrc).toContain('Untitled-11x');
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
    const sections = productSections(data.blocks);
    expect(sections[0].bullets[0]).toBe('NEW - Worldwide satellite internet.');
    expect(sections[0].bullets.length).toBe(5);
  });

  it('detects footer email', () => {
    const { data } = parseHtml(REFERENCE);
    expect(findFooter(data.blocks).email).toBe('info@globaltt.com');
  });

  it('preserves footer address lines', () => {
    const { data } = parseHtml(REFERENCE);
    expect(findFooter(data.blocks).address).toBe('Scientifique Parc Einstein,\nLouvain-la-Neuve, Belgium');
  });

  it('keeps social URLs out of footer website links', () => {
    const { data } = parseHtml(REFERENCE);
    const footer = findFooter(data.blocks);
    expect(footer.websites.map((w) => w.url)).toEqual([
      'https://www.globaltt.com',
      'https://www.ipseos.eu',
    ]);
    expect(footer.socials.map((s) => s.platform)).toEqual(['facebook', 'linkedin']);
  });

  it('warns nothing critical for the reference', () => {
    const { warnings } = parseHtml(REFERENCE);
    expect(warnings.filter((w) => w.severity === 'error')).toEqual([]);
  });
});

describe('parseHtml — degenerate inputs', () => {
  it('returns defaults + warnings on empty string', () => {
    const { data, warnings } = parseHtml('');
    expect(productSections(data.blocks).length).toBe(0);
    expect(warnings.some((w) => w.kind === 'no_sections')).toBe(true);
  });

  it('does not throw on garbage', () => {
    expect(() => parseHtml('<<>>')).not.toThrow();
  });
});
