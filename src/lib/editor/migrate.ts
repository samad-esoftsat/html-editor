import { v4 as uuid } from 'uuid';
import type {
  ProjectData,
  HeaderBlock,
  ProductSectionBlock,
  FooterBlock,
  GlobalStyles,
  WebsiteLink,
  SocialLink,
} from './types';

interface V1Header {
  logoSrc: string; logoAlt: string; logoWidth: number;
  title: string; titleFontSize: number;
  bannerSrc: string; bannerAlt: string;
  sectionHeading: string; sectionHeadingFontSize: number;
}

interface V1Section {
  id: string;
  title: string;
  bullets: string[];
  imageSrc: string; imageAlt: string;
  ctaText: string; ctaUrl?: string;
  titleFontSize?: number; bulletFontSize?: number;
  textColor?: string; buttonColor?: string; backgroundColor?: string;
}

interface V1Footer {
  bannerSrc: string; bannerAlt: string;
  companyName: string; address: string; phone: string; phoneTel: string;
  email: string;
  websites: WebsiteLink[];
  socials: SocialLink[];
  backgroundColor?: string; textColor?: string;
}

interface V1ProjectData {
  schemaVersion?: 1;
  global: GlobalStyles;
  header: V1Header;
  sections: V1Section[];
  footer: V1Footer;
}

interface V3CompatProjectData {
  schemaVersion: 3;
  global: GlobalStyles;
  blocks?: ProjectData['blocks'];
}

export function migrate(raw: unknown): ProjectData {
  if (raw == null || typeof raw !== 'object') {
    throw new Error('migrate: input must be an object');
  }
  const v = (raw as { schemaVersion?: number }).schemaVersion;
  if (v === 2) return raw as ProjectData;
  if (v === 3) return v3ToV2(raw as V3CompatProjectData);
  if (v === 1 || v === undefined) return v1ToV2(raw as V1ProjectData);
  throw new Error(`Unsupported schemaVersion: ${v}`);
}

function v1ToV2(v1: V1ProjectData): ProjectData {
  const headerBlock: HeaderBlock = {
    type: 'header',
    id: uuid(),
    locked: true,
    ...v1.header,
  };
  const sectionBlocks: ProductSectionBlock[] = v1.sections.map((s) => ({
    type: 'product-section',
    ...s,
  }));
  const footerBlock: FooterBlock = {
    type: 'footer',
    id: uuid(),
    locked: true,
    ...v1.footer,
  };
  return {
    schemaVersion: 2,
    global: v1.global,
    blocks: [headerBlock, ...sectionBlocks, footerBlock],
  };
}

function v3ToV2(v3: V3CompatProjectData): ProjectData {
  if (!Array.isArray(v3.blocks)) {
    throw new Error('migrate: v3 project is missing legacy blocks');
  }
  return {
    schemaVersion: 2,
    global: v3.global,
    blocks: v3.blocks,
  };
}

export function downgradeV2ToV1(v2: ProjectData): V1ProjectData {
  const header = v2.blocks.find((b): b is HeaderBlock => b.type === 'header');
  const footer = v2.blocks.find((b): b is FooterBlock => b.type === 'footer');
  const sections = v2.blocks.filter((b): b is ProductSectionBlock => b.type === 'product-section');
  if (!header || !footer) throw new Error('downgradeV2ToV1: missing header or footer block');
  const phase2 = v2.blocks.filter((b) => b.type === 'hero' || b.type === 'article' || b.type === 'cta-banner');
  if (phase2.length > 0) {
    throw new Error(`downgradeV2ToV1: cannot downgrade — document contains ${phase2.length} Phase 2 block(s) (hero/article/cta-banner) with no V1 equivalent`);
  }
  const { type: _ht, id: _hi, locked: _hl, ...headerFields } = header;
  const { type: _ft, id: _fi, locked: _fl, ...footerFields } = footer;
  return {
    schemaVersion: 1,
    global: v2.global,
    header: headerFields,
    sections: sections.map(({ type: _t, locked: _l, ...rest }) => rest),
    footer: footerFields,
  };
}
