import { ImportButton } from '@/components/dashboard/ImportButton';
import { NewProjectButton } from '@/components/dashboard/NewProjectButton';
import { ProjectGrid } from '@/components/dashboard/ProjectGrid';
import { UserMenu } from '@/components/dashboard/UserMenu';
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
      <header className="mb-10 flex items-center justify-between gap-4">
        <div>
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-brand">Dashboard</div>
          <h1 className="text-3xl font-bold tracking-tight text-fg">My Projects</h1>
        </div>
        <div className="flex items-center gap-2">
          <ImportButton />
          <NewProjectButton />
          <UserMenu email={user?.email} />
        </div>
      </header>
      <ProjectGrid initial={projects ?? []} />
    </main>
  );
}
