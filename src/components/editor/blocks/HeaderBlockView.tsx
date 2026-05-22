'use client';
import type { HeaderBlock, GlobalStyles } from '@/lib/editor/types';
import { useEditorStore } from '@/lib/editor/StoreProvider';
import { useEditorMode } from '../EditorModeProvider';
import { EditableText } from '../editable/EditableText';
import { EditableImage } from '../editable/EditableImage';

interface Props {
  block: HeaderBlock;
  global: GlobalStyles;
}

export function HeaderBlockView({ block, global: g }: Props) {
  const store = useEditorStore();
  const setHeader = store.getState().setHeader;
  const { mode } = useEditorMode();
  const blockNav = mode === 'edit' ? (e: React.MouseEvent) => e.preventDefault() : undefined;

  return (
    <>
      {/* Header */}
      <div style={{ maxWidth: 710, margin: '0 auto', padding: '20px' }}>
        <div style={{ textAlign: 'center' }}>
          <EditableImage
            value={block.logoSrc}
            onChange={(v) => setHeader({ logoSrc: v })}
            alt={block.logoAlt}
            placeholderLabel="Logo image - click to add"
            placeholderWidth={block.logoWidth}
            width={block.logoWidth}
            onWidthChange={(w) => setHeader({ logoWidth: w })}
            aspectRatio={block.logoWidth / 80}
            imgStyle={{ maxWidth: block.logoWidth, width: '100%' }}
            altLabel="Header logo alt text"
            onAltChange={(v) => setHeader({ logoAlt: v })}
          />
        </div>
        <h1 style={{ textAlign: 'center', fontSize: block.titleFontSize, color: g.textColor, fontWeight: 400, margin: '20px 0' }}>
          <EditableText
            value={block.title}
            onChange={(v) => setHeader({ title: v })}
            singleLine
            placeholder="Click to add a title"
            ariaLabel="Header title"
          />
        </h1>
        <div style={{ textAlign: 'center' }}>
          <EditableImage
            value={block.bannerSrc}
            onChange={(v) => setHeader({ bannerSrc: v })}
            alt={block.bannerAlt}
            placeholderLabel="Header banner - click to add"
            imgStyle={{ width: '100%' }}
            altLabel="Header banner alt text"
            onAltChange={(v) => setHeader({ bannerAlt: v })}
          />
        </div>
        <h3 style={{ textAlign: 'center', fontSize: block.sectionHeadingFontSize, color: g.textColor, fontWeight: 400, margin: '12px 0' }}>
          <EditableText
            value={block.sectionHeading}
            onChange={(v) => setHeader({ sectionHeading: v })}
            singleLine
            placeholder="Click to add a section heading"
            ariaLabel="Section heading"
          />
        </h3>
      </div>
    </>
  );
}
