import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { BrandMark } from '@/components/ui/BrandMark';
import { PageMasthead } from '@/components/ui/PageMasthead';
import { SettingsNav, type SettingsNavItem } from '@/components/ui/SettingsNav';
import { WorkspaceSwitcher, type WorkspaceOption } from '@/components/workspace/WorkspaceSwitcher';
import { UserMenu } from '@/components/dashboard/UserMenu';
import { NewProjectButton } from '@/components/dashboard/NewProjectButton';

interface Props {
  slug: string;
  currentWorkspace: WorkspaceOption;
  workspaces: WorkspaceOption[];
  email?: string;
  activeHref: string;
  children: React.ReactNode;
}

export function SettingsShell({
  slug,
  currentWorkspace,
  workspaces,
  email,
  activeHref,
  children,
}: Props) {
  const items: SettingsNavItem[] = [
    { href: `/w/${slug}/settings/general`, label: 'General' },
    { href: `/w/${slug}/settings/members`, label: 'Members' },
    { href: `/w/${slug}/settings/brand-kits`, label: 'Brand kits' },
  ];

  return (
    <main className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-30 border-b border-rule bg-bg/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-6 md:px-16">
          <div className="flex items-center gap-3 text-ink">
            <BrandMark size={28} />
            <WorkspaceSwitcher current={currentWorkspace} workspaces={workspaces} />
          </div>
          <div className="flex items-center gap-2">
            <NewProjectButton slug={slug} />
            <UserMenu email={email} />
          </div>
        </div>
      </header>

      <div className="border-b border-rule bg-bg">
        <div className="mx-auto flex h-12 max-w-[1280px] items-center gap-2 px-6 text-sm md:px-16">
          <Link
            href={`/w/${slug}`}
            className="inline-flex items-center gap-1.5 text-ink-3 transition-colors hover:text-ink"
          >
            <ArrowLeft size={14} /> Projects
          </Link>
          <span className="text-ink-4">/</span>
          <span className="text-ink">Settings</span>
        </div>
      </div>

      <div className="mx-auto max-w-[1280px] px-6 md:px-16">
        <PageMasthead
          eyebrow="SETTINGS"
          title="Workspace"
          italicWord="settings"
          trailingPunctuation="."
          subtitle="Manage your workspace, members, and brand kits."
        />
        <div className="mt-8 flex flex-col gap-10 pb-16 md:flex-row md:gap-12">
          <SettingsNav items={items} activeHref={activeHref} />
          <section className="min-w-0 flex-1 md:max-w-[760px]">{children}</section>
        </div>
      </div>
    </main>
  );
}
