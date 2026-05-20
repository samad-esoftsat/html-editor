import { listUserWorkspaces, requireWorkspaceRole } from '@/lib/auth/workspace';
import { createClient } from '@/lib/supabase/server';
import { SettingsShell } from '../_shell';
import { GeneralSettingsForm } from './GeneralSettingsForm';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function GeneralSettingsPage({ params }: Props) {
  const { slug } = await params;
  const workspace = await requireWorkspaceRole(slug, 'owner');
  const supabase = await createClient();
  const [{ data: { user } }, workspaces] = await Promise.all([
    supabase.auth.getUser(),
    listUserWorkspaces(),
  ]);

  return (
    <SettingsShell
      slug={slug}
      currentWorkspace={{ id: workspace.org.id, slug: workspace.org.slug, name: workspace.org.name }}
      workspaces={workspaces.map((w) => ({ id: w.id, slug: w.slug, name: w.name }))}
      email={user?.email ?? undefined}
      activeHref={`/w/${slug}/settings/general`}
    >
      <GeneralSettingsForm
        initialSlug={workspace.org.slug}
        initialName={workspace.org.name}
      />
    </SettingsShell>
  );
}
