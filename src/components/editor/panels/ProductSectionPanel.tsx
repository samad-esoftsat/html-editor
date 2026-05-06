'use client';
import { useState } from 'react';
import { ChevronDown, ChevronRight, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { useEditorStore } from '@/lib/editor/StoreProvider';
import type { ProductSection } from '@/lib/editor/types';
import { Input } from '@/components/ui/Input';
import { NumberInput } from '@/components/ui/NumberInput';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { Field } from '@/components/ui/Field';
import { ImageInput } from '../ImageInput';
import { BulletList } from '../BulletList';

interface Props { section: ProductSection; index: number; total: number; }

export function ProductSectionPanel({ section, index, total }: Props) {
  const [open, setOpen] = useState(false);
  const [overrides, setOverrides] = useState(false);
  const store = useEditorStore();
  const set = (patch: Partial<ProductSection>) => store.getState().setSection(section.id, patch);

  return (
    <div className={`rounded-md border bg-panel-2 overflow-hidden ${open ? 'border-brand/30' : 'border-border'}`}>
      <div className="flex items-center justify-between px-3 py-2">
        <button onClick={() => setOpen(o => !o)} className="text-sm font-medium text-fg flex items-center gap-2 flex-1 text-left">
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <span className="truncate">{section.title || '(untitled)'}</span>
        </button>
        <div className="flex items-center gap-1 text-muted-2">
          <button disabled={index === 0} onClick={() => store.getState().moveSection(section.id, 'up')} className="disabled:opacity-30 hover:text-fg"><ArrowUp size={12} /></button>
          <button disabled={index === total - 1} onClick={() => store.getState().moveSection(section.id, 'down')} className="disabled:opacity-30 hover:text-fg"><ArrowDown size={12} /></button>
          <button onClick={() => { if (confirm(`Remove "${section.title}"?`)) store.getState().removeSection(section.id); }} className="hover:text-danger"><Trash2 size={12} /></button>
        </div>
      </div>
      {open && (
        <div className="space-y-3 p-3 border-t border-border">
          <Field label="Title"><Input value={section.title} onChange={(e) => set({ title: e.target.value })} /></Field>
          <Field label="Image"><ImageInput value={section.imageSrc} onChange={(v) => set({ imageSrc: v })} /></Field>
          <Field label="Image alt"><Input value={section.imageAlt} onChange={(e) => set({ imageAlt: e.target.value })} /></Field>
          <Field label="Bullets"><BulletList bullets={section.bullets} onChange={(next) => set({ bullets: next })} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Button text"><Input value={section.ctaText} onChange={(e) => set({ ctaText: e.target.value })} /></Field>
            <Field label="Button URL (override)"><Input value={section.ctaUrl ?? ''} onChange={(e) => set({ ctaUrl: e.target.value || undefined })} /></Field>
          </div>

          <button onClick={() => setOverrides(o => !o)} className="text-xs text-muted-2 hover:text-fg w-full text-left pt-1 border-t border-border">
            Section style overrides {overrides ? '▾' : '▸'}
          </button>
          {overrides && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Field label="Title size px"><NumberInput value={section.titleFontSize ?? 0} onChange={(v) => set({ titleFontSize: v || undefined })} min={0} max={60} /></Field>
              <Field label="Bullet size px"><NumberInput value={section.bulletFontSize ?? 0} onChange={(v) => set({ bulletFontSize: v || undefined })} min={0} max={32} /></Field>
              <Field label="Text color"><ColorPicker value={section.textColor ?? ''} onChange={(v) => set({ textColor: v || undefined })} /></Field>
              <Field label="Button color"><ColorPicker value={section.buttonColor ?? ''} onChange={(v) => set({ buttonColor: v || undefined })} /></Field>
              <div className="col-span-2"><Field label="Section background"><ColorPicker value={section.backgroundColor ?? ''} onChange={(v) => set({ backgroundColor: v || undefined })} /></Field></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
