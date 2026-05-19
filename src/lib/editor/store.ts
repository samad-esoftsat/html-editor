import { createStore, type StoreApi } from 'zustand/vanilla';
import { temporal, type TemporalState } from 'zundo';
import { v4 as uuid } from 'uuid';
import type { Footer, GlobalStyles, Header, ProductSection, ProjectData } from './types';

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'error';

export interface BrandKitSnapshot {
  global?: Partial<GlobalStyles>;
  footer?: Partial<Footer>;
}

export interface EditorState {
  projectId: string;
  name: string;
  data: ProjectData;
  brandKitId: string | null;
  workspaceSlug: string;
  serverUpdatedAt: string;
  saving: SaveStatus;
  lastError: string | null;
  lastSavedData: ProjectData;
  lastSavedName: string;
  lastSavedBrandKitId: string | null;

  setName(name: string): void;
  setGlobal(patch: Partial<GlobalStyles>): void;
  setHeader(patch: Partial<Header>): void;
  setFooter(patch: Partial<Footer>): void;
  addSection(atIndex?: number): void;
  removeSection(id: string): void;
  moveSection(id: string, dir: 'up' | 'down'): void;
  duplicateSection(id: string): void;
  reorderSections(next: ProductSection[]): void;
  setSection(id: string, patch: Partial<ProductSection>): void;
  setProjectBrandKit(id: string | null): void;
  applyBrandKit(snapshot: BrandKitSnapshot): void;
  resetToSaved(): void;

  markSaving(status: SaveStatus, error?: string | null): void;
  markSaved(updatedAt: string, data: ProjectData, name: string, brandKitId: string | null): void;
}

export type TrackedState = Pick<EditorState, 'data' | 'name'>;

export interface EditorStoreApi extends StoreApi<EditorState> {
  temporal: StoreApi<TemporalState<TrackedState>>;
}

export interface EditorStore extends EditorStoreApi {
  flushHistoryCooldown(): void;
}

interface Init {
  projectId: string;
  name: string;
  data: ProjectData;
  brandKitId: string | null;
  workspaceSlug: string;
  serverUpdatedAt: string;
}

const HISTORY_THROTTLE_MS = 500;
const HISTORY_LIMIT = 100;

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
  let cooldown: ReturnType<typeof setTimeout> | null = null;
  const flushHistoryCooldown = () => {
    if (cooldown) {
      clearTimeout(cooldown);
      cooldown = null;
    }
  };

  const store = createStore<EditorState>()(
    temporal(
      (set) => ({
        projectId: init.projectId,
        name: init.name,
        data: init.data,
        brandKitId: init.brandKitId,
        workspaceSlug: init.workspaceSlug,
        serverUpdatedAt: init.serverUpdatedAt,
        saving: 'idle',
        lastError: null,
        lastSavedData: init.data,
        lastSavedName: init.name,
        lastSavedBrandKitId: init.brandKitId,

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
        addSection: (atIndex) => set((state) => {
          const fresh = blankSection();
          const sections = state.data.sections.slice();
          if (typeof atIndex === 'number' && atIndex >= 0 && atIndex <= sections.length) {
            sections.splice(atIndex, 0, fresh);
          } else {
            sections.push(fresh);
          }
          return { data: { ...state.data, sections } };
        }),
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
        duplicateSection: (id) => set((state) => {
          const idx = state.data.sections.findIndex((s) => s.id === id);
          if (idx < 0) return state;
          const src = state.data.sections[idx];
          const copy: ProductSection = {
            ...src,
            id: uuid(),
            bullets: src.bullets.slice(),
          };
          const sections = state.data.sections.slice();
          sections.splice(idx + 1, 0, copy);
          return { data: { ...state.data, sections } };
        }),
        reorderSections: (next) => set((state) => ({
          data: { ...state.data, sections: next },
        })),
        setSection: (id, patch) => set((state) => ({
          data: {
            ...state.data,
            sections: state.data.sections.map((section) => (
              section.id === id ? { ...section, ...patch } : section
            )),
          },
        })),
        setProjectBrandKit: (id) => {
          flushHistoryCooldown();
          set({ brandKitId: id });
        },
        applyBrandKit: (snapshot) => set((state) => ({
          data: {
            ...state.data,
            global: snapshot.global
              ? { ...state.data.global, ...snapshot.global }
              : state.data.global,
            footer: snapshot.footer
              ? { ...state.data.footer, ...snapshot.footer }
              : state.data.footer,
          },
        })),
        resetToSaved: () => set((state) => ({
          data: state.lastSavedData,
          name: state.lastSavedName,
          brandKitId: state.lastSavedBrandKitId,
        })),

        markSaving: (status, error = null) => set({ saving: status, lastError: error }),
        markSaved: (updatedAt, data, name, brandKitId) => set({
          saving: 'idle',
          serverUpdatedAt: updatedAt,
          lastError: null,
          lastSavedData: data,
          lastSavedName: name,
          lastSavedBrandKitId: brandKitId,
        }),
      }),
      {
        partialize: (state): TrackedState => ({ data: state.data, name: state.name }),
        limit: HISTORY_LIMIT,
        equality: (a, b) => a.data === b.data && a.name === b.name,
        handleSet: (snapshot) => (pastState, replace) => {
          if (cooldown) return;
          snapshot(pastState, replace);
          cooldown = setTimeout(() => { cooldown = null; }, HISTORY_THROTTLE_MS);
        },
      },
    ),
  ) as EditorStoreApi;

  return Object.assign(store, { flushHistoryCooldown });
}
