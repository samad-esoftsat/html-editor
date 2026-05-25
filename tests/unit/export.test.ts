import { describe, expect, it } from 'vitest';
import { renderEmail } from '@/lib/export/renderEmail';
import { createDefaultProject } from '@/lib/editor/defaultProject';
import { migrateV2ToV3 } from '@/lib/editor/migrate';
import type { LegacyProjectData } from '@/lib/editor/legacy';

function withBlocks(blocks: LegacyProjectData['blocks']) {
  return migrateV2ToV3({
    ...createDefaultProject(),
    schemaVersion: 2,
    blocks,
  } as unknown as LegacyProjectData);
}

describe('renderEmail', () => {
  it('returns a complete HTML document', async () => {
    const html = await renderEmail(createDefaultProject());
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('<body');
    expect(html.trimEnd().endsWith('</html>')).toBe(true);
  });

  it('renders default project content and footer links', async () => {
    const html = await renderEmail(createDefaultProject());
    expect(html).toContain('Critical communication');
    expect(html).toContain('Starlink Solutions');
    expect(html).toContain('GlobalTT Satellite Teleport');
    expect(html).toContain('mailto:info@globaltt.com');
  });

  it('escapes user-authored text', async () => {
    const html = await renderEmail(withBlocks([
      {
        type: 'header',
        id: 'h',
        logoSrc: '',
        logoAlt: '',
        logoWidth: 200,
        title: '<script>alert(1)</script>',
        titleFontSize: 18,
        bannerSrc: '',
        bannerAlt: '',
        sectionHeading: '',
        sectionHeadingFontSize: 24,
      },
      { type: 'footer', id: 'f', bannerSrc: '', bannerAlt: '', companyName: '', address: '', phone: '', phoneTel: '', email: '', websites: [], socials: [] },
    ]));
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('renders phase-2 blocks through the tree migrator', async () => {
    const html = await renderEmail(withBlocks([
      {
        type: 'header',
        id: 'h',
        logoSrc: '',
        logoAlt: '',
        logoWidth: 200,
        title: 'Header',
        titleFontSize: 18,
        bannerSrc: '',
        bannerAlt: '',
        sectionHeading: '',
        sectionHeadingFontSize: 24,
      },
      {
        type: 'hero',
        id: 'hero',
        imageSrc: 'https://example.com/hero.png',
        imageAlt: 'Hero image',
        title: 'Big news',
        subtitle: 'Some sub',
        ctaText: 'Learn more',
        ctaUrl: 'https://example.com/x',
      },
      {
        type: 'article',
        id: 'article',
        imageSrc: '',
        imageAlt: 'Article image',
        title: 'Article title',
        body: 'Line 1\nLine 2',
        ctaText: 'Read',
        imagePosition: 'left',
      },
      {
        type: 'cta-banner',
        id: 'cta',
        title: 'Ready?',
        subtitle: 'Sub',
        ctaText: 'Go',
        align: 'center',
      },
      { type: 'footer', id: 'f', bannerSrc: '', bannerAlt: '', companyName: '', address: '', phone: '', phoneTel: '', email: '', websites: [], socials: [] },
    ]));
    expect(html).toContain('Big news');
    expect(html).toContain('Article title');
    expect(html).toContain('Ready?');
    expect(html).toContain('https://example.com/x');
  });
});
