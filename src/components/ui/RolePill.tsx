import { cn } from '@/lib/utils/cn';

type Variant = 'outlined' | 'soft';

interface Props {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
}

export function RolePill({ variant = 'outlined', children, className }: Props) {
  const styles =
    variant === 'soft'
      ? 'bg-brand-soft text-brand-ink'
      : 'border border-rule text-ink-2';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wider uppercase',
        styles,
        className,
      )}
    >
      {children}
    </span>
  );
}
