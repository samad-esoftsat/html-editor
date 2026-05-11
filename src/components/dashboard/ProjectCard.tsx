'use client';

import { Copy, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/Button';
import { spring } from '@/lib/motion';
import { deleteProject, duplicateProject, patchProject, type ProjectSummary } from '@/lib/api/projects';
import { confirmDialog } from '@/lib/utils/confirm';

interface Props {
  project: ProjectSummary;
  onChanged: () => void;
}

export function ProjectCard({ project, onChanged }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(project.name);

  async function rename() {
    setRenaming(false);
    if (name.trim() === project.name) return;
    await patchProject(project.id, { name: name.trim() });
    onChanged();
  }

  async function onDelete() {
    const ok = await confirmDialog({
      title: 'Delete project?',
      message: `"${project.name}" will be permanently deleted. This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    start(async () => {
      await deleteProject(project.id);
      onChanged();
    });
  }

  function onDuplicate() {
    start(async () => {
      const { id } = await duplicateProject(project.id);
      router.push(`/p/${id}`);
    });
  }

  return (
    <motion.div
      className="group rounded-xl border border-border bg-panel p-5 transition-colors duration-150 ease-out hover:border-brand/40 hover:shadow-lg hover:shadow-black/20"
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={spring.press}
    >
      {renaming ? (
        <input
          autoFocus
          className="mb-1 w-full rounded border border-border-strong bg-panel-2 px-2 py-1 text-sm text-fg"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={rename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') rename();
            if (e.key === 'Escape') {
              setName(project.name);
              setRenaming(false);
            }
          }}
        />
      ) : (
        <div className="mb-1 truncate text-sm font-semibold text-fg">{project.name}</div>
      )}
      <div className="mb-4 text-xs text-muted-2" suppressHydrationWarning>
        Updated {new Date(project.updated_at).toLocaleString()}
      </div>
      <div className="flex gap-2">
        <Link
          href={`/p/${project.id}`}
          className="inline-flex h-9 flex-1 items-center justify-center rounded-md border border-brand/30 bg-brand-soft px-3 text-xs font-semibold text-brand transition-colors hover:bg-brand/20 hover:border-brand/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Open
        </Link>
        <Button
          variant="secondary"
          className="h-9 w-9 min-h-0 !px-0 !py-0"
          onClick={onDuplicate}
          disabled={pending}
          title="Duplicate"
          aria-label="Duplicate"
        >
          <Copy size={14} />
        </Button>
        <Button
          variant="secondary"
          className="h-9 w-9 min-h-0 !px-0 !py-0"
          onClick={() => setRenaming(true)}
          title="Rename"
          aria-label="Rename"
        >
          <Pencil size={14} />
        </Button>
        <Button
          variant="secondary"
          className="h-9 w-9 min-h-0 !px-0 !py-0"
          onClick={onDelete}
          disabled={pending}
          title="Delete"
          aria-label="Delete"
        >
          <Trash2 size={14} />
        </Button>
      </div>
    </motion.div>
  );
}
