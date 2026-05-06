export function htmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function attrEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

const ALLOWED_PROTOCOLS = /^(https?|mailto|tel):/i;

export function urlSafe(url: string): string {
  if (!url) return '#';
  if (ALLOWED_PROTOCOLS.test(url)) return url;
  return '#';
}
