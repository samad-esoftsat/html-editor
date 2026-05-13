import { requireWorkspace } from '@/lib/auth/workspace';
import { resolveMinRole } from '@/lib/auth/workspace';
import { createClient } from '@/lib/supabase/server';
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
  const { data } = await supabase
    .from('brand_kits')
    .select(SELECT_COLS)
    .eq('org_id', workspace.org.id)
    .order('is_default', { ascending: false })
    .order('name');

  const kits = (data ?? []) as BrandKitRow[];

  return (
    <BrandKitsPanel
      slug={slug}
      kits={kits}
      canManage={resolveMinRole(workspace.role, 'editor')}
    />
  );
}
