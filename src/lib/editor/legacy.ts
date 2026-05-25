import { v4 as uuid } from 'uuid';
import type { GlobalStyles } from './types';

export interface LegacyBlockBase {
  id: string;
  locked?: boolean;
}

export interface LegacyHeaderBlock extends LegacyBlockBase {
  type: 'header';
  logoSrc: string;
  logoAlt: string;
  logoWidth: number;
  title: string;
  titleFontSize: number;
  bannerSrc: string;
  bannerAlt: string;
  bannerWidth?: number;
  sectionHeading: string;
  sectionHeadingFontSize: number;
}

export interface LegacyProductSectionBlock extends LegacyBlockBase {
  type: 'product-section';
  title: string;
  bullets: string[];
  imageSrc: string;
  imageAlt: string;
  imageWidth?: number;
  ctaText: string;
  ctaUrl?: string;
  titleFontSize?: number;
  bulletFontSize?: number;
  textColor?: string;
  buttonColor?: string;
  backgroundColor?: string;
}

export interface WebsiteLink {
  label: string;
  url: string;
}

export type SocialPlatform = 'facebook' | 'linkedin' | 'twitter' | 'youtube' | 'instagram';

export interface SocialLink {
  platform: SocialPlatform;
  url: string;
}

export interface LegacyFooterBlock extends LegacyBlockBase {
  type: 'footer';
  bannerSrc: string;
  bannerAlt: string;
  bannerWidth?: number;
  companyName: string;
  address: string;
  phone: string;
  phoneTel: string;
  email: string;
  websites: WebsiteLink[];
  socials: SocialLink[];
  backgroundColor?: string;
  textColor?: string;
}

export interface LegacyHeroBlock extends LegacyBlockBase {
  type: 'hero';
  imageSrc: string;
  imageAlt: string;
  imageWidth?: number;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaUrl?: string;
  titleFontSize?: number;
  subtitleFontSize?: number;
  backgroundColor?: string;
  textColor?: string;
  buttonColor?: string;
}

export interface LegacyArticleBlock extends LegacyBlockBase {
  type: 'article';
  imageSrc: string;
  imageAlt: string;
  imageWidth?: number;
  title: string;
  body: string;
  ctaText: string;
  ctaUrl?: string;
  imagePosition: 'top' | 'left' | 'right';
  titleFontSize?: number;
  bodyFontSize?: number;
  backgroundColor?: string;
  textColor?: string;
}

export interface LegacyCTABannerBlock extends LegacyBlockBase {
  type: 'cta-banner';
  title: string;
  subtitle: string;
  ctaText: string;
  ctaUrl?: string;
  align: 'left' | 'center';
  titleFontSize?: number;
  backgroundColor?: string;
  textColor?: string;
  buttonColor?: string;
}

export type LegacyBlock =
  | LegacyHeaderBlock
  | LegacyProductSectionBlock
  | LegacyHeroBlock
  | LegacyArticleBlock
  | LegacyCTABannerBlock
  | LegacyFooterBlock;

export interface LegacyProjectData {
  schemaVersion: 2;
  global: GlobalStyles;
  blocks: LegacyBlock[];
}

export function makeLegacyProductSectionBlock(
  overrides: Partial<Omit<LegacyProductSectionBlock, 'type' | 'id'>> = {},
): LegacyProductSectionBlock {
  return {
    type: 'product-section',
    id: uuid(),
    title: 'New Product',
    bullets: ['Feature one', 'Feature two'],
    imageSrc: '',
    imageAlt: '',
    ctaText: 'Contact Us',
    ...overrides,
  };
}

export function makeLegacyHeaderBlock(
  overrides: Partial<Omit<LegacyHeaderBlock, 'type' | 'id'>> = {},
): LegacyHeaderBlock {
  return {
    type: 'header',
    id: uuid(),
    locked: true,
    logoSrc: '',
    logoAlt: '',
    logoWidth: 390,
    title: '',
    titleFontSize: 18,
    bannerSrc: '',
    bannerAlt: '',
    sectionHeading: '',
    sectionHeadingFontSize: 25,
    ...overrides,
  };
}

export function makeLegacyFooterBlock(
  overrides: Partial<Omit<LegacyFooterBlock, 'type' | 'id'>> = {},
): LegacyFooterBlock {
  return {
    type: 'footer',
    id: uuid(),
    locked: true,
    bannerSrc: '',
    bannerAlt: '',
    companyName: '',
    address: '',
    phone: '',
    phoneTel: '',
    email: '',
    websites: [],
    socials: [],
    ...overrides,
  };
}

export function makeLegacyHeroBlock(
  overrides: Partial<Omit<LegacyHeroBlock, 'type' | 'id'>> = {},
): LegacyHeroBlock {
  return {
    type: 'hero',
    id: uuid(),
    imageSrc: '',
    imageAlt: '',
    title: 'Big headline',
    subtitle: 'Supporting subtitle',
    ctaText: 'Learn more',
    ...overrides,
  };
}

export function makeLegacyArticleBlock(
  overrides: Partial<Omit<LegacyArticleBlock, 'type' | 'id'>> = {},
): LegacyArticleBlock {
  return {
    type: 'article',
    id: uuid(),
    imageSrc: '',
    imageAlt: '',
    title: 'Article title',
    body: 'Article body. Two or three short sentences work well here.',
    ctaText: 'Read more',
    imagePosition: 'top',
    ...overrides,
  };
}

export function makeLegacyCTABannerBlock(
  overrides: Partial<Omit<LegacyCTABannerBlock, 'type' | 'id'>> = {},
): LegacyCTABannerBlock {
  return {
    type: 'cta-banner',
    id: uuid(),
    title: 'Ready to get started?',
    subtitle: '',
    ctaText: 'Get in touch',
    align: 'center',
    ...overrides,
  };
}

export function findLegacyHeader(blocks: LegacyBlock[]): LegacyHeaderBlock {
  const block = blocks.find((value): value is LegacyHeaderBlock => value.type === 'header');
  if (!block) {
    throw new Error('findLegacyHeader: missing header block');
  }
  return block;
}

export function findLegacyFooter(blocks: LegacyBlock[]): LegacyFooterBlock {
  const block = blocks.find((value): value is LegacyFooterBlock => value.type === 'footer');
  if (!block) {
    throw new Error('findLegacyFooter: missing footer block');
  }
  return block;
}

export function findLegacyProductSections(blocks: LegacyBlock[]): LegacyProductSectionBlock[] {
  return blocks.filter((value): value is LegacyProductSectionBlock => value.type === 'product-section');
}
