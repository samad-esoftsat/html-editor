import { useNode } from '@craftjs/core';
import { Field } from '@/components/ui/Field';
import { NumberInput } from '@/components/ui/NumberInput';
import type { SpacerProps } from '@/lib/editor/types';
import { useConnectedRef } from './internals';

export function Spacer({ height }: SpacerProps) {
  const ref = useConnectedRef();
  return <div ref={ref} style={{ height }} />;
}

function SpacerSettings() {
  const { actions, height = 24 } = useNode((node) => node.data.props as SpacerProps);

  return (
    <Field label="Height">
      <NumberInput value={height} onChange={(value) => actions.setProp((props: SpacerProps) => { props.height = value; })} min={0} max={200} />
    </Field>
  );
}

Spacer.craft = {
  displayName: 'Spacer',
  props: {
    height: 24,
  } satisfies SpacerProps,
  related: {
    settings: SpacerSettings,
  },
};
