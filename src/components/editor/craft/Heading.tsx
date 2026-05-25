import { useNode } from '@craftjs/core';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { NumberInput } from '@/components/ui/NumberInput';
import type { HeadingProps } from '@/lib/editor/types';
import { resolveColorToken } from './brandTokens';
import { textAlignFor } from './internals';
import { useEditableNode } from './useEditableNode';
import { useRenderContext } from './RenderContext';

export function Heading({ text, level = 2, fontSize, color, brandToken, align = 'left' }: HeadingProps) {
  const { global } = useRenderContext();
  const resolvedColor = resolveColorToken(brandToken, global) ?? color ?? global?.textColor;
  const { actions } = useNode();
  const editable = useEditableNode(text, (next) => {
    actions.setProp((props: HeadingProps) => {
      props.text = next;
    });
  });
  const Tag = `h${level}` as const;

  return (
    <Tag
      {...editable.props}
      style={{
        color: resolvedColor,
        fontSize,
        margin: '0 0 8px',
        textAlign: textAlignFor(align),
        outline: 'none',
      }}
    >
      {text}
    </Tag>
  );
}

function HeadingSettings() {
  const { actions, align = 'left', color = '', fontSize = 24, level = 2, text = '' } = useNode((node) => node.data.props as HeadingProps);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <Field label="Text">
          <Input value={text} onChange={(event) => actions.setProp((props: HeadingProps) => { props.text = event.target.value; })} />
        </Field>
      </div>
      <Field label="Level">
        <select className="h-10 w-full rounded-md border border-ed-rule bg-ed-panel px-3 text-sm" value={level} onChange={(event) => actions.setProp((props: HeadingProps) => { props.level = Number(event.target.value) as HeadingProps['level']; })}>
          <option value={1}>H1</option>
          <option value={2}>H2</option>
          <option value={3}>H3</option>
          <option value={4}>H4</option>
        </select>
      </Field>
      <Field label="Size">
        <NumberInput value={fontSize} onChange={(value) => actions.setProp((props: HeadingProps) => { props.fontSize = value; })} min={10} max={72} />
      </Field>
      <Field label="Align">
        <select className="h-10 w-full rounded-md border border-ed-rule bg-ed-panel px-3 text-sm" value={align} onChange={(event) => actions.setProp((props: HeadingProps) => { props.align = event.target.value as HeadingProps['align']; })}>
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </Field>
      <Field label="Color">
        <ColorPicker value={color} onChange={(value) => actions.setProp((props: HeadingProps) => { props.color = value || undefined; })} />
      </Field>
    </div>
  );
}

Heading.craft = {
  displayName: 'Heading',
  props: {
    align: 'left',
    fontSize: 24,
    level: 2,
    text: 'Heading',
  } satisfies HeadingProps,
  related: {
    settings: HeadingSettings,
  },
};
