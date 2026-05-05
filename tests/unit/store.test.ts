import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '@/lib/editor/defaultProject';
import { createEditorStore } from '@/lib/editor/store';

const NOW = '2026-05-05T10:00:00Z';

function freshStore() {
  return createEditorStore({
    projectId: 'p1',
    name: 'Test',
    data: createDefaultProject(),
    serverUpdatedAt: NOW,
  });
}

describe('editor store', () => {
  it('setGlobal patches global styles', () => {
    const store = freshStore();
    store.getState().setGlobal({ backgroundColor: '#ffffff' });
    expect(store.getState().data.global.backgroundColor).toBe('#ffffff');
    expect(store.getState().data.global.fontFamily).toMatch(/Arial/);
  });

  it('addSection appends a new blank section with unique id', () => {
    const store = freshStore();
    const before = store.getState().data.sections.length;
    store.getState().addSection();
    const after = store.getState().data.sections;
    expect(after.length).toBe(before + 1);
    expect(after.at(-1)!.title).toBe('New Product');
    expect(new Set(after.map((section) => section.id)).size).toBe(after.length);
  });

  it('removeSection removes by id', () => {
    const store = freshStore();
    const target = store.getState().data.sections[2].id;
    store.getState().removeSection(target);
    expect(store.getState().data.sections.find((section) => section.id === target)).toBeUndefined();
  });

  it('moveSection up swaps with previous', () => {
    const store = freshStore();
    const ids = store.getState().data.sections.map((section) => section.id);
    store.getState().moveSection(ids[3], 'up');
    const after = store.getState().data.sections.map((section) => section.id);
    expect(after[2]).toBe(ids[3]);
    expect(after[3]).toBe(ids[2]);
  });

  it('moveSection up at index 0 is a noop', () => {
    const store = freshStore();
    const ids = store.getState().data.sections.map((section) => section.id);
    store.getState().moveSection(ids[0], 'up');
    expect(store.getState().data.sections.map((section) => section.id)).toEqual(ids);
  });

  it('moveSection down at last index is a noop', () => {
    const store = freshStore();
    const ids = store.getState().data.sections.map((section) => section.id);
    store.getState().moveSection(ids.at(-1)!, 'down');
    expect(store.getState().data.sections.map((section) => section.id)).toEqual(ids);
  });

  it('setSection patches one section, leaves siblings untouched', () => {
    const store = freshStore();
    const id = store.getState().data.sections[2].id;
    const otherTitleBefore = store.getState().data.sections[3].title;
    store.getState().setSection(id, { title: 'Renamed' });
    expect(store.getState().data.sections[2].title).toBe('Renamed');
    expect(store.getState().data.sections[3].title).toBe(otherTitleBefore);
  });
});
