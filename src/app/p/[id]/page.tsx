import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { EditorShell } from '@/components/editor/EditorShell';
import type { ProjectData } from '@/lib/editor/types';

interface Props { params: Promise<{ id: string }> }

export default async function EditorPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from('projects').select('*').eq('id', id).maybeSingle();
  if (!project) notFound();
  return (
    <EditorShell
      projectId={project.id}
      name={project.name}
      data={project.data as ProjectData}
      serverUpdatedAt={project.updated_at}
    />
  );
}
