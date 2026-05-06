import { ImportButton } from '@/components/dashboard/ImportButton';
import { NewProjectButton } from '@/components/dashboard/NewProjectButton';
import { ProjectGrid } from '@/components/dashboard/ProjectGrid';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'My Projects - GlobalTT Editor' };

export default async function Dashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, updated_at')
    .order('updated_at', { ascending: false });

  return (
    <main className="mx-auto max-w-6xl p-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <div className="mb-1 text-xs uppercase tracking-widest text-brand">Dashboard</div>
          <h1 className="text-2xl font-bold">My Projects</h1>
          <p className="mt-1 text-xs text-muted-2">{user?.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <form action="/auth/signout" method="post">
            <button className="text-xs text-muted hover:text-fg">Sign out</button>
          </form>
          <ImportButton />
          <NewProjectButton />
        </div>
      </header>
      <ProjectGrid initial={projects ?? []} />
    </main>
  );
}
