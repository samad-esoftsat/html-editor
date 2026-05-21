import { createStore, type StoreApi } from 'zustand/vanilla';
import { temporal, type TemporalState } from 'zundo';
import { v4 as uuid } from 'uuid';
import type { Block, Footer, GlobalStyles, Header, ProductSection, ProductSectionBlock, ProjectData } from './types';
import { findHeader, findFooter, makeProductSectionBlock } from './blocks';

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

  updateBlock(id: string, patch: Omit<Partial<Block>, 'type' | 'id'>): void;
  addBlock(block: Block, atIndex?: number): void;
  removeBlock(id: string): void;
  moveBlock(id: string, dir: 'up' | 'down'): void;
  duplicateBlock(id: string): void;
  reorderBlocks(next: Block[]): void;

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

function isLocked(b: Block): boolean {
  return b.locked === true;
}

function validateInvariant(blocks: Block[]): boolean {
  if (blocks.length < 2) return false;
  if (blocks[0].type !== 'header') return false;
  if (blocks[blocks.length - 1].type !== 'footer') return false;
  for (let i = 1; i < blocks.length - 1; i++) {
    if (blocks[i].type === 'header' || blocks[i].type === 'footer') return false;
  }
  if (blocks.filter((b) => b.type === 'header').length !== 1) return false;
  if (blocks.filter((b) => b.type === 'footer').length !== 1) return false;
  return true;
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
      (set, get) => ({
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

        // Block-generic core actions
        updateBlock: (id, patch) => set((state) => ({
          data: {
            ...state.data,
            blocks: state.data.blocks.map((b) =>
              b.id === id ? ({ ...b, ...patch } as Block) : b,
            ),
          },
        })),

        addBlock: (block, atIndex) => set((state) => {
          const blocks = state.data.blocks.slice();
          const insertAt = typeof atIndex === 'number'
            ? Math.max(1, Math.min(atIndex, blocks.length - 1))
            : blocks.length - 1;
          blocks.splice(insertAt, 0, block);
          if (!validateInvariant(blocks)) return state;
          return { data: { ...state.data, blocks } };
        }),

        removeBlock: (id) => set((state) => {
          const target = state.data.blocks.find((b) => b.id === id);
          if (!target || isLocked(target)) return state;
          const blocks = state.data.blocks.filter((b) => b.id !== id);
          if (!validateInvariant(blocks)) return state;
          return { data: { ...state.data, blocks } };
        }),

        moveBlock: (id, dir) => set((state) => {
          const arr = state.data.blocks;
          const idx = arr.findIndex((b) => b.id === id);
          if (idx === -1) return state;
          const swap = dir === 'up' ? idx - 1 : idx + 1;
          if (swap < 0 || swap >= arr.length) return state;
          if (isLocked(arr[idx]) || isLocked(arr[swap])) return state;
          const next = arr.slice();
          [next[idx], next[swap]] = [next[swap], next[idx]];
          if (!validateInvariant(next)) return state;
          return { data: { ...state.data, blocks: next } };
        }),

        duplicateBlock: (id) => set((state) => {
          const idx = state.data.blocks.findIndex((b) => b.id === id);
          if (idx < 0) return state;
          const src = state.data.blocks[idx];
          if (isLocked(src)) return state;
          const copy: Block = src.type === 'product-section'
            ? { ...src, id: uuid(), bullets: src.bullets.slice() }
            : { ...src, id: uuid() };
          const blocks = state.data.blocks.slice();
          blocks.splice(idx + 1, 0, copy);
          if (!validateInvariant(blocks)) return state;
          return { data: { ...state.data, blocks } };
        }),

        reorderBlocks: (next) => set((state) => {
          if (!validateInvariant(next)) return state;
          return { data: { ...state.data, blocks: next } };
        }),

        // Legacy wrapper actions — same call signatures, delegate to core
        setHeader: (patch) => {
          const id = findHeader(get().data.blocks).id;
          const { type: _t, id: _i, ...rest } = patch as Partial<Block>;
          get().updateBlock(id, rest);
        },
        setFooter: (patch) => {
          const id = findFooter(get().data.blocks).id;
          const { type: _t, id: _i, ...rest } = patch as Partial<Block>;
          get().updateBlock(id, rest);
        },
        addSection: (atIndex) => {
          // Legacy atIndex was section-relative. Translate to block-relative: header at 0 → block index = atIndex + 1.
          const blockIndex = typeof atIndex === 'number' ? atIndex + 1 : undefined;
          get().addBlock(makeProductSectionBlock(), blockIndex);
        },
        removeSection: (id) => get().removeBlock(id),
        moveSection: (id, dir) => get().moveBlock(id, dir),
        duplicateSection: (id) => get().duplicateBlock(id),
        reorderSections: (next) => {
          const blocks = get().data.blocks;
          const header = findHeader(blocks);
          const footer = findFooter(blocks);
          get().reorderBlocks([header, ...(next as ProductSectionBlock[]), footer]);
        },
        setSection: (id, patch) => {
          const { type: _t, id: _i, ...rest } = patch as Partial<Block>;
          get().updateBlock(id, rest);
        },

        setProjectBrandKit: (id) => {
          flushHistoryCooldown();
          set({ brandKitId: id });
        },
        applyBrandKit: (snapshot) => set((state) => {
          const nextGlobal = snapshot.global
            ? { ...state.data.global, ...snapshot.global }
            : state.data.global;
          if (!snapshot.footer) {
            return { data: { ...state.data, global: nextGlobal } };
          }
          const footerId = findFooter(state.data.blocks).id;
          const blocks = state.data.blocks.map((b) =>
            b.id === footerId ? ({ ...b, ...snapshot.footer } as Block) : b,
          );
          return { data: { ...state.data, global: nextGlobal, blocks } };
        }),
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
