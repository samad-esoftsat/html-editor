import { describe, expect, it } from 'vitest';
import { buildPrintHtml } from '@/lib/export/buildPrintHtml';
import { createBlankProject } from '@/lib/editor/templates';
import { createDefaultProject } from '@/lib/editor/defaultProject';

describe('buildPrintHtml', () => {
  it('returns a complete HTML document with toolbar and scripts', async () => {
    const out = await buildPrintHtml(createDefaultProject());
    expect(out.startsWith('<!doctype html>')).toBe(true);
    expect(out).toContain('class="no-print pagedjs_not_pageable"');
    expect(out).toContain('<script src="/vendor/paged.polyfill.js"></script>');
    expect(out).toContain('window.print()');
  });

  it('renders blank template without throwing', async () => {
    await expect(buildPrintHtml(createBlankProject())).resolves.toBeTypeOf('string');
  });
});
