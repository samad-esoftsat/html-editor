'use client';
import { useAssetPicker } from '../AssetPickerProvider';

export interface EditableImageProps {
  value: string;
  onChange: (next: string) => void;
  alt: string;
  placeholderLabel: string;
  placeholderWidth?: number;
  placeholderHeight?: number;
  imgStyle?: React.CSSProperties;
}

export function EditableImage({
  value,
  onChange,
  alt,
  placeholderLabel,
  placeholderWidth,
  placeholderHeight,
  imgStyle,
}: EditableImageProps) {
  const { openAssetPicker } = useAssetPicker();

  function open() {
    openAssetPicker({
      value,
      altText: alt,
      onSelect: (url) => onChange(url),
    });
  }

  if (value) {
    return (
      <img
        src={value}
        alt={alt}
        onClick={open}
        className="inline-editable-image"
        style={{ cursor: 'pointer', ...imgStyle }}
      />
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
