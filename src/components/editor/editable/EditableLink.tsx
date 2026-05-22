'use client';
import { useEffect, useRef, useState } from 'react';
import { Link as LinkIcon } from 'lucide-react';
import { useEditorMode } from '../EditorModeProvider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface EditableLinkProps {
  value: string;
  onChange: (next: string) => void;
  ariaLabel: string;
  alwaysVisible?: boolean;
  /** When true, the trigger floats outside the normal inline flow so it does not
   *  contribute to its parent's width. Use this for CTA pencil icons where the
   *  edit affordance must not change the rendered button width vs preview. */
  floating?: boolean;
  className?: string;
}

export function EditableLink({
  value,
  onChange,
  ariaLabel,
  alwaysVisible,
  floating,
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

  const wrapperClass = floating
    ? `absolute -right-6 top-1/2 -translate-y-1/2 inline-flex items-center ${className ?? ''}`
    : `relative inline-flex items-center ${className ?? ''}`;

  return (
    <span ref={rootRef} className={wrapperClass}>
      <Tooltip open={open ? false : undefined}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={openPopover}
            aria-label={ariaLabel}
            className={`${visibilityClass} inline-flex items-center justify-center rounded p-0.5 text-ed-ink-3 hover:text-brand hover:bg-ed-panel`}
          >
            <LinkIcon size={14} />
          </button>
        </TooltipTrigger>
        <TooltipContent>Edit link</TooltipContent>
      </Tooltip>
      {open && (
        <span className="absolute z-50 left-0 top-full mt-1 inline-flex items-center gap-2 rounded-md border border-ed-rule-strong bg-ed-panel-2 p-2 shadow-lg whitespace-nowrap">
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
            className="rounded border border-ed-rule-strong bg-ed-panel px-2 py-1 text-xs text-ed-ink outline-none focus:border-brand"
            placeholder="https://"
          />
          <button type="button" onClick={save} className="rounded bg-brand px-2 py-1 text-xs text-white">Save</button>
          <button type="button" onClick={cancel} className="rounded border border-ed-rule-strong px-2 py-1 text-xs text-ed-ink">Cancel</button>
        </span>
      )}
    </span>
  );
}
