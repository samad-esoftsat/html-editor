import { describe, expect, it } from 'vitest';
import { renderPrintDocument } from '@/lib/export/renderPrintDocument';
import { createDefaultProject } from '@/lib/editor/defaultProject';
import { createBlankProject } from '@/lib/editor/templates';

describe('renderPrintDocument — document structure', () => {
  it('returns a string starting with <!doctype html>', () => {
    const html = renderPrintDocument(createDefaultProject());
    expect(html.startsWith('<!doctype html>')).toBe(true);
  });

  it('closes with </html>', () => {
    const html = renderPrintDocument(createDefaultProject());
    expect(html.trimEnd().endsWith('</html>')).toBe(true);
  });

  it('declares lang="en" on <html>', () => {
    const html = renderPrintDocument(createDefaultProject());
    expect(html).toMatch(/<html[^>]*lang="en"/);
  });

  it('has <head> with charset utf-8 and viewport meta', () => {
    const html = renderPrintDocument(createDefaultProject());
    expect(html).toMatch(/<meta charset="utf-8"/i);
    expect(html).toMatch(/<meta name="viewport"/i);
  });

  it('includes @page rule with @top-center and @bottom-center', () => {
    const html = renderPrintDocument(createDefaultProject());
    expect(html).toContain('@page');
    expect(html).toContain('@top-center');
    expect(html).toContain('@bottom-center');
  });

  it('declares .running-header with position: running(header-region)', () => {
    const html = renderPrintDocument(createDefaultProject());
    expect(html).toMatch(/\.running-header\s*\{[^}]*position:\s*running\(header-region\)/);
  });

  it('declares .running-footer with position: running(footer-region)', () => {
    const html = renderPrintDocument(createDefaultProject());
    expect(html).toMatch(/\.running-footer\s*\{[^}]*position:\s*running\(footer-region\)/);
  });

  it('declares .print-block with break-inside: avoid', () => {
    const html = renderPrintDocument(createDefaultProject());
    expect(html).toMatch(/\.print-block\s*\{[^}]*break-inside:\s*avoid/);
  });

  it('body contains a .running-header div and a .running-footer div', () => {
    const html = renderPrintDocument(createDefaultProject());
    expect(html).toMatch(/<div class="running-header">/);
    expect(html).toMatch(/<div class="running-footer">/);
  });

  it('body contains a <main> element', () => {
    const html = renderPrintDocument(createDefaultProject());
    expect(html).toContain('<main>');
    expect(html).toContain('</main>');
  });

  it('the blank template (empty content) still produces a valid document', () => {
    const html = renderPrintDocument(createBlankProject());
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html.trimEnd().endsWith('</html>')).toBe(true);
  });
});

describe('renderPrintDocument — header and footer content', () => {
  it('running-header div contains the header logo image', () => {
    const html = renderPrintDocument(createDefaultProject());
    expect(html).toContain('https://36af7d465b.imgdist.com/pub/bfra/wpnsx7uw/j2q/4ah/ptb/logo%20%282%29.png');
  });

  it('running-header div contains the header title', () => {
    const html = renderPrintDocument(createDefaultProject());
    expect(html).toContain('Critical communication');
  });

  it('running-header div contains the section heading', () => {
    const html = renderPrintDocument(createDefaultProject());
    expect(html).toContain('Satellite High Throughput Connectivity');
  });

  it('running-footer div contains the company name', () => {
    const html = renderPrintDocument(createDefaultProject());
    expect(html).toContain('GlobalTT Satellite Teleport');
  });

  it('running-footer div contains the email link', () => {
    const html = renderPrintDocument(createDefaultProject());
    expect(html).toContain('mailto:info@globaltt.com');
  });

  it('escapes XSS in header title', () => {
    const data = createDefaultProject();
    const header = data.blocks[0];
    if (header.type !== 'header') throw new Error('expected header');
    header.title = '<script>alert(1)</script>';
    const html = renderPrintDocument(data);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
