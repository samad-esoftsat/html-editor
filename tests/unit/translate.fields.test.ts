import { describe, expect, it } from 'vitest';
import { extractTranslatable, applyTranslations } from '@/lib/translate/fields';
import { findHeader, findFooter, productSections } from '@/lib/editor/blocks';
import { createDefaultProject } from '@/lib/editor/defaultProject';
import type { ProjectData } from '@/lib/editor/types';

function sample(): ProjectData {
  return {
    schemaVersion: 2,
    global: {
      backgroundColor: '#fff', fontFamily: 'Arial', baseFontSize: 14, headingFontSize: 24,
      textColor: '#000', buttonColor: '#0a0', buttonTextColor: '#fff', accentColor: '#999',
      footerBackgroundColor: '#222', footerTextColor: '#ddd', contactUrl: 'https://example.com/contact',
    },
    blocks: [
      {
        type: 'header',
        id: 'hdr1',
        logoSrc: 'https://example.com/logo.png', logoAlt: 'Logo', logoWidth: 200,
        title: 'Welcome to our event', titleFontSize: 28,
        bannerSrc: 'https://example.com/banner.png', bannerAlt: 'Conference banner',
        sectionHeading: 'Our offerings', sectionHeadingFontSize: 20,
      },
      {
        type: 'product-section',
        id: 's1', title: 'First section',
        bullets: ['Bullet one', 'Bullet two'],
        imageSrc: 'https://example.com/a.png', imageAlt: 'Product A',
        ctaText: 'Learn more', ctaUrl: 'https://example.com/a',
      },
      {
        type: 'product-section',
        id: 's2', title: 'Second section',
        bullets: ['Only bullet'],
        imageSrc: 'https://example.com/b.png', imageAlt: 'Product B',
        ctaText: 'Order now',
      },
      {
        type: 'footer',
        id: 'ftr1',
        bannerSrc: 'https://example.com/fb.png', bannerAlt: 'Footer banner',
        companyName: 'Acme Corp', address: '123 Main St\nLondon\nUK',
        phone: '+44 20 1234 5678', phoneTel: '+442012345678',
        email: 'hello@acme.example',
        websites: [{ label: 'Visit us', url: 'https://acme.example' }],
        socials: [{ platform: 'linkedin', url: 'https://linkedin.com/company/acme' }],
      },
    ],
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
    findHeader(data.blocks).logoAlt = '';
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
    expect(findHeader(result.blocks).title).toBe('Bienvenue à notre événement');
    expect(productSections(result.blocks)[0].title).toBe('Première section');
    expect(productSections(result.blocks)[0].bullets[1]).toBe('Point deux');
    expect(productSections(result.blocks)[0].bullets[0]).toBe('Bullet one');
    expect(findFooter(result.blocks).companyName).toBe('Acme Corp');
    expect(findHeader(result.blocks).logoSrc).toBe('https://example.com/logo.png');
    expect(findFooter(result.blocks).email).toBe('hello@acme.example');
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
    expect(findHeader(result.blocks).title).toBe('Welcome to our event');
    expect(productSections(result.blocks)[0].title).toBe('First section');
  });

  it('preserves newlines in multi-line strings', () => {
    const data = sample();
    const translated = '123 rue Principale\nLondres\nRoyaume-Uni';
    const result = applyTranslations(data, { 'footer.address': translated });
    expect(findFooter(result.blocks).address).toBe(translated);
    expect(findFooter(result.blocks).address.split('\n').length).toBe(3);
  });

  it('handles a translation map containing keys that no longer exist (ignored)', () => {
    const data = sample();
    const result = applyTranslations(data, {
      'sections.5.title': 'Out of range',
      'sections.0.bullets.99': 'Out of range',
    });
    expect(productSections(result.blocks).length).toBe(2);
    expect(productSections(result.blocks)[0].bullets.length).toBe(2);
  });
});

describe('translate fields (Phase 2 block types)', () => {
  function withMiddle(middle: import('@/lib/editor/types').Block[]): import('@/lib/editor/types').ProjectData {
    const base = createDefaultProject();
    const header = base.blocks[0];
    const footer = base.blocks[base.blocks.length - 1];
    return { ...base, blocks: [header, ...middle, footer] };
  }

  it('extracts hero, article, and cta-banner strings under blocks.${i}.* namespace', () => {
    const hero: import('@/lib/editor/types').HeroBlock = {
      type: 'hero', id: 'h', imageSrc: '', imageAlt: 'alt-h', title: 'HeroT', subtitle: 'HeroS', ctaText: 'HeroC',
    };
    const article: import('@/lib/editor/types').ArticleBlock = {
      type: 'article', id: 'a', imageSrc: '', imageAlt: 'alt-a', title: 'ArtT', body: 'ArtB', ctaText: 'ArtC', imagePosition: 'top',
    };
    const cta: import('@/lib/editor/types').CTABannerBlock = {
      type: 'cta-banner', id: 'c', title: 'CTAt', subtitle: 'CTAs', ctaText: 'CTAc', align: 'center',
    };
    const out = extractTranslatable(withMiddle([hero, article, cta]));
    // Header is at index 0, so hero is at 1, article at 2, cta at 3.
    expect(out['blocks.1.hero.title']).toBe('HeroT');
    expect(out['blocks.1.hero.subtitle']).toBe('HeroS');
    expect(out['blocks.1.hero.imageAlt']).toBe('alt-h');
    expect(out['blocks.1.hero.ctaText']).toBe('HeroC');
    expect(out['blocks.2.article.title']).toBe('ArtT');
    expect(out['blocks.2.article.body']).toBe('ArtB');
    expect(out['blocks.2.article.imageAlt']).toBe('alt-a');
    expect(out['blocks.2.article.ctaText']).toBe('ArtC');
    expect(out['blocks.3.ctaBanner.title']).toBe('CTAt');
    expect(out['blocks.3.ctaBanner.subtitle']).toBe('CTAs');
    expect(out['blocks.3.ctaBanner.ctaText']).toBe('CTAc');
  });

  it('applies translations back to the right blocks', () => {
    const hero: import('@/lib/editor/types').HeroBlock = {
      type: 'hero', id: 'h', imageSrc: '', imageAlt: 'orig', title: 'Orig', subtitle: 'Origs', ctaText: 'Origc',
    };
    const data = withMiddle([hero]);
    const translated = applyTranslations(data, {
      'blocks.1.hero.title': 'Translated',
      'blocks.1.hero.subtitle': 'Translateds',
      'blocks.1.hero.imageAlt': 'Translatedalt',
      'blocks.1.hero.ctaText': 'Translatedc',
    });
    const h = translated.blocks[1] as import('@/lib/editor/types').HeroBlock;
    expect(h.title).toBe('Translated');
    expect(h.subtitle).toBe('Translateds');
    expect(h.imageAlt).toBe('Translatedalt');
    expect(h.ctaText).toBe('Translatedc');
  });
});
