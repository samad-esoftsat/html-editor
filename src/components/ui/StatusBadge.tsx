import { cn } from '@/lib/utils/cn';

type Tone = 'saved' | 'pending' | 'saving' | 'error';

interface Props {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
}

const DOT_BG: Record<Tone, string> = {
  saved: 'bg-ed-success',
  pending: 'bg-amber',
  saving: 'bg-brand',
  error: 'bg-ed-danger',
};

export function StatusBadge({ tone, children, className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-ed-ink-3',
        className,
      )}
    >
      <span
        data-dot
        data-tone={tone}
        className={cn('h-1.5 w-1.5 rounded-full', DOT_BG[tone])}
        aria-hidden="true"
      />
      <span className="font-mono">{children}</span>
    </span>
  );
}
