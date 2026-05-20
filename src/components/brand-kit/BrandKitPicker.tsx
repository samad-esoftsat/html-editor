'use client';

import { useEffect, useState } from 'react';

export interface BrandKitOption {
  id: string;
  name: string;
  is_default: boolean;
}

interface Props {
  slug: string;
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
  autoSelectDefault?: boolean;
  className?: string;
}

export function BrandKitPicker({
  slug,
  value,
  onChange,
  disabled,
  autoSelectDefault,
  className,
}: Props) {
  const [kits, setKits] = useState<BrandKitOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/workspaces/${slug}/brand-kits`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`http ${r.status}`))))
      .then((json: { brand_kits?: BrandKitOption[] }) => {
        if (cancelled) return;
        setKits(json.brand_kits ?? []);
      })
      .catch(() => {
        if (!cancelled) setKits([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!autoSelectDefault) return;
    if (value !== null) return;
    if (kits.length === 0) return;
    const def = kits.find((k) => k.is_default);
    if (def) onChange(def.id);
  }, [autoSelectDefault, value, kits, onChange]);

  return (
    <select
      disabled={disabled || loading}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className={
        className ??
        'w-full bg-bg-elevated border border-rule rounded px-2 py-1.5 text-sm text-ink focus:border-brand focus:outline-none disabled:opacity-50'
      }
    >
      <option value="">— No brand kit —</option>
      {kits.map((k) => (
        <option key={k.id} value={k.id}>
          {k.name}
          {k.is_default ? ' (default)' : ''}
        </option>
      ))}
    </select>
  );
}
