import { Element as CraftElement, type NodeId } from '@craftjs/core';
import { createElement, type ElementType, type ReactNode } from 'react';

interface ElementOwnProps<T extends ElementType> {
  is: T;
  id?: NodeId;
  isSSR?: boolean;
  canvas?: boolean;
  children?: ReactNode;
}

type Props<T extends ElementType> = ElementOwnProps<T> &
  Omit<React.ComponentProps<T>, keyof ElementOwnProps<T>>;

export function Element<T extends ElementType>({
  is,
  id,
  isSSR,
  canvas,
  children,
  ...rest
}: Props<T>) {
  if (isSSR) {
    return createElement(is, rest as React.ComponentProps<T>, children);
  }

  return (
    <CraftElement id={id} is={is} canvas={canvas} {...(rest as unknown as React.ComponentProps<T>)}>
      {children}
    </CraftElement>
  );
}
