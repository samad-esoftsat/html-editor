import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import { ResizableImage } from '@/components/editor/canvas/ResizableImage';

function setRect(el: HTMLElement, rect: Partial<DOMRect>) {
  el.getBoundingClientRect = () => ({
    x: rect.x ?? 0, y: rect.y ?? 0,
    left: rect.left ?? rect.x ?? 0, top: rect.top ?? rect.y ?? 0,
    right: (rect.left ?? rect.x ?? 0) + (rect.width ?? 0),
    bottom: (rect.top ?? rect.y ?? 0) + (rect.height ?? 0),
    width: rect.width ?? 0, height: rect.height ?? 0,
    toJSON: () => ({}),
  });
}

describe('ResizableImage', () => {
  it('renders children passthrough when not active', () => {
    const r = render(
      <ResizableImage width={200} onWidthChange={() => {}} aspectRatio={2}>
        <img data-testid="inner" alt="" />
      </ResizableImage>,
    );
    expect(r.getByTestId('inner')).toBeTruthy();
  });

  it('renders 4 corner handles', () => {
    const r = render(
      <ResizableImage width={200} onWidthChange={() => {}} aspectRatio={2}>
        <img data-testid="inner" alt="" />
      </ResizableImage>,
    );
    expect(r.container.querySelectorAll('[data-resize-handle]').length).toBe(4);
  });

  it('calls onWidthChange with new width when dragging bottom-right handle', () => {
    const onWidthChange = vi.fn();
    const r = render(
      <ResizableImage width={200} onWidthChange={onWidthChange} aspectRatio={2}>
        <img data-testid="inner" alt="" />
      </ResizableImage>,
    );
    const wrap = r.container.querySelector('[data-resizable-wrap]') as HTMLElement;
    setRect(wrap, { left: 100, top: 100, width: 200, height: 100 });
    const handle = r.container.querySelector('[data-resize-handle="br"]') as HTMLElement;
    fireEvent.pointerDown(handle, { clientX: 300, clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(document, { clientX: 360, clientY: 230, pointerId: 1 });
    fireEvent.pointerUp(document, { clientX: 360, clientY: 230, pointerId: 1 });
    expect(onWidthChange).toHaveBeenCalled();
    const finalWidth = onWidthChange.mock.calls.at(-1)![0];
    expect(finalWidth).toBeGreaterThan(200);
    expect(finalWidth).toBeLessThanOrEqual(360);
  });

  it('clamps to minWidth=40 when dragging shrinks below it', () => {
    const onWidthChange = vi.fn();
    const r = render(
      <ResizableImage width={200} onWidthChange={onWidthChange} aspectRatio={2}>
        <img data-testid="inner" alt="" />
      </ResizableImage>,
    );
    const wrap = r.container.querySelector('[data-resizable-wrap]') as HTMLElement;
    setRect(wrap, { left: 100, top: 100, width: 200, height: 100 });
    const handle = r.container.querySelector('[data-resize-handle="br"]') as HTMLElement;
    fireEvent.pointerDown(handle, { clientX: 300, clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(document, { clientX: 50, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(document, { clientX: 50, clientY: 100, pointerId: 1 });
    const finalWidth = onWidthChange.mock.calls.at(-1)![0];
    expect(finalWidth).toBeGreaterThanOrEqual(40);
  });

  it('shows live WxH badge during drag', () => {
    const r = render(
      <ResizableImage width={200} onWidthChange={() => {}} aspectRatio={2}>
        <img data-testid="inner" alt="" />
      </ResizableImage>,
    );
    expect(r.container.querySelector('[data-resize-badge]')).toBeNull();
    const wrap = r.container.querySelector('[data-resizable-wrap]') as HTMLElement;
    setRect(wrap, { left: 100, top: 100, width: 200, height: 100 });
    const handle = r.container.querySelector('[data-resize-handle="br"]') as HTMLElement;
    fireEvent.pointerDown(handle, { clientX: 300, clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(document, { clientX: 360, clientY: 230, pointerId: 1 });
    expect(r.container.querySelector('[data-resize-badge]')).not.toBeNull();
    fireEvent.pointerUp(document, { clientX: 360, clientY: 230, pointerId: 1 });
    expect(r.container.querySelector('[data-resize-badge]')).toBeNull();
  });
});
