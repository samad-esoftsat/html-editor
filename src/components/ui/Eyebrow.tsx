import { cn } from '@/lib/utils/cn';

interface Props {
  children: React.ReactNode;
  className?: string;
}

export function Eyebrow({ children, className }: Props) {
  return (
    <span
      className={cn(
        'inline-block text-[11px] font-medium uppercase leading-none tracking-[0.22em] text-ink-3',
        className,
      )}
    >
      {children}
    </span>
  );
}
