'use client';
import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          'w-full rounded-md bg-panel-2 border border-border-strong px-3 py-2 text-sm text-fg placeholder:text-muted-2 focus:outline-none focus:border-brand resize-y',
          className,
        )}
        {...rest}
      />
    );
  },
);
