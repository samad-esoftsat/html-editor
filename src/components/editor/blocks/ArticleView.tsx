'use client';
import { motion } from 'motion/react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ArticleBlock, GlobalStyles } from '@/lib/editor/types';
import { useEditorStore } from '@/lib/editor/StoreProvider';
import { useEditorMode } from '../EditorModeProvider';
import { useSectionSelection } from '../SectionSelectionProvider';
import { BlockToolbar } from '../canvas/BlockToolbar';
import { SectionInsertBar } from '../canvas/SectionInsertBar';
import { EditableText } from '../editable/EditableText';
import { EditableImage } from '../editable/EditableImage';
import { EditableLink } from '../editable/EditableLink';

interface Props {
  block: ArticleBlock;
  global: GlobalStyles;
  index: number;
  total: number;
}

export function ArticleView({ block, global: g, index, total: _total }: Props) {
  const store = useEditorStore();
  const update = (patch: Partial<Omit<ArticleBlock, 'type' | 'id'>>) =>
    store.getState().updateBlock(block.id, patch);
  const { mode } = useEditorMode();
  const selection = useSectionSelection();
  const blockNav = mode === 'edit' ? (e: React.MouseEvent) => e.preventDefault() : undefined;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });

  const titleSize = block.titleFontSize ?? g.headingFontSize;
  const bodySize = block.bodyFontSize ?? g.baseFontSize;
  const bg = block.backgroundColor ?? g.backgroundColor;
  const fg = block.textColor ?? g.textColor;

  const selected = selection.isSelected(block.id);
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    background: bg,
    maxWidth: 710,
    margin: '0 auto',
    position: 'relative',
  };

  function onMouseDown(e: React.MouseEvent) {
    if (!(e.metaKey || e.ctrlKey || e.shiftKey)) return;
    e.preventDefault();
    selection.toggle(block.id, e.shiftKey ? 'range' : 'single');
  }

  const ImageEl = (
    <EditableImage
      value={block.imageSrc}
      onChange={(v) => update({ imageSrc: v })}
      alt={block.imageAlt}
      placeholderLabel="Article image"
      imgStyle={{ maxWidth: '100%', height: 'auto' }}
      altLabel="Article image alt"
      onAltChange={(v) => update({ imageAlt: v })}
      width={block.imageWidth ?? 400}
      onWidthChange={(w) => update({ imageWidth: w })}
      aspectRatio={400 / 260}
    />
  );

  const TextEl = (
    <>
      <h2 style={{ fontSize: titleSize, color: fg, fontWeight: 700, margin: '0 0 8px' }}>
        <EditableText
          value={block.title}
          onChange={(v) => update({ title: v })}
          singleLine
          placeholder="Click to add a title"
          ariaLabel="Article title"
        />
      </h2>
      <p style={{ fontSize: bodySize, color: fg, whiteSpace: 'pre-wrap', margin: '0 0 16px' }}>
        <EditableText
          value={block.body}
          onChange={(v) => update({ body: v })}
          placeholder="Click to add article body"
          ariaLabel="Article body"
        />
      </p>
      {(block.ctaText || block.ctaUrl) && (
        <a
          href={block.ctaUrl ?? g.contactUrl}
          target="_blank"
          rel="noreferrer"
          onClick={blockNav}
          className="cta-edit-anchor"
          style={{ color: g.buttonColor, fontWeight: 600, textDecoration: 'none', position: 'relative' }}
        >
          <span className="inline-flex items-center">
            <EditableText
              value={block.ctaText}
              onChange={(v) => update({ ctaText: v })}
              singleLine
              placeholder="Read more"
              ariaLabel="Article CTA text"
            />
            <EditableLink
              value={block.ctaUrl ?? ''}
              onChange={(v) => update({ ctaUrl: v || undefined })}
              ariaLabel="Edit article CTA URL"
              floating
            />
          </span>
        </a>
      )}
    </>
  );

  let body: React.ReactNode;
  if (block.imagePosition === 'top') {
    body = (
      <div style={{ padding: 24 }}>
        <div style={{ marginBottom: 16 }}>{ImageEl}</div>
        {TextEl}
      </div>
    );
  } else if (block.imagePosition === 'left') {
    body = (
      <div style={{ display: 'flex', gap: 16, padding: 24 }}>
        <div style={{ flex: '0 0 40%' }}>{ImageEl}</div>
        <div style={{ flex: 1 }}>{TextEl}</div>
      </div>
    );
  } else {
    body = (
      <div style={{ display: 'flex', gap: 16, padding: 24, flexDirection: 'row-reverse' }}>
        <div style={{ flex: '0 0 40%' }}>{ImageEl}</div>
        <div style={{ flex: 1 }}>{TextEl}</div>
      </div>
    );
  }

  return (
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
        className={`section-wrap article-wrap ${selected ? 'selected' : ''}`}
        data-selected={selected || undefined}
        onMouseDown={onMouseDown}
      >
        <BlockToolbar
          blockId={block.id}
          blockLabel={block.title ?? 'Article'}
          dragAttributes={attributes as unknown as Record<string, unknown>}
          dragListeners={listeners as unknown as Record<string, unknown> | undefined}
        />
        {body}
      </motion.div>
    </motion.div>
  );
}
