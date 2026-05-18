'use client';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { fade } from '@/lib/motion';

interface Props {
  projectId: string;
  slug: string;
}

export function DownloadMenu({ projectId, slug }: Props) {
  const [open, setOpen] = useState(false);
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
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium bg-brand text-white shadow-sm shadow-brand/20 hover:bg-brand/90 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Download size={14} /> Download <ChevronDown size={14} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            variants={fade}
            initial="hidden"
            animate="show"
            exit="exit"
            className="absolute right-0 top-full mt-1 w-64 rounded-md border border-border-strong bg-panel shadow-lg shadow-black/30 overflow-hidden z-50"
            role="menu"
          >
            <a
              href={`/api/projects/${projectId}/export`}
              download
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm text-fg hover:bg-panel-2"
              role="menuitem"
            >
              <div className="font-medium">HTML (for email)</div>
              <div className="text-xs text-muted-2">Image URLs intact, smallest file.</div>
            </a>
            <a
              href={`/api/projects/${projectId}/export?embed=1`}
              download
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm text-fg hover:bg-panel-2 border-t border-border"
              role="menuitem"
            >
              <div className="font-medium">HTML (offline, with images)</div>
              <div className="text-xs text-muted-2">Self-contained, larger file.</div>
            </a>
            <a
              href={`/w/${slug}/p/${projectId}/print`}
              target="_blank"
              rel="noopener"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm text-fg hover:bg-panel-2 border-t border-border"
              role="menuitem"
            >
              <div className="font-medium">PDF (for printing)</div>
              <div className="text-xs text-muted-2">Opens print preview in a new tab.</div>
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
