import { CardSkeleton } from '@/components/dashboard/CardSkeleton';

export default function Loading() {
  return (
    <main className="max-w-6xl mx-auto p-8">
      <header className="flex items-center justify-between mb-8">
        <div>
          <div className="h-3 w-24 bg-rule rounded mb-2" />
          <div className="h-7 w-48 bg-rule rounded" />
        </div>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
      </div>
    </main>
  );
}
