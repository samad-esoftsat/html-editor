'use client';

import { useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { useRole } from '@/lib/editor/RoleProvider';
import { cn } from '@/lib/utils/cn';
import { AssetPicker } from './AssetPicker';

interface Props {
  workspaceSlug: string;
  value: string;
  onSelect(url: string): void;
  altText?: string;
  className?: string;
}

export function AssetPickerButton({ workspaceSlug, value, onSelect, altText, className }: Props) {
  const [open, setOpen] = useState(false);
  const role = useRole();

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          'inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-ed-rule-strong bg-ed-panel-2 px-3 py-2 text-sm text-ed-ink hover:border-brand hover:bg-ed-panel cursor-pointer',
          className,
        )}
      >
        <ImagePlus size={14} />
        {role === 'viewer' ? 'Browse assets' : value ? 'Change image' : 'Choose image'}
      </div>
      {open && (
        <AssetPicker
          workspaceSlug={workspaceSlug}
          value={value}
          altText={altText}
          onClose={() => setOpen(false)}
          onSelect={(url) => {
            onSelect(url);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
