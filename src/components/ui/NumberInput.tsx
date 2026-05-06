'use client';
import { Input } from './Input';

interface Props {
  value: number;
  onChange: (v: number) => void;
  min?: number; max?: number; step?: number;
}

export function NumberInput({ value, onChange, min, max, step = 1 }: Props) {
  return (
    <Input
      type="number"
      value={Number.isFinite(value) ? value : ''}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (Number.isFinite(n)) onChange(n);
      }}
      min={min} max={max} step={step}
    />
  );
}
