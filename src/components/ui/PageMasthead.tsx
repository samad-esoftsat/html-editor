import { Eyebrow } from './Eyebrow';
import { cn } from '@/lib/utils/cn';

interface Props {
  eyebrow: string;
  title: string;
  italicWord?: string;
  trailingPunctuation?: string;
  subtitle?: React.ReactNode;
  className?: string;
}

export function PageMasthead({
  eyebrow,
  title,
  italicWord,
  trailingPunctuation,
  subtitle,
  className,
}: Props) {
  return (
    <header className={cn('pt-14 pb-6', className)}>
      <Eyebrow>{eyebrow.toUpperCase()}</Eyebrow>
      <h1 className="mt-1 font-serif text-[56px] font-light leading-[1.02] tracking-[-0.03em] text-ink">
        {title}
        {italicWord ? (
          <>
            {' '}
            <em className="font-serif font-light italic">{italicWord}</em>
          </>
        ) : null}
        {trailingPunctuation ?? ''}
      </h1>
      {subtitle && (
        <p className="mt-2 text-[17px] leading-[1.6] text-ink-2">{subtitle}</p>
      )}
      <hr data-masthead-rule className="mt-6 h-px border-0 bg-rule" />
    </header>
  );
}
