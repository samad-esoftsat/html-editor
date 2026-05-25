import { useNode } from '@craftjs/core';
import type { PageProps } from '@/lib/editor/types';
import { useRenderContext } from './RenderContext';

export function Page({ children }: PageProps) {
  const { connectors } = useNode();
  const { global, target } = useRenderContext();
  const style = {
    background: global?.backgroundColor,
    color: global?.textColor,
    fontFamily: global?.fontFamily,
    minHeight: '100%',
  };

  if (target === 'email') {
    return <>{children}</>;
  }

  return (
    <div
      ref={(element) => {
        if (element) {
          connectors.connect(element);
        }
      }}
      data-craft-page
      style={style}
    >
      {children}
    </div>
  );
}

Page.craft = {
  displayName: 'Page',
  props: {},
  rules: {
    canDrag: () => false,
    canMoveIn: (incoming: Array<{ data: { type: { resolvedName?: string } } }>) =>
      incoming.every((node) => node.data.type.resolvedName === 'Section'),
  },
};
