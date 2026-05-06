import type { Footer, Header, ProductSection, ProjectData, SocialPlatform } from '@/lib/editor/types';
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

function renderBody(data: ProjectData): string {
  const bg = data.global.backgroundColor;
  const fontFamily = data.global.fontFamily;
  const fontSize = data.global.baseFontSize;
  const sectionsHtml = data.sections.map((s, i) => renderSection(s, i, data)).join('\n');
  return `<body style="margin: 0; padding: 0; background-color: ${attrEscape(bg)}; font-family: ${attrEscape(fontFamily)}; font-size: ${fontSize}px;">
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: ${attrEscape(bg)};">
<tr><td align="center">
${renderHeader(data.header, data.global.contactUrl)}
${sectionsHtml}
${renderFooter(data.footer, data)}
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
