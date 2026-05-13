'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Spinner } from '@/components/ui/Spinner';
import { fadeUp, staggerContainer } from '@/lib/motion';
import type { ProjectSummary } from '@/lib/api/projects';
import { EmptyState } from './EmptyState';
import { ProjectCard } from './ProjectCard';

export function ProjectGrid({ initial, slug }: { initial: ProjectSummary[]; slug: string }) {
  const [items, setItems] = useState(initial);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/projects/list?slug=${encodeURIComponent(slug)}`);
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, [slug]);

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
    <motion.div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      variants={staggerContainer(0.04)}
      initial="hidden"
      animate="show"
    >
      {loading && (
        <div className="col-span-full flex items-center gap-2 text-sm text-muted">
          <Spinner /> Refreshing...
        </div>
      )}
      <AnimatePresence mode="popLayout">
        {items.map((project) => (
          <motion.div
            key={project.id}
            variants={fadeUp}
            exit="exit"
            layout
          >
            <ProjectCard project={project} onChanged={reload} slug={slug} />
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
