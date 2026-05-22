'use client';
import { motion } from 'motion/react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { HeroBlock, GlobalStyles } from '@/lib/editor/types';
import { useEditorStore } from '@/lib/editor/StoreProvider';
import { useEditorMode } from '../EditorModeProvider';
import { useSectionSelection } from '../SectionSelectionProvider';
import { BlockToolbar } from '../canvas/BlockToolbar';
import { SectionInsertBar } from '../canvas/SectionInsertBar';
import { EditableText } from '../editable/EditableText';
import { EditableImage } from '../editable/EditableImage';
import { EditableLink } from '../editable/EditableLink';

interface Props {
  block: HeroBlock;
  global: GlobalStyles;
  index: number;
  total: number;
}

export function HeroBlockView({ block, global: g, index, total: _total }: Props) {
  const store = useEditorStore();
  const update = (patch: Partial<Omit<HeroBlock, 'type' | 'id'>>) =>
    store.getState().updateBlock(block.id, patch);
  const { mode } = useEditorMode();
  const selection = useSectionSelection();
  const blockNav = mode === 'edit' ? (e: React.MouseEvent) => e.preventDefault() : undefined;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });

  const titleSize = block.titleFontSize ?? Math.max(g.headingFontSize, 28);
  const subtitleSize = block.subtitleFontSize ?? g.baseFontSize;
  const bg = block.backgroundColor ?? g.backgroundColor;
  const fg = block.textColor ?? g.textColor;
  const buttonColor = block.buttonColor ?? g.buttonColor;

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
        className={`section-wrap hero-wrap ${selected ? 'selected' : ''}`}
        data-selected={selected || undefined}
        onMouseDown={onMouseDown}
      >
        <BlockToolbar
          blockId={block.id}
          blockLabel={block.title ?? 'Hero'}
          dragAttributes={attributes as unknown as Record<string, unknown>}
          dragListeners={listeners as unknown as Record<string, unknown> | undefined}
        />
        <div style={{ padding: '40px 24px', textAlign: 'center' }}>
          <EditableImage
            value={block.imageSrc}
            onChange={(v) => update({ imageSrc: v })}
            alt={block.imageAlt}
            placeholderLabel="Hero image - click to add"
            imgStyle={{ maxWidth: '100%', height: 'auto', marginBottom: 16 }}
            altLabel="Hero image alt"
            onAltChange={(v) => update({ imageAlt: v })}
            width={block.imageWidth ?? 710}
            onWidthChange={(w) => update({ imageWidth: w })}
            aspectRatio={710 / 400}
          />
          <h1 style={{ fontSize: titleSize, color: fg, fontWeight: 700, margin: '0 0 12px' }}>
            <EditableText
              value={block.title}
              onChange={(v) => update({ title: v })}
              singleLine
              placeholder="Click to add a hero title"
              ariaLabel="Hero title"
            />
          </h1>
          <p style={{ fontSize: subtitleSize, color: fg, margin: '0 0 24px' }}>
            <EditableText
              value={block.subtitle}
              onChange={(v) => update({ subtitle: v })}
              singleLine
              placeholder="Click to add a subtitle"
              ariaLabel="Hero subtitle"
            />
          </p>
          <a
            href={block.ctaUrl ?? g.contactUrl}
            target="_blank"
            rel="noreferrer"
            onClick={blockNav}
            className="cta-edit-anchor"
            style={{
              display: 'inline-block', background: buttonColor, color: g.buttonTextColor,
              padding: '14px 28px', borderRadius: 4, fontWeight: 600, textDecoration: 'none',
              position: 'relative',
            }}
          >
            <span className="inline-flex items-center">
              <EditableText
                value={block.ctaText}
                onChange={(v) => update({ ctaText: v })}
                singleLine
                placeholder="CTA"
                ariaLabel="Hero CTA text"
                style={{ color: g.buttonTextColor }}
              />
              <EditableLink
                value={block.ctaUrl ?? ''}
                onChange={(v) => update({ ctaUrl: v || undefined })}
                ariaLabel="Edit hero CTA URL"
                floating
              />
            </span>
          </a>
        </div>
      </motion.div>
    </motion.div>
  );
}
