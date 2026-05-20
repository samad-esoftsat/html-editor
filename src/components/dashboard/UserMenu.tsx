'use client';

import { useEffect, useRef, useState } from 'react';
import { LogOut } from 'lucide-react';

interface Props {
  email: string | null | undefined;
}

export function UserMenu({ email }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initial = (email?.[0] ?? '?').toUpperCase();

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
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-[12px] font-semibold text-brand-ink transition-colors hover:bg-brand/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {initial}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-11 z-50 w-60 overflow-hidden rounded-lg border border-rule bg-bg-elevated shadow-[0_8px_24px_-12px_rgba(180,66,28,0.10)]"
        >
          <div className="border-b border-rule px-3 py-2.5">
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-ink-3">Signed in as</div>
            <div className="mt-0.5 truncate text-sm text-ink">{email ?? 'Unknown'}</div>
          </div>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-bg-sunken focus-visible:bg-bg-sunken focus-visible:outline-none"
            >
              <LogOut size={14} /> Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
