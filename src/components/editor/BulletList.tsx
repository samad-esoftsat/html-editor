'use client';
import { Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface Props {
  bullets: string[];
  onChange: (next: string[]) => void;
}

export function BulletList({ bullets, onChange }: Props) {
  return (
    <div className="space-y-1.5">
      {bullets.map((b, i) => (
        <div key={i} className="flex gap-1.5">
          <Input value={b} onChange={(e) => onChange(bullets.map((x, j) => j === i ? e.target.value : x))} />
          <button onClick={() => onChange(bullets.filter((_, j) => j !== i))} className="text-ed-ink-4 hover:text-danger px-1.5"><X size={14} /></button>
        </div>
      ))}
      <Button variant="secondary" className="w-full text-success border-success/40" onClick={() => onChange([...bullets, ''])}>
        <Plus size={14} /> Bullet
      </Button>
    </div>
  );
}
