'use client';

import { useRef, useState } from 'react';
import { CornerDownLeft } from 'lucide-react';
import type { WorkspaceAsset } from '@/lib/api/assets';
import { chatEditImage, ImageApiError, type ChatEditWireTurn, type GeneratedAsset } from '@/lib/api/images';
import { createRequestKey } from '@/lib/images/request-key';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Textarea } from '@/components/ui/Textarea';

interface Props {
  workspaceSlug: string;
  canEdit: boolean;
  seed: WorkspaceAsset;
  onUse(asset: GeneratedAsset): void;
  onTurnCommitted(): void;
}

type Turn =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'model'; assetId: string; url: string; thoughtSignature?: string };

const MAX_TURNS = 20;

export function ChatRefinePanel({ workspaceSlug, canEdit, seed, onUse, onTurnCommitted }: Props) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestKeyRef = useRef<string | undefined>(undefined);

  function buildWire(displayTurns: Turn[]): ChatEditWireTurn[] {
    const wire: ChatEditWireTurn[] = [];
    let attachedSeed = false;
    for (const turn of displayTurns) {
      if (turn.role === 'user') {
        if (!attachedSeed) {
          wire.push({ role: 'user', text: turn.text, imageAssetIds: [seed.id] });
          attachedSeed = true;
        } else {
          wire.push({ role: 'user', text: turn.text });
        }
        continue;
      }
      wire.push({
        role: 'model',
        assetId: turn.assetId,
        ...(turn.thoughtSignature ? { thoughtSignature: turn.thoughtSignature } : {}),
      });
    }
    return wire;
  }

  async function onSend() {
    const text = draft.trim();
    if (!canEdit || !text || busy) return;
    if (turns.length + 2 > MAX_TURNS) {
      setError(`Conversation limit reached (${MAX_TURNS} turns). Start a new refine session.`);
      return;
    }
    const userTurn: Turn = { id: `user-${Date.now()}`, role: 'user', text };
    const nextTurns = [...turns, userTurn];
    setTurns(nextTurns);
    setDraft('');
    setBusy(true);
    setError(null);
    const requestKey = requestKeyRef.current ?? createRequestKey();
    requestKeyRef.current = requestKey;

    try {
      const result = await chatEditImage({
        turns: buildWire(nextTurns),
        workspaceSlug,
        requestKey,
      });
      requestKeyRef.current = undefined;
      const modelTurn: Turn = {
        id: `model-${result.asset.assetId}`,
        role: 'model',
        assetId: result.asset.assetId,
        url: result.asset.url,
        ...(result.asset.thoughtSignature ? { thoughtSignature: result.asset.thoughtSignature } : {}),
      };
      setTurns((prev) => [...prev, modelTurn]);
      onTurnCommitted();
    } catch (err) {
      setTurns((prev) => prev.filter((t) => t.id !== userTurn.id));
      if (err instanceof ImageApiError) {
        if (err.code === 'quota_exhausted') setError('Quota exhausted for this month.');
        else if (err.code === 'still_processing') setError('Previous turn still processing. Try again in a moment.');
        else if (err.status === 403) setError("You don't have permission to refine images.");
        else setError(err.message || 'Provider unavailable, try again.');
      } else if (err instanceof Error && err.name === 'AbortError') {
        setError('Refine timed out. The turn may still be processing.');
      } else {
        setError(err instanceof Error ? err.message : 'Provider unavailable, try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void onSend();
    }
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="text-xs text-ed-ink-3">
        Chat-style refinement. Each instruction edits the latest image. The full conversation is sent to the model each turn — keep prompts focused.
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto rounded-lg border border-ed-rule bg-ed-panel-2 p-3">
        <div className="flex flex-col gap-3">
          <div className="self-start max-w-[80%]">
            <div className="mb-1 text-[10px] uppercase tracking-wide text-ed-ink-3">Starting image</div>
            <div className="overflow-hidden rounded-lg border border-ed-rule-strong bg-ed-panel">
              <img src={seed.url} alt={seed.alt_text ?? ''} className="block max-h-56 w-full object-contain" />
            </div>
          </div>
          {turns.map((turn) => (
            <TurnBubble
              key={turn.id}
              turn={turn}
              onUse={(assetId, url) => onUse({ assetId, url, width: null, height: null })}
            />
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-xs text-ed-ink-3">
              <Spinner size={14} /> Refining…
            </div>
          )}
        </div>
      </div>
      {error && <div className="text-xs text-ed-danger">{error}</div>}
      <div className="flex flex-col gap-2">
        <Textarea
          rows={2}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Describe the next change (e.g. make it look like sunrise, add a coffee cup)…"
          disabled={!canEdit || busy}
        />
        <div className="flex items-center justify-between">
          <div className="text-xs text-ed-ink-3">{turns.filter((t) => t.role === 'user').length} / {Math.floor(MAX_TURNS / 2)} instructions used</div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void onSend()}
            disabled={!canEdit || busy || !draft.trim()}
          >
            <CornerDownLeft size={14} /> Send <span className="ml-1 text-[10px] opacity-60">⌘⏎</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

function TurnBubble({
  turn,
  onUse,
}: {
  turn: Turn;
  onUse(assetId: string, url: string): void;
}) {
  if (turn.role === 'user') {
    return (
      <div className="self-end max-w-[80%] rounded-lg rounded-br-sm bg-brand/15 px-3 py-2 text-sm text-ed-ink">
        {turn.text}
      </div>
    );
  }
  return (
    <div className="self-start max-w-[80%]">
      <div className="overflow-hidden rounded-lg rounded-bl-sm border border-ed-rule-strong bg-ed-panel">
        <img src={turn.url} alt="" className="block max-h-56 w-full object-contain" />
        <button
          type="button"
          onClick={() => onUse(turn.assetId, turn.url)}
          className="block w-full px-3 py-1.5 text-left text-xs text-ed-ink-3 hover:bg-ed-panel-3 hover:text-ed-ink"
        >
          Use this image
        </button>
      </div>
    </div>
  );
}
