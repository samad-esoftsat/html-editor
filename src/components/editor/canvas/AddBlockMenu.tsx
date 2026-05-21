'use client';
import { Plus } from 'lucide-react';
import { useEditorStore } from '@/lib/editor/StoreProvider';
import { useCanEdit } from '@/lib/editor/RoleProvider';
import { insertableBlockTypes } from '@/lib/editor/blocks';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

export function AddBlockMenu() {
  const store = useEditorStore();
  const canEdit = useCanEdit();
  if (!canEdit) return null;
  const entries = insertableBlockTypes();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="block w-full rounded-md border border-dashed border-ed-rule-strong px-3 py-2 text-sm text-ed-ink-2 transition-colors hover:border-brand hover:text-ed-ink"
        >
          <span className="inline-flex items-center gap-1">
            <Plus size={12} /> Add block
            <span aria-hidden className="text-ed-ink-3">▾</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {entries.map(({ type, metadata }) => {
          const Icon = metadata.icon;
          return (
            <DropdownMenuItem
              key={type}
              onSelect={() => store.getState().addBlock(metadata.factory())}
            >
              <Icon size={14} className="text-ed-ink-2" />
              <span>{metadata.label}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
