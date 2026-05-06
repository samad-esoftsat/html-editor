import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  parseInlineStyle,
  isLogoImg,
  isBannerImg,
  extractBgColor,
  looksDark,
} from '@/lib/import/detectors';

function el(html: string): Element {
  const tag = (html.match(/^<(\w+)/) ?? [, ''])[1].toLowerCase();
  const wrapInTable = ['td', 'th'].includes(tag);
  const inner = wrapInTable ? `<table><tbody><tr>${html}</tr></tbody></table>` : html;
  const dom = new JSDOM(`<!doctype html><html><body>${inner}</body></html>`);
  if (wrapInTable) return dom.window.document.querySelector(tag) as Element;
  return dom.window.document.body.firstElementChild as Element;
}

describe('parseInlineStyle', () => {
  it('returns empty object for empty string', () => {
    expect(parseInlineStyle('')).toEqual({});
  });

  it('parses single declaration', () => {
    expect(parseInlineStyle('color: red')).toEqual({ color: 'red' });
  });

  it('parses multiple declarations and lowercases keys', () => {
    expect(parseInlineStyle('Color: red; Background-Color: #fff')).toEqual({
      color: 'red',
      'background-color': '#fff',
    });
  });

  it('preserves case of values and trims whitespace', () => {
    expect(parseInlineStyle('font-family:  Arial, sans-serif ;')).toEqual({
      'font-family': 'Arial, sans-serif',
    });
  });

  it('skips declarations without a colon', () => {
    expect(parseInlineStyle('garbage; color: red')).toEqual({ color: 'red' });
  });
});

describe('isLogoImg', () => {
  it('returns true when alt contains "logo" (case insensitive)', () => {
    const img = el('<img src="x" alt="GlobalTT Logo">') as HTMLImageElement;
    expect(isLogoImg(img)).toBe(true);
  });

  it('returns true when width <= 500 and alt is non-empty', () => {
    const img = el('<img src="x" alt="Brand" width="200">') as HTMLImageElement;
    expect(isLogoImg(img)).toBe(true);
  });

  it('returns false when width > 500 and alt does not mention logo', () => {
    const img = el('<img src="x" alt="Hero" width="710">') as HTMLImageElement;
    expect(isLogoImg(img)).toBe(false);
  });

  it('returns false when alt is empty and no logo keyword', () => {
    const img = el('<img src="x" width="200">') as HTMLImageElement;
    expect(isLogoImg(img)).toBe(false);
  });
});

describe('isBannerImg', () => {
  it('returns true when width >= 600', () => {
    const img = el('<img src="x" width="710">') as HTMLImageElement;
    expect(isBannerImg(img)).toBe(true);
  });

  it('returns false when width < 600', () => {
    const img = el('<img src="x" width="400">') as HTMLImageElement;
    expect(isBannerImg(img)).toBe(false);
  });

  it('returns false when width missing', () => {
    const img = el('<img src="x">') as HTMLImageElement;
    expect(isBannerImg(img)).toBe(false);
  });
});

describe('extractBgColor', () => {
  it('reads bgcolor attribute', () => {
    const td = el('<td bgcolor="#abcdef"></td>');
    expect(extractBgColor(td)).toBe('#abcdef');
  });

  it('reads background-color from inline style', () => {
    const td = el('<td style="background-color: #d0d0d0;"></td>');
    expect(extractBgColor(td)).toBe('#d0d0d0');
  });

  it('falls back to background shorthand', () => {
    const td = el('<td style="background: #123456;"></td>');
    expect(extractBgColor(td)).toBe('#123456');
  });

  it('returns null when no bgcolor or style', () => {
    const td = el('<td></td>');
    expect(extractBgColor(td)).toBeNull();
  });
});

describe('looksDark', () => {
  it('detects #000000 as dark', () => {
    expect(looksDark('#000000')).toBe(true);
  });

  it('detects #000 short hex as dark', () => {
    expect(looksDark('#000')).toBe(true);
  });

  it('detects "black" as dark', () => {
    expect(looksDark('black')).toBe(true);
  });

  it('detects #ffffff as not dark', () => {
    expect(looksDark('#ffffff')).toBe(false);
  });

  it('detects mid-tone #808080 as not dark', () => {
    expect(looksDark('#808080')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(looksDark('')).toBe(false);
  });

  it('returns false for unknown format', () => {
    expect(looksDark('rgb(0,0,0)')).toBe(false);
  });
});
