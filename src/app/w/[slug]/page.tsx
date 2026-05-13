import Link from 'next/link';
import { ImportButton } from '@/components/dashboard/ImportButton';
import { NewProjectButton } from '@/components/dashboard/NewProjectButton';
import { ProjectGrid } from '@/components/dashboard/ProjectGrid';
import { UserMenu } from '@/components/dashboard/UserMenu';
import { WorkspaceSwitcher } from '@/components/workspace/WorkspaceSwitcher';
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

  return (
    <main className="mx-auto max-w-6xl p-8">
      <header className="mb-10 flex items-center justify-between gap-4">
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-brand">
              Workspace
            </span>
            <WorkspaceSwitcher
              current={{ id: workspace.org.id, slug: workspace.org.slug, name: workspace.org.name }}
              workspaces={workspaces.map((w) => ({ id: w.id, slug: w.slug, name: w.name }))}
            />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-fg">{workspace.org.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={settingsHref}
            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-border-strong bg-panel-2 px-4 py-2 text-sm font-medium text-fg transition-all duration-150 ease-out hover:border-brand hover:bg-panel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Settings
          </Link>
          <ImportButton slug={slug} />
          <NewProjectButton slug={slug} />
          <UserMenu email={user?.email} />
        </div>
      </header>
      <ProjectGrid initial={projectsRes.data ?? []} slug={slug} />
    </main>
  );
}
