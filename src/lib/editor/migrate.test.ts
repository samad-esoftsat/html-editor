import { describe, it, expect } from 'vitest';
import { migrate } from './migrate';

const V1_FIXTURE = {
  schemaVersion: 1 as const,
  global: {
    backgroundColor: '#d0d0d0',
    fontFamily: 'Arial',
    baseFontSize: 16,
    headingFontSize: 25,
    textColor: '#000',
    buttonColor: '#f00',
    buttonTextColor: '#fff',
    accentColor: '#f00',
    footerBackgroundColor: '#000',
    footerTextColor: '#fff',
    contactUrl: '',
  },
  header: {
    logoSrc: 'logo.png', logoAlt: 'L', logoWidth: 200,
    title: 'T', titleFontSize: 18,
    bannerSrc: 'b.png', bannerAlt: 'B',
    sectionHeading: 'SH', sectionHeadingFontSize: 25,
  },
  sections: [
    { id: 's1', title: 'Sec 1', bullets: ['a'], imageSrc: '', imageAlt: '', ctaText: 'CTA' },
    { id: 's2', title: 'Sec 2', bullets: ['b'], imageSrc: '', imageAlt: '', ctaText: 'CTA' },
  ],
  footer: {
    bannerSrc: '', bannerAlt: '',
    companyName: 'Co', address: 'Addr', phone: '+1', phoneTel: '+1',
    email: 'e@co', websites: [], socials: [],
  },
};

describe('migrate', () => {
  it('migrates v1 to v2 with header/sections/footer wrapped as blocks', () => {
    const v2 = migrate(V1_FIXTURE);
    expect(v2.schemaVersion).toBe(2);
    expect(v2.global).toEqual(V1_FIXTURE.global);
    expect(v2.blocks).toHaveLength(4);
    expect(v2.blocks[0].type).toBe('header');
    expect(v2.blocks[0].locked).toBe(true);
    expect(v2.blocks[1].type).toBe('product-section');
    expect(v2.blocks[2].type).toBe('product-section');
    expect(v2.blocks[3].type).toBe('footer');
    expect(v2.blocks[3].locked).toBe(true);
  });

  it('preserves existing section ids in v1 → v2', () => {
    const v2 = migrate(V1_FIXTURE);
    const sectionBlocks = v2.blocks.filter((b) => b.type === 'product-section');
    expect(sectionBlocks.map((b) => b.id)).toEqual(['s1', 's2']);
  });

  it('returns v2 input unchanged (identity)', () => {
    const v2Input = migrate(V1_FIXTURE);
    const again = migrate(v2Input);
    expect(again).toBe(v2Input);
  });

  it('treats missing schemaVersion as v1', () => {
    const { schemaVersion: _, ...withoutVersion } = V1_FIXTURE;
    const v2 = migrate(withoutVersion);
    expect(v2.schemaVersion).toBe(2);
    expect(v2.blocks).toHaveLength(4);
  });

  it('throws on unknown schemaVersion', () => {
    expect(() => migrate({ schemaVersion: 99 })).toThrow(/Unsupported schemaVersion/);
  });
});
