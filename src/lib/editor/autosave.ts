'use client';

import { useEffect, useRef } from 'react';
import { patchProject } from '@/lib/api/projects';
import { debounce } from '@/lib/utils/debounce';
import { useEditorStore } from './StoreProvider';

const DEBOUNCE_MS = 800;

export function useAutosave(enabled = true) {
  const store = useEditorStore();
  const initialised = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const save = async () => {
      const { projectId, name, data, brandKitId, serverUpdatedAt } = store.getState();
      store.getState().markSaving('saving');
      try {
        const res = await patchProject(
          projectId,
          { name, data, brand_kit_id: brandKitId },
          serverUpdatedAt,
        );
        store.getState().markSaved(res.updated_at, data, name, brandKitId);
      } catch (e) {
        const err = e as Error & { code?: string };
        if (err.code === 'conflict') {
          try {
            const res = await patchProject(projectId, { name, data, brand_kit_id: brandKitId });
            store.getState().markSaved(res.updated_at, data, name, brandKitId);
          } catch (retryError) {
            store.getState().markSaving(
              'error',
              retryError instanceof Error ? retryError.message : 'Save failed.',
            );
          }
        } else {
          store.getState().markSaving('error', err.message);
        }
      }
    };

    const debounced = debounce(save, DEBOUNCE_MS);
    const unsub = store.subscribe((state, prev) => {
      if (!initialised.current) {
        initialised.current = true;
        return;
      }
      if (
        state.data === prev.data &&
        state.name === prev.name &&
        state.brandKitId === prev.brandKitId
      ) return;
      state.markSaving('pending');
      debounced();
    });

    const onUnload = (e: BeforeUnloadEvent) => {
      const status = store.getState().saving;
      if (status === 'pending' || status === 'saving') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onUnload);

    return () => {
      unsub();
      debounced.flush();
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [store, enabled]);
}
