import { describe, expect, it } from 'vitest';
import { renderPrintDocument } from '@/lib/export/renderPrintDocument';
import { createBlankProject } from '@/lib/editor/templates';
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

describe('renderPrintDocument', () => {
  it('returns a complete HTML document', async () => {
    const html = await renderPrintDocument(createDefaultProject());
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<main>');
    expect(html.trimEnd().endsWith('</html>')).toBe(true);
  });

  it('renders print CSS and default project content', async () => {
    const html = await renderPrintDocument(createDefaultProject());
    expect(html).toContain('@page');
    expect(html).toContain('Starlink Solutions');
    expect(html).toContain('GlobalTT Satellite Teleport');
  });

  it('renders blank projects without throwing', async () => {
    await expect(renderPrintDocument(createBlankProject())).resolves.toBeTypeOf('string');
  });

  it('escapes user-authored text and renders phase-2 blocks', async () => {
    const html = await renderPrintDocument(withBlocks([
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
        imageSrc: '',
        imageAlt: '',
        title: '<script>x()</script>',
        subtitle: 'Some sub',
        ctaText: 'Learn more',
      },
      {
        type: 'article',
        id: 'article',
        imageSrc: '',
        imageAlt: '',
        title: 'Article title',
        body: 'Line 1\nLine 2',
        ctaText: 'Read',
        imagePosition: 'top',
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
    expect(html).toContain('&lt;script&gt;x()&lt;/script&gt;');
    expect(html).toContain('Article title');
    expect(html).toContain('Ready?');
  });
});
