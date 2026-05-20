import { cn } from '@/lib/utils/cn';

interface Props {
  color: string;
  showHex?: boolean;
  size?: number;
  className?: string;
}

export function SwatchChip({ color, showHex, size = 28, className }: Props) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span
        data-swatch
        aria-hidden="true"
        className="inline-block rounded-md ring-1 ring-inset ring-rule"
        style={{ width: size, height: size, backgroundColor: color }}
      />
      {showHex && (
        <span className="font-mono text-[12px] text-ink-3">{color.toUpperCase()}</span>
      )}
    </span>
  );
}
