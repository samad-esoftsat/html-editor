import type {
  ArticleBlock, Block, CTABannerBlock, Footer, Header, HeroBlock,
  ProductSection, ProjectData, SocialPlatform,
} from '@/lib/editor/types';
import { findHeader, findFooter } from '@/lib/editor/blocks';
import { attrEscape, htmlEscape, urlSafe } from './escape';

const SOCIAL_ICON: Record<SocialPlatform, { url: string; alt: string }> = {
  facebook: { url: 'https://app-rsrc.getbee.io/public/resources/social-networks-icon-sets/circle-color/facebook@2x.png', alt: 'Facebook' },
  linkedin: { url: 'https://app-rsrc.getbee.io/public/resources/social-networks-icon-sets/circle-color/linkedin@2x.png', alt: 'LinkedIn' },
  twitter: { url: 'https://app-rsrc.getbee.io/public/resources/social-networks-icon-sets/circle-color/twitter@2x.png', alt: 'Twitter' },
  youtube: { url: 'https://app-rsrc.getbee.io/public/resources/social-networks-icon-sets/circle-color/youtube@2x.png', alt: 'YouTube' },
  instagram: { url: 'https://app-rsrc.getbee.io/public/resources/social-networks-icon-sets/circle-color/instagram@2x.png', alt: 'Instagram' },
};

function renderHead(): string {
  return `<head>
<title></title>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; }
  a[x-apple-data-detectors] { color: inherit !important; text-decoration: inherit !important; }
  p { line-height: inherit; }
  .row-content { width: 100%; max-width: 710px; margin: 0 auto; }
  .reverse .column-1 { order: 2; }
  .reverse .column-2 { order: 1; }
  @media (max-width: 600px) {
    .row-content { width: 100% !important; }
    .row-content table { width: 100% !important; }
    .row-content img { width: auto !important; max-width: 100% !important; height: auto !important; }
    .stack .column { width: 100% !important; display: block !important; }
  }
</style>
</head>`;
}

const MSO_OPEN = '<!--[if mso]><table role="presentation" width="710" align="center" border="0" cellpadding="0" cellspacing="0"><tr><td><![endif]-->';
const MSO_CLOSE = '<!--[if mso]></td></tr></table><![endif]-->';

function renderHeader(header: Header, contactUrl: string): string {
  const logoSrc = urlSafe(header.logoSrc);
  const bannerSrc = urlSafe(header.bannerSrc);
  const cu = urlSafe(contactUrl);
  const logoWidth = Math.min(header.logoWidth, 600);
  return `<table role="presentation" class="row row-header" width="100%" border="0" cellpadding="0" cellspacing="0">
<tr><td>
${MSO_OPEN}
<table role="presentation" class="row-content" width="710" border="0" cellpadding="0" cellspacing="0" align="center">
<tr><td align="center" style="padding: 16px;">
<a href="${attrEscape(cu)}" target="_blank"><img src="${attrEscape(logoSrc)}" alt="${attrEscape(header.logoAlt)}" width="${logoWidth}" style="display: block; max-width: 100%; height: auto; border: 0;"></a>
</td></tr>
<tr><td align="center" style="padding: 8px 16px; font-size: ${header.titleFontSize}px; font-weight: bold;">${htmlEscape(header.title)}</td></tr>
<tr><td align="center" style="padding: 8px 16px;"><img src="${attrEscape(bannerSrc)}" alt="${attrEscape(header.bannerAlt)}" style="display: block; max-width: 100%; height: auto; border: 0;"></td></tr>
<tr><td align="center" style="padding: 16px; font-size: ${header.sectionHeadingFontSize}px; font-weight: bold;">${htmlEscape(header.sectionHeading)}</td></tr>
</table>
${MSO_CLOSE}
</td></tr>
</table>`;
}

