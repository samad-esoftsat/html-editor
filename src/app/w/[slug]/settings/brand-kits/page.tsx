import { listUserWorkspaces, requireWorkspace, resolveMinRole } from '@/lib/auth/workspace';
import { createClient } from '@/lib/supabase/server';
import { SettingsShell } from '../_shell';
import { BrandKitsPanel, type BrandKitRow } from './BrandKitsPanel';

interface Props {
  params: Promise<{ slug: string }>;
}

const SELECT_COLS =
  'id, org_id, name, is_default, colors, fonts, logo, footer, created_by, created_at, updated_at';

export default async function BrandKitsSettingsPage({ params }: Props) {
  const { slug } = await params;
  const workspace = await requireWorkspace(slug);
  const supabase = await createClient();

  const [{ data }, { data: { user } }, workspaces] = await Promise.all([
    supabase
      .from('brand_kits')
      .select(SELECT_COLS)
      .eq('org_id', workspace.org.id)
      .order('is_default', { ascending: false })
      .order('name'),
    supabase.auth.getUser(),
    listUserWorkspaces(),
  ]);

  const kits = (data ?? []) as BrandKitRow[];

  return (
    <SettingsShell
      slug={slug}
      currentWorkspace={{ id: workspace.org.id, slug: workspace.org.slug, name: workspace.org.name }}
      workspaces={workspaces.map((w) => ({ id: w.id, slug: w.slug, name: w.name }))}
      email={user?.email ?? undefined}
      activeHref={`/w/${slug}/settings/brand-kits`}
    >
      <BrandKitsPanel
        slug={slug}
        kits={kits}
        canManage={resolveMinRole(workspace.role, 'editor')}
      />
    </SettingsShell>
  );
}
