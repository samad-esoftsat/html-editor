'use client';
import { useLayoutEffect, useRef } from 'react';
import { EditableText } from './EditableText';
import { useEditorMode } from '../EditorModeProvider';

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
    const el = e.currentTarget as HTMLElement;
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
      style={{ margin: 0, paddingLeft: '20px' }}
    >
      {items.map((b, i) => (
        <li
          key={i}
          role="listitem"
          className={liClassName}
          style={itemStyle}
          onKeyDown={(e) => onKeyDown(e, i)}
        >
          <EditableText
            value={b}
            onChange={(v) => commitIndex(i, v)}
            ariaLabel={`${ariaLabel} item ${i + 1}`}
            placeholder=""
            singleLine={false}
          />
        </li>
      ))}
    </ul>
  );
}
