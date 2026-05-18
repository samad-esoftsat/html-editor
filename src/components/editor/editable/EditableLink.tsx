'use client';
import { useEffect, useRef, useState } from 'react';
import { Link as LinkIcon } from 'lucide-react';
import { useEditorMode } from '../EditorModeProvider';

export interface EditableLinkProps {
  value: string;
  onChange: (next: string) => void;
  ariaLabel: string;
  alwaysVisible?: boolean;
  className?: string;
}

export function EditableLink({
  value,
  onChange,
  ariaLabel,
  alwaysVisible,
  className,
}: EditableLinkProps) {
  const { mode } = useEditorMode();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const rootRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (rootRef.current.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  if (mode === 'preview') return null;

  function openPopover(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDraft(value);
    setOpen(true);
  }

  function save() {
    onChange(draft);
    setOpen(false);
  }

  function cancel() {
    setOpen(false);
  }

  const visibilityClass = alwaysVisible ? 'opacity-100' : 'editable-link-icon';

  return (
    <span ref={rootRef} className={`relative inline-flex items-center ${className ?? ''}`}>
      <button
        type="button"
        onClick={openPopover}
        aria-label={ariaLabel}
        className={`${visibilityClass} inline-flex items-center justify-center rounded p-0.5 text-muted hover:text-brand hover:bg-panel`}
      >
        <LinkIcon size={14} />
      </button>
      {open && (
        <span className="absolute z-50 left-0 top-full mt-1 inline-flex items-center gap-2 rounded-md border border-border-strong bg-panel-2 p-2 shadow-lg whitespace-nowrap">
          <input
            type="text"
            role="textbox"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); save(); }
              if (e.key === 'Escape') { e.preventDefault(); cancel(); }
            }}
            className="rounded border border-border-strong bg-panel px-2 py-1 text-xs text-fg outline-none focus:border-brand"
            placeholder="https://"
          />
          <button type="button" onClick={save} className="rounded bg-brand px-2 py-1 text-xs text-white">Save</button>
          <button type="button" onClick={cancel} className="rounded border border-border-strong px-2 py-1 text-xs text-fg">Cancel</button>
        </span>
      )}
    </span>
  );
}
