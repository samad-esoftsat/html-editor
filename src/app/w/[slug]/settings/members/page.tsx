import { requireWorkspace } from '@/lib/auth/workspace';
import { createClient } from '@/lib/supabase/server';
import { MembersPanel, type MemberRow, type InviteRow } from './MembersPanel';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function MembersSettingsPage({ params }: Props) {
  const { slug } = await params;
  const workspace = await requireWorkspace(slug);

  const supabase = await createClient();

  const [membersRes, invitesRes] = await Promise.all([
    supabase.rpc('list_org_members', { p_org: workspace.org.id }),
    supabase
      .from('organization_invites')
      .select('id, org_id, email, role, expires_at, accepted_at, created_at, invited_by')
      .eq('org_id', workspace.org.id)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }),
  ]);

  const members = (membersRes.data ?? []) as MemberRow[];
  const invites = (invitesRes.data ?? []) as InviteRow[];

  return (
    <MembersPanel
      slug={slug}
      members={members}
      invites={invites}
      canManage={workspace.role === 'owner'}
      currentUserId={workspace.userId}
    />
  );
}
