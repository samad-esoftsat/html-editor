'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { createProject } from '@/lib/api/projects';
import { TEMPLATES } from '@/lib/editor/templates';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/lib/utils/toast';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function NewProjectDialog({ open, onClose }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string>(TEMPLATES[0].id);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setSelected(TEMPLATES[0].id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  async function go() {
    setBusy(true);
    try {
      const project = await createProject(undefined, selected);
      router.push(`/p/${project.id}`);
    } catch (e) {
      toast.error(`Couldn't create project: ${(e as Error).message}`);
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-6"
      onClick={() => { if (!busy) onClose(); }}
    >
      <div
        className="bg-panel border border-border-strong rounded-xl p-6 w-[560px] max-w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-semibold text-fg mb-1">Start a new project</div>
        <div className="text-sm text-muted mb-5">Pick a template to start from.</div>

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
      </div>
    </div>
  );
}
