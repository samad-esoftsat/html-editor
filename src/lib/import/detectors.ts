export function parseInlineStyle(style: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!style) return out;
  for (const decl of style.split(';')) {
    const idx = decl.indexOf(':');
    if (idx === -1) continue;
    const k = decl.slice(0, idx).trim().toLowerCase();
    const v = decl.slice(idx + 1).trim();
    if (k && v) out[k] = v;
  }
  return out;
}

export function isLogoImg(el: HTMLImageElement): boolean {
  const alt = (el.getAttribute('alt') ?? '').toLowerCase();
  if (alt.includes('logo')) return true;
  const w = parseInt(el.getAttribute('width') ?? '', 10);
  if (Number.isFinite(w) && w > 0 && w <= 500 && alt.length > 0) return true;
  return false;
}

export function isBannerImg(el: HTMLImageElement): boolean {
  const w = parseInt(el.getAttribute('width') ?? '', 10);
  return Number.isFinite(w) && w >= 600;
}

export function extractBgColor(el: Element): string | null {
  const bgcolor = el.getAttribute('bgcolor');
  if (bgcolor) return bgcolor;
  const style = parseInlineStyle(el.getAttribute('style') ?? '');
  return style['background-color'] ?? style['background'] ?? null;
}

export function looksDark(color: string): boolean {
  if (!color) return false;
  const c = color.trim().toLowerCase();
  if (c === '#000' || c === '#000000' || c === 'black') return true;
  const m = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (m) {
    const hex = m[1].length === 3 ? m[1].split('').map((x) => x + x).join('') : m[1];
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return 0.299 * r + 0.587 * g + 0.114 * b < 80;
  }
  return false;
}
