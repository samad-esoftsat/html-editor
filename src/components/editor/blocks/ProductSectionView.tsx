'use client';
import { motion } from 'motion/react';
import type { ProductSectionBlock, GlobalStyles } from '@/lib/editor/types';
import { useEditorStore } from '@/lib/editor/StoreProvider';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { BlockToolbar } from '../canvas/BlockToolbar';
import { SectionInsertBar } from '../canvas/SectionInsertBar';
import { useSectionSelection } from '../SectionSelectionProvider';
import { useEditorMode } from '../EditorModeProvider';
import { EditableText } from '../editable/EditableText';
import { EditableBulletList } from '../editable/EditableBulletList';
import { EditableImage } from '../editable/EditableImage';
import { EditableLink } from '../editable/EditableLink';

interface Props {
  block: ProductSectionBlock;
  global: GlobalStyles;
  index: number;
  total: number;
}

export function ProductSectionView({ block, global: g, index, total }: Props) {
  const store = useEditorStore();
  const setSection = store.getState().setSection;
  const { mode } = useEditorMode();
  const selection = useSectionSelection();
  const blockNav = mode === 'edit' ? (e: React.MouseEvent) => e.preventDefault() : undefined;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });

  const reverse = index % 2 === 1;
  const titleSize = block.titleFontSize ?? g.headingFontSize;
  const bulletSize = block.bulletFontSize ?? g.baseFontSize;
  const textColor = block.textColor ?? g.textColor;
  const buttonColor = block.buttonColor ?? g.buttonColor;

  const { toggle, isSelected } = selection;
  const selected = isSelected(block.id);
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    background: block.backgroundColor,
    maxWidth: 710,
    margin: '0 auto',
    position: 'relative',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'stretch',
  };

  function onMouseDown(e: React.MouseEvent) {
    if (!(e.metaKey || e.ctrlKey || e.shiftKey)) return;
    e.preventDefault();
    toggle(block.id, e.shiftKey ? 'range' : 'single');
  }

  const imageWidth = block.imageWidth ?? 355;
  const ImageCol = (
    <div style={{ flex: '0 0 auto', padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <EditableImage
        value={block.imageSrc}
        onChange={(v) => setSection(block.id, { imageSrc: v })}
        alt={block.imageAlt}
        placeholderLabel="Section image - click to add"
        imgStyle={{ display: 'block', height: 'auto' }}
        altLabel={`Section ${index + 1} image alt text`}
        onAltChange={(v) => setSection(block.id, { imageAlt: v })}
        width={imageWidth}
        onWidthChange={(w) => setSection(block.id, { imageWidth: w })}
        aspectRatio={355 / 266}
      />
    </div>
  );
  const TextCol = (
    <div style={{ flex: '1 1 0', minWidth: 0, padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start' }}>
      <h1 style={{ fontSize: titleSize, color: textColor, fontWeight: 700, margin: 0 }}>
        <EditableText
          value={block.title}
          onChange={(v) => setSection(block.id, { title: v })}
          singleLine
          placeholder="Click to add a section title"
          ariaLabel={`Section ${index + 1} title`}
        />
      </h1>
      <EditableBulletList
        bullets={block.bullets}
        onChange={(next) => setSection(block.id, { bullets: next })}
        ariaLabel={`Section ${index + 1} bullets`}
        itemStyle={{ fontSize: bulletSize, color: textColor, lineHeight: '150%' }}
      />
      <a
        href={block.ctaUrl ?? g.contactUrl}
        target="_blank"
        rel="noreferrer"
        onClick={blockNav}
        className="cta-edit-anchor"
        style={{
          display: 'inline-block', position: 'relative', background: buttonColor, color: g.buttonTextColor,
          padding: '10px 30px', borderRadius: 10, fontWeight: 700, fontSize: 16, textDecoration: 'none',
        }}
      >
        <span className="inline-flex items-center">
          <EditableText
            value={block.ctaText}
            onChange={(v) => setSection(block.id, { ctaText: v })}
            singleLine
            placeholder="Click to add CTA text"
            ariaLabel={`Section ${index + 1} CTA text`}
            style={{ color: g.buttonTextColor }}
          />
          <EditableLink
            value={block.ctaUrl ?? ''}
            onChange={(v) => setSection(block.id, { ctaUrl: v })}
            ariaLabel={`Edit section ${index + 1} CTA URL`}
          />
        </span>
      </a>
    </div>
  );

  return (
    <>
      <motion.div key={block.id} layout transition={{ duration: 0.18, ease: 'easeOut' }}>
        <SectionInsertBar atIndex={index} />
        <motion.div
          ref={setNodeRef}
          layout
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: isDragging ? 0.5 : 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          style={style}
          className={`section-wrap ${selected ? 'selected' : ''}`}
          data-selected={selected || undefined}
          onMouseDown={onMouseDown}
        >
          <BlockToolbar
            blockId={block.id}
            blockLabel={block.title ?? ''}
            dragAttributes={attributes as unknown as Record<string, unknown>}
            dragListeners={listeners as unknown as Record<string, unknown> | undefined}
          />
          {reverse ? <>{TextCol}{ImageCol}</> : <>{ImageCol}{TextCol}</>}
        </motion.div>
      </motion.div>
    </>
  );
}
