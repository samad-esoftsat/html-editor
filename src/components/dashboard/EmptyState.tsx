import { LayoutTemplate } from 'lucide-react';

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-panel/30 p-16 text-center">
      <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full border border-border bg-panel-2 text-brand">
        <LayoutTemplate size={24} />
      </div>
      <h2 className="mb-1.5 text-base font-semibold text-fg">No projects yet</h2>
      <p className="max-w-sm text-sm text-muted">{children}</p>
    </div>
  );
}
