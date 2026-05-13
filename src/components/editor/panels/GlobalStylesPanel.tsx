'use client';
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useEditor, useEditorStore } from '@/lib/editor/StoreProvider';
import { useCanEdit } from '@/lib/editor/RoleProvider';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { NumberInput } from '@/components/ui/NumberInput';
import { Select } from '@/components/ui/Select';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { BrandKitPicker } from '@/components/brand-kit/BrandKitPicker';
import { Button } from '@/components/ui/Button';
import type { Footer, GlobalStyles } from '@/lib/editor/types';
import type { BrandKitSnapshot } from '@/lib/editor/store';

const FONT_FAMILIES = [
  'Arial, Helvetica Neue, Helvetica, sans-serif',
  'Georgia, "Times New Roman", serif',
  'Verdana, Geneva, sans-serif',
  '"Courier New", Courier, monospace',
  '"Trebuchet MS", Helvetica, sans-serif',
  '"Lucida Sans Unicode", "Lucida Grande", sans-serif',
];

type GlobalColorKey =
  | 'backgroundColor'
  | 'textColor'
  | 'buttonColor'
  | 'buttonTextColor'
  | 'accentColor'
  | 'footerBackgroundColor'
  | 'footerTextColor';

const GLOBAL_COLOR_KEYS: GlobalColorKey[] = [
  'backgroundColor',
  'textColor',
  'buttonColor',
  'buttonTextColor',
  'accentColor',
  'footerBackgroundColor',
  'footerTextColor',
];

type GlobalFontNumberKey = 'baseFontSize' | 'headingFontSize';
const GLOBAL_FONT_NUMBER_KEYS: GlobalFontNumberKey[] = ['baseFontSize', 'headingFontSize'];

type FooterStringKey =
  | 'companyName'
  | 'address'
  | 'phone'
  | 'phoneTel'
  | 'email'
  | 'bannerSrc'
  | 'bannerAlt';

const FOOTER_STRING_KEYS: FooterStringKey[] = [
  'companyName',
  'address',
  'phone',
  'phoneTel',
  'email',
  'bannerSrc',
  'bannerAlt',
];

type FooterColorKey = 'backgroundColor' | 'textColor';
const FOOTER_COLOR_KEYS: FooterColorKey[] = ['backgroundColor', 'textColor'];

interface BrandKitRow {
  id: string;
  colors: Record<string, unknown>;
  fonts: Record<string, unknown>;
  logo: Record<string, unknown>;
  footer: Record<string, unknown>;
}

function pickStrings<K extends string>(src: Record<string, unknown>, keys: readonly K[]): Partial<Record<K, string>> {
  const out: Partial<Record<K, string>> = {};
  for (const key of keys) {
    const value = src[key];
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}

function pickNumbers<K extends string>(src: Record<string, unknown>, keys: readonly K[]): Partial<Record<K, number>> {
  const out: Partial<Record<K, number>> = {};
  for (const key of keys) {
    const value = src[key];
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
  }
  return out;
}

function mapKitToSnapshot(kit: BrandKitRow): BrandKitSnapshot {
  const colors = pickStrings(kit.colors ?? {}, GLOBAL_COLOR_KEYS);
  const fontFamily = pickStrings(kit.fonts ?? {}, ['fontFamily'] as const);
  const fontSizes = pickNumbers(kit.fonts ?? {}, GLOBAL_FONT_NUMBER_KEYS);
  const global: Partial<GlobalStyles> = { ...colors, ...fontFamily, ...fontSizes };

  const footer: Partial<Footer> = {
    ...pickStrings(kit.footer ?? {}, FOOTER_STRING_KEYS),
    ...pickStrings(kit.footer ?? {}, FOOTER_COLOR_KEYS),
    ...pickStrings(kit.logo ?? {}, ['bannerSrc', 'bannerAlt'] as const),
  };

  return {
    global: Object.keys(global).length > 0 ? global : undefined,
    footer: Object.keys(footer).length > 0 ? footer : undefined,
  };
}

export function GlobalStylesPanel() {
  const [open, setOpen] = useState(true);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const g = useEditor((s) => s.data.global);
  const brandKitId = useEditor((s) => s.brandKitId);
  const workspaceSlug = useEditor((s) => s.workspaceSlug);
  const store = useEditorStore();
  const setGlobal = store.getState().setGlobal;
  const canEdit = useCanEdit();

  const onApply = async () => {
    if (!brandKitId) return;
    setApplying(true);
    setApplyError(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceSlug}/brand-kits`);
      if (!res.ok) throw new Error(`http ${res.status}`);
      const json = (await res.json()) as { brand_kits?: BrandKitRow[] };
      const kit = json.brand_kits?.find((k) => k.id === brandKitId);
      if (!kit) throw new Error('kit not found');
      store.getState().applyBrandKit(mapKitToSnapshot(kit));
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : 'Failed to apply');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="rounded-md bg-panel-2 border border-border overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-fg">
        <span>Global Styles</span>
        {open ? <ChevronDown size={14} className="text-muted-2" /> : <ChevronRight size={14} className="text-muted-2" />}
      </button>
      {open && (
        <fieldset disabled={!canEdit} className="grid grid-cols-2 gap-3 p-3 border-t border-border min-w-0 disabled:opacity-70">
          <div className="col-span-2 space-y-2">
            <Field label="Brand kit">
              <BrandKitPicker
                slug={workspaceSlug}
                value={brandKitId}
                onChange={(id) => store.getState().setProjectBrandKit(id)}
              />
            </Field>
            {canEdit && (
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={onApply}
                  disabled={!brandKitId || applying}
                >
                  {applying ? 'Applying…' : 'Apply to project'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => store.getState().setProjectBrandKit(null)}
                  disabled={!brandKitId}
                >
                  Detach
                </Button>
              </div>
            )}
            {applyError && <div className="text-xs text-red-400">{applyError}</div>}
          </div>
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
        </fieldset>
      )}
    </div>
  );
}
