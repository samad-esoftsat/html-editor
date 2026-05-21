'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { fade, scaleFade } from '@/lib/motion';
import { createProject } from '@/lib/api/projects';
import { TEMPLATES } from '@/lib/editor/templates';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/lib/utils/toast';
import { BrandKitPicker } from '@/components/brand-kit/BrandKitPicker';

interface Props {
  open: boolean;
  onClose: () => void;
  slug: string;
}

export function NewProjectDialog({ open, onClose, slug }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string>(TEMPLATES[0].id);
  const [brandKitId, setBrandKitId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setSelected(TEMPLATES[0].id);
      setBrandKitId(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  async function go() {
    setBusy(true);
    try {
      const project = await createProject(slug, undefined, selected, brandKitId);
      router.push(`/w/${slug}/p/${project.id}`);
    } catch (e) {
      toast.error(`Couldn't create project: ${(e as Error).message}`);
      setBusy(false);
    }
  }

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-ink/40 backdrop-blur-sm p-6"
          onClick={() => { if (!busy) onClose(); }}
          variants={fade}
          initial="hidden"
          animate="show"
          exit="exit"
        >
          <motion.div
            className="w-[560px] max-w-full rounded-[14px] border border-rule bg-bg-elevated p-6 shadow-[0_30px_80px_-20px_rgba(20,20,20,0.25)]"
            onClick={(e) => e.stopPropagation()}
            variants={scaleFade}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            <div className="mb-1 text-[20px] font-semibold tracking-[-0.01em] text-ink">Start a new project</div>
            <div className="text-sm text-ink-3 mb-5">Pick a template to start from.</div>

            <div className="mb-5">
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.05em] text-ink-3">
                Brand kit
              </label>
              <BrandKitPicker
                slug={slug}
                value={brandKitId}
                onChange={setBrandKitId}
                disabled={busy}
                autoSelectDefault
              />
            </div>

            {(['Quick start', 'Layouts'] as const).map((group) => {
              const entries = TEMPLATES.filter((t) => t.group === group);
              if (entries.length === 0) return null;
              return (
                <section key={group} className="mb-5">
                  <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.05em] text-ink-3">{group}</div>
                  <div className="grid grid-cols-2 gap-3">
                    {entries.map((t) => {
                      const active = selected === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSelected(t.id)}
                          className={cn(
                            'text-left rounded-lg p-4 border transition',
                            active
                              ? 'border-brand bg-bg-sunken'
                              : 'border-rule bg-bg-sunken hover:border-brand',
                          )}
                        >
                          <div className="font-semibold text-ink">{t.label}</div>
                          <div className="text-xs text-ink-3 mt-1">{t.description}</div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
              <Button onClick={go} disabled={busy}>
                {busy ? <Spinner /> : 'Create project'}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
