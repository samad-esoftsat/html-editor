'use client';
import { AnimatePresence, motion } from 'motion/react';
import { GlobalStylesPanel } from './panels/GlobalStylesPanel';
import { HeaderPanel } from './panels/HeaderPanel';
import { FooterPanel } from './panels/FooterPanel';
import { ProductSectionPanel } from './panels/ProductSectionPanel';
import { useEditor, useEditorStore } from '@/lib/editor/StoreProvider';
import { useCanEdit } from '@/lib/editor/RoleProvider';
import { fadeUp } from '@/lib/motion';
import { productSections } from '@/lib/editor/blocks';

export function LeftPanel() {
  const blocks = useEditor((s) => s.data.blocks);
  const store = useEditorStore();
  const canEdit = useCanEdit();
  const sectionCount = productSections(blocks).length;

  let sectionIndex = -1;

  return (
    <aside className="w-[320px] shrink-0 overflow-y-auto border-r border-ed-rule bg-ed-panel p-3 space-y-2">
      <GlobalStylesPanel />
      <AnimatePresence initial={false}>
        {blocks.map((block) => {
          if (block.type === 'product-section') sectionIndex++;
          const idx = sectionIndex;
          return (
            <motion.div
              key={block.id}
              layout
              variants={fadeUp}
              initial="hidden"
              animate="show"
              exit="exit"
            >
              {block.type === 'header' && <HeaderPanel block={block} />}
              {block.type === 'product-section' && (
                <ProductSectionPanel block={block} index={idx} total={sectionCount} />
              )}
              {block.type === 'footer' && <FooterPanel block={block} />}
              {block.type === 'header' && (
                <div className="px-1 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-ed-ink-3">
                  Products{' '}
                  <span className="font-mono text-ed-ink-3">· {sectionCount}</span>
                </div>
              )}
            </motion.div>
          );
        })}
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
    </aside>
  );
}
