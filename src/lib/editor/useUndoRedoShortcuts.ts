'use client';

import { useEffect } from 'react';
import { useEditorStore } from './StoreProvider';

export function useUndoRedoShortcuts(enabled = true) {
  const store = useEditorStore();

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key !== 'z' && key !== 'y') return;
      e.preventDefault();
      store.flushHistoryCooldown();
      const temporal = store.temporal.getState();
      const isRedo = key === 'y' || (key === 'z' && e.shiftKey);
      if (isRedo) temporal.redo();
      else temporal.undo();
    };

    const onFocusOut = () => {
      store.flushHistoryCooldown();
    };

    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, [store, enabled]);
}
