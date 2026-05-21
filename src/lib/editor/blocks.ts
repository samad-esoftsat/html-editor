import { v4 as uuid } from 'uuid';
import type {
  Block,
  HeaderBlock,
  ProductSectionBlock,
  FooterBlock,
  ProjectData,
  HeroBlock,
  ArticleBlock,
  CTABannerBlock,
} from './types';
import type { LucideIcon } from 'lucide-react';
import { FileText, Image as ImageIcon, LayoutList, Megaphone } from 'lucide-react';

export function makeProductSectionBlock(
  overrides: Partial<Omit<ProductSectionBlock, 'type' | 'id'>> = {},
): ProductSectionBlock {
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

export function makeHeaderBlock(
  overrides: Partial<Omit<HeaderBlock, 'type' | 'id'>> = {},
): HeaderBlock {
  return {
    type: 'header',
    id: uuid(),
    locked: true,
    logoSrc: '', logoAlt: '', logoWidth: 390,
    title: '', titleFontSize: 18,
    bannerSrc: '', bannerAlt: '',
    sectionHeading: '', sectionHeadingFontSize: 25,
    ...overrides,
  };
}

export function makeFooterBlock(
  overrides: Partial<Omit<FooterBlock, 'type' | 'id'>> = {},
): FooterBlock {
  return {
    type: 'footer',
    id: uuid(),
    locked: true,
    bannerSrc: '', bannerAlt: '',
    companyName: '', address: '', phone: '', phoneTel: '',
    email: '', websites: [], socials: [],
    ...overrides,
  };
}

export function findHeader(blocks: Block[]): HeaderBlock {
  const b = blocks.find((x): x is HeaderBlock => x.type === 'header');
  if (!b) throw new Error('findHeader: no header block in project');
  return b;
}

export function findFooter(blocks: Block[]): FooterBlock {
  const b = blocks.find((x): x is FooterBlock => x.type === 'footer');
  if (!b) throw new Error('findFooter: no footer block in project');
  return b;
}

export function findBlock(blocks: Block[], id: string): Block | undefined {
  return blocks.find((b) => b.id === id);
}

export function productSections(blocks: Block[]): ProductSectionBlock[] {
  return blocks.filter((b): b is ProductSectionBlock => b.type === 'product-section');
}

export function productSectionCount(data: ProjectData): number {
  return productSections(data.blocks).length;
}

export function makeHeroBlock(
  overrides: Partial<Omit<HeroBlock, 'type' | 'id'>> = {},
): HeroBlock {
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

export function makeArticleBlock(
  overrides: Partial<Omit<ArticleBlock, 'type' | 'id'>> = {},
): ArticleBlock {
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

export function makeCTABannerBlock(
  overrides: Partial<Omit<CTABannerBlock, 'type' | 'id'>> = {},
): CTABannerBlock {
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

export interface BlockMetadata {
  label: string;
  icon: LucideIcon;
  factory: () => Block;
  insertable: boolean;
}

export const BLOCK_METADATA: Record<Block['type'], BlockMetadata> = {
  header:            { label: 'Header',          icon: LayoutList, factory: makeHeaderBlock,         insertable: false },
  footer:            { label: 'Footer',          icon: LayoutList, factory: makeFooterBlock,         insertable: false },
  'product-section': { label: 'Product section', icon: LayoutList, factory: makeProductSectionBlock, insertable: true  },
  hero:              { label: 'Hero',            icon: ImageIcon,  factory: makeHeroBlock,           insertable: true  },
  article:           { label: 'Article',         icon: FileText,   factory: makeArticleBlock,        insertable: true  },
  'cta-banner':      { label: 'CTA banner',      icon: Megaphone,  factory: makeCTABannerBlock,      insertable: true  },
};

export function insertableBlockTypes(): Array<{ type: Block['type']; metadata: BlockMetadata }> {
  return (Object.entries(BLOCK_METADATA) as Array<[Block['type'], BlockMetadata]>)
    .filter(([, m]) => m.insertable)
    .map(([type, metadata]) => ({ type, metadata }));
}
