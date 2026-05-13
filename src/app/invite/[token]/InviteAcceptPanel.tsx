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

  return (
    <div className="w-[420px] max-w-full rounded-xl border border-border-strong bg-panel-2 p-8">
      <div className="mb-6 text-center">
        <div className="text-2xl font-extrabold text-brand">GT</div>
        <div className="text-sm text-muted">GlobalTT Email Editor</div>
      </div>

      <h1 className="mb-2 text-center text-lg font-semibold text-fg">
        You&apos;ve been invited
      </h1>
      <p className="mb-6 text-center text-sm text-muted">
        Accept this invite to join the workspace as{' '}
        <span className="text-fg">{email}</span>.
      </p>

      <div className="flex flex-col gap-2">
        <Button onClick={accept} disabled={busy || done} className="w-full">
          {busy ? <Spinner /> : done ? 'Accepted' : 'Accept invite'}
        </Button>
        <Button
          variant="ghost"
          onClick={() => router.replace('/')}
          disabled={busy}
          className="w-full"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
