'use client';

import { Copy, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { motion } from 'motion/react';
import { spring } from '@/lib/motion';
import { deleteProject, duplicateProject, patchProject, type ProjectSummary } from '@/lib/api/projects';
import { confirmDialog } from '@/lib/utils/confirm';
import { promptDialog } from '@/lib/utils/prompt';
import { toast } from '@/lib/utils/toast';

interface Props {
  project: ProjectSummary;
  onChanged: () => void;
  slug: string;
}

export function ProjectCard({ project, onChanged, slug }: Props) {
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

  async function onDuplicate() {
    const result = await promptDialog({
      title: 'Duplicate project',
      message: 'Leave blank to use the default name.',
      label: 'Name',
      defaultValue: `${project.name} (copy)`,
      confirmLabel: 'Duplicate',
    });
    if (result === null) return;
    start(async () => {
      try {
        await duplicateProject(project.id, result.length > 0 ? result : undefined);
        toast.success('Project duplicated');
        onChanged();
      } catch (err) {
        toast.error(err instanceof Error && err.message ? err.message : 'Could not duplicate project');
      }
    });
  }

  return (
    <motion.article
      className="group relative overflow-hidden rounded-[14px] border border-rule bg-bg-elevated transition-all duration-150 ease-out hover:border-rule-strong hover:shadow-[0_8px_24px_-12px_rgba(180,66,28,0.10)]"
      transition={spring.press}
    >
      <Link href={`/w/${slug}/p/${project.id}`} className="block" aria-label={`Open ${project.name}`}>
        <div className="aspect-[16/10] bg-bg-cream" aria-hidden="true">
          <div className="flex h-full flex-col">
            <div className="h-2 w-full bg-brand" />
            <div className="flex flex-1 flex-col gap-2 p-5">
              <div className="h-2 w-24 rounded-full bg-ink/15" />
              <div className="h-1.5 w-36 rounded-full bg-ink/10" />
              <div className="h-1.5 w-28 rounded-full bg-ink/10" />
            </div>
          </div>
        </div>
      </Link>
      <div className="border-t border-rule p-4">
        {renaming ? (
          <input
            autoFocus
            className="mb-1 w-full rounded-md border border-rule bg-bg-elevated px-2 py-1 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-soft"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={rename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') rename();
              if (e.key === 'Escape') { setName(project.name); setRenaming(false); }
            }}
          />
        ) : (
          <Link
            href={`/w/${slug}/p/${project.id}`}
            className="block truncate text-base font-semibold text-ink decoration-brand decoration-[1.5px] underline-offset-4 hover:underline"
          >
            {project.name}
          </Link>
        )}
        <div className="mt-1 flex items-center justify-between">
          <div className="font-mono text-[12px] text-ink-3" suppressHydrationWarning>
            Updated {new Date(project.updated_at).toLocaleDateString()}
          </div>
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <button
              aria-label="Rename project"
              onClick={() => setRenaming(true)}
              className="rounded-md p-1.5 text-ink-3 hover:bg-bg-sunken hover:text-ink"
            >
              <Pencil size={14} />
            </button>
            <button
              aria-label="Duplicate project"
              onClick={onDuplicate}
              disabled={pending}
              className="rounded-md p-1.5 text-ink-3 hover:bg-bg-sunken hover:text-ink disabled:opacity-40"
            >
              <Copy size={14} />
            </button>
            <button
              aria-label="Delete project"
              onClick={onDelete}
              disabled={pending}
              className="rounded-md p-1.5 text-ink-3 hover:bg-bg-sunken hover:text-danger disabled:opacity-40"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
