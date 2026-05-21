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
  sectionHeading: string;
  sectionHeadingFontSize: number;
}

export interface ProductSectionBlock extends BlockBase {
  type: 'product-section';
  title: string;
  bullets: string[];
  imageSrc: string;
  imageAlt: string;
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

export type Block = HeaderBlock | ProductSectionBlock | FooterBlock;

// Legacy aliases — preserved to minimize Phase 1 call-site churn. Phase 2 deletes these.
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
