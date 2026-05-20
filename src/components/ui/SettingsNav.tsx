import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

export interface SettingsNavItem {
  href: string;
  label: string;
}

interface Props {
  items: SettingsNavItem[];
  activeHref: string;
  className?: string;
}

export function SettingsNav({ items, activeHref, className }: Props) {
  return (
    <nav aria-label="Settings sections" className={cn('w-[220px] shrink-0', className)}>
      <ul className="space-y-1">
        {items.map((item) => {
          const active = item.href === activeHref;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                data-active={active}
                className={cn(
                  'block rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-brand-soft text-brand-ink'
                    : 'text-ink-3 hover:text-ink hover:bg-bg-sunken',
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
