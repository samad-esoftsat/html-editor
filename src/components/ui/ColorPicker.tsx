'use client';
import { Input } from './Input';

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export function ColorPicker({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-8 h-8 rounded border border-border-strong bg-transparent cursor-pointer"
      />
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono text-xs" />
    </div>
  );
}
