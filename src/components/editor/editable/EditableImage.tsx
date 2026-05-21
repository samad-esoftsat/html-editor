'use client';
import { useAssetPicker } from '../AssetPickerProvider';
import { useEditorMode } from '../EditorModeProvider';
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
}: EditableImageProps) {
  const { openAssetPicker } = useAssetPicker();
  const { mode } = useEditorMode();

  if (mode === 'preview') {
    if (!value) return null;
    return <img src={value} alt={alt} style={imgStyle} />;
  }

  function open() {
    openAssetPicker({
      value,
      altText: alt,
      onSelect: (url) => onChange(url),
    });
  }

  if (value) {
    const img = (
      <img
        src={value}
        alt={alt}
        onClick={open}
        className="inline-editable-image"
        style={{ cursor: 'pointer', ...imgStyle }}
      />
    );
    if (!onAltChange) return img;
    return (
      <span className="editable-image-wrap">
        {img}
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
