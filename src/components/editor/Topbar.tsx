'use client';
import Link from 'next/link';
import { useEditor, useEditorStore, useTemporal } from '@/lib/editor/StoreProvider';
import { useState } from 'react';

export function Topbar() {
  const name = useEditor((s) => s.name);
  const projectId = useEditor((s) => s.projectId);
  const saving = useEditor((s) => s.saving);
  const lastError = useEditor((s) => s.lastError);
  const isDirty = useEditor((s) => s.data !== s.lastSavedData || s.name !== s.lastSavedName);
  const canUndo = useTemporal((s) => s.pastStates.length > 0);
  const canRedo = useTemporal((s) => s.futureStates.length > 0);
  const undo = useTemporal((s) => s.undo);
  const redo = useTemporal((s) => s.redo);
  const store = useEditorStore();

  const onUndo = () => { store.flushHistoryCooldown(); undo(); };
  const onRedo = () => { store.flushHistoryCooldown(); redo(); };
  const onReset = () => {
    store.flushHistoryCooldown();
    store.getState().resetToSaved();
  };

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(name);

  const status =
    saving === 'saving' ? 'Saving…' :
    saving === 'pending' ? 'Pending…' :
    saving === 'error' ? 'Save failed' : '✓ Saved';

  async function commitName() {
    setEditing(false);
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === name) { setDraftName(name); return; }
    store.getState().setName(trimmed);
  }

  return (
    <div className="flex items-center gap-4 px-5 py-2.5 border-b border-border bg-panel-2 text-sm">
      <Link href="/" className="text-brand">← Projects</Link>
      <span className="text-border-strong">|</span>
      {editing ? (
        <input
          autoFocus
          className="bg-panel border border-border-strong rounded px-2 py-0.5"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitName();
            if (e.key === 'Escape') { setDraftName(name); setEditing(false); }
          }}
        />
      ) : (
        <button onClick={() => { setDraftName(name); setEditing(true); }} className="font-semibold text-fg">{name}</button>
      )}
      <span className={saving === 'error' ? 'text-danger' : 'text-muted'}>{status}</span>
      {lastError && <span className="text-danger text-xs">{lastError}</span>}
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl/Cmd+Z)"
          className="rounded-md border border-border-strong px-2.5 py-1.5 text-xs text-fg hover:bg-panel disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ↶ Undo
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl/Cmd+Shift+Z)"
          className="rounded-md border border-border-strong px-2.5 py-1.5 text-xs text-fg hover:bg-panel disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ↷ Redo
        </button>
        <button
          type="button"
          onClick={onReset}
          disabled={!isDirty}
          title="Discard unsaved changes and revert to last saved version"
          className="rounded-md border border-border-strong px-2.5 py-1.5 text-xs text-fg hover:bg-panel disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Reset to last saved
        </button>
        <a
          href={`/api/projects/${projectId}/export`}
          download
          className="inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium bg-brand text-white hover:opacity-90"
        >
          ⬇ Download HTML
        </a>
      </div>
    </div>
  );
}
