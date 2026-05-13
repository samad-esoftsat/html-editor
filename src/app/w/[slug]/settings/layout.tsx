import Link from 'next/link';
import type { ReactNode } from 'react';
import { requireWorkspace } from '@/lib/auth/workspace';
import { SettingsNav } from './SettingsNav';

interface Props {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function SettingsLayout({ children, params }: Props) {
  const { slug } = await params;
  const workspace = await requireWorkspace(slug);

  return (
    <main className="mx-auto max-w-6xl p-8">
      <header className="mb-8">
        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-brand">
          Settings
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-3xl font-bold tracking-tight text-fg">{workspace.org.name}</h1>
          <Link
            href={`/w/${slug}`}
            className="text-sm text-muted hover:text-fg"
          >
            ← Back to workspace
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-[180px_1fr] gap-8">
        <aside>
          <SettingsNav slug={slug} canManageOrg={workspace.role === 'owner'} />
        </aside>
        <section>{children}</section>
      </div>
    </main>
  );
}
