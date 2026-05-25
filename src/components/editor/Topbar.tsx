'use client';
import Link from 'next/link';
import { ArrowLeft, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Redo2, RotateCcw, Undo2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEditor, useEditorStore, useTemporal } from '@/lib/editor/StoreProvider';
import { useCanEdit } from '@/lib/editor/RoleProvider';
import { useEffect, useState } from 'react';
import { fade } from '@/lib/motion';
import { cn } from '@/lib/utils/cn';
import { WorkspaceSwitcher, type WorkspaceOption } from '@/components/workspace/WorkspaceSwitcher';
import { BrandMark } from '@/components/ui/BrandMark';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DownloadMenu } from './DownloadMenu';
import { ProjectActionsMenu } from './ProjectActionsMenu';
import { TranslateMenu } from './TranslateMenu';
import { useEditorMode } from './EditorModeProvider';

interface TopbarProps {
  slug: string;
  currentWorkspace: WorkspaceOption;
  workspaces: WorkspaceOption[];
  leftPanelOpen: boolean;
  setLeftPanelOpen: (open: boolean) => void;
  rightPanelOpen: boolean;
  setRightPanelOpen: (open: boolean) => void;
  busy: 'duplicating' | 'deleting' | null;
  setBusy: (value: 'duplicating' | 'deleting' | null) => void;
}

type SaveTone = 'saved' | 'pending' | 'saving' | 'error';

