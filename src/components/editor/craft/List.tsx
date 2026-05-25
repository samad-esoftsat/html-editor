import { useEffect, useRef } from 'react';
import { useNode } from '@craftjs/core';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { Field } from '@/components/ui/Field';
import { NumberInput } from '@/components/ui/NumberInput';
import { Textarea } from '@/components/ui/Textarea';
import type { ListProps } from '@/lib/editor/types';
import { resolveColorToken } from './brandTokens';
import { textAlignFor, useConnectedRef } from './internals';
import { useRenderContext } from './RenderContext';

export function List({ items, ordered = false, fontSize, color, brandToken, align = 'left' }: ListProps) {
  const { global, target } = useRenderContext();
  const resolvedColor = resolveColorToken(brandToken, global) ?? color ?? global?.textColor;
  const ref = useConnectedRef();
  const { actions } = useNode();
  const Tag = ordered ? 'ol' : 'ul';

  const setItem = (index: number, next: string) => {
    actions.setProp((props: ListProps) => {
      const copy = props.items.slice();
      copy[index] = next;
      props.items = copy;
    });
  };

  const setItems = (next: string[]) => {
    actions.setProp((props: ListProps) => {
      props.items = next;
    });
  };

  return (
    <Tag ref={ref} style={{ color: resolvedColor, fontSize, margin: '0 0 12px', paddingLeft: 20, textAlign: textAlignFor(align) }}>
      {items.map((item, index) => (
        <EditableListItem
          key={index}
          value={item}
          editable={target === 'editor'}
          onChange={(next) => setItem(index, next)}
          onEnter={() => {
            const next = [...items];
            next.splice(index + 1, 0, '');
            setItems(next);
          }}
          onBackspaceEmpty={() => {
            if (items.length <= 1) return;
            const next = items.filter((_, i) => i !== index);
            setItems(next);
          }}
        />
      ))}
    </Tag>
  );
}

function EditableListItem({
  value,
  editable,
  onChange,
  onEnter,
  onBackspaceEmpty,
}: {
  value: string;
  editable: boolean;
  onChange: (next: string) => void;
  onEnter: () => void;
  onBackspaceEmpty: () => void;
}) {
  const elRef = useRef<HTMLLIElement | null>(null);
  const last = useRef(value);

  useEffect(() => {
    const el = elRef.current;
    if (!editable || !el) return;
    if (document.activeElement === el) return;
    if (el.innerText !== value) el.innerText = value;
    last.current = value;
  }, [value, editable]);

  return (
    <li
      ref={elRef}
      contentEditable={editable}
      suppressContentEditableWarning
      style={{ outline: 'none' }}
      onMouseDown={(e) => { if (editable) e.stopPropagation(); }}
      onInput={(e) => {
        const next = (e.currentTarget as HTMLElement).innerText;
        if (next !== last.current) {
          last.current = next;
          onChange(next);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onEnter();
        } else if (e.key === 'Backspace' && (e.currentTarget as HTMLElement).innerText === '') {
          e.preventDefault();
          onBackspaceEmpty();
        } else if (e.key === 'Escape') {
          (e.currentTarget as HTMLElement).blur();
        }
      }}
    >
      {value}
    </li>
  );
}

function ListSettings() {
  const { actions, color = '', fontSize = 16, items = [], ordered = false } = useNode((node) => node.data.props as ListProps);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <Field label="Items">
          <Textarea
            rows={6}
            value={items.join('\n')}
            onChange={(event) => actions.setProp((props: ListProps) => {
              props.items = event.target.value.split('\n');
            })}
          />
        </Field>
      </div>
      <Field label="Ordered">
        <label className="flex h-10 items-center gap-2 rounded-md border border-ed-rule px-3 text-sm">
          <input checked={ordered} type="checkbox" onChange={(event) => actions.setProp((props: ListProps) => { props.ordered = event.target.checked; })} />
          Numbered list
        </label>
      </Field>
      <Field label="Font size">
        <NumberInput value={fontSize} onChange={(value) => actions.setProp((props: ListProps) => { props.fontSize = value; })} min={10} max={36} />
      </Field>
      <Field label="Color">
        <ColorPicker value={color} onChange={(value) => actions.setProp((props: ListProps) => { props.color = value || undefined; })} />
      </Field>
    </div>
  );
}

List.craft = {
  displayName: 'List',
  props: {
    fontSize: 16,
    items: ['Item one', 'Item two'],
    ordered: false,
  } satisfies ListProps,
  related: {
    settings: ListSettings,
  },
};
