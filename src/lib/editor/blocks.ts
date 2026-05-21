import { v4 as uuid } from 'uuid';
import type {
  Block,
  HeaderBlock,
  ProductSectionBlock,
  FooterBlock,
  ProjectData,
} from './types';

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
