import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseHtml } from '@/lib/import/parseHtml';
import { findFooter, findHeader, productSections } from '@/lib/editor/blocks';

const REFERENCE = readFileSync(resolve(__dirname, '../../reference/globaltt-email.html'), 'utf8');

describe('parseHtml', () => {
  it('returns schema version 3 data with legacy block mirror', () => {
    const { data } = parseHtml(REFERENCE);
    expect(data.schemaVersion).toBe(3);
    expect(data.tree).toBeTruthy();
    expect(productSections(data.blocks).length).toBe(8);
  });

  it('detects key content from the reference email', () => {
    const { data } = parseHtml(REFERENCE);
    expect(findHeader(data.blocks).logoSrc).toContain('logo');
    expect(productSections(data.blocks)[0].title).toBe('Starlink Solutions');
    expect(findFooter(data.blocks).email).toBe('info@globaltt.com');
  });

  it('returns warnings for degenerate input without throwing', () => {
    const { data, warnings } = parseHtml('');
    expect(productSections(data.blocks).length).toBe(0);
    expect(warnings.some((warning) => warning.kind === 'no_sections')).toBe(true);
    expect(() => parseHtml('<<>>')).not.toThrow();
  });
});