function renderSection(section: ProductSection, idx: number, data: ProjectData): string {
  const reverse = idx % 2 === 1;
  const titleSize = section.titleFontSize ?? 22;
  const bulletSize = section.bulletFontSize ?? 16;
  const textColor = section.textColor ?? data.global.textColor;
  const buttonColor = section.buttonColor ?? data.global.buttonColor;
  const bg = section.backgroundColor ?? '';
  const ctaUrl = urlSafe(section.ctaUrl ?? data.global.contactUrl);
  const imageSrc = urlSafe(section.imageSrc);

  const bulletsHtml = section.bullets
    .map((b) => `<li style="margin: 4px 0; font-size: ${bulletSize}px; color: ${attrEscape(textColor)};">${htmlEscape(b)}</li>`)
    .join('');

  const imageCell = `<td class="column column-1" width="50%" valign="top" style="padding: 16px;">
<div style="max-width: 339px; margin: 0 auto;"><img src="${attrEscape(imageSrc)}" alt="${attrEscape(section.imageAlt)}" width="339" style="display: block; width: 100%; max-width: 100%; height: auto; border: 0;"></div>
</td>`;

  const textCell = `<td class="column column-2" width="50%" valign="top" style="padding: 16px;">
<h2 style="margin: 0 0 8px 0; font-size: ${titleSize}px; color: ${attrEscape(textColor)};">${htmlEscape(section.title)}</h2>
<ul style="margin: 0 0 12px 0; padding-left: 20px;">${bulletsHtml}</ul>
<a href="${attrEscape(ctaUrl)}" target="_blank" style="display: inline-block; padding: 10px 18px; background-color: ${attrEscape(buttonColor)}; color: ${attrEscape(data.global.buttonTextColor)}; text-decoration: none; border-radius: 4px; font-weight: bold;">${htmlEscape(section.ctaText)}</a>
</td>`;

  const cells = reverse ? `${textCell}${imageCell}` : `${imageCell}${textCell}`;
  const rowClass = reverse ? 'row row-section reverse' : 'row row-section';
  const bgStyle = bg ? ` style="background-color: ${attrEscape(bg)};"` : '';

  return `<table role="presentation" ${reverse ? 'class="reverse"' : 'class="row-section"'} width="100%" border="0" cellpadding="0" cellspacing="0"${bgStyle}>
<tr><td>
${MSO_OPEN}
<table role="presentation" class="row-content stack ${rowClass}" width="710" border="0" cellpadding="0" cellspacing="0" align="center">
<tr>${cells}</tr>
</table>
${MSO_CLOSE}
</td></tr>
</table>`;
}

function renderFooter(footer: Footer, data: ProjectData): string {
  const bg = footer.backgroundColor ?? data.global.footerBackgroundColor;
  const fg = footer.textColor ?? data.global.footerTextColor;
  const bannerSrc = urlSafe(footer.bannerSrc);
  const addressLines = (footer.address || '')
    .split('\n')
    .map((line) => `<p style="margin: 0; color: ${attrEscape(fg)};">${htmlEscape(line)}</p>`)
    .join('');
  const phoneHtml = footer.phone
    ? `<p style="margin: 8px 0 0 0;"><a href="tel:${attrEscape(urlSafe('tel:' + (footer.phoneTel || '')))}" style="color: ${attrEscape(fg)}; text-decoration: none;">${htmlEscape(footer.phone)}</a></p>`
    : '';
  const emailHtml = footer.email
    ? `<p style="margin: 4px 0 0 0;"><a href="${attrEscape(urlSafe('mailto:' + footer.email))}" style="color: ${attrEscape(fg)}; text-decoration: none;">${htmlEscape(footer.email)}</a></p>`
    : '';
  const websitesHtml = footer.websites && footer.websites.length
    ? `<p style="margin: 8px 0 0 0;">${footer.websites
        .map((w) => `<a href="${attrEscape(urlSafe(w.url))}" target="_blank" style="color: ${attrEscape(fg)}; text-decoration: none;">${htmlEscape(w.label)}</a>`)
        .join(' &amp; ')}</p>`
    : '';
  const socialsHtml = footer.socials && footer.socials.length
    ? `<p style="margin: 12px 0 0 0;">${footer.socials
        .map((s) => {
          const icon = SOCIAL_ICON[s.platform];
          if (!icon) return '';
          return `<a href="${attrEscape(urlSafe(s.url))}" target="_blank" style="display: inline-block; margin-right: 6px;"><img src="${attrEscape(icon.url)}" alt="${attrEscape(icon.alt)}" width="32" height="32" style="display: inline-block; border: 0;"></a>`;
        })
        .join('')}</p>`
    : '';

  return `<table role="presentation" class="row row-footer" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: ${attrEscape(bg)};">
<tr><td>
${MSO_OPEN}
<table role="presentation" class="row-content" width="710" border="0" cellpadding="0" cellspacing="0" align="center">
<tr><td align="center" style="padding: 16px;"><img src="${attrEscape(bannerSrc)}" alt="${attrEscape(footer.bannerAlt)}" style="display: block; max-width: 100%; height: auto; border: 0;"></td></tr>
<tr><td align="center" style="padding: 16px; color: ${attrEscape(fg)}; font-family: ${attrEscape(data.global.fontFamily)}; font-size: ${data.global.baseFontSize}px;">
<p style="margin: 0;"><strong>${htmlEscape(footer.companyName)}</strong></p>
${addressLines}
${phoneHtml}
${emailHtml}
${websitesHtml}
${socialsHtml}
</td></tr>
</table>
${MSO_CLOSE}
</td></tr>
</table>`;
}

