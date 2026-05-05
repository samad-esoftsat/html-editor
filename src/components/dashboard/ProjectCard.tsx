'use client';

import { Copy, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { deleteProject, duplicateProject, patchProject, type ProjectSummary } from '@/lib/api/projects';

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

  function onDelete() {
    if (!confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
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
    <div className="rounded-xl border border-border bg-panel p-5">
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
      <div className="mb-4 text-xs text-muted-2">
        Updated {new Date(project.updated_at).toLocaleString()}
      </div>
      <div className="flex gap-2">
        <Link
          href={`/p/${project.id}`}
          className="inline-flex flex-1 items-center justify-center rounded border border-brand/30 bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand"
        >
          Open
        </Link>
        <Button
          variant="secondary"
          className="px-2.5 py-1.5"
          onClick={onDuplicate}
          disabled={pending}
          title="Duplicate"
          aria-label="Duplicate"
        >
          <Copy size={14} />
        </Button>
        <Button
          variant="secondary"
          className="px-2.5 py-1.5"
          onClick={() => setRenaming(true)}
          title="Rename"
          aria-label="Rename"
        >
          <Pencil size={14} />
        </Button>
        <Button
          variant="secondary"
          className="px-2.5 py-1.5"
          onClick={onDelete}
          disabled={pending}
          title="Delete"
          aria-label="Delete"
        >
          <Trash2 size={14} />
        </Button>
      </div>
    </div>
  );
}
