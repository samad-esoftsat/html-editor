export function CardSkeleton() {
  return (
    <div className="rounded-xl bg-bg-elevated border border-rule p-5 animate-pulse">
      <div className="h-4 bg-rule-strong rounded w-2/3 mb-2" />
      <div className="h-3 bg-rule rounded w-1/2 mb-6" />
      <div className="flex gap-2">
        <div className="flex-1 h-8 bg-rule rounded" />
        <div className="h-8 w-10 bg-rule rounded" />
        <div className="h-8 w-10 bg-rule rounded" />
        <div className="h-8 w-10 bg-rule rounded" />
      </div>
    </div>
  );
}