export function Topbar({
  slug,
  currentWorkspace,
  workspaces,
  leftPanelOpen,
  setLeftPanelOpen,
  rightPanelOpen,
  setRightPanelOpen,
  busy,
  setBusy,
}: TopbarProps) {
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

  useEffect(() => {
    if (!canEdit) return;
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        setLeftPanelOpen(!leftPanelOpen);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === '\\') {
        e.preventDefault();
        setRightPanelOpen(!rightPanelOpen);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [canEdit, leftPanelOpen, setLeftPanelOpen, rightPanelOpen, setRightPanelOpen]);

  const onUndo = () => { store.flushHistoryCooldown(); undo(); };
  const onRedo = () => { store.flushHistoryCooldown(); redo(); };
  const onReset = () => {
    store.flushHistoryCooldown();
    store.getState().resetToSaved();
  };

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(name);

  const tone: SaveTone =
    saving === 'saving' ? 'saving'
    : saving === 'pending' ? 'pending'
    : saving === 'error' ? 'error'
    : 'saved';
  const label =
    saving === 'saving' ? 'Saving…'
    : saving === 'pending' ? 'Pending…'
    : saving === 'error' ? 'Save failed'
    : 'Saved';

  async function commitName() {
    setEditing(false);
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === name) { setDraftName(name); return; }
    store.getState().setName(trimmed);
  }

  return (
    <div className="flex h-[52px] items-center gap-3 border-b border-ed-rule bg-ed-panel-2 px-4 text-sm">
      <Link
        href={`/w/${slug}`}
        aria-label="Back to projects"
        className="inline-flex items-center gap-2 text-ed-ink transition-colors hover:opacity-80"
      >
        <BrandMark size={22} className="text-ed-ink" />
      </Link>
      <Link
        href={`/w/${slug}`}
        className="inline-flex items-center gap-1 text-ed-ink-3 transition-colors hover:text-ed-ink"
      >
        <ArrowLeft size={12} /> Projects
      </Link>
      <span className="text-ed-rule-strong">/</span>
      <WorkspaceSwitcher current={currentWorkspace} workspaces={workspaces} />
      <span className="text-ed-rule-strong">/</span>

      {editing && canEdit ? (
        <input
          autoFocus
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitName();
            if (e.key === 'Escape') { setDraftName(name); setEditing(false); }
          }}
          className="rounded-md border border-ed-rule-strong bg-ed-panel px-2 py-1 font-serif text-[18px] font-normal text-ed-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-ed-brand-soft"
        />
      ) : canEdit ? (
        <button
          type="button"
          onClick={() => { setDraftName(name); setEditing(true); }}
          className="font-serif text-[18px] font-normal text-ed-ink decoration-brand decoration-[1.5px] underline-offset-4 hover:underline"
        >
          {name}
        </button>
      ) : (
        <span className="font-serif text-[18px] font-normal text-ed-ink">{name}</span>
      )}

      {canEdit && (
        <ProjectActionsMenu
          projectId={projectId}
          projectName={name}
          slug={slug}
          busy={busy}
          setBusy={setBusy}
        />
      )}

      {canEdit && (
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={saving}
            variants={fade}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            <StatusBadge tone={tone}>{label}</StatusBadge>
          </motion.span>
        </AnimatePresence>
      )}

      {!canEdit && (
        <span className="inline-flex items-center rounded-md border border-ed-rule-strong bg-ed-panel px-2 py-0.5 text-[10px] uppercase tracking-wider text-ed-ink-3">
          View only
        </span>
      )}
      {lastError && <span className="font-mono text-[11px] text-ed-danger">{lastError}</span>}

      <div className="ml-auto flex items-center gap-1">
        {canEdit && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setLeftPanelOpen(!leftPanelOpen)}
                aria-label={leftPanelOpen ? 'Hide inspector' : 'Show inspector'}
                className={cn(
                  'inline-flex h-8 w-8 items-center justify-center rounded-md text-ed-ink-2 transition-colors hover:bg-ed-panel-3 hover:text-ed-ink',
                  leftPanelOpen && 'bg-ed-brand-soft text-brand hover:bg-ed-brand-soft',
                )}
              >
                {leftPanelOpen ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
              </button>
            </TooltipTrigger>
            <TooltipContent>{leftPanelOpen ? 'Hide inspector' : 'Show inspector'} (Ctrl/Cmd+\)</TooltipContent>
          </Tooltip>
        )}

        {canEdit && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setRightPanelOpen(!rightPanelOpen)}
                aria-label={rightPanelOpen ? 'Hide insert panel' : 'Show insert panel'}
                className={cn(
                  'inline-flex h-8 w-8 items-center justify-center rounded-md text-ed-ink-2 transition-colors hover:bg-ed-panel-3 hover:text-ed-ink',
                  rightPanelOpen && 'bg-ed-brand-soft text-brand hover:bg-ed-brand-soft',
                )}
              >
                {rightPanelOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
              </button>
            </TooltipTrigger>
            <TooltipContent>{rightPanelOpen ? 'Hide insert panel' : 'Show insert panel'} (Ctrl/Cmd+Shift+\)</TooltipContent>
          </Tooltip>
        )}

        <span className="mx-1 h-5 w-px bg-ed-rule" />

        {canEdit && <ModeToggle />}

        {canEdit && (
          <>
            <IconBtn onClick={onUndo} disabled={!canUndo} tooltip="Undo (Ctrl/Cmd+Z)" label="Undo">
              <Undo2 size={14} />
            </IconBtn>
            <IconBtn onClick={onRedo} disabled={!canRedo} tooltip="Redo (Ctrl/Cmd+Shift+Z)" label="Redo">
              <Redo2 size={14} />
            </IconBtn>
            <IconBtn onClick={onReset} disabled={!isDirty} tooltip="Discard unsaved changes and revert to last saved version" label="Reset to last saved">
              <RotateCcw size={14} />
            </IconBtn>
            <TranslateMenu projectId={projectId} projectName={name} slug={slug} />
          </>
        )}
        <DownloadMenu projectId={projectId} slug={slug} />
      </div>
    </div>
  );
}

function IconBtn({
  onClick, disabled, tooltip, label, children,
}: {
  onClick: () => void;
  disabled?: boolean;
  tooltip: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ed-ink-2 transition-colors hover:bg-ed-panel-3 hover:text-ed-ink disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function ModeToggle() {
  const { mode, setMode } = useEditorMode();
  return (
    <div className="inline-flex items-center overflow-hidden rounded-md border border-ed-rule-strong">
      <button
        type="button"
        aria-pressed={mode === 'edit'}
        onClick={() => setMode('edit')}
        className={`px-2.5 py-1 text-xs transition-colors ${mode === 'edit' ? 'bg-brand text-white' : 'text-ed-ink-2 hover:bg-ed-panel-3 hover:text-ed-ink'}`}
      >
        Edit
      </button>
      <button
        type="button"
        aria-pressed={mode === 'preview'}
        onClick={() => setMode('preview')}
        className={`px-2.5 py-1 text-xs transition-colors ${mode === 'preview' ? 'bg-brand text-white' : 'text-ed-ink-2 hover:bg-ed-panel-3 hover:text-ed-ink'}`}
      >
        Preview
      </button>
    </div>
  );
}
