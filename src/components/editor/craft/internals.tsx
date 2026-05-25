import { useNode } from '@craftjs/core';
import type { ReactElement, ReactNode } from 'react';

export function marginForAlign(align: 'left' | 'center' | 'right' = 'left'): string {
  if (align === 'center') {
    return '0 auto';
  }
  if (align === 'right') {
    return '0 0 0 auto';
  }
  return '0';
}

export function textAlignFor(align: 'left' | 'center' | 'right' = 'left'): 'left' | 'center' | 'right' {
  return align;
}

export function wrapWithLink(linkHref: string | undefined, child: ReactNode): ReactNode {
  if (!linkHref) {
    return child;
  }
  return (
    <a href={linkHref} target="_blank" rel="noreferrer">
      {child}
    </a>
  );
}

export function useConnectDrag(): {
  connect: (element: HTMLElement) => HTMLElement;
  drag: (element: HTMLElement) => HTMLElement;
} {
  const { connectors } = useNode();
  return connectors;
}

export function useConnectedRef(): (element: HTMLElement | null) => void {
  const { connect, drag } = useConnectDrag();
  return (element) => {
    if (element) {
      connect(drag(element));
    }
  };
}

export function useConnectedElementRef(connectOnly = false): (element: HTMLElement | null) => void {
  const { connectors } = useNode();
  return (element) => {
    if (!element) {
      return;
    }
    if (connectOnly) {
      connectors.connect(element);
      return;
    }
    connectors.connect(connectors.drag(element));
  };
}

export function isReactElement(node: ReactNode): node is ReactElement {
  return typeof node === 'object' && node !== null && 'type' in node;
}
