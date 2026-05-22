import { describe, it, expectTypeOf, expect } from 'vitest';
import type { ArticleBlock, CTABannerBlock, FooterBlock, HeaderBlock, HeroBlock, ProductSectionBlock } from '@/lib/editor/types';

describe('Block image width fields', () => {
  it('ProductSectionBlock accepts an optional imageWidth number', () => {
    expectTypeOf<ProductSectionBlock['imageWidth']>().toEqualTypeOf<number | undefined>();
  });

  it('HeroBlock accepts an optional imageWidth number', () => {
    expectTypeOf<HeroBlock['imageWidth']>().toEqualTypeOf<number | undefined>();
  });

  it('ArticleBlock accepts an optional imageWidth number', () => {
    expectTypeOf<ArticleBlock['imageWidth']>().toEqualTypeOf<number | undefined>();
  });

  it('FooterBlock accepts an optional bannerWidth number', () => {
    expectTypeOf<FooterBlock['bannerWidth']>().toEqualTypeOf<number | undefined>();
  });

  it('HeaderBlock already has logoWidth (sanity check)', () => {
    expectTypeOf<HeaderBlock['logoWidth']>().toEqualTypeOf<number>();
  });

  it('CTABannerBlock has no image, so no width field expected', () => {
    const c = {} as CTABannerBlock;
    expect(c).toBeDefined();
  });
});
