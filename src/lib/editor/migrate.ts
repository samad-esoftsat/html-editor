import { v4 as uuid } from 'uuid';
import type { LegacyBlock, LegacyFooterBlock, LegacyHeaderBlock, LegacyProjectData, SocialLink, WebsiteLink } from './legacy';
import {
  findLegacyFooter,
  findLegacyHeader,
  makeLegacyFooterBlock,
  makeLegacyHeaderBlock,
} from './legacy';
import { SCHEMA_VERSION, type GlobalStyles, type ProjectData } from './types';
import { SerializedTreeBuilder } from './tree';

interface V1Header {
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

interface V1Section {
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

interface V1Footer {
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

interface V1ProjectData {
  schemaVersion?: 1;
  global: GlobalStyles;
  header: V1Header;
  sections: V1Section[];
  footer: V1Footer;
}

const SOCIAL_ICON: Record<SocialLink['platform'], { alt: string; url: string }> = {
  facebook: {
    alt: 'Facebook',
    url: 'https://app-rsrc.getbee.io/public/resources/social-networks-icon-sets/circle-color/facebook@2x.png',
  },
  linkedin: {
    alt: 'LinkedIn',
    url: 'https://app-rsrc.getbee.io/public/resources/social-networks-icon-sets/circle-color/linkedin@2x.png',
  },
  twitter: {
    alt: 'Twitter',
    url: 'https://app-rsrc.getbee.io/public/resources/social-networks-icon-sets/circle-color/twitter@2x.png',
  },
  youtube: {
    alt: 'YouTube',
    url: 'https://app-rsrc.getbee.io/public/resources/social-networks-icon-sets/circle-color/youtube@2x.png',
  },
  instagram: {
    alt: 'Instagram',
    url: 'https://app-rsrc.getbee.io/public/resources/social-networks-icon-sets/circle-color/instagram@2x.png',
  },
};

export function migrate(raw: unknown): ProjectData {
  if (raw == null || typeof raw !== 'object') {
    throw new Error('migrate: input must be an object');
  }
  const version = (raw as { schemaVersion?: number }).schemaVersion;
  if (version === SCHEMA_VERSION) {
    return rescueV3(raw as ProjectData);
  }
  if (version === 2) {
    return migrateV2ToV3(raw as LegacyProjectData);
  }
  if (version === 1 || version === undefined) {
    return migrateV2ToV3(migrateV1ToV2(raw as V1ProjectData));
  }
  throw new Error(`Unsupported schemaVersion: ${version}`);
}

// Idempotent fixup pass for already-migrated v3 projects. Runs on every load
// so corrections to the migration logic apply retroactively without forcing
// a re-migration.
function rescueV3(data: ProjectData): ProjectData {
  if (!data.tree) return data;

  // If the persisted tree has an old-shape footer (no labelPrefix on the phone
  // text), rebuild the entire tree from the preserved legacy blocks. The
  // preserved `data.blocks` is a v2 snapshot kept on migration specifically
  // for retroactive structural fixes like this one.
  if (hasLegacyFooterShape(data.tree) && Array.isArray((data as { blocks?: unknown }).blocks)) {
    const legacyBlocks = (data as unknown as { blocks: LegacyBlock[] }).blocks;
    return migrateV2ToV3({ schemaVersion: 2, global: data.global, blocks: legacyBlocks });
  }

  let mutated = false;
  const nextTree: typeof data.tree = {};
  for (const [id, node] of Object.entries(data.tree)) {
    if (!node) { nextTree[id] = node; continue; }
    const typeName = typeof node.type === 'string' ? node.type : node.type?.resolvedName;
    const slot = typeof node.custom?.slot === 'string' ? node.custom.slot : undefined;
    // Footer Text nodes must use a legible brand token on the dark band.
    // Allowed tokens: 'footerText' (default white) and 'accent' (used for
    // website links, which sit on their own centered lines).
    if (typeName === 'Text' && slot?.startsWith('footer.')) {
      const props = node.props as { brandToken?: string; color?: string };
      const isWebsite = slot.startsWith('footer.website.');
      const expectedToken = isWebsite ? 'accent' : 'footerText';
      const allowedTokens = isWebsite ? ['accent', 'footerText'] : ['footerText'];
      const tokenOk = props.brandToken !== undefined && allowedTokens.includes(props.brandToken);
      if (!tokenOk || props.color !== undefined) {
        nextTree[id] = {
          ...node,
          props: { ...node.props, brandToken: tokenOk ? props.brandToken : expectedToken, color: undefined },
        };
        mutated = true;
        continue;
      }
    }
    nextTree[id] = node;
  }
  return mutated ? { ...data, tree: nextTree } : data;
}

// Returns true when the persisted v3 tree's footer subtree matches the
// pre-redesign shape (no labelPrefix on the phone text node). Used to
// trigger a one-shot structural rebuild from the preserved legacy blocks.
function hasLegacyFooterShape(tree: ProjectData['tree']): boolean {
  let footerSlotPhone: { props: { labelPrefix?: unknown } } | undefined;
  let footerSlotCompany: { props: { bold?: unknown; marginBottom?: unknown } } | undefined;
  for (const node of Object.values(tree)) {
    if (!node) continue;
    const slot = typeof node.custom?.slot === 'string' ? node.custom.slot : undefined;
    if (slot === 'footer.phone') footerSlotPhone = node as { props: { labelPrefix?: unknown } };
    if (slot === 'footer.companyName') footerSlotCompany = node as { props: { bold?: unknown; marginBottom?: unknown } };
  }
  if (footerSlotPhone && footerSlotPhone.props.labelPrefix === undefined) return true;
  if (footerSlotCompany && !footerSlotCompany.props.bold) return true;
  // Compact-spacing pass: rebuild if companyName lacks marginBottom (the
  // tight-spacing migration introduced it).
  if (footerSlotCompany && footerSlotCompany.props.marginBottom === undefined) return true;
  return false;
}

export function migrateV1ToV2(v1: V1ProjectData): LegacyProjectData {
  return {
    schemaVersion: 2,
    global: v1.global,
    blocks: [
      {
        type: 'header',
        id: uuid(),
        locked: true,
        ...v1.header,
      },
      ...v1.sections.map((section) => ({
        type: 'product-section' as const,
        ...section,
      })),
      {
        type: 'footer',
        id: uuid(),
        locked: true,
        ...v1.footer,
      },
    ],
  };
}

export function migrateV2ToV3(v2: LegacyProjectData): ProjectData {
  const builder = new SerializedTreeBuilder();
  const header = getSafeHeader(v2.blocks);
  const footer = getSafeFooter(v2.blocks);
  const middleBlocks = v2.blocks.filter((block) => block.type !== 'header' && block.type !== 'footer');

  appendHeader(builder, header, v2.global);
  middleBlocks.forEach((block, index) => {
    appendMiddleBlock(builder, block, v2.global, index);
  });
  appendFooter(builder, footer, v2.global);

  return {
    schemaVersion: SCHEMA_VERSION,
    global: v2.global,
    tree: builder.nodes,
    blocks: v2.blocks,
  };
}

function getSafeHeader(blocks: LegacyBlock[]): LegacyHeaderBlock {
  try {
    return findLegacyHeader(blocks);
  } catch {
    return makeLegacyHeaderBlock();
  }
}

function getSafeFooter(blocks: LegacyBlock[]): LegacyFooterBlock {
  try {
    return findLegacyFooter(blocks);
  } catch {
    return makeLegacyFooterBlock();
  }
}

function appendHeader(builder: SerializedTreeBuilder, header: LegacyHeaderBlock, global: GlobalStyles): void {
  const sectionId = builder.addSection(
    { locked: true, paddingX: 16, paddingY: 16 },
    { role: 'header' },
  );

  const logoRow = builder.addRow(sectionId);
  const logoColumn = builder.addColumn(logoRow, { widthPercent: 100 });
  builder.addImage(
    logoColumn,
    {
      src: header.logoSrc,
      alt: header.logoAlt,
      width: header.logoWidth,
      align: 'center',
      linkHref: global.contactUrl || undefined,
    },
    { slot: 'header.logo' },
  );

  const titleRow = builder.addRow(sectionId);
  const titleColumn = builder.addColumn(titleRow, { widthPercent: 100 });
  builder.addHeading(
    titleColumn,
    {
      align: 'center',
      fontSize: header.titleFontSize,
      level: 3,
      text: header.title,
    },
    { slot: 'header.title' },
  );

  const bannerRow = builder.addRow(sectionId);
  const bannerColumn = builder.addColumn(bannerRow, { widthPercent: 100 });
  builder.addImage(
    bannerColumn,
    {
      src: header.bannerSrc,
      alt: header.bannerAlt,
      width: header.bannerWidth,
      align: 'center',
    },
    { slot: 'header.banner' },
  );

  const headingRow = builder.addRow(sectionId);
  const headingColumn = builder.addColumn(headingRow, { widthPercent: 100 });
  builder.addHeading(
    headingColumn,
    {
      align: 'center',
      fontSize: header.sectionHeadingFontSize,
      level: 2,
      text: header.sectionHeading,
    },
    { slot: 'header.sectionHeading' },
  );
}

function appendMiddleBlock(
  builder: SerializedTreeBuilder,
  block: Exclude<LegacyBlock, LegacyHeaderBlock | LegacyFooterBlock>,
  global: GlobalStyles,
  middleIndex: number,
): void {
  switch (block.type) {
    case 'product-section':
      appendProductSection(builder, block, global, middleIndex);
      return;
    case 'hero':
      appendHero(builder, block, global);
      return;
    case 'article':
      appendArticle(builder, block, global);
      return;
    case 'cta-banner':
      appendCtaBanner(builder, block, global);
      return;
  }
}

function appendProductSection(
  builder: SerializedTreeBuilder,
  block: Extract<LegacyBlock, { type: 'product-section' }>,
  global: GlobalStyles,
  middleIndex: number,
): void {
  const sectionId = builder.addSection(
    {
      backgroundColor: block.backgroundColor,
      paddingX: 16,
      paddingY: 16,
    },
    { preset: 'product-section' },
  );
  const rowId = builder.addRow(sectionId, { gap: 16, reverse: middleIndex % 2 === 1 });
  const imageColumnId = builder.addColumn(rowId, { widthPercent: 50 });
  const textColumnId = builder.addColumn(rowId, { widthPercent: 50 });

  builder.addImage(
    imageColumnId,
    {
      src: block.imageSrc,
      alt: block.imageAlt,
      width: block.imageWidth ?? 339,
      align: 'center',
    },
    { slot: `${block.id}.image` },
  );
  builder.addHeading(
    textColumnId,
    {
      color: block.textColor,
      fontSize: block.titleFontSize ?? 22,
      level: 2,
      text: block.title,
    },
    { slot: `${block.id}.title` },
  );
  builder.addList(
    textColumnId,
    {
      color: block.textColor ?? global.textColor,
      fontSize: block.bulletFontSize ?? global.baseFontSize,
      items: block.bullets,
    },
    { slot: `${block.id}.bullets` },
  );
  builder.addButton(
    textColumnId,
    {
      align: 'left',
      backgroundColor: block.buttonColor,
      href: block.ctaUrl ?? global.contactUrl,
      label: block.ctaText,
    },
    { slot: `${block.id}.cta` },
  );
}

function appendHero(
  builder: SerializedTreeBuilder,
  block: Extract<LegacyBlock, { type: 'hero' }>,
  global: GlobalStyles,
): void {
  const sectionId = builder.addSection(
    {
      backgroundColor: block.backgroundColor,
      paddingX: 24,
      paddingY: 40,
    },
    { preset: 'hero' },
  );
  const rowId = builder.addRow(sectionId);
  const columnId = builder.addColumn(rowId, { widthPercent: 100 });
  builder.addImage(columnId, {
    src: block.imageSrc,
    alt: block.imageAlt,
    width: block.imageWidth,
    align: 'center',
  }, { slot: `${block.id}.image` });
  builder.addHeading(columnId, {
    align: 'center',
    color: block.textColor,
    fontSize: block.titleFontSize ?? Math.max(global.headingFontSize, 28),
    level: 1,
    text: block.title,
  }, { slot: `${block.id}.title` });
  builder.addText(columnId, {
    align: 'center',
    color: block.textColor,
    fontSize: block.subtitleFontSize ?? global.baseFontSize,
    text: block.subtitle,
  }, { slot: `${block.id}.subtitle` });
  builder.addButton(columnId, {
    align: 'center',
    backgroundColor: block.buttonColor,
    href: block.ctaUrl ?? global.contactUrl,
    label: block.ctaText,
  }, { slot: `${block.id}.cta` });
}

function appendArticle(
  builder: SerializedTreeBuilder,
  block: Extract<LegacyBlock, { type: 'article' }>,
  global: GlobalStyles,
): void {
  const sectionId = builder.addSection(
    {
      backgroundColor: block.backgroundColor,
      paddingX: 24,
      paddingY: 24,
    },
    { preset: 'article' },
  );

  if (block.imagePosition === 'top') {
    const rowId = builder.addRow(sectionId);
    const columnId = builder.addColumn(rowId, { widthPercent: 100 });
    builder.addImage(columnId, {
      src: block.imageSrc,
      alt: block.imageAlt,
      width: block.imageWidth,
      align: 'center',
    }, { slot: `${block.id}.image` });
    appendArticleTextNodes(builder, columnId, block, global);
    return;
  }

  const rowId = builder.addRow(sectionId, { gap: 16, reverse: block.imagePosition === 'right' });
  const imageColumnId = builder.addColumn(rowId, { widthPercent: 40 });
  const textColumnId = builder.addColumn(rowId, { widthPercent: 60 });
  builder.addImage(imageColumnId, {
    src: block.imageSrc,
    alt: block.imageAlt,
    width: block.imageWidth,
    align: 'center',
  }, { slot: `${block.id}.image` });
  appendArticleTextNodes(builder, textColumnId, block, global);
}

function appendArticleTextNodes(
  builder: SerializedTreeBuilder,
  columnId: string,
  block: Extract<LegacyBlock, { type: 'article' }>,
  global: GlobalStyles,
): void {
  builder.addHeading(columnId, {
    color: block.textColor,
    fontSize: block.titleFontSize ?? global.headingFontSize,
    level: 2,
    text: block.title,
  }, { slot: `${block.id}.title` });
  builder.addText(columnId, {
    color: block.textColor,
    fontSize: block.bodyFontSize ?? global.baseFontSize,
    text: block.body,
  }, { slot: `${block.id}.body` });
  builder.addButton(columnId, {
    align: 'left',
    href: block.ctaUrl ?? global.contactUrl,
    label: block.ctaText,
  }, { slot: `${block.id}.cta` });
}

function appendCtaBanner(
  builder: SerializedTreeBuilder,
  block: Extract<LegacyBlock, { type: 'cta-banner' }>,
  global: GlobalStyles,
): void {
  const sectionId = builder.addSection(
    {
      backgroundColor: block.backgroundColor,
      paddingX: 24,
      paddingY: 32,
    },
    { preset: 'cta-banner' },
  );
  const rowId = builder.addRow(sectionId);
  const columnId = builder.addColumn(rowId, { widthPercent: 100 });
  builder.addHeading(columnId, {
    align: block.align,
    color: block.textColor,
    fontSize: block.titleFontSize ?? global.headingFontSize,
    level: 2,
    text: block.title,
  }, { slot: `${block.id}.title` });
  builder.addText(columnId, {
    align: block.align,
    color: block.textColor,
    text: block.subtitle,
  }, { slot: `${block.id}.subtitle` });
  builder.addButton(columnId, {
    align: block.align,
    backgroundColor: block.buttonColor,
    href: block.ctaUrl ?? global.contactUrl,
    label: block.ctaText,
  }, { slot: `${block.id}.cta` });
}

function appendFooter(builder: SerializedTreeBuilder, footer: LegacyFooterBlock, global: GlobalStyles): void {
  const sectionId = builder.addSection(
    {
      backgroundColor: footer.backgroundColor ?? global.footerBackgroundColor,
      brandToken: footer.backgroundColor ? undefined : 'footerBg',
      locked: true,
      paddingX: 16,
      paddingY: 16,
    },
    { role: 'footer' },
  );

  // Row 1: small centered banner image (~150px wide), not full-width.
  if (footer.bannerSrc) {
    const bannerRow = builder.addRow(sectionId);
    const bannerColumn = builder.addColumn(bannerRow, { widthPercent: 100 });
    builder.addImage(bannerColumn, {
      src: footer.bannerSrc,
      alt: footer.bannerAlt,
      width: footer.bannerWidth ?? 150,
      align: 'center',
    }, { slot: 'footer.banner' });
  }

  // Rows 2-5: contact details stacked, single full-width column, centered.
  // Tight gap between text lines so the footer reads as a compact block.
  const textRow = builder.addRow(sectionId);
  const textColumn = builder.addColumn(textRow, { widthPercent: 100, gap: 4 });
  appendFooterText(builder, textColumn, footer, global);

  // Row 6: small centered social icons clustered tightly.
  // Each icon sits in a narrow column (5%) so the cluster stays close to the
  // center; padding columns absorb the remaining width on either side.
  if (footer.socials.length > 0) {
    const iconRow = builder.addRow(sectionId, { gap: 4 });
    const iconCount = Math.min(footer.socials.length, 4);
    const iconColumnWidth = 5;
    const padding = Math.max(0, Math.floor((100 - iconCount * iconColumnWidth) / 2));
    if (padding > 0) {
      builder.addColumn(iconRow, { widthPercent: padding });
    }
    footer.socials.slice(0, iconCount).forEach((social) => {
      const iconColumn = builder.addColumn(iconRow, { widthPercent: iconColumnWidth });
      const icon = SOCIAL_ICON[social.platform];
      builder.addImage(iconColumn, {
        src: icon.url,
        alt: icon.alt,
        width: 24,
        align: 'center',
        linkHref: social.url,
      }, { slot: `footer.social.${social.platform}` });
    });
    if (padding > 0) {
      builder.addColumn(iconRow, { widthPercent: padding });
    }
  }
}

function appendFooterText(
  builder: SerializedTreeBuilder,
  columnId: string,
  footer: LegacyFooterBlock,
  global: GlobalStyles,
): void {
  // Row 2: bold company name (white), centered.
  if (footer.companyName) {
    builder.addText(columnId, {
      align: 'center',
      bold: true,
      brandToken: 'footerText',
      marginBottom: 0,
      text: footer.companyName,
    }, { slot: 'footer.companyName' });
  }
  // Row 2 (cont.): address (white), centered.
  if (footer.address) {
    builder.addText(columnId, {
      align: 'center',
      brandToken: 'footerText',
      marginBottom: 0,
      text: footer.address,
    }, { slot: 'footer.address' });
  }
  // Row 3: inline "Tel: " (white) + phone number (accent link).
  if (footer.phone) {
    builder.addText(columnId, {
      align: 'center',
      brandToken: 'footerText',
      labelPrefix: 'Tel: ',
      linkBrandToken: 'accent',
      linkHref: footer.phoneTel ? `tel:${footer.phoneTel}` : undefined,
      marginBottom: 0,
      text: footer.phone,
    }, { slot: 'footer.phone' });
  }
  // Row 4: inline "Email: " (white) + email (accent link).
  if (footer.email) {
    builder.addText(columnId, {
      align: 'center',
      brandToken: 'footerText',
      labelPrefix: 'Email: ',
      linkBrandToken: 'accent',
      linkHref: `mailto:${footer.email}`,
      marginBottom: 0,
      text: footer.email,
    }, { slot: 'footer.email' });
  }

  // Row 5: each website link on its own centered line in accent colour.
  // (Inline "·"-separated rendering isn't supported by TextProps today.)
  footer.websites.forEach((website, index) => {
    builder.addText(columnId, {
      align: 'center',
      brandToken: 'accent',
      linkHref: website.url || global.contactUrl,
      marginBottom: 0,
      text: website.label,
    }, { slot: `footer.website.${index}` });
  });
}
