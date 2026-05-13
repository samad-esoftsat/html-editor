import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { InviteAcceptPanel } from './InviteAcceptPanel';

interface Props {
  params: Promise<{ token: string }>;
}

export const metadata = { title: 'Accept invite - GlobalTT Editor' };

export default async function InvitePage({ params }: Props) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <InviteAcceptPanel token={token} email={user.email ?? ''} />
    </main>
  );
}
