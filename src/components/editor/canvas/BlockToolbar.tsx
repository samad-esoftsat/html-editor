'use client';
import { Copy, GripVertical, X } from 'lucide-react';
import { useEditorStore } from '@/lib/editor/StoreProvider';
import { confirmDialog } from '@/lib/utils/confirm';
import { useEditorMode } from '../EditorModeProvider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface BlockToolbarProps {
  blockId: string;
  blockLabel: string;
  dragAttributes: Record<string, unknown>;
  dragListeners: Record<string, unknown> | undefined;
}

export function BlockToolbar({ blockId, blockLabel, dragAttributes, dragListeners }: BlockToolbarProps) {
  const { mode } = useEditorMode();
  const store = useEditorStore();
  if (mode === 'preview') return null;

  async function onDelete() {
    const ok = await confirmDialog({
      title: 'Delete block?',
      message: `This will remove "${blockLabel || 'Untitled'}" from the email.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    store.getState().removeBlock(blockId);
  }

  return (
    <div className="block-toolbar absolute top-2 right-2 z-10 inline-flex items-center gap-1 rounded-full border border-ed-rule-strong bg-ed-panel-2 p-1 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Drag to reorder block"
            className="inline-flex h-7 w-7 cursor-grab items-center justify-center rounded-md text-ed-ink-2 transition-colors hover:bg-ed-panel-3 hover:text-ed-ink active:cursor-grabbing"
            {...dragAttributes}
            {...(dragListeners ?? {})}
          >
            <GripVertical size={14} />
          </button>
        </TooltipTrigger>
        <TooltipContent>Drag to reorder block</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Duplicate block"
            onClick={() => store.getState().duplicateBlock(blockId)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ed-ink-2 transition-colors hover:bg-ed-panel-3 hover:text-ed-ink"
          >
            <Copy size={14} />
          </button>
        </TooltipTrigger>
        <TooltipContent>Duplicate block</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Delete block"
            onClick={onDelete}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ed-ink-2 transition-colors hover:bg-ed-panel-3 hover:text-ed-danger"
          >
            <X size={14} />
          </button>
        </TooltipTrigger>
        <TooltipContent>Delete block</TooltipContent>
      </Tooltip>
    </div>
  );
}
