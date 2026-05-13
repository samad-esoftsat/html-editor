'use client';
import { AnimatePresence, motion } from 'motion/react';
import { GlobalStylesPanel } from './panels/GlobalStylesPanel';
import { HeaderPanel } from './panels/HeaderPanel';
import { FooterPanel } from './panels/FooterPanel';
import { ProductSectionPanel } from './panels/ProductSectionPanel';
import { useEditor, useEditorStore } from '@/lib/editor/StoreProvider';
import { useCanEdit } from '@/lib/editor/RoleProvider';
import { Button } from '@/components/ui/Button';
import { fadeUp } from '@/lib/motion';

export function LeftPanel() {
  const sections = useEditor((s) => s.data.sections);
  const store = useEditorStore();
  const canEdit = useCanEdit();

  return (
    <aside className="w-[320px] shrink-0 border-r border-border bg-panel overflow-y-auto p-3 space-y-2">
      <GlobalStylesPanel />
      <HeaderPanel />
      <div className="text-[10px] uppercase tracking-widest text-muted-2 px-1 pt-3 pb-1">Products</div>
      <AnimatePresence initial={false}>
        {sections.map((s, idx) => (
          <motion.div
            key={s.id}
            layout
            variants={fadeUp}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            <ProductSectionPanel section={s} index={idx} total={sections.length} />
          </motion.div>
        ))}
      </AnimatePresence>
      {canEdit && (
        <Button variant="secondary" className="w-full" onClick={() => store.getState().addSection()}>
          + Add Product Section
        </Button>
      )}
      <FooterPanel />
    </aside>
  );
}
