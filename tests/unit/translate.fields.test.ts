import { describe, expect, it } from 'vitest';
import { applyTranslations, extractTranslatable } from '@/lib/translate/fields';
import { migrateV2ToV3 } from '@/lib/editor/migrate';
import type { LegacyProjectData } from '@/lib/editor/legacy';

function sample() {
  const legacy: LegacyProjectData = {
    schemaVersion: 2,
    global: {
      accentColor: '#999',
      backgroundColor: '#fff',
      baseFontSize: 14,
      buttonColor: '#0a0',
      buttonTextColor: '#fff',
      contactUrl: 'https://example.com/contact',
      fontFamily: 'Arial',
      footerBackgroundColor: '#222',
      footerTextColor: '#ddd',
      headingFontSize: 24,
      textColor: '#000',
    },
    blocks: [
      {
        type: 'header',
        id: 'hdr1',
        logoSrc: 'https://example.com/logo.png',
        logoAlt: 'Logo',
        logoWidth: 200,
        title: 'Welcome to our event',
        titleFontSize: 28,
        bannerSrc: 'https://example.com/banner.png',
        bannerAlt: 'Conference banner',
        sectionHeading: 'Our offerings',
        sectionHeadingFontSize: 20,
      },
      {
        type: 'product-section',
        id: 's1',
        title: 'First section',
        bullets: ['Bullet one', 'Bullet two'],
        imageSrc: 'https://example.com/a.png',
        imageAlt: 'Product A',
        ctaText: 'Learn more',
        ctaUrl: 'https://example.com/a',
      },
      {
        type: 'footer',
        id: 'ftr1',
        bannerSrc: 'https://example.com/fb.png',
        bannerAlt: 'Footer banner',
        companyName: 'Acme Corp',
        address: '123 Main St\nLondon\nUK',
        phone: '+44 20 1234 5678',
        phoneTel: '+442012345678',
        email: 'hello@acme.example',
        websites: [{ label: 'Visit us', url: 'https://acme.example' }],
        socials: [{ platform: 'linkedin', url: 'https://linkedin.com/company/acme' }],
      },
    ],
  };
  return migrateV2ToV3(legacy);
}

describe('extractTranslatable', () => {
  it('extracts user-facing strings from the v3 tree', () => {
    const values = Object.values(extractTranslatable(sample()));
    expect(values).toContain('Welcome to our event');
    expect(values).toContain('Our offerings');
    expect(values).toContain('Product A');
    expect(values).toContain('Learn more');
    expect(values).toContain('123 Main St\nLondon\nUK');
  });

  it('omits empty strings', () => {
    const data = sample();
    const firstKey = Object.entries(extractTranslatable(data)).find(([, value]) => value === 'Logo')?.[0];
    expect(firstKey).toBeTruthy();
    const translated = applyTranslations(data, { [firstKey!]: '' });
    expect(Object.values(extractTranslatable(translated))).not.toContain('');
  });
});

describe('applyTranslations', () => {
  it('applies translations back into a new tree', () => {
    const data = sample();
    const strings = extractTranslatable(data);
    const titleKey = Object.entries(strings).find(([, value]) => value === 'Welcome to our event')?.[0];
    const bulletKey = Object.entries(strings).find(([, value]) => value === 'Bullet two')?.[0];
    const result = applyTranslations(data, {
      [titleKey!]: 'Bienvenue',
      [bulletKey!]: 'Point deux',
    });
    const values = Object.values(extractTranslatable(result));
    expect(values).toContain('Bienvenue');
    expect(values).toContain('Point deux');
    expect(values).toContain('Bullet one');
  });

  it('does not mutate the input data', () => {
    const data = sample();
    const before = JSON.parse(JSON.stringify(data));
    const strings = extractTranslatable(data);
    const titleKey = Object.entries(strings).find(([, value]) => value === 'Welcome to our event')?.[0];
    applyTranslations(data, { [titleKey!]: 'Changed' });
    expect(data).toEqual(before);
  });
});
