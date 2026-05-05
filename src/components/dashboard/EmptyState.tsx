export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-16 text-center text-muted">
      {children}
    </div>
  );
}
