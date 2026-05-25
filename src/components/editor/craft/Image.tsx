'use client';
import { useNode } from '@craftjs/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { NumberInput } from '@/components/ui/NumberInput';
import type { ImageProps } from '@/lib/editor/types';
import { marginForAlign, useConnectedRef, wrapWithLink } from './internals';
import { useRenderContext } from './RenderContext';
import { useAssetPickerForNode } from './useAssetPickerForNode';
import { ImageResizer } from './ImageResizer';

export function Image({ src, alt, width, height, align = 'center', linkHref }: ImageProps) {
  const { target } = useRenderContext();
  const ref = useConnectedRef();
  const { isSelected, openPicker } = useAssetPickerForNode();
  const { actions } = useNode();
  const isEditor = target === 'editor';
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);

  // For images without an explicit height stored, fall back to the rendered
  // height once the <img> loads so the resizer can grab a real starting box.
  useEffect(() => {
    if (height) return;
    const img = imgRef.current;
    if (!img) return;
    const update = () => {
      if (img.clientHeight > 0) setMeasuredHeight(img.clientHeight);
    };
    if (img.complete) update();
    img.addEventListener('load', update);
    return () => img.removeEventListener('load', update);
  }, [height, src]);

  const handleResize = useCallback((next: { width: number; height: number }) => {
    actions.setProp((props: ImageProps) => {
      props.width = next.width;
      props.height = next.height;
    });
  }, [actions]);

  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      if (!isEditor) return;
      // First click on an unselected node: let Craft handle selection.
      // Second click on an already-selected node: open the picker.
      if (!isSelected) return;
      event.stopPropagation();
      openPicker();
    },
    [isEditor, isSelected, openPicker],
  );

  const handleDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      if (!isEditor) return;
      event.stopPropagation();
      openPicker();
    },
    [isEditor, openPicker],
  );

  if (!src) {
    if (isEditor) {
      return (
        <div
          ref={ref}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          role="button"
          tabIndex={0}
          aria-label="Image placeholder"
          style={{
            alignItems: 'center',
            border: '1px dashed #c9c1b5',
            color: '#7a7063',
            cursor: isSelected ? 'pointer' : 'default',
            display: 'flex',
            justifyContent: 'center',
            margin: marginForAlign(align),
            minHeight: 120,
            width: width ?? '100%',
          }}
        >
          {isSelected ? 'Click to choose image' : 'Image placeholder'}
        </div>
      );
    }
    return null;
  }

  if (isEditor) {
    const resizerWidth = width ?? 300;
    const resizerHeight = height ?? measuredHeight ?? Math.round(resizerWidth * 0.6);
    return (
      <div style={{ width: '100%', textAlign: align, margin: marginForAlign(align) }}>
        <ImageResizer
          width={resizerWidth}
          height={resizerHeight}
          isSelected={isSelected}
          onChange={handleResize}
          renderImage={(size) => (
            <img
              ref={(el) => {
                ref(el);
                imgRef.current = el;
              }}
              src={src}
              alt={alt}
              onClick={handleClick}
              onDoubleClick={handleDoubleClick}
              style={{
                border: 0,
                cursor: isSelected ? 'pointer' : undefined,
                display: 'block',
                height: size.height,
                margin: 0,
                maxWidth: '100%',
                width: size.width,
              }}
            />
          )}
        />
      </div>
    );
  }

  const image = (
    <img
      ref={(el) => {
        ref(el);
        imgRef.current = el;
      }}
      src={src}
      alt={alt}
      width={target === 'email' && width ? width : undefined}
      height={target === 'email' && height ? height : undefined}
      style={{
        border: 0,
        display: 'block',
        height: height ?? 'auto',
        margin: marginForAlign(align),
        maxWidth: '100%',
        width,
      }}
    />
  );

  return <>{wrapWithLink(linkHref, image)}</>;
}

function ImageSettings() {
  const { actions, align = 'center', alt = '', linkHref = '', src = '', width = 300, height } = useNode((node) => node.data.props as ImageProps);
  const { openPicker } = useAssetPickerForNode();

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <button
          type="button"
          onClick={openPicker}
          className="inline-flex w-full min-h-9 items-center justify-center gap-2 rounded-md border border-ed-rule-strong bg-ed-panel-2 px-3 py-2 text-sm text-ed-ink hover:border-brand hover:bg-ed-panel"
        >
          <ImagePlus size={14} />
          {src ? 'Replace image…' : 'Choose image…'}
        </button>
      </div>
      <div className="col-span-2">
        <Field label="Source">
          <Input value={src} onChange={(event) => actions.setProp((props: ImageProps) => { props.src = event.target.value; })} />
        </Field>
      </div>
      <div className="col-span-2">
        <Field label="Alt text">
          <Input value={alt} onChange={(event) => actions.setProp((props: ImageProps) => { props.alt = event.target.value; })} />
        </Field>
      </div>
      <Field label="Width">
        <NumberInput value={width} onChange={(value) => actions.setProp((props: ImageProps) => { props.width = value; })} min={0} max={710} />
      </Field>
      <Field label="Height">
        <NumberInput value={height ?? 0} onChange={(value) => actions.setProp((props: ImageProps) => { props.height = value > 0 ? value : undefined; })} min={0} max={1600} />
      </Field>
      <Field label="Align">
        <select className="h-10 w-full rounded-md border border-ed-rule bg-ed-panel px-3 text-sm" value={align} onChange={(event) => actions.setProp((props: ImageProps) => { props.align = event.target.value as ImageProps['align']; })}>
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </Field>
      <div className="col-span-2">
        <Field label="Link">
          <Input value={linkHref} onChange={(event) => actions.setProp((props: ImageProps) => { props.linkHref = event.target.value || undefined; })} />
        </Field>
      </div>
    </div>
  );
}

Image.craft = {
  displayName: 'Image',
  props: {
    align: 'center',
    alt: '',
    src: '',
    width: 300,
  } satisfies ImageProps,
  related: {
    settings: ImageSettings,
  },
};
