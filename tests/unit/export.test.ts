import { describe, it, expect } from 'vitest';
import { renderEmail } from '@/lib/export/renderEmail';
import { createDefaultProject } from '@/lib/editor/defaultProject';
import { productSections } from '@/lib/editor/blocks';

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
    productSections(data.blocks)[0].title = '<script>alert(1)</script>';
    const html = renderEmail(data);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('blocks javascript: in CTA URL by replacing with #', () => {
    const data = createDefaultProject();
    productSections(data.blocks)[0].ctaUrl = 'javascript:alert(1)';
    const html = renderEmail(data);
    expect(html).not.toContain('javascript:alert(1)');
  });
});

describe('renderEmail (reference fragments)', () => {
  it('renders 710px max-width row-content layout', () => {
    const html = renderEmail(createDefaultProject());
    expect(html).toMatch(/width="710"/);
  });

  it('renders the header logo URL exactly as provided', () => {
    const html = renderEmail(createDefaultProject());
    expect(html).toContain(
      'https://36af7d465b.imgdist.com/pub/bfra/wpnsx7uw/j2q/4ah/ptb/logo%20%282%29.png'
    );
  });

  it('renders Starlink first bullet text', () => {
    const html = renderEmail(createDefaultProject());
    expect(html).toContain('NEW - Worldwide satellite internet.');
  });

  it('renders the address split across multiple <p> tags', () => {
    const html = renderEmail(createDefaultProject());
    expect(html).toContain('Scientifique Parc Einstein,');
    expect(html).toContain('Louvain-la-Neuve, Belgium');
  });

  it('renders facebook and linkedin social icons via app-rsrc.getbee.io', () => {
    const html = renderEmail(createDefaultProject());
    expect(html).toContain(
      'https://app-rsrc.getbee.io/public/resources/social-networks-icon-sets/circle-color/facebook@2x.png'
    );
    expect(html).toContain(
      'https://app-rsrc.getbee.io/public/resources/social-networks-icon-sets/circle-color/linkedin@2x.png'
    );
  });

  it('renders websites separated by " &amp; "', () => {
    const html = renderEmail(createDefaultProject());
    expect(html).toContain('www.globaltt.com');
    expect(html).toContain('www.Ipseos.eu');
    expect(html).toMatch(/www\.globaltt\.com<\/a> &amp; <a/);
  });

  it('renders tel: link for the footer phone', () => {
    const html = renderEmail(createDefaultProject());
    expect(html).toContain('tel:+3210395070');
  });

  it('renders the default brand button color #f1592a on CTA buttons', () => {
    const html = renderEmail(createDefaultProject());
    expect(html).toContain('background-color: #f1592a');
  });

  it('escapes & in any URL-derived attribute (no raw & character)', () => {
    const data = createDefaultProject();
    productSections(data.blocks)[0].ctaUrl = 'https://example.com/?a=1&b=2';
    const html = renderEmail(data);
    expect(html).toContain('https://example.com/?a=1&amp;b=2');
  });
});
