'use client';
import { AnimatePresence, motion } from 'motion/react';
import { GlobalStylesPanel } from './panels/GlobalStylesPanel';
import { HeaderPanel } from './panels/HeaderPanel';
import { FooterPanel } from './panels/FooterPanel';
import { ProductSectionPanel } from './panels/ProductSectionPanel';
import { HeroPanel } from './panels/HeroPanel';
import { ArticlePanel } from './panels/ArticlePanel';
import { CTABannerPanel } from './panels/CTABannerPanel';
import { AddBlockMenu } from './canvas/AddBlockMenu';
import { useEditor } from '@/lib/editor/StoreProvider';
import { fadeUp } from '@/lib/motion';

export function LeftPanel() {
  const blocks = useEditor((s) => s.data.blocks);
  const middleBlocks = blocks.slice(1, -1);
  const middleTotal = middleBlocks.length;

  return (
    <aside className="w-[320px] shrink-0 overflow-y-auto border-r border-ed-rule bg-ed-panel p-3 space-y-2">
      <GlobalStylesPanel />
      <AnimatePresence initial={false}>
        {blocks.map((block) => {
          const middleIndex = middleBlocks.findIndex((b) => b.id === block.id);
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
                <ProductSectionPanel block={block} index={middleIndex} total={middleTotal} />
              )}
              {block.type === 'hero' && (
                <HeroPanel block={block} index={middleIndex} total={middleTotal} />
              )}
              {block.type === 'article' && (
                <ArticlePanel block={block} index={middleIndex} total={middleTotal} />
              )}
              {block.type === 'cta-banner' && (
                <CTABannerPanel block={block} index={middleIndex} total={middleTotal} />
              )}
              {block.type === 'footer' && <FooterPanel block={block} />}
            </motion.div>
          );
        })}
      </AnimatePresence>
      <AddBlockMenu />
    </aside>
  );
}
