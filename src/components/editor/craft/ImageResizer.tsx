'use client';
import { useCallback, useRef, useState, type ReactNode } from 'react';

type HandlePosition = 'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r';

interface ImageResizerProps {
  width: number;
  height: number;
  onChange: (next: { width: number; height: number }) => void;
  isSelected: boolean;
  minSize?: number;
  maxSize?: number;
  /** Render-prop receives the live size so the image reflows during drag. */
  renderImage: (size: { width: number; height: number }) => ReactNode;
}

const HANDLE_OFFSET = -5;
const HANDLE_SIZE = 10;
const DEFAULT_MIN = 24;
const DEFAULT_MAX = 1600;

interface DragState {
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  handle: HandlePosition;
}

export function ImageResizer({
  width,
  height,
  onChange,
  isSelected,
  minSize = DEFAULT_MIN,
  maxSize = DEFAULT_MAX,
  renderImage,
}: ImageResizerProps) {
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const [drag, setDrag] = useState<{ width: number; height: number } | null>(null);

  const startDrag = useCallback(
    (handle: HandlePosition) => (event: React.PointerEvent<HTMLSpanElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const wrap = wrapRef.current;
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      const state: DragState = {
        startX: event.clientX,
        startY: event.clientY,
        startWidth: rect.width,
        startHeight: rect.height,
        handle,
      };

      function clamp(value: number): number {
        return Math.max(minSize, Math.min(maxSize, Math.round(value)));
      }

      function compute(ev: PointerEvent): { width: number; height: number } {
        const dx = ev.clientX - state.startX;
        const dy = ev.clientY - state.startY;
        const wSign = handle.includes('r') ? 1 : handle.includes('l') ? -1 : 0;
        const hSign = handle.includes('b') ? 1 : handle.includes('t') ? -1 : 0;
        return {
          width: clamp(state.startWidth + dx * wSign),
          height: clamp(state.startHeight + dy * hSign),
        };
      }

      function onMove(ev: PointerEvent) {
        setDrag(compute(ev));
      }

      function onUp(ev: PointerEvent) {
        const next = compute(ev);
        setDrag(null);
        onChange(next);
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      }

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    },
    [maxSize, minSize, onChange],
  );

  const displayWidth = drag?.width ?? width;
  const displayHeight = drag?.height ?? height;

  return (
    <span
      ref={wrapRef}
      style={{
        display: 'inline-block',
        position: 'relative',
        maxWidth: '100%',
        outline: isSelected ? '1px solid var(--color-brand, #f1592a)' : 'none',
      }}
    >
      {renderImage({ width: displayWidth, height: displayHeight })}
      {isSelected && (
        <>
          {(['tl', 'tr', 'bl', 'br', 't', 'b', 'l', 'r'] as HandlePosition[]).map((handle) => (
            <span
              key={handle}
              data-resize-handle={handle}
              onPointerDown={startDrag(handle)}
              style={{
                position: 'absolute',
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                background: 'var(--color-brand, #f1592a)',
                border: '1px solid #fff',
                borderRadius: 2,
                cursor: cursorFor(handle),
                zIndex: 4,
                ...positionFor(handle),
              }}
            />
          ))}
          {drag && (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: -28,
                right: 0,
                background: 'var(--color-ed-panel-2, #1f1f1f)',
                color: 'var(--color-brand, #f1592a)',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11,
                padding: '2px 6px',
                borderRadius: 4,
                border: '1px solid var(--color-ed-rule-strong, #444)',
                whiteSpace: 'nowrap',
                zIndex: 5,
              }}
            >
              {displayWidth} × {displayHeight}
            </span>
          )}
        </>
      )}
    </span>
  );
}

function cursorFor(handle: HandlePosition): string {
  if (handle === 't' || handle === 'b') return 'ns-resize';
  if (handle === 'l' || handle === 'r') return 'ew-resize';
  if (handle === 'tl' || handle === 'br') return 'nwse-resize';
  return 'nesw-resize';
}

function positionFor(handle: HandlePosition): React.CSSProperties {
  const style: React.CSSProperties = {};
  if (handle.includes('t')) style.top = HANDLE_OFFSET;
  if (handle.includes('b')) style.bottom = HANDLE_OFFSET;
  if (handle.includes('l')) style.left = HANDLE_OFFSET;
  if (handle.includes('r')) style.right = HANDLE_OFFSET;
  if (handle === 't' || handle === 'b') { style.left = '50%'; style.transform = 'translateX(-50%)'; }
  if (handle === 'l' || handle === 'r') { style.top = '50%'; style.transform = 'translateY(-50%)'; }
  return style;
}
