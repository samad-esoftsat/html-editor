import type { ArticleBlock, Block, CTABannerBlock, FooterBlock, HeaderBlock, HeroBlock, ProductSectionBlock, ProjectData, SocialPlatform } from '@/lib/editor/types';
import { findHeader, findFooter } from '@/lib/editor/blocks';
import { attrEscape, htmlEscape, urlSafe } from './escape';

const SOCIAL_ICON: Record<SocialPlatform, { url: string; alt: string }> = {
  facebook: { url: 'https://app-rsrc.getbee.io/public/resources/social-networks-icon-sets/circle-color/facebook@2x.png', alt: 'Facebook' },
  linkedin: { url: 'https://app-rsrc.getbee.io/public/resources/social-networks-icon-sets/circle-color/linkedin@2x.png', alt: 'LinkedIn' },
  twitter: { url: 'https://app-rsrc.getbee.io/public/resources/social-networks-icon-sets/circle-color/twitter@2x.png', alt: 'Twitter' },
  youtube: { url: 'https://app-rsrc.getbee.io/public/resources/social-networks-icon-sets/circle-color/youtube@2x.png', alt: 'YouTube' },
  instagram: { url: 'https://app-rsrc.getbee.io/public/resources/social-networks-icon-sets/circle-color/instagram@2x.png', alt: 'Instagram' },
};

const PRINT_CSS = `
@page {
  size: A4 portrait;
  margin: 32mm 0 64mm 0;
  @top-center    { content: element(header-region); }
  @bottom-center { content: element(footer-region); }
}
@page :first { margin-top: 32mm; }
.print-footer { font-size: 13px; line-height: 1.4; }
.print-footer .print-footer-banner { display: block; width: 100%; height: 80px; object-fit: cover; margin: 0 auto 8px; }
.print-cover .print-cover-banner { display: block; width: 100%; max-width: 710px; height: 120px; object-fit: cover; margin: 0 auto 10px; }

* { box-sizing: border-box; }
body { margin: 0; padding: 0; }

.running-header { position: running(header-region); }
.running-footer { position: running(footer-region); }
.running-header, .running-footer { display: none; }

.print-block {
  break-inside: avoid;
  page-break-inside: avoid;
  margin: 0 auto;
  max-width: 710px;
}

main { width: 100%; }
`.trim();

function renderHead(data: ProjectData): string {
  const family = attrEscape(data.global.fontFamily);
  const bg = attrEscape(data.global.backgroundColor);
  return `<head>
<title>Print preview</title>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
${PRINT_CSS}
body { font-family: ${family}; font-size: ${data.global.baseFontSize}px; color: ${attrEscape(data.global.textColor)}; background: ${bg}; }
.pagedjs_page { background-color: ${bg}; }
@media print { @page { background-color: ${bg}; } }
</style>
</head>`;
}

function renderHeaderRunning(header: HeaderBlock, data: ProjectData): string {
  // Per-page repeating chrome: logo + title only. Anything taller (banner image,
  // large heading) overflows the @page top-margin and collides with body content.
  const contactUrl = urlSafe(data.global.contactUrl);
  const logoWidth = Math.min(header.logoWidth, 600);

  const logo = header.logoSrc
    ? `<a href="${attrEscape(contactUrl)}" target="_blank"><img src="${attrEscape(urlSafe(header.logoSrc))}" alt="${attrEscape(header.logoAlt)}" width="${logoWidth}" style="display: block; max-width: 100%; height: auto; margin: 0 auto;"></a>`
    : '';
  const title = header.title
    ? `<div style="text-align: center; padding: 4px 0; font-size: ${header.titleFontSize}px; font-weight: bold;">${htmlEscape(header.title)}</div>`
    : '';

  return `<div class="print-header" style="text-align: center; max-width: 710px; margin: 0 auto;">${logo}${title}</div>`;
}

