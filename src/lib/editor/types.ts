export const SCHEMA_VERSION = 1;

export interface ProjectData {
  schemaVersion: 1;
  global: GlobalStyles;
  header: Header;
  sections: ProductSection[];
  footer: Footer;
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

export interface Header {
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

export interface ProductSection {
  id: string;
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

export interface Footer {
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

export interface WebsiteLink {
  label: string;
  url: string;
}

export type SocialPlatform = 'facebook' | 'linkedin' | 'twitter' | 'youtube' | 'instagram';

export interface SocialLink {
  platform: SocialPlatform;
  url: string;
}
