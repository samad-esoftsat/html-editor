'use client';
import { useState } from 'react';
import { ChevronDown, ChevronRight, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { useEditorStore } from '@/lib/editor/StoreProvider';
import { useCanEdit } from '@/lib/editor/RoleProvider';
import type { HeroBlock } from '@/lib/editor/types';
import { Input } from '@/components/ui/Input';
import { NumberInput } from '@/components/ui/NumberInput';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { Field } from '@/components/ui/Field';
import { ImageInput } from '../ImageInput';
import { confirmDialog } from '@/lib/utils/confirm';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils/cn';

interface Props { block: HeroBlock; index: number; total: number; }

export function HeroPanel({ block, index, total }: Props) {
  const [open, setOpen] = useState(false);
  const [overrides, setOverrides] = useState(false);
  const store = useEditorStore();
  const canEdit = useCanEdit();
  const set = (patch: Partial<Omit<HeroBlock, 'type' | 'id'>>) =>
    store.getState().updateBlock(block.id, patch);

  return (
    <div className={cn(
      'rounded-md border bg-ed-panel-2 overflow-hidden shadow-[inset_0_1px_0_rgba(237,231,220,0.04)]',
      open ? 'border-brand/40' : 'border-ed-rule',
    )}>
      <div className="flex items-center justify-between px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center gap-2 text-left text-[12px] font-semibold uppercase tracking-[0.14em] text-ed-ink-2 transition-colors hover:text-ed-ink"
        >
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <span className="truncate">Hero · {block.title || '(untitled)'}</span>
        </button>
        {canEdit && (
          <div className="flex items-center gap-1 text-ed-ink-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <button aria-label="Move block up" disabled={index === 0} onClick={() => store.getState().moveBlock(block.id, 'up')} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ed-ink-3 transition-colors hover:bg-ed-panel-3 hover:text-ed-ink disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ed-ink-3"><ArrowUp size={12} /></button>
              </TooltipTrigger>
              <TooltipContent>Move block up</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button aria-label="Move block down" disabled={index === total - 1} onClick={() => store.getState().moveBlock(block.id, 'down')} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ed-ink-3 transition-colors hover:bg-ed-panel-3 hover:text-ed-ink disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ed-ink-3"><ArrowDown size={12} /></button>
              </TooltipTrigger>
              <TooltipContent>Move block down</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button aria-label="Remove block" onClick={async () => {
                  const ok = await confirmDialog({
                    title: 'Remove block?',
                    message: `"${block.title || 'Hero'}" will be removed.`,
                    confirmLabel: 'Remove',
                    danger: true,
                  });
                  if (ok) store.getState().removeBlock(block.id);
                }} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ed-ink-3 transition-colors hover:bg-ed-panel-3 hover:text-ed-danger"><Trash2 size={12} /></button>
              </TooltipTrigger>
              <TooltipContent>Remove block</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
      {open && (
        <div className="border-t border-ed-rule">
          <fieldset disabled={!canEdit} className="space-y-3 p-3 min-w-0 disabled:opacity-70">
            <Field label="Image"><ImageInput value={block.imageSrc} onChange={(v) => set({ imageSrc: v })} /></Field>
            <Field label="Image alt"><Input value={block.imageAlt} onChange={(e) => set({ imageAlt: e.target.value })} /></Field>
            <Field label="Title"><Input value={block.title} onChange={(e) => set({ title: e.target.value })} /></Field>
            <Field label="Subtitle"><Input value={block.subtitle} onChange={(e) => set({ subtitle: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="CTA text"><Input value={block.ctaText} onChange={(e) => set({ ctaText: e.target.value })} /></Field>
              <Field label="CTA URL (override)"><Input value={block.ctaUrl ?? ''} onChange={(e) => set({ ctaUrl: e.target.value || undefined })} /></Field>
            </div>
          </fieldset>
          <div className="px-3 pb-3">
            <button type="button" onClick={() => setOverrides(o => !o)} className="text-xs text-ed-ink-4 hover:text-ed-ink w-full text-left pt-1 border-t border-ed-rule">
              Hero style overrides {overrides ? 'v' : '>'}
            </button>
            {overrides && (
              <fieldset disabled={!canEdit} className="grid grid-cols-2 gap-2 pt-1 min-w-0 disabled:opacity-70">
                <Field label="Title size px"><NumberInput value={block.titleFontSize ?? 0} onChange={(v) => set({ titleFontSize: v || undefined })} min={0} max={72} /></Field>
                <Field label="Subtitle size px"><NumberInput value={block.subtitleFontSize ?? 0} onChange={(v) => set({ subtitleFontSize: v || undefined })} min={0} max={32} /></Field>
                <Field label="Background"><ColorPicker value={block.backgroundColor ?? ''} onChange={(v) => set({ backgroundColor: v || undefined })} /></Field>
                <Field label="Text color"><ColorPicker value={block.textColor ?? ''} onChange={(v) => set({ textColor: v || undefined })} /></Field>
                <Field label="Button color"><ColorPicker value={block.buttonColor ?? ''} onChange={(v) => set({ buttonColor: v || undefined })} /></Field>
              </fieldset>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
