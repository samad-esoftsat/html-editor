import { type ReactNode } from 'react';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wide text-muted-2 mb-1">{label}</span>
      {children}
    </label>
  );
}
