import { useNode } from '@craftjs/core';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import type { ButtonProps } from '@/lib/editor/types';
import { resolveColorToken } from './brandTokens';
import { marginForAlign, textAlignFor, useConnectedRef } from './internals';
import { useEditableNode } from './useEditableNode';
import { useRenderContext } from './RenderContext';

export function Button({ label, href, backgroundColor, color, brandToken, align = 'left' }: ButtonProps) {
  const { global, target } = useRenderContext();
  const resolvedBackground = resolveColorToken(brandToken, global) ?? backgroundColor ?? global?.buttonColor;
  const resolvedText = color ?? global?.buttonTextColor;
  const ref = useConnectedRef();
  const { actions } = useNode();
  const editable = useEditableNode(label, (next) => {
    actions.setProp((props: ButtonProps) => {
      props.label = next;
    });
  });

  if (target === 'email') {
    return (
      <table role="presentation" border={0} cellPadding={0} cellSpacing={0} style={{ margin: marginForAlign(align) }}>
        <tbody>
          <tr>
            <td
              style={{
                backgroundColor: resolvedBackground,
                borderRadius: 4,
                padding: '10px 18px',
                textAlign: textAlignFor(align),
              }}
            >
              <a
                href={href}
                ref={ref}
                style={{
                  color: resolvedText,
                  display: 'inline-block',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
                target="_blank"
                rel="noreferrer"
              >
                {label}
              </a>
            </td>
          </tr>
        </tbody>
      </table>
    );
  }

  if (target === 'editor') {
    return (
      <div ref={ref as unknown as React.Ref<HTMLDivElement>} style={{ width: '100%', textAlign: textAlignFor(align) }}>
        <span
          {...editable.props}
          style={{
            backgroundColor: resolvedBackground,
            borderRadius: 4,
            color: resolvedText,
            display: 'inline-block',
            padding: '10px 18px',
            textDecoration: 'none',
            outline: 'none',
            cursor: 'text',
          }}
        >
          {label}
        </span>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', textAlign: textAlignFor(align) }}>
      <a
        href={href}
        ref={ref}
        rel="noreferrer"
        style={{
          backgroundColor: resolvedBackground,
          borderRadius: 4,
          color: resolvedText,
          display: 'inline-block',
          padding: '10px 18px',
          textDecoration: 'none',
        }}
        target="_blank"
      >
        {label}
      </a>
    </div>
  );
}

function ButtonSettings() {
  const { actions, align = 'left', backgroundColor = '', color = '', href = '', label = '' } = useNode((node) => node.data.props as ButtonProps);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <Field label="Label">
          <Input value={label} onChange={(event) => actions.setProp((props: ButtonProps) => { props.label = event.target.value; })} />
        </Field>
      </div>
      <div className="col-span-2">
        <Field label="Href">
          <Input value={href} onChange={(event) => actions.setProp((props: ButtonProps) => { props.href = event.target.value || undefined; })} />
        </Field>
      </div>
      <Field label="Align">
        <select className="h-10 w-full rounded-md border border-ed-rule bg-ed-panel px-3 text-sm" value={align} onChange={(event) => actions.setProp((props: ButtonProps) => { props.align = event.target.value as ButtonProps['align']; })}>
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </Field>
      <Field label="Background">
        <ColorPicker value={backgroundColor} onChange={(value) => actions.setProp((props: ButtonProps) => { props.backgroundColor = value || undefined; })} />
      </Field>
      <Field label="Text color">
        <ColorPicker value={color} onChange={(value) => actions.setProp((props: ButtonProps) => { props.color = value || undefined; })} />
      </Field>
    </div>
  );
}

Button.craft = {
  displayName: 'Button',
  props: {
    align: 'left',
    label: 'Button',
  } satisfies ButtonProps,
  related: {
    settings: ButtonSettings,
  },
};
