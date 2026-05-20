'use client';
import { AnimatePresence, motion } from 'motion/react';
import { GlobalStylesPanel } from './panels/GlobalStylesPanel';
import { HeaderPanel } from './panels/HeaderPanel';
import { FooterPanel } from './panels/FooterPanel';
import { ProductSectionPanel } from './panels/ProductSectionPanel';
import { useEditor, useEditorStore } from '@/lib/editor/StoreProvider';
import { useCanEdit } from '@/lib/editor/RoleProvider';
import { fadeUp } from '@/lib/motion';

export function LeftPanel() {
  const sections = useEditor((s) => s.data.sections);
  const store = useEditorStore();
  const canEdit = useCanEdit();

  return (
    <aside className="w-[320px] shrink-0 overflow-y-auto border-r border-ed-rule bg-ed-panel p-3 space-y-2">
      <GlobalStylesPanel />
      <HeaderPanel />
      <div className="px-1 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-ed-ink-3">
        Products{' '}
        <span className="font-mono text-ed-ink-3">· {sections.length}</span>
      </div>
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
        <button
          type="button"
          onClick={() => store.getState().addSection()}
          className="block w-full rounded-md border border-dashed border-ed-rule-strong px-3 py-2 text-sm text-ed-ink-2 transition-colors hover:border-brand hover:text-ed-ink"
        >
          + Add Product Section
        </button>
      )}
      <FooterPanel />
    </aside>
  );
}
