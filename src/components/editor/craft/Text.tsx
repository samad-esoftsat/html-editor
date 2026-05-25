import { useNode } from '@craftjs/core';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { NumberInput } from '@/components/ui/NumberInput';
import { Textarea } from '@/components/ui/Textarea';
import type { TextProps } from '@/lib/editor/types';
import { resolveColorToken } from './brandTokens';
import { textAlignFor, useConnectedRef, wrapWithLink } from './internals';
import { useEditableNode } from './useEditableNode';
import { useRenderContext } from './RenderContext';

export function Text({
  text,
  fontSize,
  color,
  brandToken,
  align = 'left',
  linkHref,
  labelPrefix,
  linkBrandToken,
  bold,
  marginBottom,
}: TextProps) {
  const margin = `0 0 ${marginBottom ?? 8}px`;
  const { global } = useRenderContext();
  const resolvedColor = resolveColorToken(brandToken, global) ?? color ?? global?.textColor;
  const { actions } = useNode();
  const editable = useEditableNode(text, (next) => {
    actions.setProp((props: TextProps) => {
      props.text = next;
    });
  });
  const staticRef = useConnectedRef();

  // Inline label + link rendering (e.g., "Tel: 555-1234"). When labelPrefix
  // is set we render the label in the resolved text color and the link in
  // the resolved link color, all inside a single <p>. The label itself stays
  // read-only (edit via the inspector); only the link value is contentEditable.
  if (labelPrefix && linkHref) {
    const resolvedLinkColor =
      resolveColorToken(linkBrandToken, global) ?? resolvedColor;
    return (
      <p
        ref={staticRef}
        style={{
          color: resolvedColor,
          fontSize,
          fontWeight: bold ? 700 : undefined,
          margin,
          textAlign: textAlignFor(align),
          whiteSpace: 'pre-wrap',
        }}
      >
        {labelPrefix}
        <span
          {...editable.props}
          style={{ color: resolvedLinkColor, textDecoration: 'none', outline: 'none' }}
        >
          {text}
        </span>
      </p>
    );
  }

  const node = (
    <p
      {...editable.props}
      style={{
        color: resolvedColor,
        fontSize,
        fontWeight: bold ? 700 : undefined,
        margin,
        textAlign: textAlignFor(align),
        whiteSpace: 'pre-wrap',
        outline: 'none',
      }}
    >
      {text}
    </p>
  );
  return <>{wrapWithLink(linkHref, node)}</>;
}

function TextSettings() {
  const {
    actions,
    align = 'left',
    color = '',
    fontSize = 16,
    linkHref = '',
    text = '',
    labelPrefix = '',
  } = useNode((node) => node.data.props as TextProps);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <Field label="Text">
          <Textarea rows={4} value={text} onChange={(event) => actions.setProp((props: TextProps) => { props.text = event.target.value; })} />
        </Field>
      </div>
      <Field label="Size">
        <NumberInput value={fontSize} onChange={(value) => actions.setProp((props: TextProps) => { props.fontSize = value; })} min={10} max={48} />
      </Field>
      <Field label="Align">
        <select className="h-10 w-full rounded-md border border-ed-rule bg-ed-panel px-3 text-sm" value={align} onChange={(event) => actions.setProp((props: TextProps) => { props.align = event.target.value as TextProps['align']; })}>
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </Field>
      <Field label="Color">
        <ColorPicker value={color} onChange={(value) => actions.setProp((props: TextProps) => { props.color = value || undefined; })} />
      </Field>
      <Field label="Link">
        <Input value={linkHref} onChange={(event) => actions.setProp((props: TextProps) => { props.linkHref = event.target.value || undefined; })} />
      </Field>
      <div className="col-span-2">
        <Field label="Label prefix (inline)">
          <Input
            value={labelPrefix}
            placeholder="e.g. Tel: "
            onChange={(event) => actions.setProp((props: TextProps) => { props.labelPrefix = event.target.value || undefined; })}
          />
        </Field>
      </div>
    </div>
  );
}

Text.craft = {
  displayName: 'Text',
  props: {
    align: 'left',
    fontSize: 16,
    text: 'Body text',
  } satisfies TextProps,
  related: {
    settings: TextSettings,
  },
};
