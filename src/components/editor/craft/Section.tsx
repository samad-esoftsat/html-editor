import { useNode } from '@craftjs/core';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { Field } from '@/components/ui/Field';
import { NumberInput } from '@/components/ui/NumberInput';
import type { SectionProps } from '@/lib/editor/types';
import { paperMetricsFor } from '@/lib/editor/types';
import { resolveColorToken } from './brandTokens';
import { useRenderContext } from './RenderContext';

export function Section({
  backgroundColor,
  brandToken,
  paddingX = 16,
  paddingY = 16,
  children,
}: SectionProps) {
  const { connectors, role } = useNode((node) => ({
    role: typeof node.data.custom?.role === 'string' ? node.data.custom.role : undefined,
  }));
  const { global, target } = useRenderContext();
  const resolvedBackground = resolveColorToken(brandToken, global) ?? backgroundColor;

  if (target === 'email') {
    return (
      <table
        role="presentation"
        width="100%"
        border={0}
        cellPadding={0}
        cellSpacing={0}
        style={resolvedBackground ? { backgroundColor: resolvedBackground } : undefined}
      >
        <tbody>
          <tr>
            <td>
              <table
                role="presentation"
                width="100%"
                border={0}
                cellPadding={0}
                cellSpacing={0}
                style={{ margin: '0 auto', maxWidth: 710, width: '100%' }}
              >
                <tbody>
                  <tr>
                    <td style={{ padding: `${paddingY}px ${paddingX}px` }}>{children}</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    );
  }

  return (
    <section
      ref={(element) => {
        if (element) {
          connectors.connect(element);
        }
      }}
      data-craft-section
      data-section-role={role}
      style={{ backgroundColor: resolvedBackground, padding: `${paddingY}px ${paddingX}px` }}
    >
      <div style={{ margin: '0 auto', maxWidth: global ? paperMetricsFor(global).contentWidthPx : 688 }}>{children}</div>
    </section>
  );
}

function SectionSettings() {
  const { actions, backgroundColor = '', brandToken, paddingX = 16, paddingY = 16 } = useNode((node) => {
    const props = node.data.props as SectionProps;
    return props;
  });

  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Background">
        <ColorPicker
          value={backgroundColor}
          onChange={(value) => actions.setProp((props: SectionProps) => {
            props.backgroundColor = value || undefined;
          })}
        />
      </Field>
      <Field label="Padding X">
        <NumberInput
          value={paddingX}
          onChange={(value) => actions.setProp((props: SectionProps) => {
            props.paddingX = value;
          })}
          min={0}
          max={64}
        />
      </Field>
      <Field label="Padding Y">
        <NumberInput
          value={paddingY}
          onChange={(value) => actions.setProp((props: SectionProps) => {
            props.paddingY = value;
          })}
          min={0}
          max={64}
        />
      </Field>
      <Field label="Brand token">
        <select
          className="h-10 w-full rounded-md border border-ed-rule bg-ed-panel px-3 text-sm"
          value={brandToken ?? ''}
          onChange={(event) => actions.setProp((props: SectionProps) => {
            props.brandToken = event.target.value ? (event.target.value as SectionProps['brandToken']) : undefined;
          })}
        >
          <option value="">None</option>
          <option value="footerBg">Footer background</option>
          <option value="accent">Accent</option>
        </select>
      </Field>
    </div>
  );
}

Section.craft = {
  displayName: 'Section',
  props: {
    paddingX: 16,
    paddingY: 16,
  } satisfies SectionProps,
  related: {
    settings: SectionSettings,
  },
  rules: {
    canDrag: (node: { data: { props: SectionProps } }) => node.data.props.locked !== true,
    canMoveIn: (incoming: Array<{ data: { type: { resolvedName?: string } } }>) =>
      incoming.every((node) => node.data.type.resolvedName === 'Row'),
  },
};
