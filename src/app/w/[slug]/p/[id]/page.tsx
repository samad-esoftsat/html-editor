import { notFound } from 'next/navigation';
import { EditorShell } from '@/components/editor/EditorShell';
import { listUserWorkspaces, requireWorkspace } from '@/lib/auth/workspace';
import { migrate } from '@/lib/editor/migrate';
import { createClient } from '@/lib/supabase/server';

interface Props {
  params: Promise<{ slug: string; id: string }>;
}

export default async function WorkspaceEditorPage({ params }: Props) {
  const { slug, id } = await params;
  const workspace = await requireWorkspace(slug);
  const supabase = await createClient();
  const [projectRes, workspaces] = await Promise.all([
    supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('org_id', workspace.org.id)
      .maybeSingle(),
    listUserWorkspaces(),
  ]);

  const project = projectRes.data;
  if (!project) notFound();

  return (
    <EditorShell
      projectId={project.id}
      name={project.name}
      data={migrate(project.data)}
      brandKitId={(project as { brand_kit_id?: string | null }).brand_kit_id ?? null}
      serverUpdatedAt={project.updated_at}
      workspaceSlug={slug}
      currentWorkspace={{ id: workspace.org.id, slug: workspace.org.slug, name: workspace.org.name }}
      workspaces={workspaces.map((w) => ({ id: w.id, slug: w.slug, name: w.name }))}
      role={workspace.role}
    />
  );
}
