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

  const middleIds = store.getState().data.blocks.slice(1, -1).map((b) => b.id);
  const ordered = middleIds.filter((id) => selected.has(id));

  function onDuplicate() {
    const { duplicateBlock } = store.getState();
    for (const id of ordered) duplicateBlock(id);
  }

  async function onDelete() {
    const ok = await confirmDialog({
      title: ordered.length === 1 ? 'Delete block?' : `Delete ${ordered.length} blocks?`,
      message:
        ordered.length === 1
          ? 'This will remove the block from the email.'
          : `This will remove ${ordered.length} blocks from the email.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    const { removeBlock } = store.getState();
    for (const id of ordered) removeBlock(id);
    clear();
  }

  function onMoveUp() {
    const { moveBlock } = store.getState();
    for (const id of ordered) moveBlock(id, 'up');
  }

  function onMoveDown() {
    const { moveBlock } = store.getState();
    for (const id of ordered.slice().reverse()) moveBlock(id, 'down');
  }

  return (
    <div
      data-selection-bar
      className="fixed bottom-6 left-1/2 z-40 inline-flex -translate-x-1/2 items-center gap-1 rounded-full border border-ed-rule-strong bg-ed-panel-2 px-2 py-1.5 text-xs text-ed-ink shadow-[0_12px_32px_-8px_rgba(0,0,0,0.65)]"
    >
      <span className="px-2 font-medium text-ed-ink">{ordered.length} selected</span>
      <button
        type="button"
        aria-label="Duplicate selected blocks"
        onClick={onDuplicate}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-ed-ink-2 transition-colors hover:bg-ed-panel-3 hover:text-ed-ink"
      >
        <Copy size={14} /> Duplicate
      </button>
      <button
        type="button"
        aria-label="Delete selected blocks"
        onClick={onDelete}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-ed-ink-2 transition-colors hover:bg-ed-panel-3 hover:text-ed-danger"
      >
        <X size={14} /> Delete
      </button>
      <button
        type="button"
        aria-label="Move selected blocks up"
        onClick={onMoveUp}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-ed-ink-2 transition-colors hover:bg-ed-panel-3 hover:text-ed-ink"
      >
        <ArrowUp size={14} /> Up
      </button>
      <button
        type="button"
        aria-label="Move selected blocks down"
        onClick={onMoveDown}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-ed-ink-2 transition-colors hover:bg-ed-panel-3 hover:text-ed-ink"
      >
        <ArrowDown size={14} /> Down
      </button>
      <span className="text-ed-rule-strong">|</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Clear selection"
            onClick={clear}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ed-ink-2 transition-colors hover:bg-ed-panel-3 hover:text-ed-ink"
          >
            <X size={14} />
          </button>
        </TooltipTrigger>
        <TooltipContent>Clear selection (Esc)</TooltipContent>
      </Tooltip>
    </div>
  );
}
