import { describe, expect, it } from 'vitest';
import {
  makeHeroBlock,
  makeArticleBlock,
  makeCTABannerBlock,
  BLOCK_METADATA,
  insertableBlockTypes,
} from '@/lib/editor/blocks';

describe('Phase 2 block factories', () => {
  it('makeHeroBlock returns a hero with non-empty defaults and a fresh id', () => {
    const a = makeHeroBlock();
    const b = makeHeroBlock();
    expect(a.type).toBe('hero');
    expect(a.id).not.toBe(b.id);
    expect(a.title.length).toBeGreaterThan(0);
    expect(a.ctaText.length).toBeGreaterThan(0);
  });

  it('makeArticleBlock defaults imagePosition to top', () => {
    const a = makeArticleBlock();
    expect(a.type).toBe('article');
    expect(a.imagePosition).toBe('top');
  });

  it('makeCTABannerBlock defaults align to center', () => {
    const c = makeCTABannerBlock();
    expect(c.type).toBe('cta-banner');
    expect(c.align).toBe('center');
  });

  it('factories accept overrides', () => {
    expect(makeHeroBlock({ title: 'Custom' }).title).toBe('Custom');
    expect(makeArticleBlock({ imagePosition: 'left' }).imagePosition).toBe('left');
    expect(makeCTABannerBlock({ align: 'left' }).align).toBe('left');
  });
});

describe('BLOCK_METADATA registry', () => {
  it('contains every Block variant', () => {
    const expected = ['header', 'footer', 'product-section', 'hero', 'article', 'cta-banner'];
    for (const k of expected) {
      expect(BLOCK_METADATA).toHaveProperty(k);
    }
  });

  it('factory().type matches the registry key for every entry', () => {
    for (const [key, meta] of Object.entries(BLOCK_METADATA)) {
      expect(meta.factory().type).toBe(key);
    }
  });

  it('header and footer are not insertable', () => {
    expect(BLOCK_METADATA.header.insertable).toBe(false);
    expect(BLOCK_METADATA.footer.insertable).toBe(false);
  });

  it('insertableBlockTypes returns four entries: product-section, hero, article, cta-banner', () => {
    const insertable = insertableBlockTypes().map((e) => e.type).sort();
    expect(insertable).toEqual(['article', 'cta-banner', 'hero', 'product-section']);
  });
});
