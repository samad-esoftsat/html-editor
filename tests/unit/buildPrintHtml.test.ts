import { describe, expect, it } from 'vitest';
import { buildPrintHtml } from '@/lib/export/buildPrintHtml';

const SAMPLE = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><p>hello</p></body></html>';

describe('buildPrintHtml', () => {
  it('injects an @page A4 style block into <head>', () => {
    const out = buildPrintHtml(SAMPLE);
    expect(out).toContain('@page { size: A4 portrait; margin: 12mm; }');
    expect(out.indexOf('@page')).toBeLessThan(out.indexOf('</head>'));
  });

  it('injects a window.print() script that fires on load', () => {
    const out = buildPrintHtml(SAMPLE);
    expect(out).toContain('window.print()');
    expect(out).toContain("addEventListener('load'");
  });

  it('injects a no-print toolbar with a Print button into <body>', () => {
    const out = buildPrintHtml(SAMPLE);
    expect(out).toContain('class="no-print"');
    expect(out).toContain('>Print / Save as PDF<');
  });

  it('hides .no-print elements in print media via injected CSS', () => {
    const out = buildPrintHtml(SAMPLE);
    expect(out).toMatch(/@media print[\s\S]*?\.no-print[\s\S]*?display:\s*none/);
  });

  it('leaves the original email body content intact', () => {
    const out = buildPrintHtml(SAMPLE);
    expect(out).toContain('<p>hello</p>');
  });

  it('throws if input has no </head>', () => {
    expect(() => buildPrintHtml('<html><body></body></html>')).toThrow();
  });
});
