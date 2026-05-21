'use client';
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useEditorStore } from '@/lib/editor/StoreProvider';
import { useCanEdit } from '@/lib/editor/RoleProvider';
import type { HeaderBlock } from '@/lib/editor/types';
import { Input } from '@/components/ui/Input';
import { NumberInput } from '@/components/ui/NumberInput';
import { Field } from '@/components/ui/Field';
import { ImageInput } from '../ImageInput';

interface Props { block: HeaderBlock; }

export function HeaderPanel({ block }: Props) {
  const [open, setOpen] = useState(false);
  const setHeader = useEditorStore().getState().setHeader;
  const canEdit = useCanEdit();

  return (
    <div className="rounded-md border border-ed-rule bg-ed-panel-2 shadow-[inset_0_1px_0_rgba(237,231,220,0.04)] overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)} className="flex w-full items-center justify-between px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-ed-ink-2 transition-colors hover:text-ed-ink">
        <span>Header</span>
        {open ? <ChevronDown size={12} className="text-ed-ink-3" /> : <ChevronRight size={12} className="text-ed-ink-3" />}
      </button>
      {open && (
        <fieldset disabled={!canEdit} className="space-y-3 p-3 border-t border-ed-rule min-w-0 disabled:opacity-70">
          <Field label="Logo image"><ImageInput value={block.logoSrc} onChange={(v) => setHeader({ logoSrc: v })} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Logo alt"><Input value={block.logoAlt} onChange={(e) => setHeader({ logoAlt: e.target.value })} /></Field>
            <Field label="Logo width px"><NumberInput value={block.logoWidth} onChange={(v) => setHeader({ logoWidth: v })} min={100} max={710} /></Field>
          </div>
          <Field label="Header title"><Input value={block.title} onChange={(e) => setHeader({ title: e.target.value })} /></Field>
          <Field label="Header title size px"><NumberInput value={block.titleFontSize} onChange={(v) => setHeader({ titleFontSize: v })} min={10} max={36} /></Field>
          <Field label="Banner image"><ImageInput value={block.bannerSrc} onChange={(v) => setHeader({ bannerSrc: v })} /></Field>
          <Field label="Banner alt"><Input value={block.bannerAlt} onChange={(e) => setHeader({ bannerAlt: e.target.value })} /></Field>
          <Field label="Section heading"><Input value={block.sectionHeading} onChange={(e) => setHeader({ sectionHeading: e.target.value })} /></Field>
          <Field label="Section heading size px"><NumberInput value={block.sectionHeadingFontSize} onChange={(v) => setHeader({ sectionHeadingFontSize: v })} min={12} max={48} /></Field>
        </fieldset>
      )}
    </div>
  );
}
