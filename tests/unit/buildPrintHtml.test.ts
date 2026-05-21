import { describe, expect, it } from 'vitest';
import { buildPrintHtml } from '@/lib/export/buildPrintHtml';
import { createDefaultProject } from '@/lib/editor/defaultProject';
import { createBlankProject } from '@/lib/editor/templates';

describe('buildPrintHtml', () => {
  it('accepts a ProjectData and returns a complete HTML document', () => {
    const out = buildPrintHtml(createDefaultProject());
    expect(out.startsWith('<!doctype html>')).toBe(true);
    expect(out.trimEnd().endsWith('</html>')).toBe(true);
  });

  it('includes the @page rule from renderPrintDocument', () => {
    const out = buildPrintHtml(createDefaultProject());
    expect(out).toContain('@page');
    expect(out).toContain('@top-center');
    expect(out).toContain('@bottom-center');
  });

  it('injects the PagedJS polyfill script before </body>', () => {
    const out = buildPrintHtml(createDefaultProject());
    expect(out).toContain('<script src="/vendor/paged.polyfill.js"></script>');
    expect(out.indexOf('<script src="/vendor/paged.polyfill.js"')).toBeLessThan(out.indexOf('</body>'));
  });

  it('injects a no-print toolbar with a Print button as first child of <body>', () => {
    const out = buildPrintHtml(createDefaultProject());
    expect(out).toContain('class="no-print pagedjs_not_pageable"');
    expect(out).toContain('>Print / Save as PDF<');
  });

  it('hides .no-print in print media via injected CSS', () => {
    const out = buildPrintHtml(createDefaultProject());
    expect(out).toMatch(/@media print[\s\S]*?\.no-print[\s\S]*?display:\s*none/);
  });

  it('injects an auto-print script that hooks PagedConfig.after', () => {
    const out = buildPrintHtml(createDefaultProject());
    expect(out).toContain('window.PagedConfig');
    expect(out).toContain('window.print()');
  });

  it('renders blank template without throwing', () => {
    expect(() => buildPrintHtml(createBlankProject())).not.toThrow();
  });
});
