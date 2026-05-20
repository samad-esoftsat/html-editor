'use client';

import { useRef, useState } from 'react';
import { X } from 'lucide-react';
import { generateImage, ImageApiError, type GeneratedAsset } from '@/lib/api/images';
import { uploadWorkspaceAsset } from '@/lib/api/assets';
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

const MAX_REFERENCES = 3;

type Reference = { assetId: string; url: string };

export function GenerateImageForm({ workspaceSlug, canEdit, onUse, onGenerated }: Props) {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16' | '4:3'>('16:9');
  const [count, setCount] = useState<1 | 2 | 4>(1);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<GeneratedAsset[]>([]);
  const [references, setReferences] = useState<Reference[]>([]);
  const [refUploadBusy, setRefUploadBusy] = useState(false);
  const [useGoogleSearch, setUseGoogleSearch] = useState(false);
  const requestKeyRef = useRef<string | undefined>(undefined);
  const refInputRef = useRef<HTMLInputElement | null>(null);

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
        referenceAssetIds: references.map((r) => r.assetId),
        useGoogleSearch,
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

  async function onAddReference(file: File) {
    if (references.length >= MAX_REFERENCES) return;
    setRefUploadBusy(true);
    setError(null);
    try {
      const uploaded = await uploadWorkspaceAsset(workspaceSlug, file);
      setReferences((prev) => [...prev, { assetId: uploaded.assetId, url: uploaded.url }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to attach reference.');
    } finally {
      setRefUploadBusy(false);
      if (refInputRef.current) refInputRef.current.value = '';
    }
  }

  function onRemoveReference(assetId: string) {
    setReferences((prev) => prev.filter((r) => r.assetId !== assetId));
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
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-ed-ink">Reference images (optional)</div>
          <div className="text-xs text-ed-ink-3">{references.length}/{MAX_REFERENCES}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {references.map((ref) => (
            <div key={ref.assetId} className="relative h-16 w-16 overflow-hidden rounded-md border border-ed-rule-strong bg-ed-panel-2">
              <img src={ref.url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => onRemoveReference(ref.assetId)}
                disabled={busy}
                className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80 disabled:opacity-50"
                aria-label="Remove reference"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          {references.length < MAX_REFERENCES && (
            <button
              type="button"
              onClick={() => refInputRef.current?.click()}
              disabled={!canEdit || busy || refUploadBusy}
              className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed border-ed-rule-strong bg-ed-panel-2 text-xs text-ed-ink-3 hover:border-brand hover:text-ed-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              {refUploadBusy ? <Spinner size={14} /> : '+ Add'}
            </button>
          )}
        </div>
        <input
          ref={refInputRef}
          type="file"
          hidden
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onAddReference(file);
          }}
        />
        {references.length > 0 && (
          <div className="text-xs text-ed-ink-3">References guide the style or subject of the output.</div>
        )}
      </div>
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
      <label className="flex items-start gap-2 text-xs text-ed-ink">
        <input
          type="checkbox"
          checked={useGoogleSearch}
          onChange={(event) => setUseGoogleSearch(event.target.checked)}
          disabled={!canEdit || busy}
          className="mt-0.5 h-3.5 w-3.5 cursor-pointer accent-brand"
        />
        <span>
          <span className="font-medium">Use Google Search</span>
          <span className="ml-1 text-ed-ink-3">— ground in web + image search results (slower; great for current events, brands, real places).</span>
        </span>
      </label>
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
              className="overflow-hidden rounded-md border border-ed-rule-strong bg-ed-panel-2 text-left"
              onClick={() => onUse(asset)}
            >
              <img src={asset.url} alt="" className="h-28 w-full object-cover" />
              <div className="px-2 py-1 text-xs text-ed-ink-3">Use image</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
