import { describe, expect, it } from 'vitest';
import { extractTranslatable, applyTranslations } from '@/lib/translate/fields';
import type { ProjectData } from '@/lib/editor/types';

function sample(): ProjectData {
  return {
    schemaVersion: 1,
    global: {
      backgroundColor: '#fff', fontFamily: 'Arial', baseFontSize: 14, headingFontSize: 24,
      textColor: '#000', buttonColor: '#0a0', buttonTextColor: '#fff', accentColor: '#999',
      footerBackgroundColor: '#222', footerTextColor: '#ddd', contactUrl: 'https://example.com/contact',
    },
    header: {
      logoSrc: 'https://example.com/logo.png', logoAlt: 'Logo', logoWidth: 200,
      title: 'Welcome to our event', titleFontSize: 28,
      bannerSrc: 'https://example.com/banner.png', bannerAlt: 'Conference banner',
      sectionHeading: 'Our offerings', sectionHeadingFontSize: 20,
    },
    sections: [
      {
        id: 's1', title: 'First section',
        bullets: ['Bullet one', 'Bullet two'],
        imageSrc: 'https://example.com/a.png', imageAlt: 'Product A',
        ctaText: 'Learn more', ctaUrl: 'https://example.com/a',
      },
      {
        id: 's2', title: 'Second section',
        bullets: ['Only bullet'],
        imageSrc: 'https://example.com/b.png', imageAlt: 'Product B',
        ctaText: 'Order now',
      },
    ],
    footer: {
      bannerSrc: 'https://example.com/fb.png', bannerAlt: 'Footer banner',
      companyName: 'Acme Corp', address: '123 Main St\nLondon\nUK',
      phone: '+44 20 1234 5678', phoneTel: '+442012345678',
      email: 'hello@acme.example',
      websites: [{ label: 'Visit us', url: 'https://acme.example' }],
      socials: [{ platform: 'linkedin', url: 'https://linkedin.com/company/acme' }],
    },
  };
}

describe('extractTranslatable', () => {
  it('returns translatable string fields keyed by dot-path', () => {
    const map = extractTranslatable(sample());
    expect(map['header.title']).toBe('Welcome to our event');
    expect(map['header.sectionHeading']).toBe('Our offerings');
    expect(map['header.logoAlt']).toBe('Logo');
    expect(map['header.bannerAlt']).toBe('Conference banner');
    expect(map['sections.0.title']).toBe('First section');
    expect(map['sections.0.bullets.0']).toBe('Bullet one');
    expect(map['sections.0.bullets.1']).toBe('Bullet two');
    expect(map['sections.0.imageAlt']).toBe('Product A');
    expect(map['sections.0.ctaText']).toBe('Learn more');
    expect(map['sections.1.title']).toBe('Second section');
    expect(map['sections.1.bullets.0']).toBe('Only bullet');
    expect(map['footer.bannerAlt']).toBe('Footer banner');
    expect(map['footer.companyName']).toBe('Acme Corp');
    expect(map['footer.address']).toBe('123 Main St\nLondon\nUK');
    expect(map['footer.websites.0.label']).toBe('Visit us');
  });

  it('does not include URLs, emails, phones, colors, ids, or social platforms', () => {
    const map = extractTranslatable(sample());
    const keys = Object.keys(map);
    expect(keys).not.toContain('header.logoSrc');
    expect(keys).not.toContain('header.bannerSrc');
    expect(keys).not.toContain('sections.0.imageSrc');
    expect(keys).not.toContain('sections.0.ctaUrl');
    expect(keys).not.toContain('sections.0.id');
    expect(keys).not.toContain('global.contactUrl');
    expect(keys).not.toContain('global.backgroundColor');
    expect(keys).not.toContain('footer.email');
    expect(keys).not.toContain('footer.phone');
    expect(keys).not.toContain('footer.phoneTel');
    expect(keys).not.toContain('footer.websites.0.url');
    expect(keys).not.toContain('footer.socials.0.url');
    expect(keys).not.toContain('footer.socials.0.platform');
  });

  it('omits empty strings (no point translating empty fields)', () => {
    const data = sample();
    data.header.logoAlt = '';
    const map = extractTranslatable(data);
    expect(map['header.logoAlt']).toBeUndefined();
  });
});

describe('applyTranslations', () => {
  it('substitutes values at the matching paths', () => {
    const data = sample();
    const result = applyTranslations(data, {
      'header.title': 'Bienvenue à notre événement',
      'sections.0.title': 'Première section',
      'sections.0.bullets.1': 'Point deux',
    });
    expect(result.header.title).toBe('Bienvenue à notre événement');
    expect(result.sections[0].title).toBe('Première section');
    expect(result.sections[0].bullets[1]).toBe('Point deux');
    expect(result.sections[0].bullets[0]).toBe('Bullet one');
    expect(result.footer.companyName).toBe('Acme Corp');
    expect(result.header.logoSrc).toBe('https://example.com/logo.png');
    expect(result.footer.email).toBe('hello@acme.example');
  });

  it('round-trips: apply(data, extract(data)) deep-equals data', () => {
    const data = sample();
    const result = applyTranslations(data, extractTranslatable(data));
    expect(result).toEqual(data);
  });

  it('does not mutate the input data', () => {
    const data = sample();
    const before = JSON.parse(JSON.stringify(data));
    applyTranslations(data, { 'header.title': 'Changed' });
    expect(data).toEqual(before);
  });

  it('ignores non-string values defensively (keeps original)', () => {
    const data = sample();
    const result = applyTranslations(data, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'header.title': 123 as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'sections.0.title': null as any,
    });
    expect(result.header.title).toBe('Welcome to our event');
    expect(result.sections[0].title).toBe('First section');
  });

  it('preserves newlines in multi-line strings', () => {
    const data = sample();
    const translated = '123 rue Principale\nLondres\nRoyaume-Uni';
    const result = applyTranslations(data, { 'footer.address': translated });
    expect(result.footer.address).toBe(translated);
    expect(result.footer.address.split('\n').length).toBe(3);
  });

  it('handles a translation map containing keys that no longer exist (ignored)', () => {
    const data = sample();
    const result = applyTranslations(data, {
      'sections.5.title': 'Out of range',
      'sections.0.bullets.99': 'Out of range',
    });
    expect(result.sections.length).toBe(2);
    expect(result.sections[0].bullets.length).toBe(2);
  });
});
