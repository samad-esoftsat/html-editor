'use client';
import { Copy, GripVertical, X } from 'lucide-react';
import { useEditorStore } from '@/lib/editor/StoreProvider';
import { confirmDialog } from '@/lib/utils/confirm';
import { useEditorMode } from '../EditorModeProvider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface SectionToolbarProps {
  sectionId: string;
  sectionTitle: string;
  dragAttributes: Record<string, unknown>;
  dragListeners: Record<string, unknown> | undefined;
}

export function SectionToolbar({ sectionId, sectionTitle, dragAttributes, dragListeners }: SectionToolbarProps) {
  const { mode } = useEditorMode();
  const store = useEditorStore();
  if (mode === 'preview') return null;

  async function onDelete() {
    const ok = await confirmDialog({
      title: 'Delete section?',
      message: `This will remove the section "${sectionTitle || 'Untitled'}" from the email.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    store.getState().removeSection(sectionId);
  }

  return (
    <div className="section-toolbar absolute top-2 right-2 z-10 inline-flex items-center gap-1 rounded-full border border-ed-rule-strong bg-ed-panel-2 p-1 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Drag to reorder section"
            className="inline-flex h-7 w-7 cursor-grab items-center justify-center rounded-md text-ed-ink-2 transition-colors hover:bg-ed-panel-3 hover:text-ed-ink active:cursor-grabbing"
            {...dragAttributes}
            {...(dragListeners ?? {})}
          >
            <GripVertical size={14} />
          </button>
        </TooltipTrigger>
        <TooltipContent>Drag to reorder section</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Duplicate section"
            onClick={() => store.getState().duplicateSection(sectionId)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ed-ink-2 transition-colors hover:bg-ed-panel-3 hover:text-ed-ink"
          >
            <Copy size={14} />
          </button>
        </TooltipTrigger>
        <TooltipContent>Duplicate section</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Delete section"
            onClick={onDelete}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ed-ink-2 transition-colors hover:bg-ed-panel-3 hover:text-ed-danger"
          >
            <X size={14} />
          </button>
        </TooltipTrigger>
        <TooltipContent>Delete section</TooltipContent>
      </Tooltip>
    </div>
  );
}
