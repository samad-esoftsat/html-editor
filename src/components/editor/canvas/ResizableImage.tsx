'use client';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

interface ResizableImageProps {
  width: number;
  onWidthChange: (next: number) => void;
  aspectRatio: number;
  minWidth?: number;
  maxWidth?: number;
  children: ReactNode;
}

type Corner = 'tl' | 'tr' | 'bl' | 'br';

const HANDLE_OFFSET = -4;
const DEFAULT_MIN = 40;
const DEFAULT_MAX = 1200;

export function ResizableImage({
  width,
  onWidthChange,
  aspectRatio,
  minWidth = DEFAULT_MIN,
  maxWidth = DEFAULT_MAX,
  children,
}: ResizableImageProps) {
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const [naturalRatio, setNaturalRatio] = useState<number | null>(null);

  // Watch the wrapped <img> for natural dimensions so the ghost overlay matches
  // the real image instead of the caller-supplied aspectRatio fallback.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const img = wrap.querySelector('img');
    if (!img) return;
    const capture = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        setNaturalRatio(img.naturalWidth / img.naturalHeight);
      }
    };
    if (img.complete) capture();
    img.addEventListener('load', capture);
    return () => img.removeEventListener('load', capture);
  }, [children]);

  const effectiveRatio = naturalRatio ?? aspectRatio;

  const startDrag = useCallback(
    (corner: Corner) => (event: React.PointerEvent<HTMLSpanElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const wrap = wrapRef.current;
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      const startWidth = rect.width;
      const startX = event.clientX;
      const sign = corner === 'tr' || corner === 'br' ? 1 : -1;

      function clamp(next: number): number {
        return Math.max(minWidth, Math.min(maxWidth, Math.round(next)));
      }

      function onMove(ev: PointerEvent) {
        const delta = (ev.clientX - startX) * sign;
        const next = clamp(startWidth + delta);
        setDragWidth(next);
      }

      function onUp(ev: PointerEvent) {
        const delta = (ev.clientX - startX) * sign;
        const next = clamp(startWidth + delta);
        setDragWidth(null);
        onWidthChange(next);
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      }

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    },
    [maxWidth, minWidth, onWidthChange],
  );

  const displayWidth = dragWidth ?? width;
  const displayHeight = Math.round(displayWidth / effectiveRatio);

  return (
    <span
      ref={wrapRef}
      data-resizable-wrap
      className="resizable-image"
      style={{ display: 'inline-block', position: 'relative', maxWidth: '100%' }}
    >
      {children}
      {(['tl', 'tr', 'bl', 'br'] as Corner[]).map((corner) => (
        <span
          key={corner}
          data-resize-handle={corner}
          onPointerDown={startDrag(corner)}
          className={`resize-handle resize-handle-${corner}`}
          style={{
            position: 'absolute',
            width: 10,
            height: 10,
            background: 'var(--color-brand)',
            border: '1px solid #fff',
            borderRadius: 2,
            cursor: corner === 'tl' || corner === 'br' ? 'nwse-resize' : 'nesw-resize',
            zIndex: 4,
            ...(corner.startsWith('t') ? { top: HANDLE_OFFSET } : { bottom: HANDLE_OFFSET }),
            ...(corner.endsWith('l') ? { left: HANDLE_OFFSET } : { right: HANDLE_OFFSET }),
          }}
        />
      ))}
      {dragWidth !== null && (
        <>
          <span
            data-resize-ghost
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: dragWidth,
              height: displayHeight,
              border: '2px dashed var(--color-brand)',
              background: 'color-mix(in oklab, var(--color-brand) 12%, transparent)',
              pointerEvents: 'none',
              zIndex: 3,
            }}
          />
          <span
            data-resize-badge
            className="resize-badge"
            style={{
              position: 'absolute',
              top: -28,
              right: 0,
              background: 'var(--color-ed-panel-2)',
              color: 'var(--color-brand)',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11,
              padding: '2px 6px',
              borderRadius: 4,
              border: '1px solid var(--color-ed-rule-strong)',
              whiteSpace: 'nowrap',
              zIndex: 5,
            }}
          >
            {dragWidth} × {displayHeight}
          </span>
        </>
      )}
    </span>
  );
}
