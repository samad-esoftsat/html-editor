'use client';

import { createContext, useContext, useRef, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type { TemporalState } from 'zundo';
import { createEditorStore, type EditorState, type EditorStore, type TrackedState } from './store';
import type { ProjectData } from './types';

interface ProviderProps {
  projectId: string;
  name: string;
  data: ProjectData;
  brandKitId: string | null;
  workspaceSlug: string;
  serverUpdatedAt: string;
  children: ReactNode;
}

const Ctx = createContext<EditorStore | null>(null);

export function StoreProvider(props: ProviderProps) {
  const ref = useRef<EditorStore | null>(null);
  if (!ref.current) {
    ref.current = createEditorStore({
      projectId: props.projectId,
      name: props.name,
      data: props.data,
      brandKitId: props.brandKitId,
      workspaceSlug: props.workspaceSlug,
      serverUpdatedAt: props.serverUpdatedAt,
    });
  }
  return <Ctx.Provider value={ref.current}>{props.children}</Ctx.Provider>;
}

export function useEditor<T>(selector: (state: EditorState) => T): T {
  const store = useContext(Ctx);
  if (!store) throw new Error('useEditor must be used within StoreProvider');
  return useStore(store, selector);
}

export function useEditorStore(): EditorStore {
  const store = useContext(Ctx);
  if (!store) throw new Error('useEditorStore must be used within StoreProvider');
  return store;
}

export function useTemporal<T>(selector: (state: TemporalState<TrackedState>) => T): T {
  const store = useContext(Ctx);
  if (!store) throw new Error('useTemporal must be used within StoreProvider');
  return useStore(store.temporal, selector);
}
