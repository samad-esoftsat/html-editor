'use client';
import { useEffect } from 'react';
import { useEditor, useEditorStore } from '@/lib/editor/StoreProvider';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDragSensors } from './canvas/useDragSensors';
import { SectionInsertBar } from './canvas/SectionInsertBar';
import { useSectionSelection } from './SectionSelectionProvider';
import { SelectionActionBar } from './canvas/SelectionActionBar';
import { HeaderBlockView } from './blocks/HeaderBlockView';
import { ProductSectionView } from './blocks/ProductSectionView';
import { HeroBlockView } from './blocks/HeroBlockView';
import { ArticleView } from './blocks/ArticleView';
import { CTABannerView } from './blocks/CTABannerView';
import { FooterBlockView } from './blocks/FooterBlockView';
import { findHeader, findFooter } from '@/lib/editor/blocks';

export function PreviewBody() {
  const data = useEditor((s) => s.data);
  const store = useEditorStore();
  const sensors = useDragSensors();
  const reorderBlocks = store.getState().reorderBlocks;
  const selection = useSectionSelection();

  // Middle slice = everything between header and footer; heterogeneous drag operates on this.
  const middleBlocks = data.blocks.slice(1, -1);

  function onCanvasMouseDown(e: React.MouseEvent) {
    if (e.target === e.currentTarget) selection.clear();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && selection.selected.size > 0) selection.clear();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selection]);

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = middleBlocks.findIndex((b) => b.id === active.id);
    const newIndex = middleBlocks.findIndex((b) => b.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(middleBlocks, oldIndex, newIndex);
    const header = findHeader(data.blocks);
    const footer = findFooter(data.blocks);
    reorderBlocks([header, ...reordered, footer]);
  }

  return (
    <div
      className="preview-canvas"
      onMouseDown={onCanvasMouseDown}
      style={{ background: data.global.backgroundColor, padding: 0, minHeight: '100%', fontFamily: data.global.fontFamily }}
    >
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={middleBlocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          {data.blocks.map((block) => {
            switch (block.type) {
              case 'header':
                return <HeaderBlockView key={block.id} block={block} global={data.global} />;
              case 'product-section': {
                const idx = middleBlocks.findIndex((b) => b.id === block.id);
                return (
                  <ProductSectionView
                    key={block.id}
                    block={block}
                    global={data.global}
                    index={idx}
                    total={middleBlocks.length}
                  />
                );
              }
              case 'hero': {
                const idx = middleBlocks.findIndex((b) => b.id === block.id);
                return (
                  <HeroBlockView
                    key={block.id}
                    block={block}
                    global={data.global}
                    index={idx}
                    total={middleBlocks.length}
                  />
                );
              }
              case 'article': {
                const idx = middleBlocks.findIndex((b) => b.id === block.id);
                return (
                  <ArticleView
                    key={block.id}
                    block={block}
                    global={data.global}
                    index={idx}
                    total={middleBlocks.length}
                  />
                );
              }
              case 'cta-banner': {
                const idx = middleBlocks.findIndex((b) => b.id === block.id);
                return (
                  <CTABannerView
                    key={block.id}
                    block={block}
                    global={data.global}
                    index={idx}
                    total={middleBlocks.length}
                  />
                );
              }
              case 'footer':
                return <FooterBlockView key={block.id} block={block} global={data.global} />;
            }
          })}
          {middleBlocks.length === 0 && <SectionInsertBar atIndex={0} />}
          {middleBlocks.length > 0 && <SectionInsertBar atIndex={middleBlocks.length} />}
        </SortableContext>
      </DndContext>
      <SelectionActionBar />
    </div>
  );
}
