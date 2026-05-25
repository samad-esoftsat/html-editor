import { useNode } from '@craftjs/core';
import { Field } from '@/components/ui/Field';
import { NumberInput } from '@/components/ui/NumberInput';
import type { ColumnProps } from '@/lib/editor/types';
import { useRenderContext } from './RenderContext';

export function Column({ widthPercent, verticalAlign = 'top', gap, children }: ColumnProps) {
  const { connectors } = useNode();
  const { target } = useRenderContext();

  if (target === 'email') {
    return (
      <td
        width={widthPercent ? `${widthPercent}%` : undefined}
        valign={verticalAlign}
        style={{ padding: 0, width: widthPercent ? `${widthPercent}%` : undefined }}
      >
        {children}
      </td>
    );
  }

  return (
    <div
      ref={(element) => {
        if (element) {
          connectors.connect(element);
        }
      }}
      data-craft-column
      style={{
        display: 'flex',
        flex: widthPercent ? `0 0 ${widthPercent}%` : '1 1 0',
        flexDirection: 'column',
        gap: gap ?? 12,
        minWidth: 0,
      }}
    >
      {children}
    </div>
  );
}

function ColumnSettings() {
  const { actions, verticalAlign = 'top', widthPercent = 100 } = useNode((node) => node.data.props as ColumnProps);

  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Width %">
        <NumberInput
          value={widthPercent}
          onChange={(value) => actions.setProp((props: ColumnProps) => {
            props.widthPercent = value;
          })}
          min={10}
          max={100}
        />
      </Field>
      <Field label="Vertical align">
        <select
          className="h-10 w-full rounded-md border border-ed-rule bg-ed-panel px-3 text-sm"
          value={verticalAlign}
          onChange={(event) => actions.setProp((props: ColumnProps) => {
            props.verticalAlign = event.target.value as ColumnProps['verticalAlign'];
          })}
        >
          <option value="top">Top</option>
          <option value="middle">Middle</option>
          <option value="bottom">Bottom</option>
        </select>
      </Field>
    </div>
  );
}

Column.craft = {
  displayName: 'Column',
  props: {
    verticalAlign: 'top',
    widthPercent: 100,
  } satisfies ColumnProps,
  related: {
    settings: ColumnSettings,
  },
  rules: {
    canMoveIn: (incoming: Array<{ data: { type: { resolvedName?: string } } }>) =>
      incoming.every((node) => !['Page', 'Section', 'Row', 'Column'].includes(node.data.type.resolvedName ?? '')),
  },
};
