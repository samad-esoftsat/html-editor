'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from '@/lib/utils/toast';

interface Props {
  token: string;
  email: string;
}

interface AcceptResponse {
  org_id: string;
  slug: string;
  role: 'owner' | 'editor' | 'viewer';
}

export function InviteAcceptPanel({ token, email }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function accept() {
    setBusy(true);
    try {
      const res = await fetch(`/api/invites/${token}/accept`, { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as
        | AcceptResponse
        | { error?: string };

      if (!res.ok) {
        const err = (data as { error?: string }).error;
        if (err === 'invite_not_found') {
          toast.error('This invite link is invalid.');
        } else if (err === 'invite_already_accepted') {
          toast.error('This invite has already been accepted.');
        } else if (err === 'invite_expired') {
          toast.error('This invite has expired.');
        } else if (err === 'invite_email_mismatch') {
          toast.error('This invite was sent to a different email address.');
        } else if (err === 'unauthorized') {
          router.replace(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
          return;
        } else {
          toast.error(err ?? 'Failed to accept invite');
        }
        return;
      }

      const row = data as AcceptResponse;
      setDone(true);
      toast.success('Invite accepted');
      router.replace(`/w/${row.slug}`);
    } finally {
      setBusy(false);
    }
  }

  // `email` is intentionally unused inside the panel (the page renders it);
  // kept in props for future "you are signed in as" UI without a breaking API change.
  void email;

  return (
    <div className="mt-8 flex w-full max-w-[460px] flex-col gap-3">
      <Button onClick={accept} disabled={busy || done} className="h-11 w-full">
        {busy ? <Spinner /> : done ? 'Accepted' : 'Accept invitation'}
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={() => router.replace('/')}
        disabled={busy}
        className="w-full"
      >
        Decline
      </Button>
    </div>
  );
}
