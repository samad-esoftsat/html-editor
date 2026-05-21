import { describe, expect, it } from 'vitest';
import {
  createNewsletterTemplate,
  createAnnouncementTemplate,
  createEventInviteTemplate,
  TEMPLATES,
} from '@/lib/editor/templates';

describe('Phase 2 templates', () => {
  it('newsletter has header, hero, three articles (top), cta-banner, footer', () => {
    const p = createNewsletterTemplate();
    const types = p.blocks.map((b) => b.type);
    expect(types[0]).toBe('header');
    expect(types[types.length - 1]).toBe('footer');
    expect(types.filter((t) => t === 'hero').length).toBe(1);
    expect(types.filter((t) => t === 'article').length).toBe(3);
    expect(types.filter((t) => t === 'cta-banner').length).toBe(1);
    const articles = p.blocks.filter((b) => b.type === 'article');
    for (const a of articles) {
      if (a.type !== 'article') throw new Error('type narrow');
      expect(a.imagePosition).toBe('top');
    }
  });

  it('announcement has header, hero, one article (left), cta-banner, footer', () => {
    const p = createAnnouncementTemplate();
    const types = p.blocks.map((b) => b.type);
    expect(types).toEqual(['header', 'hero', 'article', 'cta-banner', 'footer']);
    const art = p.blocks.find((b) => b.type === 'article');
    if (!art || art.type !== 'article') throw new Error('missing article');
    expect(art.imagePosition).toBe('left');
  });

  it('event-invite has header, hero, one article (left), three product-sections, cta-banner, footer', () => {
    const p = createEventInviteTemplate();
    const types = p.blocks.map((b) => b.type);
    expect(types).toEqual([
      'header', 'hero', 'article',
      'product-section', 'product-section', 'product-section',
      'cta-banner', 'footer',
    ]);
  });

  it('TEMPLATES registers five entries with groups', () => {
    expect(TEMPLATES.length).toBe(5);
    const ids = TEMPLATES.map((t) => t.id).sort();
    expect(ids).toEqual(['announcement', 'blank', 'event-invite', 'globaltt', 'newsletter']);
    for (const t of TEMPLATES) {
      expect(['Quick start', 'Layouts']).toContain(t.group);
    }
  });
});
