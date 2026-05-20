import { LayoutTemplate } from 'lucide-react';

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] border-2 border-dashed border-rule-strong bg-bg-cream p-12 text-center">
      <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full border border-rule bg-bg-elevated text-brand">
        <LayoutTemplate size={24} />
      </div>
      <h2 className="mb-1.5 text-base font-semibold text-ink">No projects yet</h2>
      <p className="max-w-sm text-sm text-ink-2">{children}</p>
    </div>
  );
}
