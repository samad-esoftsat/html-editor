import type { HeaderBlock, FooterBlock, ProjectData, SocialPlatform } from '@/lib/editor/types';
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
  margin: 32mm 12mm 32mm 12mm;
  @top-center    { content: element(header-region); }
  @bottom-center { content: element(footer-region); }
}

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
  return `<head>
<title>Print preview</title>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
${PRINT_CSS}
body { font-family: ${family}; font-size: ${data.global.baseFontSize}px; color: ${attrEscape(data.global.textColor)}; background: ${attrEscape(data.global.backgroundColor)}; }
</style>
</head>`;
}

function renderHeaderForPrint(header: HeaderBlock, data: ProjectData): string {
  const logoSrc = urlSafe(header.logoSrc);
  const bannerSrc = urlSafe(header.bannerSrc);
  const contactUrl = urlSafe(data.global.contactUrl);
  const logoWidth = Math.min(header.logoWidth, 600);

  const logo = logoSrc
    ? `<a href="${attrEscape(contactUrl)}" target="_blank"><img src="${attrEscape(logoSrc)}" alt="${attrEscape(header.logoAlt)}" width="${logoWidth}" style="display: block; max-width: 100%; height: auto; margin: 0 auto;"></a>`
    : '';
  const title = header.title
    ? `<div style="text-align: center; padding: 6px 0; font-size: ${header.titleFontSize}px; font-weight: bold;">${htmlEscape(header.title)}</div>`
    : '';
  const banner = bannerSrc
    ? `<img src="${attrEscape(bannerSrc)}" alt="${attrEscape(header.bannerAlt)}" style="display: block; max-width: 100%; height: auto; margin: 4px auto;">`
    : '';
  const sectionHeading = header.sectionHeading
    ? `<div style="text-align: center; padding: 6px 0; font-size: ${header.sectionHeadingFontSize}px; font-weight: bold;">${htmlEscape(header.sectionHeading)}</div>`
    : '';

  return `<div class="print-header" style="text-align: center; max-width: 710px; margin: 0 auto;">${logo}${title}${banner}${sectionHeading}</div>`;
}

function renderFooterForPrint(footer: FooterBlock, data: ProjectData): string {
  const bg = footer.backgroundColor ?? data.global.footerBackgroundColor;
  const fg = footer.textColor ?? data.global.footerTextColor;
  const bannerSrc = urlSafe(footer.bannerSrc);

  const banner = bannerSrc
    ? `<img src="${attrEscape(bannerSrc)}" alt="${attrEscape(footer.bannerAlt)}" style="display: block; max-width: 100%; height: auto; margin: 0 auto 6px;">`
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

  return `<div class="print-footer" style="text-align: center; max-width: 710px; margin: 0 auto; background-color: ${attrEscape(bg)}; color: ${attrEscape(fg)}; padding: 8px 12px;">
${banner}
<div style="font-weight: bold;">${htmlEscape(footer.companyName)}</div>
${address}
${phone}
${email}
${websites}
${socials}
</div>`;
}

export function renderPrintDocument(data: ProjectData): string {
  const header = findHeader(data.blocks);
  const footer = findFooter(data.blocks);
  return `<!doctype html>
<html lang="en">
${renderHead(data)}
<body>
<div class="running-header">${renderHeaderForPrint(header, data)}</div>
<div class="running-footer">${renderFooterForPrint(footer, data)}</div>
<main>
</main>
</body>
</html>`;
}
