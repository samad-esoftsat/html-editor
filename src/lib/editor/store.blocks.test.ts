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
});
