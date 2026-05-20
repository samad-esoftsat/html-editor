'use client';
import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { useCanEdit } from '@/lib/editor/RoleProvider';
import { useEditor } from '@/lib/editor/StoreProvider';
import { AssetPickerButton } from './AssetPickerButton';

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function ImageInput({ value, onChange, placeholder = 'Image URL' }: Props) {
  const workspaceSlug = useEditor((s) => s.workspaceSlug);
  const canEdit = useCanEdit();
  const [err] = useState<string | null>(null);

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2 items-center">
        {value && <img src={value} alt="" className="w-10 h-10 object-cover rounded border border-ed-rule-strong" />}
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1"
          disabled={!canEdit}
        />
        <AssetPickerButton workspaceSlug={workspaceSlug} value={value} onSelect={onChange} />
      </div>
      {err && <div className="text-xs text-danger">{err}</div>}
    </div>
  );
}
