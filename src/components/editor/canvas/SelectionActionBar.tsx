'use client';
import { ArrowDown, ArrowUp, Copy, X } from 'lucide-react';
import { useEditorStore } from '@/lib/editor/StoreProvider';
import { confirmDialog } from '@/lib/utils/confirm';
import { useEditorMode } from '../EditorModeProvider';
import { useSectionSelection } from '../SectionSelectionProvider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function SelectionActionBar() {
  const { mode } = useEditorMode();
  const { selected, clear } = useSectionSelection();
  const store = useEditorStore();
  if (mode === 'preview') return null;
  if (selected.size === 0) return null;

  const stateIds = store.getState().data.sections.map((s) => s.id);
  const ordered = stateIds.filter((id) => selected.has(id));

  function onDuplicate() {
    const { duplicateSection } = store.getState();
    for (const id of ordered) duplicateSection(id);
  }

  async function onDelete() {
    const ok = await confirmDialog({
      title: ordered.length === 1 ? 'Delete section?' : `Delete ${ordered.length} sections?`,
      message:
        ordered.length === 1
          ? 'This will remove the section from the email.'
          : `This will remove ${ordered.length} sections from the email.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    const { removeSection } = store.getState();
    for (const id of ordered) removeSection(id);
    clear();
  }

  function onMoveUp() {
    const { moveSection } = store.getState();
    for (const id of ordered) moveSection(id, 'up');
  }

  function onMoveDown() {
    const { moveSection } = store.getState();
    for (const id of ordered.slice().reverse()) moveSection(id, 'down');
  }

  return (
    <div
      data-selection-bar
      className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 inline-flex items-center gap-2 rounded-full border border-border-strong bg-panel-2 px-3 py-1.5 text-xs text-fg shadow-lg"
    >
      <span className="px-2 font-medium">{ordered.length} selected</span>
      <button
        type="button"
        aria-label="Duplicate selected sections"
        onClick={onDuplicate}
        className="inline-flex items-center gap-1 rounded p-1.5 text-muted hover:text-brand hover:bg-panel"
      >
        <Copy size={14} /> Duplicate
      </button>
      <button
        type="button"
        aria-label="Delete selected sections"
        onClick={onDelete}
        className="inline-flex items-center gap-1 rounded p-1.5 text-muted hover:text-danger hover:bg-panel"
      >
        <X size={14} /> Delete
      </button>
      <button
        type="button"
        aria-label="Move selected sections up"
        onClick={onMoveUp}
        className="inline-flex items-center gap-1 rounded p-1.5 text-muted hover:text-brand hover:bg-panel"
      >
        <ArrowUp size={14} /> Up
      </button>
      <button
        type="button"
        aria-label="Move selected sections down"
        onClick={onMoveDown}
        className="inline-flex items-center gap-1 rounded p-1.5 text-muted hover:text-brand hover:bg-panel"
      >
        <ArrowDown size={14} /> Down
      </button>
      <span className="text-border-strong">|</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Clear selection"
            onClick={clear}
            className="rounded p-1.5 text-muted hover:text-fg hover:bg-panel"
          >
            <X size={14} />
          </button>
        </TooltipTrigger>
        <TooltipContent>Clear selection (Esc)</TooltipContent>
      </Tooltip>
    </div>
  );
}
