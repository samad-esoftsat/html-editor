import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'link' | 'danger';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] hover:-translate-y-px hover:shadow-[0_6px_16px_-6px_rgba(241,89,42,0.45)] active:translate-y-0',
  secondary:
    'bg-ink text-white hover:bg-ink-2',
  ghost:
    'bg-transparent text-ink border border-rule hover:bg-bg-sunken hover:border-rule-strong',
  link:
    'bg-transparent text-ink underline-offset-4 hover:underline decoration-brand decoration-[1.5px] px-0',
  danger:
    'bg-transparent border border-danger text-danger hover:bg-danger/10',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant = 'primary', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-all duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-40',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    />
  );
});
