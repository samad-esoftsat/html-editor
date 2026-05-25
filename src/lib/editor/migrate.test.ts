import { describe, expect, it } from 'vitest';
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
  it('migrates v1 input to schema v3 with a legacy block mirror', () => {
    const project = migrate(V1_FIXTURE);
    expect(project.schemaVersion).toBe(3);
    expect(project.global).toEqual(V1_FIXTURE.global);
    expect(project.blocks).toHaveLength(4);
    expect(project.tree).toBeTruthy();
  });

  it('preserves section ids in the compatibility mirror', () => {
    const project = migrate(V1_FIXTURE);
    const sectionBlocks = project.blocks.filter((block) => block.type === 'product-section');
    expect(sectionBlocks.map((block) => block.id)).toEqual(['s1', 's2']);
  });

  it('returns schema-v3 input unchanged', () => {
    const project = migrate(V1_FIXTURE);
    const again = migrate(project);
    expect(again).toBe(project);
  });

  it('treats missing schemaVersion as v1', () => {
    const { schemaVersion: _schemaVersion, ...withoutVersion } = V1_FIXTURE;
    expect(migrate(withoutVersion).schemaVersion).toBe(3);
  });

  it('throws on unknown schemaVersion', () => {
    expect(() => migrate({ schemaVersion: 99 })).toThrow(/Unsupported schemaVersion/);
  });
});
