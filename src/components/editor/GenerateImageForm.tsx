'use client';

import { useRef, useState } from 'react';
import { generateImage, ImageApiError, type GeneratedAsset } from '@/lib/api/images';
import { createRequestKey } from '@/lib/images/request-key';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { Textarea } from '@/components/ui/Textarea';

interface Props {
  workspaceSlug: string;
  canEdit: boolean;
  onUse(asset: GeneratedAsset): void;
  onGenerated(): void;
}

export function GenerateImageForm({ workspaceSlug, canEdit, onUse, onGenerated }: Props) {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16' | '4:3'>('16:9');
  const [count, setCount] = useState<1 | 2 | 4>(1);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<GeneratedAsset[]>([]);
  const requestKeyRef = useRef<string | undefined>(undefined);

  async function onSubmit() {
    if (!canEdit || !prompt.trim()) return;
    setBusy(true);
    setError(null);
    const requestKey = requestKeyRef.current ?? createRequestKey();
    requestKeyRef.current = requestKey;
    const started = Date.now();
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    try {
      const result = await generateImage({
        prompt: prompt.trim(),
        aspectRatio,
        count,
        workspaceSlug,
        requestKey,
      });
      requestKeyRef.current = undefined;
      setAssets(result.assets);
      onGenerated();
    } catch (error) {
      if (error instanceof ImageApiError) {
        if (error.code === 'quota_exhausted') {
          setError('Quota exhausted for this month.');
        } else if (error.code === 'still_processing') {
          setError('Request still processing. Please wait.');
        } else if (error.status === 403) {
          setError("You don't have permission to generate images.");
        } else {
          setError(error.message || 'Provider unavailable, try again.');
        }
      } else if (error instanceof Error && error.name === 'AbortError') {
        setError('Still processing. Check status or retry safely.');
      } else {
        setError(error instanceof Error ? error.message : 'Provider unavailable, try again.');
      }
    } finally {
      window.clearInterval(timer);
      setBusy(false);
      setElapsed(0);
    }
  }

  return (
    <div className="space-y-3">
      <Textarea
        rows={4}
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="Describe the image you want to create..."
        disabled={!canEdit || busy}
      />
      <div className="grid grid-cols-2 gap-2">
        <Select
          value={aspectRatio}
          onChange={(event) => setAspectRatio(event.target.value as typeof aspectRatio)}
          disabled={!canEdit || busy}
        >
          <option value="1:1">1:1</option>
          <option value="16:9">16:9</option>
          <option value="9:16">9:16</option>
          <option value="4:3">4:3</option>
        </Select>
        <Select
          value={String(count)}
          onChange={(event) => setCount(Number(event.target.value) as 1 | 2 | 4)}
          disabled={!canEdit || busy}
        >
          <option value="1">1 variant</option>
          <option value="2">2 variants</option>
          <option value="4">4 variants</option>
        </Select>
      </div>
      <Button
        type="button"
        variant="secondary"
        onClick={onSubmit}
        disabled={!canEdit || busy || !prompt.trim()}
        className="w-full"
      >
        {busy ? <><Spinner size={14} /> Generating {elapsed > 0 ? `(${elapsed}s)` : ''}</> : 'Generate'}
      </Button>
      {error && <div className="text-xs text-danger">{error}</div>}
      {assets.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {assets.map((asset) => (
            <button
              key={asset.assetId}
              type="button"
              className="overflow-hidden rounded-md border border-border-strong bg-panel-2 text-left"
              onClick={() => onUse(asset)}
            >
              <img src={asset.url} alt="" className="h-28 w-full object-cover" />
              <div className="px-2 py-1 text-xs text-muted">Use image</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
