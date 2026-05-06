'use client';
import { useEffect, useState } from 'react';
import { Button } from './Button';
import { subscribe, type ConfirmState } from '@/lib/utils/confirm';

export function ConfirmDialog() {
  const [state, setState] = useState<ConfirmState | null>(null);
  useEffect(() => subscribe(setState), []);
  if (!state) return null;
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-6">
      <div className="bg-panel border border-border-strong rounded-xl p-6 w-[420px]">
        <div className="font-semibold text-fg mb-2">{state.title}</div>
        <div className="text-sm text-muted mb-6">{state.message}</div>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={() => state.resolve(false)}>Cancel</Button>
          <Button variant={state.danger ? 'danger' : 'primary'} onClick={() => state.resolve(true)}>
            {state.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
