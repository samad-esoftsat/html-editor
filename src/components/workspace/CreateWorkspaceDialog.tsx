'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Input } from '@/components/ui/Input';
import { Field } from '@/components/ui/Field';
import { fade, scaleFade } from '@/lib/motion';
import { toast } from '@/lib/utils/toast';

interface Props {
  open: boolean;
  onClose: () => void;
}

const SLUG_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 40);
}

function validateSlug(slug: string): string | null {
  if (slug.length < 3) return 'Slug must be at least 3 characters.';
  if (slug.length > 40) return 'Slug must be 40 characters or fewer.';
  if (!SLUG_RE.test(slug)) return 'Lowercase letters, digits, and hyphens only.';
  return null;
}

export function CreateWorkspaceDialog({ open, onClose }: Props) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setSlug('');
      setSlugEdited(false);
      setError(null);
      requestAnimationFrame(() => nameRef.current?.focus());
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

  function onNameChange(value: string) {
    setName(value);
    if (!slugEdited) setSlug(slugify(value));
    if (error) setError(null);
  }

  function onSlugChange(value: string) {
    setSlugEdited(true);
    setSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
    if (error) setError(null);
  }

  const trimmedName = name.trim();
  const slugError = slug ? validateSlug(slug) : null;
  const canSubmit = !busy && trimmedName.length > 0 && slug.length >= 3 && !slugError;

  async function go() {
    if (!canSubmit) return;
    const validation = validateSlug(slug);
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: trimmedName, slug }),
      });
      const body = (await res.json().catch(() => ({}))) as { slug?: string; error?: string };
      if (!res.ok) {
        if (res.status === 409 || body.error === 'slug_taken') {
          setError('That slug is already taken.');
          setBusy(false);
          return;
        }
        if (res.status === 400 && body.error === 'invalid_slug') {
          setError('Invalid slug. Use lowercase letters, digits, and hyphens.');
          setBusy(false);
          return;
        }
        throw new Error(body.error ?? 'Failed');
      }
      toast.success(`Workspace "${trimmedName}" created`);
      router.push(`/w/${body.slug ?? slug}`);
    } catch (e) {
      toast.error(`Couldn't create workspace: ${(e as Error).message}`);
      setBusy(false);
    }
  }

  return (
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
            className="w-[480px] max-w-full rounded-[14px] border border-rule bg-bg-elevated p-6 shadow-[0_30px_80px_-20px_rgba(20,20,20,0.25)]"
            onClick={(e) => e.stopPropagation()}
            variants={scaleFade}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            <div className="mb-1 text-[20px] font-semibold tracking-[-0.01em] text-ink">New workspace</div>
            <div className="text-sm text-ink-3 mb-5">
              Workspaces hold projects, brand kits, and members.
            </div>

            <div className="flex flex-col gap-4 mb-5">
              <Field label="Name">
                <Input
                  ref={nameRef}
                  value={name}
                  onChange={(e) => onNameChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && canSubmit) go();
                  }}
                  placeholder="Acme Marketing"
                  disabled={busy}
                  maxLength={80}
                />
              </Field>
              <Field label="Slug">
                <Input
                  value={slug}
                  onChange={(e) => onSlugChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && canSubmit) go();
                  }}
                  placeholder="acme-marketing"
                  disabled={busy}
                  maxLength={40}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                />
                <div className="mt-1 text-[11px] text-ink-3">
                  Used in URLs: <span className="font-mono">/w/{slug || 'your-slug'}</span>
                </div>
              </Field>
              {(error || slugError) && (
                <div className="text-xs text-danger">{error ?? slugError}</div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={go} disabled={!canSubmit}>
                {busy ? <Spinner /> : 'Create workspace'}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
