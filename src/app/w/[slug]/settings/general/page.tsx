import { requireWorkspaceRole } from '@/lib/auth/workspace';
import { GeneralSettingsForm } from './GeneralSettingsForm';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function GeneralSettingsPage({ params }: Props) {
  const { slug } = await params;
  const workspace = await requireWorkspaceRole(slug, 'owner');

  return (
    <GeneralSettingsForm
      initialSlug={workspace.org.slug}
      initialName={workspace.org.name}
    />
  );
}
