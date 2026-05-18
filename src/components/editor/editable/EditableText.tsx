'use client';
import React, { useEffect, useRef } from 'react';

export interface EditableTextProps {
  value: string;
  onChange: (next: string) => void;
  singleLine?: boolean;
  placeholder?: string;
  ariaLabel: string;
  className?: string;
  style?: React.CSSProperties;
  as?: keyof React.JSX.IntrinsicElements;
}

export function EditableText({
  value,
  onChange,
  singleLine,
  placeholder,
  ariaLabel,
  className,
  style,
  as,
}: EditableTextProps) {
  const ref = useRef<HTMLElement | null>(null);
  const committedRef = useRef<string>(value);

  useEffect(() => {
    committedRef.current = value;
    const el = ref.current;
    if (!el) return;
    if (document.activeElement !== el) {
      el.textContent = value;
    }
  }, [value]);

  function commit() {
    const el = ref.current;
    if (!el) return;
    const next = el.textContent ?? '';
    if (next === committedRef.current) return;
    committedRef.current = next;
    onChange(next);
  }

  function revert() {
    const el = ref.current;
    if (!el) return;
    el.textContent = committedRef.current;
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      revert();
      (e.currentTarget as HTMLElement).blur();
      return;
    }
    if (e.key === 'Enter' && singleLine) {
      e.preventDefault();
      commit();
      (e.currentTarget as HTMLElement).blur();
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      range.collapse(false);
    } else {
      const el = ref.current;
      if (el) el.textContent = (el.textContent ?? '') + text;
    }
  }

  const Tag = (as ?? 'span') as React.ElementType;
  const isEmpty = value.length === 0;
  const baseClass = [
    'inline-editable',
    'outline-none',
    isEmpty ? 'opacity-50' : '',
    className ?? '',
  ].filter(Boolean).join(' ');

  return (
    <Tag
      ref={ref as React.Ref<HTMLElement> & React.Ref<HTMLSpanElement>}
      role="textbox"
      aria-label={ariaLabel}
      aria-multiline={!singleLine}
      aria-placeholder={placeholder}
      data-empty={isEmpty ? 'true' : 'false'}
      contentEditable
      suppressContentEditableWarning
      onBlur={commit}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      className={baseClass}
      style={style}
    >
      {value}
    </Tag>
  );
}
