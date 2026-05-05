import { createStore, type StoreApi } from 'zustand/vanilla';
import { v4 as uuid } from 'uuid';
import type { Footer, GlobalStyles, Header, ProductSection, ProjectData } from './types';

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'error';

export interface EditorState {
  projectId: string;
  name: string;
  data: ProjectData;
  serverUpdatedAt: string;
  saving: SaveStatus;
  lastError: string | null;

  setName(name: string): void;
  setGlobal(patch: Partial<GlobalStyles>): void;
  setHeader(patch: Partial<Header>): void;
  setFooter(patch: Partial<Footer>): void;
  addSection(): void;
  removeSection(id: string): void;
  moveSection(id: string, dir: 'up' | 'down'): void;
  setSection(id: string, patch: Partial<ProductSection>): void;

  markSaving(status: SaveStatus, error?: string | null): void;
  markSaved(updatedAt: string): void;
}

export type EditorStore = StoreApi<EditorState>;

interface Init {
  projectId: string;
  name: string;
  data: ProjectData;
  serverUpdatedAt: string;
}

function blankSection(): ProductSection {
  return {
    id: uuid(),
    title: 'New Product',
    bullets: ['Feature one', 'Feature two'],
    imageSrc: '',
    imageAlt: '',
    ctaText: 'Contact Us',
  };
}

export function createEditorStore(init: Init): EditorStore {
  return createStore<EditorState>((set) => ({
    projectId: init.projectId,
    name: init.name,
    data: init.data,
    serverUpdatedAt: init.serverUpdatedAt,
    saving: 'idle',
    lastError: null,

    setName: (name) => set({ name }),
    setGlobal: (patch) => set((state) => ({
      data: { ...state.data, global: { ...state.data.global, ...patch } },
    })),
    setHeader: (patch) => set((state) => ({
      data: { ...state.data, header: { ...state.data.header, ...patch } },
    })),
    setFooter: (patch) => set((state) => ({
      data: { ...state.data, footer: { ...state.data.footer, ...patch } },
    })),
    addSection: () => set((state) => ({
      data: { ...state.data, sections: [...state.data.sections, blankSection()] },
    })),
    removeSection: (id) => set((state) => ({
      data: { ...state.data, sections: state.data.sections.filter((section) => section.id !== id) },
    })),
    moveSection: (id, dir) => set((state) => {
      const arr = state.data.sections;
      const idx = arr.findIndex((section) => section.id === id);
      if (idx === -1) return state;
      const swap = dir === 'up' ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= arr.length) return state;
      const next = arr.slice();
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return { data: { ...state.data, sections: next } };
    }),
    setSection: (id, patch) => set((state) => ({
      data: {
        ...state.data,
        sections: state.data.sections.map((section) => (
          section.id === id ? { ...section, ...patch } : section
        )),
      },
    })),

    markSaving: (status, error = null) => set({ saving: status, lastError: error }),
    markSaved: (updatedAt) => set({ saving: 'idle', serverUpdatedAt: updatedAt, lastError: null }),
  }));
}
