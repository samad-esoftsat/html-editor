export const SCHEMA_VERSION = 2;

export interface ProjectData {
  schemaVersion: 2;
  global: GlobalStyles;
  blocks: Block[];
}

export interface GlobalStyles {
  backgroundColor: string;
  fontFamily: string;
  baseFontSize: number;
  headingFontSize: number;
  textColor: string;
  buttonColor: string;
  buttonTextColor: string;
  accentColor: string;
  footerBackgroundColor: string;
  footerTextColor: string;
  contactUrl: string;
}

export interface BlockBase {
  id: string;
  locked?: boolean;
}

export interface HeaderBlock extends BlockBase {
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

export interface ProductSectionBlock extends BlockBase {
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

export interface FooterBlock extends BlockBase {
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

export interface HeroBlock extends BlockBase {
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

export interface ArticleBlock extends BlockBase {
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

export interface CTABannerBlock extends BlockBase {
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

export type Block =
  | HeaderBlock
  | ProductSectionBlock
  | HeroBlock
  | ArticleBlock
  | CTABannerBlock
  | FooterBlock;

// Legacy aliases — preserved for callers from Phase 1. Safe to retain; remove in a later cleanup pass.
export type Header = HeaderBlock;
export type ProductSection = ProductSectionBlock;
export type Footer = FooterBlock;

export interface WebsiteLink {
  label: string;
  url: string;
}

export type SocialPlatform = 'facebook' | 'linkedin' | 'twitter' | 'youtube' | 'instagram';

export interface SocialLink {
  platform: SocialPlatform;
  url: string;
}
