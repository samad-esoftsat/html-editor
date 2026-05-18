'use client';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AssetPicker } from './AssetPicker';

interface PendingPick {
  value: string;
  altText?: string;
  onSelect: (url: string) => void;
}

interface AssetPickerContextValue {
  openAssetPicker: (args: { value?: string; altText?: string; onSelect: (url: string) => void }) => void;
}

const AssetPickerContext = createContext<AssetPickerContextValue | null>(null);

export function useAssetPicker(): AssetPickerContextValue {
  const ctx = useContext(AssetPickerContext);
  if (!ctx) throw new Error('useAssetPicker must be used within AssetPickerProvider');
  return ctx;
}

interface ProviderProps {
  workspaceSlug: string;
  children: React.ReactNode;
}

export function AssetPickerProvider({ workspaceSlug, children }: ProviderProps) {
  const [pending, setPending] = useState<PendingPick | null>(null);
  const pendingRef = useRef<PendingPick | null>(null);

  const openAssetPicker = useCallback<AssetPickerContextValue['openAssetPicker']>((args) => {
    const next: PendingPick = {
      value: args.value ?? '',
      altText: args.altText,
      onSelect: args.onSelect,
    };
    pendingRef.current = next;
    setPending(next);
  }, []);

  const value = useMemo(() => ({ openAssetPicker }), [openAssetPicker]);

  return (
    <AssetPickerContext.Provider value={value}>
      {children}
      {pending && (
        <AssetPicker
          workspaceSlug={workspaceSlug}
          value={pending.value}
          altText={pending.altText}
          onClose={() => {
            pendingRef.current = null;
            setPending(null);
          }}
          onSelect={(url) => {
            const cb = pendingRef.current?.onSelect;
            pendingRef.current = null;
            setPending(null);
            cb?.(url);
          }}
        />
      )}
    </AssetPickerContext.Provider>
  );
}
