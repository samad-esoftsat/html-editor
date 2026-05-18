'use client';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, Check, Loader2, Redo2, Undo2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEditor, useEditorStore, useTemporal } from '@/lib/editor/StoreProvider';
import { useCanEdit } from '@/lib/editor/RoleProvider';
import { useState } from 'react';
import { fade } from '@/lib/motion';
import { WorkspaceSwitcher, type WorkspaceOption } from '@/components/workspace/WorkspaceSwitcher';
import { DownloadMenu } from './DownloadMenu';

interface TopbarProps {
  slug: string;
  currentWorkspace: WorkspaceOption;
  workspaces: WorkspaceOption[];
}

export function Topbar({ slug, currentWorkspace, workspaces }: TopbarProps) {
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
  const canEdit = useCanEdit();

  const onUndo = () => { store.flushHistoryCooldown(); undo(); };
  const onRedo = () => { store.flushHistoryCooldown(); redo(); };
  const onReset = () => {
    store.flushHistoryCooldown();
    store.getState().resetToSaved();
  };

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(name);

  const statusIcon =
    saving === 'saving' || saving === 'pending' ? <Loader2 size={12} className="animate-spin" /> :
    saving === 'error' ? <AlertCircle size={12} /> :
    <Check size={12} />;
  const statusLabel =
    saving === 'saving' ? 'Saving...' :
    saving === 'pending' ? 'Pending...' :
    saving === 'error' ? 'Save failed' : 'Saved';

  async function commitName() {
    setEditing(false);
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === name) { setDraftName(name); return; }
    store.getState().setName(trimmed);
  }

  return (
    <div className="flex items-center gap-4 px-5 py-2.5 border-b border-border bg-panel-2 text-sm">
      <Link
        href={`/w/${slug}`}
        className="inline-flex items-center gap-1.5 text-brand hover:opacity-80 transition-opacity"
      >
        <ArrowLeft size={14} /> Projects
      </Link>
      <WorkspaceSwitcher current={currentWorkspace} workspaces={workspaces} />
      <span className="text-border-strong">|</span>
      {editing && canEdit ? (
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
      ) : canEdit ? (
        <button onClick={() => { setDraftName(name); setEditing(true); }} className="font-semibold text-fg">{name}</button>
      ) : (
        <span className="font-semibold text-fg">{name}</span>
      )}
      {canEdit && (
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={saving}
            variants={fade}
            initial="hidden"
            animate="show"
            exit="exit"
            className={`inline-flex items-center gap-1.5 ${saving === 'error' ? 'text-danger' : saving === 'idle' ? 'text-success' : 'text-muted'}`}
          >
            {statusIcon} {statusLabel}
          </motion.span>
        </AnimatePresence>
      )}
      {!canEdit && (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-border-strong bg-panel px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-2">
          View only
        </span>
      )}
      {lastError && <span className="text-danger text-xs">{lastError}</span>}
      <div className="ml-auto flex items-center gap-2">
        {canEdit && (
          <>
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo (Ctrl/Cmd+Z)"
              className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-2.5 py-1.5 text-xs text-fg hover:bg-panel hover:border-brand/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border-strong"
            >
              <Undo2 size={14} /> Undo
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo (Ctrl/Cmd+Shift+Z)"
              className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-2.5 py-1.5 text-xs text-fg hover:bg-panel hover:border-brand/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border-strong"
            >
              <Redo2 size={14} /> Redo
            </button>
            <button
              type="button"
              onClick={onReset}
              disabled={!isDirty}
              title="Discard unsaved changes and revert to last saved version"
              className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-2.5 py-1.5 text-xs text-fg hover:bg-panel hover:border-brand/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border-strong"
            >
              Reset to last saved
            </button>
          </>
        )}
        <DownloadMenu projectId={projectId} slug={slug} />
      </div>
    </div>
  );
}
