import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand/90 shadow-sm shadow-brand/20',
  secondary: 'bg-panel-2 text-fg border border-border-strong hover:border-brand hover:bg-panel',
  ghost: 'text-muted hover:text-fg hover:bg-panel-2',
  danger: 'bg-transparent border border-danger text-danger hover:bg-danger/10',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant = 'primary', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex min-h-9 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all duration-150 ease-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    />
  );
});