function renderHero(block: HeroBlock, data: ProjectData): string {
  const bg = block.backgroundColor ?? data.global.backgroundColor;
  const fg = block.textColor ?? data.global.textColor;
  const buttonColor = block.buttonColor ?? data.global.buttonColor;
  const buttonTextColor = data.global.buttonTextColor;
  const titleSize = block.titleFontSize ?? Math.max(data.global.headingFontSize, 28);
  const subtitleSize = block.subtitleFontSize ?? data.global.baseFontSize;
  const ctaUrl = urlSafe(block.ctaUrl ?? data.global.contactUrl);
  const imageHtml = block.imageSrc
    ? `<img src="${attrEscape(urlSafe(block.imageSrc))}" alt="${attrEscape(block.imageAlt)}" style="display: block; max-width: 100%; height: auto; border: 0; margin: 0 auto 16px;">`
    : '';
  const subtitleHtml = block.subtitle
    ? `<p style="font-size: ${subtitleSize}px; color: ${attrEscape(fg)}; margin: 0 0 24px;">${htmlEscape(block.subtitle)}</p>`
    : '';
  return `<table role="presentation" class="row row-hero" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: ${attrEscape(bg)};">
<tr><td>
${MSO_OPEN}
<table role="presentation" class="row-content" width="710" border="0" cellpadding="0" cellspacing="0" align="center">
<tr><td align="center" style="padding: 40px 24px; color: ${attrEscape(fg)};">
${imageHtml}
<h1 style="font-size: ${titleSize}px; font-weight: 700; margin: 0 0 12px; color: ${attrEscape(fg)};">${htmlEscape(block.title)}</h1>
${subtitleHtml}
<a href="${attrEscape(ctaUrl)}" target="_blank" style="display: inline-block; padding: 14px 28px; background-color: ${attrEscape(buttonColor)}; color: ${attrEscape(buttonTextColor)}; text-decoration: none; font-weight: 600; border-radius: 4px;">${htmlEscape(block.ctaText)}</a>
</td></tr>
</table>
${MSO_CLOSE}
</td></tr>
</table>`;
}

function renderArticle(block: ArticleBlock, data: ProjectData): string {
  const bg = block.backgroundColor ?? data.global.backgroundColor;
  const fg = block.textColor ?? data.global.textColor;
  const titleSize = block.titleFontSize ?? data.global.headingFontSize;
  const bodySize = block.bodyFontSize ?? data.global.baseFontSize;
  const ctaUrl = urlSafe(block.ctaUrl ?? data.global.contactUrl);

  const imgHtml = block.imageSrc
    ? `<img src="${attrEscape(urlSafe(block.imageSrc))}" alt="${attrEscape(block.imageAlt)}" style="display: block; max-width: 100%; height: auto; border: 0;">`
    : '';
  const titleHtml = `<h2 style="margin: 0 0 8px; font-size: ${titleSize}px; color: ${attrEscape(fg)};">${htmlEscape(block.title)}</h2>`;
  const bodyHtml = `<p style="margin: 0 0 16px; font-size: ${bodySize}px; color: ${attrEscape(fg)}; white-space: pre-wrap;">${htmlEscape(block.body)}</p>`;
  const ctaHtml = block.ctaText
    ? `<a href="${attrEscape(ctaUrl)}" target="_blank" style="color: ${attrEscape(data.global.buttonColor)}; font-weight: 600; text-decoration: none;">${htmlEscape(block.ctaText)}</a>`
    : '';
  const textCell = `<td class="article-col" valign="top" style="padding: 16px;">${titleHtml}${bodyHtml}${ctaHtml}</td>`;
  const imageCell = `<td class="article-col" width="40%" valign="top" style="padding: 16px;">${imgHtml}</td>`;

  let inner: string;
  if (block.imagePosition === 'top') {
    inner = `<tr><td class="article-col" valign="top" style="padding: 24px 24px 8px;">${imgHtml}</td></tr>
<tr>${textCell}</tr>`;
  } else if (block.imagePosition === 'left') {
    inner = `<tr>${imageCell}${textCell}</tr>`;
  } else {
    inner = `<tr>${textCell}${imageCell}</tr>`;
  }

  return `<table role="presentation" class="row row-article" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: ${attrEscape(bg)};">
<tr><td>
${MSO_OPEN}
<table role="presentation" class="row-content stack" width="710" border="0" cellpadding="0" cellspacing="0" align="center">
${inner}
</table>
${MSO_CLOSE}
</td></tr>
</table>`;
}

