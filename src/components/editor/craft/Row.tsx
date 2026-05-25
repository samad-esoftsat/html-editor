import { useNode } from '@craftjs/core';
import { Field } from '@/components/ui/Field';
import { NumberInput } from '@/components/ui/NumberInput';
import type { RowProps } from '@/lib/editor/types';
import { useRenderContext } from './RenderContext';

export function Row({ gap = 16, reverse = false, children }: RowProps) {
  const { connectors } = useNode();
  const { target } = useRenderContext();

  if (target === 'email') {
    return (
      <table role="presentation" width="100%" border={0} cellPadding={0} cellSpacing={0}>
        <tbody>
          <tr style={reverse ? { direction: 'rtl' } : undefined}>{children}</tr>
        </tbody>
      </table>
    );
  }

  return (
    <div
      ref={(element) => {
        if (element) {
          connectors.connect(element);
        }
      }}
      data-craft-row
      style={{
        display: 'flex',
        flexDirection: reverse ? 'row-reverse' : 'row',
        gap,
        width: '100%',
      }}
    >
      {children}
    </div>
  );
}

function RowSettings() {
  const { actions, gap = 16, reverse = false } = useNode((node) => node.data.props as RowProps);

  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Gap">
        <NumberInput
          value={gap}
          onChange={(value) => actions.setProp((props: RowProps) => {
            props.gap = value;
          })}
          min={0}
          max={48}
        />
      </Field>
      <Field label="Reverse">
        <label className="flex h-10 items-center gap-2 rounded-md border border-ed-rule px-3 text-sm">
          <input
            checked={reverse}
            type="checkbox"
            onChange={(event) => actions.setProp((props: RowProps) => {
              props.reverse = event.target.checked;
            })}
          />
          Reverse columns
        </label>
      </Field>
    </div>
  );
}

Row.craft = {
  displayName: 'Row',
  props: {
    gap: 16,
    reverse: false,
  } satisfies RowProps,
  related: {
    settings: RowSettings,
  },
  rules: {
    canMoveIn: (
      incoming: Array<{ data: { type: { resolvedName?: string } } }>,
      currentNode: { data: { nodes: string[] } },
    ) => incoming.every((node) => node.data.type.resolvedName === 'Column')
      && currentNode.data.nodes.length + incoming.length <= 4,
  },
};
