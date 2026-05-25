'use client';
import { Copy, MoreHorizontal, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { deleteProject, duplicateProject } from '@/lib/api/projects';
import { confirmDialog } from '@/lib/utils/confirm';
import { promptDialog } from '@/lib/utils/prompt';
import { toast } from '@/lib/utils/toast';

interface Props {
  projectId: string;
  projectName: string;
  slug: string;
  busy: 'duplicating' | 'deleting' | null;
  setBusy: (value: 'duplicating' | 'deleting' | null) => void;
}

export function ProjectActionsMenu({ projectId, projectName, slug, busy, setBusy }: Props) {
  const router = useRouter();

  async function onDuplicate() {
    const name = await promptDialog({
      title: 'Duplicate project',
      message: 'Leave blank to use the default name.',
      label: 'Name',
      defaultValue: `${projectName} (copy)`,
      confirmLabel: 'Duplicate',
    });
    if (name === null) return;
    setBusy('duplicating');
    try {
      const result = await duplicateProject(projectId, name.length > 0 ? name : undefined);
      toast.success('Project duplicated — opening copy…');
      router.push(`/w/${slug}/p/${result.id}`);
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Could not duplicate project');
      setBusy(null);
    }
  }

  async function onDelete() {
    const ok = await confirmDialog({
      title: 'Delete project?',
      message: `"${projectName}" will be permanently deleted. This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    setBusy('deleting');
    try {
      await deleteProject(projectId);
      toast.success('Project deleted');
      router.push(`/w/${slug}`);
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Could not delete project');
      setBusy(null);
    }
  }

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger
            disabled={busy !== null}
            aria-label="Project actions"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ed-ink-2 transition-colors hover:bg-ed-panel-3 hover:text-ed-ink disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <MoreHorizontal size={14} />
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Project actions</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onSelect={onDuplicate}>
          <Copy size={14} className="text-ed-ink-2" />
          Duplicate project
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={onDelete}
          className="text-ed-danger data-[highlighted]:bg-ed-danger/10 data-[highlighted]:text-ed-danger"
        >
          <Trash2 size={14} />
          Delete project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
