'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';

interface Props {
  slug: string;
  canManageOrg: boolean;
}

export function SettingsNav({ slug, canManageOrg }: Props) {
  const pathname = usePathname();
  const base = `/w/${slug}/settings`;
  const items: { href: string; label: string }[] = [
    { href: `${base}/general`, label: 'General' },
    { href: `${base}/members`, label: 'Members' },
    { href: `${base}/brand-kits`, label: 'Brand Kits' },
  ];

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const disabled = item.label === 'General' && !canManageOrg;
        if (disabled) {
          return (
            <span
              key={item.href}
              className="rounded-md px-3 py-2 text-sm text-muted-2"
              aria-disabled="true"
              title="Owners only"
            >
              {item.label}
            </span>
          );
        }
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'rounded-md px-3 py-2 text-sm transition-colors',
              active
                ? 'bg-panel-2 text-fg'
                : 'text-muted hover:bg-panel-2 hover:text-fg',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
