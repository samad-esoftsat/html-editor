'use client';
import { Input } from '@/components/ui/Input';

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function ImageInput({ value, onChange, placeholder = 'Image URL' }: Props) {
  return (
    <div className="flex gap-2 items-center">
      {value && <img src={value} alt="" className="w-10 h-10 object-cover rounded border border-border-strong" />}
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="flex-1" />
    </div>
  );
}
