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
    <div className="section-toolbar absolute top-2 right-2 z-10 inline-flex items-center gap-1 rounded-md border border-border-strong bg-panel-2 p-1 shadow-sm">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Drag to reorder section"
            className="cursor-grab rounded p-1 text-muted hover:text-brand hover:bg-panel active:cursor-grabbing"
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
            className="rounded p-1 text-muted hover:text-brand hover:bg-panel"
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
            className="rounded p-1 text-muted hover:text-danger hover:bg-panel"
          >
            <X size={14} />
          </button>
        </TooltipTrigger>
        <TooltipContent>Delete section</TooltipContent>
      </Tooltip>
    </div>
  );
}
