'use client';
import { useEffect, useMemo, useState } from 'react';
import { Languages, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { fade, scaleFade } from '@/lib/motion';
import { LANGUAGES, getLanguage, isLanguageCode, type LanguageCode } from '@/lib/translate/languages';
import { translateProject } from '@/lib/api/projects';
import { toast } from '@/lib/utils/toast';

interface Props {
  projectId: string;
  projectName: string;
  slug: string;
}

export function TranslateMenu({ projectId, projectName, slug }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState<LanguageCode>('fr');
  const [name, setName] = useState('');
  const [tone, setTone] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abbrev = useMemo(() => getLanguage(language).abbrev, [language]);

  useEffect(() => {
    if (open) {
      setName(`${projectName} (${abbrev})`);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !pending) setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, pending]);

  async function submit() {
    if (!isLanguageCode(language)) return;
    setPending(true);
    setError(null);
    try {
      const { id } = await translateProject(projectId, {
        name: name.trim() || undefined,
        language,
        tone: tone.trim() || undefined,
      });
      toast.success('Translated project created');
      setOpen(false);
      router.push(`/w/${slug}/p/${id}`);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Translation failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-ed-rule-strong bg-ed-panel px-2.5 text-[12px] text-ed-ink-2 hover:text-ed-ink hover:bg-ed-panel-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        title="Translate to another language"
      >
        <Languages size={14} /> Translate
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-6"
            variants={fade}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            <motion.div
              className="bg-ed-panel-2 border border-ed-rule rounded-xl p-6 w-[460px] max-w-full shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]"
              variants={scaleFade}
              initial="hidden"
              animate="show"
              exit="exit"
            >
              <div className="font-semibold text-ed-ink mb-1">Translate project</div>
              <div className="text-xs text-ed-ink-3 mb-4">A new translated project will be created. The original is not modified.</div>

              <label className="mb-4 block text-xs font-medium text-ed-ink-3">
                <span className="mb-1 block">Target language</span>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as LanguageCode)}
                  disabled={pending}
                  className="w-full rounded border border-ed-rule bg-ed-panel px-2 py-1.5 text-sm text-ed-ink placeholder:text-ed-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-ed-brand-soft"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
              </label>

              <label className="mb-4 block text-xs font-medium text-ed-ink-3">
                <span className="mb-1 block">Name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={pending}
                  className="w-full rounded border border-ed-rule bg-ed-panel px-2 py-1.5 text-sm text-ed-ink placeholder:text-ed-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-ed-brand-soft"
                />
              </label>

              <label className="mb-4 block text-xs font-medium text-ed-ink-3">
                <span className="mb-1 block">Tone or extra instructions (optional)</span>
                <textarea
                  rows={2}
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  disabled={pending}
                  placeholder="e.g. keep tone friendly and casual"
                  className="w-full rounded border border-ed-rule bg-ed-panel px-2 py-1.5 text-sm text-ed-ink placeholder:text-ed-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-ed-brand-soft resize-none"
                />
              </label>

              {error && (
                <div className="mb-4 rounded border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
                  {error}
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
                <Button variant="primary" onClick={submit} disabled={pending}>
                  {pending ? <Loader2 size={14} className="animate-spin" /> : null}
                  {pending ? 'Translating…' : 'Translate'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
