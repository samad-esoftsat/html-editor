'use client';
import type { SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'w-full rounded-md bg-panel-2 border border-border-strong px-2 py-2 text-sm text-fg focus:outline-none focus:border-brand',
        className,
      )}
      {...rest}
    />
  );
}
