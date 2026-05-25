import { useNode } from '@craftjs/core';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { Field } from '@/components/ui/Field';
import { NumberInput } from '@/components/ui/NumberInput';
import type { DividerProps } from '@/lib/editor/types';
import { useConnectedRef } from './internals';

export function Divider({ color = '#d8d8d8', thickness = 1 }: DividerProps) {
  const ref = useConnectedRef();
  return <hr ref={ref} style={{ border: 0, borderTop: `${thickness}px solid ${color}`, margin: '12px 0' }} />;
}

function DividerSettings() {
  const { actions, color = '#d8d8d8', thickness = 1 } = useNode((node) => node.data.props as DividerProps);

  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Color">
        <ColorPicker value={color} onChange={(value) => actions.setProp((props: DividerProps) => { props.color = value || undefined; })} />
      </Field>
      <Field label="Thickness">
        <NumberInput value={thickness} onChange={(value) => actions.setProp((props: DividerProps) => { props.thickness = value; })} min={1} max={12} />
      </Field>
    </div>
  );
}

Divider.craft = {
  displayName: 'Divider',
  props: {
    color: '#d8d8d8',
    thickness: 1,
  } satisfies DividerProps,
  related: {
    settings: DividerSettings,
  },
};
