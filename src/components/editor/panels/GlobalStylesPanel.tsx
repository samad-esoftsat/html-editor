'use client';
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useEditor, useEditorStore } from '@/lib/editor/StoreProvider';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { NumberInput } from '@/components/ui/NumberInput';
import { Select } from '@/components/ui/Select';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';

const FONT_FAMILIES = [
  'Arial, Helvetica Neue, Helvetica, sans-serif',
  'Georgia, "Times New Roman", serif',
  'Verdana, Geneva, sans-serif',
  '"Courier New", Courier, monospace',
  '"Trebuchet MS", Helvetica, sans-serif',
  '"Lucida Sans Unicode", "Lucida Grande", sans-serif',
];

export function GlobalStylesPanel() {
  const [open, setOpen] = useState(true);
  const g = useEditor((s) => s.data.global);
  const setGlobal = useEditorStore().getState().setGlobal;

  return (
    <div className="rounded-md bg-panel-2 border border-border overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-fg">
        <span>🎨 Global Styles</span>
        {open ? <ChevronDown size={14} className="text-muted-2" /> : <ChevronRight size={14} className="text-muted-2" />}
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-3 p-3 border-t border-border">
          <Field label="Background"><ColorPicker value={g.backgroundColor} onChange={(v) => setGlobal({ backgroundColor: v })} /></Field>
          <Field label="Text color"><ColorPicker value={g.textColor} onChange={(v) => setGlobal({ textColor: v })} /></Field>
          <Field label="Button color"><ColorPicker value={g.buttonColor} onChange={(v) => setGlobal({ buttonColor: v })} /></Field>
          <Field label="Button text"><ColorPicker value={g.buttonTextColor} onChange={(v) => setGlobal({ buttonTextColor: v })} /></Field>
          <Field label="Accent / link"><ColorPicker value={g.accentColor} onChange={(v) => setGlobal({ accentColor: v })} /></Field>
          <Field label="Footer bg"><ColorPicker value={g.footerBackgroundColor} onChange={(v) => setGlobal({ footerBackgroundColor: v })} /></Field>
          <Field label="Footer text"><ColorPicker value={g.footerTextColor} onChange={(v) => setGlobal({ footerTextColor: v })} /></Field>
          <Field label="Heading size px"><NumberInput value={g.headingFontSize} onChange={(v) => setGlobal({ headingFontSize: v })} min={10} max={64} /></Field>
          <Field label="Body size px"><NumberInput value={g.baseFontSize} onChange={(v) => setGlobal({ baseFontSize: v })} min={10} max={32} /></Field>
          <div className="col-span-2">
            <Field label="Font family">
              <Select value={g.fontFamily} onChange={(e) => setGlobal({ fontFamily: e.target.value })}>
                {FONT_FAMILIES.map(f => <option key={f} value={f}>{f.split(',')[0].replace(/['"]/g, '')}</option>)}
              </Select>
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Default Contact URL">
              <Input value={g.contactUrl} onChange={(e) => setGlobal({ contactUrl: e.target.value })} />
            </Field>
          </div>
        </div>
      )}
    </div>
  );
}
