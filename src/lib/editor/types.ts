import type { ReactNode } from 'react';
import type {
  LegacyArticleBlock,
  LegacyBlock,
  LegacyCTABannerBlock,
  LegacyFooterBlock,
  LegacyHeaderBlock,
  LegacyHeroBlock,
  LegacyProductSectionBlock,
  SocialLink,
  SocialPlatform,
  WebsiteLink,
} from './legacy';
import type { SerializedNodes } from './craftSchema';

export const SCHEMA_VERSION = 3;

export interface ProjectData {
  schemaVersion: 3;
  global: GlobalStyles;
  tree: SerializedNodes;
  blocks: LegacyBlock[];
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
  /** When true, the locked header/footer Sections are extracted from the main
   * body flow and rendered as PagedJS running regions, so they repeat at the
   * top/bottom of every printed page. Default: false (single-page documents
   * don't need the extra chrome). Email export ignores this. */
  repeatHeaderFooter?: boolean;
  /** Paper size for PDF/print export. The editor canvas width is sized to
   * match this so the editor is a true preview of the printed page. Email
   * export ignores this. Default: 'A4'. */
  paperSize?: PaperSize;
}

export type PaperSize = 'A4' | 'A3' | 'A5';

// Paper dimensions in CSS pixels at 96dpi. Print margins are reserved on
// every side so the inner content area matches the PDF body region exactly.
// Two margin sets:
//   - Non-running PDF (`basePrintCss` in renderPrintDocument.ts):
//       14mm horizontal, 18mm vertical → contentHeightPx
//   - Running header/footer PDF (`RUNNING_CSS` in renderPrintDocument.ts):
//       14mm horizontal, 60mm top, 85mm bottom → contentHeightRunningPx
//   These margins are tuned to fit the GlobalTT header (~50mm) and footer
//   (~75mm) Section content with a ~10mm safety buffer each, while keeping
//   body height generous enough to fit two average product Sections per
//   page. If header or footer content gets taller, bump the matching
//   margin OR shrink the editor content.
// IF YOU CHANGE THE PDF MARGINS, UPDATE THESE NUMBERS — the editor's
// page-break overlay reads these to predict where PagedJS will break, and
// any drift makes the editor lie about page count.
export interface PaperMetrics {
  widthPx: number;
  heightPx: number;
  contentWidthPx: number;
  contentHeightPx: number;
  contentHeightRunningPx: number;
  cssSize: string;
}

export const PAPER_METRICS: Record<PaperSize, PaperMetrics> = {
  // 210mm × 297mm = 794 × 1123 at 96dpi.
  // contentHeightRunningPx = 1123 − (60mm + 85mm)·96/25.4 ≈ 575.
  A4: { widthPx: 794, heightPx: 1123, contentWidthPx: 688, contentHeightPx: 987, contentHeightRunningPx: 575, cssSize: 'A4' },
  // 297mm × 420mm = 1123 × 1587.
  // contentHeightRunningPx = 1587 − 548 ≈ 1039.
  A3: { widthPx: 1123, heightPx: 1587, contentWidthPx: 1017, contentHeightPx: 1451, contentHeightRunningPx: 1039, cssSize: 'A3' },
  // 148mm × 210mm = 559 × 794.
  // contentHeightRunningPx = 794 − 548 ≈ 246. A5 + running header/footer
  // is impractically tight; recommend leaving repeat-on-every-page off for
  // A5 documents.
  A5: { widthPx: 559, heightPx: 794, contentWidthPx: 453, contentHeightPx: 658, contentHeightRunningPx: 246, cssSize: 'A5' },
};

export function paperMetricsFor(global: GlobalStyles): PaperMetrics {
  return PAPER_METRICS[global.paperSize ?? 'A4'];
}

export type ColorToken = 'text' | 'primary' | 'accent' | 'footerBg' | 'footerText';

export interface PageProps {
  children?: ReactNode;
}

export interface SectionProps {
  backgroundColor?: string;
  brandToken?: ColorToken;
  paddingX?: number;
  paddingY?: number;
  locked?: boolean;
  children?: ReactNode;
}

export interface RowProps {
  gap?: number;
  reverse?: boolean;
  children?: ReactNode;
}

export interface ColumnProps {
  widthPercent?: number;
  verticalAlign?: 'top' | 'middle' | 'bottom';
  gap?: number;
  children?: ReactNode;
}

export interface HeadingProps {
  text: string;
  level?: 1 | 2 | 3 | 4;
  fontSize?: number;
  color?: string;
  brandToken?: ColorToken;
  align?: 'left' | 'center' | 'right';
}

export interface TextProps {
  text: string;
  fontSize?: number;
  color?: string;
  brandToken?: ColorToken;
  align?: 'left' | 'center' | 'right';
  linkHref?: string;
  labelPrefix?: string;
  linkBrandToken?: ColorToken;
  bold?: boolean;
  marginBottom?: number;
}

export interface ImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  align?: 'left' | 'center' | 'right';
  linkHref?: string;
}

export interface ButtonProps {
  label: string;
  href?: string;
  backgroundColor?: string;
  color?: string;
  brandToken?: ColorToken;
  align?: 'left' | 'center' | 'right';
}

export interface DividerProps {
  color?: string;
  thickness?: number;
}

export interface SpacerProps {
  height: number;
}

export interface ListProps {
  items: string[];
  ordered?: boolean;
  fontSize?: number;
  color?: string;
  brandToken?: ColorToken;
  align?: 'left' | 'center' | 'right';
}

export type NodeProps =
  | PageProps
  | SectionProps
  | RowProps
  | ColumnProps
  | HeadingProps
  | TextProps
  | ImageProps
  | ButtonProps
  | DividerProps
  | SpacerProps
  | ListProps;

// Temporary compatibility exports while the migration removes v2-only callers.
export type Block = LegacyBlock;
export type HeaderBlock = LegacyHeaderBlock;
export type ProductSectionBlock = LegacyProductSectionBlock;
export type FooterBlock = LegacyFooterBlock;
export type HeroBlock = LegacyHeroBlock;
export type ArticleBlock = LegacyArticleBlock;
export type CTABannerBlock = LegacyCTABannerBlock;
export type Header = LegacyHeaderBlock;
export type ProductSection = LegacyProductSectionBlock;
export type Footer = LegacyFooterBlock;
export type { WebsiteLink, SocialPlatform, SocialLink };
