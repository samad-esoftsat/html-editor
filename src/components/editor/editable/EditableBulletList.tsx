'use client';
import { useLayoutEffect, useRef } from 'react';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { EditableText } from './EditableText';
import { useEditorMode } from '../EditorModeProvider';
import { useDragSensors } from '../canvas/useDragSensors';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface EditableBulletListProps {
  bullets: string[];
  onChange: (next: string[]) => void;
  ariaLabel: string;
  itemStyle?: React.CSSProperties;
  className?: string;
  liClassName?: string;
}

function caretAtStart(el: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return true;
  const r = sel.getRangeAt(0);
  if (!r.collapsed) return false;
  if (r.startOffset !== 0) return false;
  let node: Node | null = r.startContainer;
  while (node && node !== el) {
    if (node.previousSibling) return false;
    node = node.parentNode;
  }
  return node === el;
}

export function EditableBulletList({
  bullets,
  onChange,
  ariaLabel,
  itemStyle,
  className,
  liClassName,
}: EditableBulletListProps) {
  const { mode } = useEditorMode();
  const items = bullets.length > 0 ? bullets : [''];
  const focusRequest = useRef<{ index: number; caret: 'start' | 'end' } | null>(null);
  const ulRef = useRef<HTMLUListElement | null>(null);

  useLayoutEffect(() => {
    const req = focusRequest.current;
    if (!req) return;
    focusRequest.current = null;
    const ul = ulRef.current;
    if (!ul) return;
    const li = ul.children[req.index] as HTMLElement | undefined;
    if (!li) return;
    const target = li.querySelector('[role="textbox"]') as HTMLElement | null;
    if (!target) return;
    target.focus();
    const sel = window.getSelection();
    const range = document.createRange();
    if (req.caret === 'start') {
      range.setStart(target, 0);
    } else {
      range.selectNodeContents(target);
      range.collapse(false);
    }
    sel?.removeAllRanges();
    sel?.addRange(range);
  });

  function commitIndex(index: number, next: string) {
    if (bullets.length === 0 && next === '') return;
    const arr = bullets.length === 0 ? [''] : bullets.slice();
    arr[index] = next;
    onChange(arr);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLElement>, index: number) {
    // Find the actual contenteditable (textbox) so that caretAtStart works
    // correctly even when the <li> contains a preceding grip button.
    const li = e.currentTarget as HTMLElement;
    const textbox = li.querySelector('[role="textbox"]') as HTMLElement | null;
    const el = textbox ?? li;
    if (e.key === 'Enter') {
      e.preventDefault();
      const currentText = el.textContent ?? '';
      const arr = items.slice();
      arr[index] = currentText;
      arr.splice(index + 1, 0, '');
      focusRequest.current = { index: index + 1, caret: 'start' };
      onChange(arr);
      return;
    }
    if (e.key === 'Backspace' && caretAtStart(el)) {
      const currentText = el.textContent ?? '';
      if (items.length === 1) {
        return;
      }
      e.preventDefault();
      const arr = items.slice();
      if (currentText.length === 0) {
        arr.splice(index, 1);
        const focusIndex = Math.max(0, index - 1);
        focusRequest.current = { index: focusIndex, caret: 'end' };
        onChange(arr);
      } else if (index > 0) {
        const prev = arr[index - 1];
        arr[index - 1] = prev + currentText;
        arr.splice(index, 1);
        focusRequest.current = { index: index - 1, caret: 'end' };
        onChange(arr);
      }
    }
  }

  const sensors = useDragSensors();
  const ids = items.map((_, i) => `${ariaLabel}::${i}`);

  function onBulletDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(arrayMove(items, oldIndex, newIndex));
  }

  if (mode === 'preview') {
    return (
      <ul role="list" aria-label={ariaLabel} className={className} style={{ margin: '1em 0', paddingLeft: 40 }}>
        {items.map((b, i) => (
          <li key={i} className={liClassName} style={itemStyle}>{b}</li>
        ))}
      </ul>
    );
  }

  return (
    <ul
      ref={ulRef}
      role="list"
      aria-label={ariaLabel}
      data-bullet-list={ariaLabel}
      className={className}
      style={{ margin: '1em 0', paddingLeft: '40px' }}
    >
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onBulletDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {items.map((b, i) => (
            <SortableBulletItem
              key={ids[i]}
              id={ids[i]}
              index={i}
              bullet={b}
              ariaLabel={ariaLabel}
              itemStyle={itemStyle}
              liClassName={liClassName}
              onKeyDown={onKeyDown}
              onChangeText={commitIndex}
            />
          ))}
        </SortableContext>
      </DndContext>
    </ul>
  );
}

function SortableBulletItem({
  id,
  index,
  bullet,
  ariaLabel,
  itemStyle,
  liClassName,
  onKeyDown,
  onChangeText,
}: {
  id: string;
  index: number;
  bullet: string;
  ariaLabel: string;
  itemStyle?: React.CSSProperties;
  liClassName?: string;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>, index: number) => void;
  onChangeText: (index: number, next: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    ...itemStyle,
  };
  return (
    <li
      ref={setNodeRef}
      role="listitem"
      className={`bullet-row ${liClassName ?? ''}`}
      style={style}
      onKeyDown={(e) => onKeyDown(e, index)}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Drag to reorder bullet"
            className="bullet-grip inline-flex items-center justify-center cursor-grab active:cursor-grabbing text-ed-ink-3 hover:text-brand p-1"
            {...attributes}
            {...(listeners as Record<string, unknown> | undefined ?? {})}
          >
            <GripVertical size={14} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">Drag to reorder bullet</TooltipContent>
      </Tooltip>
      <EditableText
        value={bullet}
        onChange={(v) => onChangeText(index, v)}
        ariaLabel={`${ariaLabel} item ${index + 1}`}
        placeholder=""
        singleLine={false}
      />
    </li>
  );
}
