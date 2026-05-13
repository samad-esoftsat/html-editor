'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { CreateWorkspaceDialog } from './CreateWorkspaceDialog';

export interface WorkspaceOption {
  id: string;
  slug: string;
  name: string;
}

interface Props {
  current: WorkspaceOption;
  workspaces: WorkspaceOption[];
}

export function WorkspaceSwitcher({ current, workspaces }: Props) {
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 rounded-md border border-border-strong bg-panel-2 px-2.5 py-1.5 text-xs font-medium text-fg transition-colors hover:border-brand hover:bg-panel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <span className="max-w-[160px] truncate">{current.name}</span>
          <ChevronsUpDown size={12} className="text-muted-2" />
        </button>
        {open && (
          <div
            role="menu"
            className="absolute left-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-lg border border-border-strong bg-panel-2 shadow-xl shadow-black/40"
          >
            <div className="border-b border-border px-3 py-2 text-[10px] uppercase tracking-widest text-muted-2">
              Workspaces
            </div>
            <div className="max-h-72 overflow-y-auto py-1">
              {workspaces.map((w) => {
                const active = w.id === current.id;
                return (
                  <Link
                    key={w.id}
                    href={`/w/${w.slug}`}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-center justify-between gap-2 px-3 py-1.5 text-sm transition-colors',
                      active ? 'bg-panel text-fg' : 'text-fg hover:bg-panel',
                    )}
                  >
                    <span className="truncate">{w.name}</span>
                    {active && <Check size={14} className="shrink-0 text-brand" />}
                  </Link>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => { setOpen(false); setDialog(true); }}
              className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-sm text-brand transition-colors hover:bg-panel focus-visible:bg-panel focus-visible:outline-none"
            >
              <Plus size={14} /> New workspace
            </button>
          </div>
        )}
      </div>
      <CreateWorkspaceDialog open={dialog} onClose={() => setDialog(false)} />
    </>
  );
}