function renderCTABanner(block: CTABannerBlock, data: ProjectData): string {
  const bg = block.backgroundColor ?? data.global.backgroundColor;
  const fg = block.textColor ?? data.global.textColor;
  const buttonColor = block.buttonColor ?? data.global.buttonColor;
  const buttonTextColor = data.global.buttonTextColor;
  const titleSize = block.titleFontSize ?? data.global.headingFontSize;
  const ctaUrl = urlSafe(block.ctaUrl ?? data.global.contactUrl);

  const titleHtml = block.title
    ? `<h2 style="margin: 0 0 8px; font-size: ${titleSize}px; color: ${attrEscape(fg)};">${htmlEscape(block.title)}</h2>`
    : '';
  const subtitleHtml = block.subtitle
    ? `<p style="margin: 0 0 16px; color: ${attrEscape(fg)};">${htmlEscape(block.subtitle)}</p>`
    : '';

  return `<table role="presentation" class="row row-cta-banner" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: ${attrEscape(bg)};">
<tr><td>
${MSO_OPEN}
<table role="presentation" class="row-content" width="710" border="0" cellpadding="0" cellspacing="0" align="center">
<tr><td style="padding: 32px 24px; text-align: ${block.align};">
${titleHtml}
${subtitleHtml}
<a href="${attrEscape(ctaUrl)}" target="_blank" style="display: inline-block; padding: 12px 24px; background-color: ${attrEscape(buttonColor)}; color: ${attrEscape(buttonTextColor)}; text-decoration: none; font-weight: 600;">${htmlEscape(block.ctaText)}</a>
</td></tr>
</table>
${MSO_CLOSE}
</td></tr>
</table>`;
}

function renderBody(data: ProjectData): string {
  const bg = data.global.backgroundColor;
  const fontFamily = data.global.fontFamily;
  const fontSize = data.global.baseFontSize;
  const header = findHeader(data.blocks);
  const footer = findFooter(data.blocks);

  const middleHtml = data.blocks
    .reduce<{ idx: number; out: string[] }>((acc, block) => {
      switch (block.type) {
        case 'header':
        case 'footer':
          return acc;
        case 'product-section':
          return { idx: acc.idx + 1, out: [...acc.out, renderSection(block, acc.idx, data)] };
        case 'hero':
          return { idx: acc.idx + 1, out: [...acc.out, renderHero(block, data)] };
        case 'article':
          return { idx: acc.idx + 1, out: [...acc.out, renderArticle(block, data)] };
        case 'cta-banner':
          return { idx: acc.idx + 1, out: [...acc.out, renderCTABanner(block, data)] };
      }
    }, { idx: 0, out: [] })
    .out
    .join('\n');

  return `<body style="margin: 0; padding: 0; background-color: ${attrEscape(bg)}; font-family: ${attrEscape(fontFamily)}; font-size: ${fontSize}px;">
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: ${attrEscape(bg)};">
<tr><td align="center">
${renderHeader(header, data.global.contactUrl)}
${middleHtml}
${renderFooter(footer, data)}
</td></tr>
</table>
</body>`;
}

export function renderEmail(data: ProjectData): string {
  return `<!DOCTYPE html>
<html xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="en">
${renderHead()}
${renderBody(data)}
</html>`;
}
