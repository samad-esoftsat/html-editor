'use client';
import { GlobalStylesPanel } from './panels/GlobalStylesPanel';
import { HeaderPanel } from './panels/HeaderPanel';
import { FooterPanel } from './panels/FooterPanel';
import { ProductSectionPanel } from './panels/ProductSectionPanel';
import { useEditor, useEditorStore } from '@/lib/editor/StoreProvider';
import { Button } from '@/components/ui/Button';

export function LeftPanel() {
  const sections = useEditor((s) => s.data.sections);
  const store = useEditorStore();

  return (
    <aside className="w-[320px] shrink-0 border-r border-border bg-panel overflow-y-auto p-3 space-y-2">
      <GlobalStylesPanel />
      <HeaderPanel />
      <div className="text-[10px] uppercase tracking-widest text-muted-2 px-1 pt-3 pb-1">Products</div>
      {sections.map((s, idx) => (
        <ProductSectionPanel key={s.id} section={s} index={idx} total={sections.length} />
      ))}
      <Button variant="secondary" className="w-full" onClick={() => store.getState().addSection()}>
        + Add Product Section
      </Button>
      <FooterPanel />
    </aside>
  );
}
