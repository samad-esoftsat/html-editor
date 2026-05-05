import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'w-full rounded-md border border-border-strong bg-panel-2 px-3 py-2 text-sm text-fg placeholder:text-muted-2 focus:border-brand focus:outline-none',
          className,
        )}
        {...rest}
      />
    );
  },
);
