import Link from 'next/link';
import { ImportButton } from '@/components/dashboard/ImportButton';
import { NewProjectButton } from '@/components/dashboard/NewProjectButton';
import { ProjectGrid } from '@/components/dashboard/ProjectGrid';
import { UserMenu } from '@/components/dashboard/UserMenu';
import { WorkspaceSwitcher } from '@/components/workspace/WorkspaceSwitcher';
import { BrandMark } from '@/components/ui/BrandMark';
import { PageMasthead } from '@/components/ui/PageMasthead';
import { listUserWorkspaces, requireWorkspace } from '@/lib/auth/workspace';
import { createClient } from '@/lib/supabase/server';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function WorkspaceDashboard({ params }: Props) {
  const { slug } = await params;
  const workspace = await requireWorkspace(slug);
  const settingsHref = workspace.role === 'owner'
    ? `/w/${slug}/settings/general`
    : `/w/${slug}/settings/members`;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [projectsRes, workspaces] = await Promise.all([
    supabase
      .from('projects')
      .select('id, name, updated_at')
      .eq('org_id', workspace.org.id)
      .order('updated_at', { ascending: false }),
    listUserWorkspaces(),
  ]);

  const projects = projectsRes.data ?? [];
  const count = projects.length;
  const mostRecent = projects[0]?.updated_at;

  return (
    <main className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-30 border-b border-rule bg-bg/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-6 md:px-16">
          <div className="flex items-center gap-3 text-ink">
            <BrandMark size={28} />
            <WorkspaceSwitcher
              current={{ id: workspace.org.id, slug: workspace.org.slug, name: workspace.org.name }}
              workspaces={workspaces.map((w) => ({ id: w.id, slug: w.slug, name: w.name }))}
            />
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={settingsHref}
              className="inline-flex h-10 items-center rounded-md px-3 text-sm text-ink-3 transition-colors hover:bg-bg-sunken hover:text-ink"
            >
              Settings
            </Link>
            <ImportButton slug={slug} />
            <NewProjectButton slug={slug} />
            <UserMenu email={user?.email} />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1280px] px-6 md:px-16">
        <PageMasthead
          eyebrow="WORKSPACE"
          title="My"
          italicWord="projects"
          subtitle={
            <>
              {count} {count === 1 ? 'project' : 'projects'}
              {mostRecent ? (
                <>
                  {' '}· last updated{' '}
                  <span className="font-mono text-[14px] text-ink-3" suppressHydrationWarning>
                    {relativeTime(mostRecent)}
                  </span>
                </>
              ) : null}
            </>
          }
        />

        <div className="mt-6 flex items-center justify-between">
          <nav aria-label="Project filter" className="flex items-center gap-6 text-sm">
            <span className="relative pb-2 font-medium text-ink">
              All
              <span className="absolute inset-x-0 -bottom-px h-0.5 bg-brand" />
            </span>
          </nav>
        </div>

        <div className="mt-6 pb-16">
          <ProjectGrid initial={projects} slug={slug} />
        </div>
      </div>
    </main>
  );
}

function relativeTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
