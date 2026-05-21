'use client';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { findHeader, findFooter, productSections } from '@/lib/editor/blocks';
import type { ProjectData } from '@/lib/editor/types';

type Stage = 'idle' | 'analysing' | 'review' | 'naming' | 'creating';

interface ParseResponse {
  data: ProjectData;
  warnings: { kind: string; severity: 'info' | 'warn' | 'error'; message: string }[];
}

export function ImportButton({ slug }: { slug: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [parsed, setParsed] = useState<ParseResponse | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  function pick() { inputRef.current?.click(); }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setStage('analysing');
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/import', { method: 'POST', body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null;
        setError(importErrorMessage(body?.error, res.status));
        setStage('idle');
        return;
      }
      const result = (await res.json()) as ParseResponse;
      setParsed(result);
      setName(file.name.replace(/\.html?$/i, ''));
      setStage('review');
    } catch {
      setError('Could not analyse this HTML file. Please try again.');
      setStage('idle');
    }
  }

  async function confirm() {
    if (!parsed) return;
    setStage('creating');
    const create = await fetch('/api/projects', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug, name: name || 'Imported campaign' }),
    });
    if (!create.ok) { setError('Could not create project.'); setStage('review'); return; }
    const { id } = await create.json();
    const patch = await fetch(`/api/projects/${id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data: parsed.data }),
    });
    if (!patch.ok) { setError('Could not save imported data.'); setStage('review'); return; }
    router.push(`/w/${slug}/p/${id}`);
  }

  return (
    <>
      <div className="flex flex-col items-start gap-2">
        <Button variant="secondary" onClick={pick} disabled={stage === 'analysing' || stage === 'creating'}>
          <Upload size={14} /> Import HTML
        </Button>
        {error && stage === 'idle' && <div className="text-xs text-danger">{error}</div>}
      </div>
      <input ref={inputRef} type="file" hidden accept=".html,text/html" onChange={onFile} />

      {typeof document !== 'undefined' && (stage === 'review' || stage === 'creating') && parsed && (() => {
        const header = findHeader(parsed.data.blocks);
        const footer = findFooter(parsed.data.blocks);
        const sections = productSections(parsed.data.blocks);
        return createPortal(
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6">
            <div className="bg-bg-elevated border border-rule-strong rounded-xl p-6 w-[560px] max-h-[85vh] overflow-auto">
              <div className="text-xs uppercase tracking-widest text-brand mb-2">Step 2 of 3 — Review</div>
              <h2 className="text-lg font-bold mb-4">We found:</h2>
              <ul className="text-sm space-y-1.5 mb-6">
                <Found ok={!!header.logoSrc} label="Logo image" />
                <Found ok={!!header.bannerSrc} label="Banner image" />
                <Found ok={!!header.title} label="Header title" />
                <Found ok={sections.length > 0} label={`${sections.length} product sections`} />
                <Found ok={!!footer.email} label="Footer details" />
                <Found ok={!!parsed.data.global.backgroundColor} label={`Background colour ${parsed.data.global.backgroundColor}`} />
                <Found ok={!!parsed.data.global.buttonColor} label={`Button colour ${parsed.data.global.buttonColor}`} />
              </ul>
              {parsed.warnings.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs uppercase tracking-widest text-ink-4 mb-1">Warnings</div>
                  <ul className="text-xs text-ink-3 space-y-1">
                    {parsed.warnings.map((w, i) => (
                      <li key={i} className={w.severity === 'error' ? 'text-danger' : ''}>· {w.message}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="text-xs uppercase tracking-widest text-brand mb-2">Step 3 of 3 — Name</div>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" className="mb-4" />
              {error && <div className="text-danger text-xs mb-3">{error}</div>}
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setStage('idle')}>Cancel</Button>
                <Button onClick={confirm} disabled={stage === 'creating' || sections.length === 0}>
                  {stage === 'creating' ? 'Creating…' : 'Open in Editor →'}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        );
      })()}

      {typeof document !== 'undefined' && stage === 'analysing' && createPortal(
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 text-ink text-sm">Analysing file…</div>,
        document.body,
      )}
    </>
  );
}

function importErrorMessage(error: string | undefined, status: number) {
  if (error === 'unauthorized' || status === 401) return 'Please sign in again before importing HTML.';
  if (error === 'too_large' || status === 413) return 'That HTML file is too large. Please use a file under 2 MB.';
  if (error === 'bad_type' || status === 415) return 'Please choose an HTML file.';
  if (error) return `Could not analyse this HTML file (${error}).`;
  return 'Could not analyse this HTML file. Please try again.';
}

function Found({ ok, label }: { ok: boolean; label: string }) {
  return <li className={ok ? 'text-success' : 'text-danger'}>{ok ? '✓' : '✗'} {label}</li>;
}
