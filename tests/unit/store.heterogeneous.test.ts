import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '@/lib/editor/defaultProject';
import { createEditorStore } from '@/lib/editor/store';
import { findHeader, findFooter, productSections } from '@/lib/editor/blocks';
import type { HeroBlock, ArticleBlock, CTABannerBlock } from '@/lib/editor/types';

const NOW = '2026-05-21T10:00:00Z';

function freshStore() {
  return createEditorStore({
    projectId: 'p1', name: 'Test',
    data: createDefaultProject(),
    brandKitId: null, workspaceSlug: 'test-ws', serverUpdatedAt: NOW,
  });
}

function makeHero(id: string): HeroBlock {
  return { type: 'hero', id, imageSrc: '', imageAlt: '', title: 'H', subtitle: '', ctaText: 'Go' };
}
function makeArticle(id: string): ArticleBlock {
  return { type: 'article', id, imageSrc: '', imageAlt: '', title: 'A', body: 'b', ctaText: 'Go', imagePosition: 'top' };
}
function makeCTABanner(id: string): CTABannerBlock {
  return { type: 'cta-banner', id, title: 'C', subtitle: '', ctaText: 'Go', align: 'center' };
}

describe('heterogeneous middle slice', () => {
  it('addBlock accepts a hero block before the footer', () => {
    const store = freshStore();
    store.getState().addBlock(makeHero('hero-1'));
    const blocks = store.getState().data.blocks;
    expect(blocks[blocks.length - 2].type).toBe('hero');
    expect(blocks[blocks.length - 1].type).toBe('footer');
  });

  it('addBlock accepts an article block', () => {
    const store = freshStore();
    store.getState().addBlock(makeArticle('art-1'));
    expect(store.getState().data.blocks.some((b) => b.id === 'art-1')).toBe(true);
  });

  it('addBlock accepts a cta-banner block', () => {
    const store = freshStore();
    store.getState().addBlock(makeCTABanner('cta-1'));
    expect(store.getState().data.blocks.some((b) => b.id === 'cta-1')).toBe(true);
  });

  it('reorderBlocks accepts a heterogeneous middle', () => {
    const store = freshStore();
    store.getState().addBlock(makeHero('hero-1'));
    store.getState().addBlock(makeArticle('art-1'));
    const blocks = store.getState().data.blocks;
    const header = findHeader(blocks);
    const footer = findFooter(blocks);
    const middle = blocks.slice(1, -1);
    const reordered = [...middle].reverse();
    store.getState().reorderBlocks([header, ...reordered, footer]);
    const after = store.getState().data.blocks;
    expect(after[0].type).toBe('header');
    expect(after[after.length - 1].type).toBe('footer');
    expect(after.slice(1, -1).map((b) => b.id)).toEqual(reordered.map((b) => b.id));
  });

  it('reorderBlocks rejects a header in the middle', () => {
    const store = freshStore();
    const blocks = store.getState().data.blocks;
    const header = findHeader(blocks);
    const footer = findFooter(blocks);
    const before = store.getState().data.blocks;
    store.getState().reorderBlocks([header, header, footer]);
    expect(store.getState().data.blocks).toBe(before);
  });

  it('duplicateBlock works on a hero block', () => {
    const store = freshStore();
    store.getState().addBlock(makeHero('hero-1'));
    store.getState().duplicateBlock('hero-1');
    const heroes = store.getState().data.blocks.filter((b) => b.type === 'hero');
    expect(heroes.length).toBe(2);
    expect(heroes[0].id).toBe('hero-1');
    expect(heroes[1].id).not.toBe('hero-1');
  });

  it('duplicateBlock refuses to duplicate the header', () => {
    const store = freshStore();
    const headerId = findHeader(store.getState().data.blocks).id;
    const before = store.getState().data.blocks;
    store.getState().duplicateBlock(headerId);
    expect(store.getState().data.blocks).toBe(before);
  });

  it('duplicateBlock still deep-copies product-section bullets', () => {
    const store = freshStore();
    const psId = productSections(store.getState().data.blocks)[0].id;
    store.getState().duplicateBlock(psId);
    const copies = store.getState().data.blocks.filter((b) => b.type === 'product-section');
    const src = copies[0];
    const copy = copies[1];
    if (src.type !== 'product-section' || copy.type !== 'product-section') throw new Error('type narrow');
    expect(copy.bullets).not.toBe(src.bullets);
    expect(copy.bullets).toEqual(src.bullets);
  });
});
