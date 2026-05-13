import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export const metadata = { title: 'My Projects - GlobalTT Editor' };

interface MembershipRow {
  created_at: string;
  organizations: {
    slug: string;
  } | null;
}

export default async function DashboardRedirect() {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const lastSlug = cookieStore.get('last_ws')?.value ?? null;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  if (lastSlug) {
    const { data: lastMembership } = await supabase
      .from('organization_members')
      .select('organizations!inner(slug)')
      .eq('user_id', user.id)
      .eq('organizations.slug', lastSlug)
      .maybeSingle();

    const slug = (lastMembership as { organizations?: { slug?: string } | null } | null)
      ?.organizations?.slug;
    if (slug) {
      redirect(`/w/${slug}`);
    }
  }

  const { data: memberships } = await supabase
    .from('organization_members')
    .select('created_at, organizations!inner(slug)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  const firstSlug = (memberships as MembershipRow[] | null)?.[0]?.organizations?.slug;
  if (firstSlug) {
    redirect(`/w/${firstSlug}`);
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-bold text-fg">No workspace found</h1>
      <p className="mt-2 text-sm text-muted">
        Your account does not have an available workspace yet. Apply the workspace signup trigger or add a membership to continue.
      </p>
    </main>
  );
}
