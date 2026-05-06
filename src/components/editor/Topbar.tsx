'use client';
import Link from 'next/link';
import { useEditor, useEditorStore } from '@/lib/editor/StoreProvider';
import { Button } from '@/components/ui/Button';
import { useState } from 'react';

export function Topbar() {
  const name = useEditor((s) => s.name);
  const saving = useEditor((s) => s.saving);
  const lastError = useEditor((s) => s.lastError);
  const store = useEditorStore();

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
      <div className="ml-auto">
        <Button disabled title="Phase 3 — HTML export">⬇ Download HTML</Button>
      </div>
    </div>
  );
}
