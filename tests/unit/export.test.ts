import { describe, it, expect } from 'vitest';
import { renderEmail } from '@/lib/export/renderEmail';
import { createDefaultProject } from '@/lib/editor/defaultProject';

describe('renderEmail (skeleton)', () => {
  it('returns a string starting with <!DOCTYPE html>', () => {
    const html = renderEmail(createDefaultProject());
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
  });

  it('declares MSO/VML XML namespaces on <html>', () => {
    const html = renderEmail(createDefaultProject());
    expect(html).toMatch(/<html[^>]*xmlns:v="urn:schemas-microsoft-com:vml"/);
    expect(html).toMatch(/<html[^>]*xmlns:o="urn:schemas-microsoft-com:office:office"/);
    expect(html).toMatch(/<html[^>]*lang="en"/);
  });

  it('contains a <head> with charset and viewport meta tags', () => {
    const html = renderEmail(createDefaultProject());
    expect(html).toMatch(/<meta charset="utf-8"/i);
    expect(html).toMatch(/<meta name="viewport"/i);
  });

  it('renders global background color on the outer table', () => {
    const data = createDefaultProject();
    data.global.backgroundColor = '#abcdef';
    const html = renderEmail(data);
    expect(html).toContain('background-color: #abcdef');
  });

  it('closes with </html>', () => {
    const html = renderEmail(createDefaultProject());
    expect(html.trimEnd().endsWith('</html>')).toBe(true);
  });

  it('renders header logo, title, banner, and section heading', () => {
    const html = renderEmail(createDefaultProject());
    expect(html).toContain('https://36af7d465b.imgdist.com/pub/bfra/wpnsx7uw/j2q/4ah/ptb/logo%20%282%29.png');
    expect(html).toContain('Critical communication');
    expect(html).toContain('Satellite High Throughput Connectivity');
  });

  it('renders all 8 default product sections', () => {
    const html = renderEmail(createDefaultProject());
    const titles = [
      'Starlink Solutions',
      'V-Sat GEO Satellite Ku-Band',
      'V-Sat Satellite PRO',
      'V-Sat GEO Satellite Ka-Band',
      'BGAN/Thuraya-IP',
      'Iridium GO Exec',
      'Iridium PTT',
      'Wi-Fi Long Range',
    ];
    for (const t of titles) {
      expect(html).toContain(t);
    }
  });

  it('alternates `class="reverse"` on every other section (4 reverses for 8 sections)', () => {
    const html = renderEmail(createDefaultProject());
    const matches = html.match(/class="reverse"/g) || [];
    expect(matches.length).toBe(4);
  });

  it('renders the contact URL on every CTA button (8 sections)', () => {
    const html = renderEmail(createDefaultProject());
    const url = 'https://www.globaltt.com/en/quickContact-GlobalTT.html';
    const occurrences = html.split(url).length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(8);
  });

  it('renders footer company name and email link', () => {
    const html = renderEmail(createDefaultProject());
    expect(html).toContain('GlobalTT Satellite Teleport');
    expect(html).toContain('mailto:info@globaltt.com');
  });

  it('escapes XSS attempts in section title', () => {
    const data = createDefaultProject();
    data.sections[0].title = '<script>alert(1)</script>';
    const html = renderEmail(data);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('blocks javascript: in CTA URL by replacing with #', () => {
    const data = createDefaultProject();
    data.sections[0].ctaUrl = 'javascript:alert(1)';
    const html = renderEmail(data);
    expect(html).not.toContain('javascript:alert(1)');
  });
});
