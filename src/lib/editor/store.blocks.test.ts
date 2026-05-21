import { describe, it, expect } from 'vitest';
import { createEditorStore } from './store';
import { createBlankProject } from './templates';
import { findHeader, findFooter, productSections } from './blocks';

function makeStore() {
  return createEditorStore({
    projectId: 'p1',
    name: 'Test',
    data: createBlankProject(),
    brandKitId: null,
    workspaceSlug: 'ws',
    serverUpdatedAt: new Date().toISOString(),
  });
}

describe('store: block invariants', () => {
  it('removeBlock refuses to remove a locked header', () => {
    const store = makeStore();
    const header = findHeader(store.getState().data.blocks);
    store.getState().removeBlock(header.id);
    expect(findHeader(store.getState().data.blocks).id).toBe(header.id);
  });

  it('removeBlock refuses to remove a locked footer', () => {
    const store = makeStore();
    const footer = findFooter(store.getState().data.blocks);
    store.getState().removeBlock(footer.id);
    expect(findFooter(store.getState().data.blocks).id).toBe(footer.id);
  });

  it('removeBlock removes a product-section block', () => {
    const store = makeStore();
    const sections = productSections(store.getState().data.blocks);
    const target = sections[0];
    store.getState().removeBlock(target.id);
    expect(productSections(store.getState().data.blocks).find((s) => s.id === target.id)).toBeUndefined();
  });

  it('reorderBlocks refuses an arrangement where the footer is not last', () => {
    const store = makeStore();
    const initial = store.getState().data.blocks;
    const reversed = [...initial].reverse();
    store.getState().reorderBlocks(reversed);
    expect(store.getState().data.blocks).toEqual(initial);
  });

  it('moveBlock refuses to move header down or footer up', () => {
    const store = makeStore();
    const header = findHeader(store.getState().data.blocks);
    const footer = findFooter(store.getState().data.blocks);
    store.getState().moveBlock(header.id, 'down');
    store.getState().moveBlock(footer.id, 'up');
    expect(store.getState().data.blocks[0].id).toBe(header.id);
    const last = store.getState().data.blocks.length - 1;
    expect(store.getState().data.blocks[last].id).toBe(footer.id);
  });

  it('addBlock inserts a product-section before the footer when no index is given', () => {
    const store = makeStore();
    const before = productSections(store.getState().data.blocks).length;
    store.getState().addSection();
    const after = productSections(store.getState().data.blocks).length;
    expect(after).toBe(before + 1);
    const blocks = store.getState().data.blocks;
    expect(blocks[blocks.length - 1].type).toBe('footer');
  });

  it('legacy setHeader patches the header block', () => {
    const store = makeStore();
    store.getState().setHeader({ title: 'New title' });
    expect(findHeader(store.getState().data.blocks).title).toBe('New title');
  });

  it('legacy setFooter patches the footer block', () => {
    const store = makeStore();
    store.getState().setFooter({ companyName: 'New Co' });
    expect(findFooter(store.getState().data.blocks).companyName).toBe('New Co');
  });

  it('legacy setSection patches a product-section block', () => {
    const store = makeStore();
    const target = productSections(store.getState().data.blocks)[0];
    store.getState().setSection(target.id, { title: 'Patched' });
    const updated = productSections(store.getState().data.blocks).find((s) => s.id === target.id);
    expect(updated?.title).toBe('Patched');
  });

  it('duplicateBlock inserts a copy with a new id after a product section', () => {
    const store = makeStore();
    const target = productSections(store.getState().data.blocks)[0];
    const beforeCount = productSections(store.getState().data.blocks).length;
    store.getState().duplicateBlock(target.id);
    const afterSections = productSections(store.getState().data.blocks);
    expect(afterSections.length).toBe(beforeCount + 1);
    const ids = afterSections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length); // all unique
    // The duplicate appears immediately after the source
    const srcIndex = afterSections.findIndex((s) => s.id === target.id);
    const dup = afterSections[srcIndex + 1];
    expect(dup.title).toBe(target.title);
    expect(dup.id).not.toBe(target.id);
    // Footer remains last block
    const blocks = store.getState().data.blocks;
    expect(blocks[blocks.length - 1].type).toBe('footer');
  });

  it('reorderBlocks accepts a valid reordering of product sections', () => {
    const store = makeStore();
    const blocks = store.getState().data.blocks;
    const header = blocks.find((b) => b.type === 'header')!;
    const footer = blocks.find((b) => b.type === 'footer')!;
    const sections = productSections(blocks);
    const swapped = [sections[1], sections[0], ...sections.slice(2)];
    store.getState().reorderBlocks([header, ...swapped, footer]);
    const newSections = productSections(store.getState().data.blocks);
    expect(newSections[0].id).toBe(sections[1].id);
    expect(newSections[1].id).toBe(sections[0].id);
  });

  it('moveBlock moves a product section up by one position', () => {
    const store = makeStore();
    const sectionsBefore = productSections(store.getState().data.blocks);
    const second = sectionsBefore[1];
    store.getState().moveBlock(second.id, 'up');
    const sectionsAfter = productSections(store.getState().data.blocks);
    expect(sectionsAfter[0].id).toBe(second.id);
    expect(sectionsAfter[1].id).toBe(sectionsBefore[0].id);
  });
});
