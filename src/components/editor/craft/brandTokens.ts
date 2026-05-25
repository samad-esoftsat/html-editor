import type { GlobalStyles, ColorToken } from '@/lib/editor/types';

export function fallbackGlobalStyles(): GlobalStyles {
  return {
    accentColor: '#f1592a',
    backgroundColor: '#ffffff',
    baseFontSize: 16,
    buttonColor: '#f1592a',
    buttonTextColor: '#ffffff',
    contactUrl: '',
    fontFamily: 'Arial, Helvetica Neue, Helvetica, sans-serif',
    footerBackgroundColor: '#000000',
    footerTextColor: '#fafafa',
    headingFontSize: 25,
    textColor: '#1c1c1c',
  };
}

export function resolveColorToken(
  token: ColorToken | undefined,
  global: GlobalStyles | undefined,
): string | undefined {
  const resolved = global ?? fallbackGlobalStyles();
  if (!token) {
    return undefined;
  }
  switch (token) {
    case 'text':
      return resolved.textColor;
    case 'primary':
      return resolved.buttonColor;
    case 'accent':
      return resolved.accentColor;
    case 'footerBg':
      return resolved.footerBackgroundColor;
    case 'footerText':
      return resolved.footerTextColor;
  }
}
