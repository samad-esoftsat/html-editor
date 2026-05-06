import { describe, it, expect } from 'vitest';
import { htmlEscape, attrEscape, urlSafe } from '@/lib/export/escape';

describe('htmlEscape', () => {
  it('escapes &, <, >, ", and \'', () => {
    expect(htmlEscape(`Tom & Jerry's <script>"x"</script>`)).toBe(
      'Tom &amp; Jerry&#39;s &lt;script&gt;&quot;x&quot;&lt;/script&gt;'
    );
  });

  it('escapes & first to avoid double-escaping', () => {
    expect(htmlEscape('&amp;')).toBe('&amp;amp;');
  });

  it('returns empty string unchanged', () => {
    expect(htmlEscape('')).toBe('');
  });
});

describe('attrEscape', () => {
  it('escapes & and " only', () => {
    expect(attrEscape('a & b "c"')).toBe('a &amp; b &quot;c&quot;');
  });

  it('leaves < and > alone in attr context', () => {
    expect(attrEscape('a<b>c')).toBe('a<b>c');
  });
});

describe('urlSafe', () => {
  it('allows https URLs', () => {
    expect(urlSafe('https://example.com')).toBe('https://example.com');
  });

  it('allows http URLs', () => {
    expect(urlSafe('http://example.com')).toBe('http://example.com');
  });

  it('allows mailto URLs', () => {
    expect(urlSafe('mailto:info@example.com')).toBe('mailto:info@example.com');
  });

  it('allows tel URLs', () => {
    expect(urlSafe('tel:+1234567890')).toBe('tel:+1234567890');
  });

  it('blocks javascript: URLs', () => {
    expect(urlSafe('javascript:alert(1)')).toBe('#');
  });

  it('blocks data: URLs', () => {
    expect(urlSafe('data:text/html,<script>alert(1)</script>')).toBe('#');
  });

  it('blocks relative URLs', () => {
    expect(urlSafe('/relative/path')).toBe('#');
  });

  it('returns # for empty string', () => {
    expect(urlSafe('')).toBe('#');
  });

  it('is case-insensitive on the protocol', () => {
    expect(urlSafe('HTTPS://example.com')).toBe('HTTPS://example.com');
    expect(urlSafe('JavaScript:alert(1)')).toBe('#');
  });
});
