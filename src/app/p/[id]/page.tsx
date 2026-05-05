import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditorPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!project) notFound();

  return (
    <main className="min-h-dvh p-8">
      <Link href="/" className="text-sm text-brand">Back to projects</Link>
      <h1 className="mt-2 text-2xl font-bold">{project.name}</h1>
      <pre className="mt-6 overflow-auto rounded bg-panel-2 p-4 text-xs text-muted-2">
        {JSON.stringify(project.data, null, 2)}
      </pre>
      <div className="mt-4 text-xs text-muted-2">Editor UI lands in Phase 2.</div>
    </main>
  );
}
