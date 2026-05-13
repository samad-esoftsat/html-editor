import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

interface Props { params: Promise<{ id: string }> }

export default async function LegacyEditorPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from('projects')
    .select('id, organizations!inner(slug)')
    .eq('id', id)
    .maybeSingle();
  if (!project) notFound();
  const slug = (project as { organizations?: { slug?: string } | null }).organizations?.slug;
  if (!slug) notFound();
  redirect(`/w/${slug}/p/${id}`);
}