function renderHeaderCover(header: HeaderBlock): string {
  // Page-1 cover area: banner image + section heading. Rendered once at the top
  // of the body so the giant Coverage Map / hero banner doesn't repeat every page.
  if (!header.bannerSrc && !header.sectionHeading) return '';
  const banner = header.bannerSrc
    ? `<img class="print-cover-banner" src="${attrEscape(urlSafe(header.bannerSrc))}" alt="${attrEscape(header.bannerAlt)}">`
    : '';
  const sectionHeading = header.sectionHeading
    ? `<div style="text-align: center; padding: 6px 0; font-size: ${header.sectionHeadingFontSize}px; font-weight: bold;">${htmlEscape(header.sectionHeading)}</div>`
    : '';
  return `<div class="print-cover" style="text-align: center; max-width: 710px; margin: 0 auto 12px;">${banner}${sectionHeading}</div>`;
}

function renderFooterForPrint(footer: FooterBlock, data: ProjectData): string {
  const bg = footer.backgroundColor ?? data.global.footerBackgroundColor;
  const fg = footer.textColor ?? data.global.footerTextColor;

  const banner = footer.bannerSrc
    ? `<img class="print-footer-banner" src="${attrEscape(urlSafe(footer.bannerSrc))}" alt="${attrEscape(footer.bannerAlt)}">`
    : '';
  const address = (footer.address || '')
    .split('\n')
    .map((line) => `<div style="margin: 0; color: ${attrEscape(fg)};">${htmlEscape(line)}</div>`)
    .join('');
  const phone = footer.phone
    ? `<div style="margin: 4px 0 0 0;"><a href="${attrEscape(urlSafe('tel:' + (footer.phoneTel || '')))}" style="color: ${attrEscape(fg)}; text-decoration: none;">${htmlEscape(footer.phone)}</a></div>`
    : '';
  const email = footer.email
    ? `<div style="margin: 2px 0 0 0;"><a href="${attrEscape(urlSafe('mailto:' + footer.email))}" style="color: ${attrEscape(fg)}; text-decoration: none;">${htmlEscape(footer.email)}</a></div>`
    : '';
  const websites = footer.websites && footer.websites.length
    ? `<div style="margin: 4px 0 0 0;">${footer.websites.map((w) => `<a href="${attrEscape(urlSafe(w.url))}" target="_blank" style="color: ${attrEscape(fg)}; text-decoration: none;">${htmlEscape(w.label)}</a>`).join(' &amp; ')}</div>`
    : '';
  const socials = footer.socials && footer.socials.length
    ? `<div style="margin: 6px 0 0 0;">${footer.socials.map((s) => {
        const icon = SOCIAL_ICON[s.platform];
        if (!icon) return '';
        return `<a href="${attrEscape(urlSafe(s.url))}" target="_blank" style="display: inline-block; margin-right: 4px;"><img src="${attrEscape(icon.url)}" alt="${attrEscape(icon.alt)}" width="24" height="24" style="border: 0; display: inline-block;"></a>`;
      }).join('')}</div>`
    : '';

  return `<div class="print-footer" style="text-align: center; background-color: ${attrEscape(bg)}; color: ${attrEscape(fg)};">
${banner}
<div style="max-width: 710px; margin: 0 auto; padding: 8px 16px;">
<div style="font-weight: bold;">${htmlEscape(footer.companyName)}</div>
${address}
${phone}
${email}
${websites}
${socials}
</div>
</div>`;
}

