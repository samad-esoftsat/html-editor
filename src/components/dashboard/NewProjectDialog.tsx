'use client';

import { useEffect, useState } from 'react';
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

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-6"
          onClick={() => { if (!busy) onClose(); }}
          variants={fade}
          initial="hidden"
          animate="show"
          exit="exit"
        >
          <motion.div
            className="bg-panel border border-border-strong rounded-xl p-6 w-[560px] max-w-full"
            onClick={(e) => e.stopPropagation()}
            variants={scaleFade}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            <div className="font-semibold text-fg mb-1">Start a new project</div>
            <div className="text-sm text-muted mb-5">Pick a template to start from.</div>

            <div className="mb-5">
              <label className="block text-xs font-medium uppercase tracking-[0.14em] text-muted mb-1.5">
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

            <div className="grid grid-cols-2 gap-3 mb-6">
              {TEMPLATES.map((t) => {
                const active = selected === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelected(t.id)}
                    className={cn(
                      'text-left rounded-lg p-4 border transition',
                      active
                        ? 'border-brand bg-panel-2'
                        : 'border-border-strong bg-panel-2 hover:border-brand',
                    )}
                  >
                    <div className="font-semibold text-fg">{t.label}</div>
                    <div className="text-xs text-muted mt-1">{t.description}</div>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
              <Button onClick={go} disabled={busy}>
                {busy ? <Spinner /> : 'Create project'}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
