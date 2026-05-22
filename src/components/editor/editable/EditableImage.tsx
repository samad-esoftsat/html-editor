'use client';
import { useAssetPicker } from '../AssetPickerProvider';
import { useEditorMode } from '../EditorModeProvider';
import { ResizableImage } from '../canvas/ResizableImage';
import { EditableText } from './EditableText';

export interface EditableImageProps {
  value: string;
  onChange: (next: string) => void;
  alt: string;
  placeholderLabel: string;
  placeholderWidth?: number;
  placeholderHeight?: number;
  imgStyle?: React.CSSProperties;
  altLabel?: string;
  onAltChange?: (next: string) => void;
  width?: number;
  onWidthChange?: (next: number) => void;
  aspectRatio?: number;
}

export function EditableImage({
  value,
  onChange,
  alt,
  placeholderLabel,
  placeholderWidth,
  placeholderHeight,
  imgStyle,
  altLabel,
  onAltChange,
  width,
  onWidthChange,
  aspectRatio,
}: EditableImageProps) {
  const { openAssetPicker } = useAssetPicker();
  const { mode } = useEditorMode();

  if (mode === 'preview') {
    if (!value) return null;
    const previewStyle: React.CSSProperties = width ? { ...imgStyle, width, maxWidth: 'none' } : imgStyle ?? {};
    return <img src={value} alt={alt} style={previewStyle} />;
  }

  function open() {
    openAssetPicker({
      value,
      altText: alt,
      onSelect: (url) => onChange(url),
    });
  }

  if (value) {
    const renderedWidth = width;
    const img = (
      <img
        src={value}
        alt={alt}
        onClick={open}
        className="inline-editable-image"
        style={{ cursor: 'pointer', ...imgStyle, ...(renderedWidth ? { width: renderedWidth, maxWidth: 'none' } : {}) }}
      />
    );

    const wrapped = onWidthChange && renderedWidth && aspectRatio
      ? (
        <ResizableImage
          width={renderedWidth}
          onWidthChange={onWidthChange}
          aspectRatio={aspectRatio}
        >
          {img}
        </ResizableImage>
      )
      : img;

    if (!onAltChange) return wrapped;
    return (
      <span className="editable-image-wrap">
        {wrapped}
        <span className="editable-image-alt text-[12px] text-ed-ink-3 px-1">
          Alt:{' '}
          <EditableText
            value={alt}
            onChange={onAltChange}
            singleLine
            placeholder="click to add"
            ariaLabel={altLabel ?? 'Image alt text'}
          />
        </span>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={open}
      aria-label={placeholderLabel}
      className="inline-editable-image-placeholder"
      style={{
        width: '100%',
        maxWidth: placeholderWidth ?? 355,
        aspectRatio: placeholderWidth && placeholderHeight
          ? `${placeholderWidth} / ${placeholderHeight}`
          : '4/3',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#eaeaea',
        color: '#888',
        border: '1px dashed #bbb',
        fontSize: 12,
        cursor: 'pointer',
        padding: 0,
      }}
    >
      {placeholderLabel}
    </button>
  );
}