function renderProductSectionForPrint(section: ProductSectionBlock, idx: number, data: ProjectData): string {
  const reverse = idx % 2 === 1;
  const titleSize = section.titleFontSize ?? 22;
  const bulletSize = section.bulletFontSize ?? 16;
  const textColor = section.textColor ?? data.global.textColor;
  const buttonColor = section.buttonColor ?? data.global.buttonColor;
  const bg = section.backgroundColor ?? '';
  const ctaUrl = urlSafe(section.ctaUrl ?? data.global.contactUrl);

  const bulletsHtml = section.bullets
    .map((b) => `<li style="margin: 4px 0; font-size: ${bulletSize}px; color: ${attrEscape(textColor)};">${htmlEscape(b)}</li>`)
    .join('');

  const hasImage = !!section.imageSrc;
  const widthStyle = section.imageWidth ? `width: ${section.imageWidth}px;` : '';
  const imageCol = hasImage
    ? `<div style="flex: 0 0 50%; padding: 12px;"><img src="${attrEscape(urlSafe(section.imageSrc))}" alt="${attrEscape(section.imageAlt)}" style="display: block; max-width: 100%; height: auto;${widthStyle ? ` ${widthStyle}` : ''}"></div>`
    : '';
  const textFlex = hasImage ? 'flex: 0 0 50%;' : 'flex: 1 1 100%;';
  const textCol = `<div style="${textFlex} padding: 12px;">
<h2 style="margin: 0 0 6px 0; font-size: ${titleSize}px; color: ${attrEscape(textColor)};">${htmlEscape(section.title)}</h2>
<ul style="margin: 0 0 10px 0; padding-left: 20px;">${bulletsHtml}</ul>
<a href="${attrEscape(ctaUrl)}" target="_blank" style="display: inline-block; padding: 8px 16px; background-color: ${attrEscape(buttonColor)}; color: ${attrEscape(data.global.buttonTextColor)}; text-decoration: none; border-radius: 4px; font-weight: bold;">${htmlEscape(section.ctaText)}</a>
</div>`;

  const cells = reverse ? `${textCol}${imageCol}` : `${imageCol}${textCol}`;
  const reverseClass = reverse ? ' reverse' : '';
  const bgStyle = bg ? ` background-color: ${attrEscape(bg)};` : '';
  return `<section class="product-section${reverseClass}" style="display: flex; flex-direction: row;${bgStyle}">${cells}</section>`;
}

function renderHeroForPrint(block: HeroBlock, data: ProjectData): string {
  const bg = block.backgroundColor ?? data.global.backgroundColor;
  const fg = block.textColor ?? data.global.textColor;
  const buttonColor = block.buttonColor ?? data.global.buttonColor;
  const buttonTextColor = data.global.buttonTextColor;
  const titleSize = block.titleFontSize ?? Math.max(data.global.headingFontSize, 28);
  const subtitleSize = block.subtitleFontSize ?? data.global.baseFontSize;
  const ctaUrl = urlSafe(block.ctaUrl ?? data.global.contactUrl);
  const widthStyle = block.imageWidth ? `width: ${block.imageWidth}px;` : '';

  const imageHtml = block.imageSrc
    ? `<img src="${attrEscape(urlSafe(block.imageSrc))}" alt="${attrEscape(block.imageAlt)}" style="display: block; max-width: 100%; height: auto; margin: 0 auto 12px;${widthStyle ? ` ${widthStyle}` : ''}">`
    : '';
  const subtitleHtml = block.subtitle
    ? `<p style="font-size: ${subtitleSize}px; color: ${attrEscape(fg)}; margin: 0 0 18px;">${htmlEscape(block.subtitle)}</p>`
    : '';
  return `<section class="hero" style="background-color: ${attrEscape(bg)}; padding: 24px 16px; text-align: center; color: ${attrEscape(fg)};">
${imageHtml}
<h1 style="font-size: ${titleSize}px; font-weight: 700; margin: 0 0 8px; color: ${attrEscape(fg)};">${htmlEscape(block.title)}</h1>
${subtitleHtml}
<a href="${attrEscape(ctaUrl)}" target="_blank" style="display: inline-block; padding: 10px 22px; background-color: ${attrEscape(buttonColor)}; color: ${attrEscape(buttonTextColor)}; text-decoration: none; font-weight: 600; border-radius: 4px;">${htmlEscape(block.ctaText)}</a>
</section>`;
}

