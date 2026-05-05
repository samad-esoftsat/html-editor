'use client';

import { useCallback, useEffect, useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import type { ProjectSummary } from '@/lib/api/projects';
import { EmptyState } from './EmptyState';
import { ProjectCard } from './ProjectCard';

export function ProjectGrid({ initial }: { initial: ProjectSummary[] }) {
  const [items, setItems] = useState(initial);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/projects/list');
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    setItems(initial);
  }, [initial]);

  if (items.length === 0) {
    return (
      <EmptyState>
        No projects yet. Click <strong className="text-fg">+ New Project</strong> to start your first campaign.
      </EmptyState>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {loading && (
        <div className="col-span-full flex items-center gap-2 text-sm text-muted">
          <Spinner /> Refreshing...
        </div>
      )}
      {items.map((project) => (
        <ProjectCard key={project.id} project={project} onChanged={reload} />
      ))}
    </div>
  );
}