function renderArticleForPrint(block: ArticleBlock, data: ProjectData): string {
  const bg = block.backgroundColor ?? data.global.backgroundColor;
  const fg = block.textColor ?? data.global.textColor;
  const titleSize = block.titleFontSize ?? data.global.headingFontSize;
  const bodySize = block.bodyFontSize ?? data.global.baseFontSize;
  const ctaUrl = urlSafe(block.ctaUrl ?? data.global.contactUrl);
  const widthStyle = block.imageWidth ? `width: ${block.imageWidth}px;` : '';

  const imgHtml = block.imageSrc
    ? `<img src="${attrEscape(urlSafe(block.imageSrc))}" alt="${attrEscape(block.imageAlt)}" style="display: block; max-width: 100%; height: auto;${widthStyle ? ` ${widthStyle}` : ''}">`
    : '';
  const titleHtml = `<h2 style="margin: 0 0 6px; font-size: ${titleSize}px; color: ${attrEscape(fg)};">${htmlEscape(block.title)}</h2>`;
  const bodyHtml = `<p style="margin: 0 0 12px; font-size: ${bodySize}px; color: ${attrEscape(fg)}; white-space: pre-wrap;">${htmlEscape(block.body)}</p>`;
  const ctaHtml = block.ctaText
    ? `<a href="${attrEscape(ctaUrl)}" target="_blank" style="color: ${attrEscape(data.global.buttonColor)}; font-weight: 600; text-decoration: none;">${htmlEscape(block.ctaText)}</a>`
    : '';

  if (block.imagePosition === 'top') {
    return `<section class="article article-top" style="background-color: ${attrEscape(bg)}; padding: 16px;">
${imgHtml ? `<div style="margin-bottom: 12px;">${imgHtml}</div>` : ''}
${titleHtml}${bodyHtml}${ctaHtml}
</section>`;
  }
  const flexDir = block.imagePosition === 'left' ? 'row' : 'row-reverse';
  const imageColumn = imgHtml ? `<div style="flex: 0 0 40%;">${imgHtml}</div>` : '';
  return `<section class="article article-${block.imagePosition}" style="background-color: ${attrEscape(bg)}; display: flex; flex-direction: ${flexDir}; gap: 12px; padding: 16px;">
${imageColumn}
<div style="flex: 1;">${titleHtml}${bodyHtml}${ctaHtml}</div>
</section>`;
}

function renderCTABannerForPrint(block: CTABannerBlock, data: ProjectData): string {
  const bg = block.backgroundColor ?? data.global.backgroundColor;
  const fg = block.textColor ?? data.global.textColor;
  const buttonColor = block.buttonColor ?? data.global.buttonColor;
  const buttonTextColor = data.global.buttonTextColor;
  const titleSize = block.titleFontSize ?? data.global.headingFontSize;
  const ctaUrl = urlSafe(block.ctaUrl ?? data.global.contactUrl);

  const titleHtml = block.title
    ? `<h2 style="margin: 0 0 6px; font-size: ${titleSize}px; color: ${attrEscape(fg)};">${htmlEscape(block.title)}</h2>`
    : '';
  const subtitleHtml = block.subtitle
    ? `<p style="margin: 0 0 12px; color: ${attrEscape(fg)};">${htmlEscape(block.subtitle)}</p>`
    : '';

  return `<section class="cta-banner" style="background-color: ${attrEscape(bg)}; padding: 20px 16px; text-align: ${block.align};">
${titleHtml}
${subtitleHtml}
<a href="${attrEscape(ctaUrl)}" target="_blank" style="display: inline-block; padding: 10px 20px; background-color: ${attrEscape(buttonColor)}; color: ${attrEscape(buttonTextColor)}; text-decoration: none; font-weight: 600; border-radius: 4px;">${htmlEscape(block.ctaText)}</a>
</section>`;
}

function renderBlockForPrint(block: Block, idx: number, data: ProjectData): string {
  switch (block.type) {
    case 'product-section':
      return renderProductSectionForPrint(block, idx, data);
    case 'hero':
      return renderHeroForPrint(block, data);
    case 'article':
      return renderArticleForPrint(block, data);
    case 'cta-banner':
      return renderCTABannerForPrint(block, data);
    case 'header':
    case 'footer':
      return '';
  }
}

export function renderPrintDocument(data: ProjectData): string {
  const header = findHeader(data.blocks);
  const footer = findFooter(data.blocks);
  const middle = data.blocks.slice(1, -1);
  const middleHtml = middle
    .map((b, i) => `<div class="print-block">${renderBlockForPrint(b, i, data)}</div>`)
    .join('\n');

  return `<!doctype html>
<html lang="en">
${renderHead(data)}
<body>
<div class="running-header">${renderHeaderRunning(header, data)}</div>
<div class="running-footer">${renderFooterForPrint(footer, data)}</div>
<main>
${renderHeaderCover(header)}
${middleHtml}
</main>
</body>
</html>`;
}
