'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { fade, scaleFade } from '@/lib/motion';
import { confirmDialog } from '@/lib/utils/confirm';
import { toast } from '@/lib/utils/toast';

export type Role = 'owner' | 'editor' | 'viewer';

export interface MemberRow {
  user_id: string;
  email: string;
  role: Role;
  created_at: string;
}

export interface InviteRow {
  id: string;
  org_id: string;
  email: string;
  role: Role;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  invited_by: string;
}

interface Props {
  slug: string;
  members: MemberRow[];
  invites: InviteRow[];
  canManage: boolean;
  currentUserId: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner',
  editor: 'Editor',
  viewer: 'Viewer',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

export function MembersPanel({ slug, members, invites, canManage, currentUserId }: Props) {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [pendingMember, setPendingMember] = useState<string | null>(null);
  const [pendingInvite, setPendingInvite] = useState<string | null>(null);

  async function changeRole(userId: string, role: Role) {
    setPendingMember(userId);
    try {
      const res = await fetch(`/api/workspaces/${slug}/members/${userId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (data.error === 'last_owner') {
          toast.error('Cannot demote the last owner');
        } else if (data.error === 'forbidden') {
          toast.error('Only owners can change roles');
        } else {
          toast.error(data.error ?? 'Failed to update role');
        }
        return;
      }
      toast.success('Role updated');
      router.refresh();
    } finally {
      setPendingMember(null);
    }
  }

  async function removeMember(member: MemberRow) {
    const isSelf = member.user_id === currentUserId;
    const ok = await confirmDialog({
      title: isSelf ? 'Leave workspace?' : 'Remove member?',
      message: isSelf
        ? 'You will lose access to this workspace and its projects.'
        : `Remove ${member.email} from this workspace?`,
      confirmLabel: isSelf ? 'Leave workspace' : 'Remove',
      danger: true,
    });
    if (!ok) return;

    setPendingMember(member.user_id);
    try {
      const res = await fetch(`/api/workspaces/${slug}/members/${member.user_id}`, {
        method: 'DELETE',
      });
      if (res.status === 204) {
        toast.success(isSelf ? 'Left workspace' : 'Member removed');
        if (isSelf) {
          router.replace('/');
        } else {
          router.refresh();
        }
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (data.error === 'last_owner') {
        toast.error('Cannot remove the last owner');
      } else if (data.error === 'forbidden') {
        toast.error('Only owners can remove other members');
      } else {
        toast.error(data.error ?? 'Failed to remove member');
      }
    } finally {
      setPendingMember(null);
    }
  }

  async function revokeInvite(invite: InviteRow) {
    const ok = await confirmDialog({
      title: 'Revoke invite?',
      message: `Revoke the pending invite for ${invite.email}?`,
      confirmLabel: 'Revoke',
      danger: true,
    });
    if (!ok) return;

    setPendingInvite(invite.id);
    try {
      const res = await fetch(`/api/workspaces/${slug}/invites/${invite.id}`, {
        method: 'DELETE',
      });
      if (res.status === 204) {
        toast.success('Invite revoked');
        router.refresh();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(data.error ?? 'Failed to revoke invite');
    } finally {
      setPendingInvite(null);
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-fg">Members</h2>
          {canManage && (
            <Button onClick={() => setInviteOpen(true)}>Invite member</Button>
          )}
        </div>

        <div className="overflow-hidden rounded-lg border border-border-strong bg-panel">
          <table className="w-full text-sm">
            <thead className="bg-panel-2 text-xs uppercase tracking-wide text-muted-2">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Email</th>
                <th className="px-4 py-2.5 text-left font-medium">Role</th>
                <th className="px-4 py-2.5 text-left font-medium">Joined</th>
                <th className="px-4 py-2.5 text-right font-medium" />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const isSelf = m.user_id === currentUserId;
                const busy = pendingMember === m.user_id;
                return (
                  <tr key={m.user_id} className="border-t border-border-strong">
                    <td className="px-4 py-3 text-fg">
                      {m.email}
                      {isSelf && <span className="ml-2 text-xs text-muted-2">(you)</span>}
                    </td>
                    <td className="px-4 py-3">
                      {canManage && !isSelf ? (
                        <Select
                          value={m.role}
                          disabled={busy}
                          onChange={(e) => changeRole(m.user_id, e.target.value as Role)}
                          className="w-32"
                        >
                          <option value="owner">Owner</option>
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </Select>
                      ) : (
                        <span className="text-muted">{ROLE_LABEL[m.role]}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">{formatDate(m.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      {(canManage || isSelf) && (
                        <Button
                          variant="ghost"
                          onClick={() => removeMember(m)}
                          disabled={busy}
                          className="text-danger hover:text-danger hover:bg-danger/10"
                        >
                          {isSelf ? 'Leave' : 'Remove'}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-fg">Pending invites</h2>
        {invites.length === 0 ? (
          <div className="rounded-lg border border-border-strong bg-panel p-5 text-sm text-muted">
            No pending invites.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border-strong bg-panel">
            <table className="w-full text-sm">
              <thead className="bg-panel-2 text-xs uppercase tracking-wide text-muted-2">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Email</th>
                  <th className="px-4 py-2.5 text-left font-medium">Role</th>
                  <th className="px-4 py-2.5 text-left font-medium">Expires</th>
                  <th className="px-4 py-2.5 text-right font-medium" />
                </tr>
              </thead>
              <tbody>
                {invites.map((inv) => {
                  const busy = pendingInvite === inv.id;
                  return (
                    <tr key={inv.id} className="border-t border-border-strong">
                      <td className="px-4 py-3 text-fg">{inv.email}</td>
                      <td className="px-4 py-3 text-muted">{ROLE_LABEL[inv.role]}</td>
                      <td className="px-4 py-3 text-muted">{formatDate(inv.expires_at)}</td>
                      <td className="px-4 py-3 text-right">
                        {canManage && (
                          <Button
                            variant="ghost"
                            onClick={() => revokeInvite(inv)}
                            disabled={busy}
                            className="text-danger hover:text-danger hover:bg-danger/10"
                          >
                            Revoke
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        slug={slug}
        onInvited={() => {
          setInviteOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}

interface InviteDialogProps {
  open: boolean;
  onClose: () => void;
  slug: string;
  onInvited: () => void;
}

function InviteDialog({ open, onClose, slug, onInvited }: InviteDialogProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('editor');
  const [busy, setBusy] = useState(false);

  async function send() {
    const next = email.trim().toLowerCase();
    if (!EMAIL_RE.test(next) || next.length > 320) {
      toast.error('Enter a valid email address');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/workspaces/${slug}/invites`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: next, role }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (data.error === 'invalid_email') {
          toast.error('Invalid email address');
        } else if (data.error === 'invalid_role') {
          toast.error('Invalid role');
        } else if (data.error === 'forbidden') {
          toast.error('Only owners can invite members');
        } else if (data.error === 'token_conflict') {
          toast.error('Could not generate invite token, please retry');
        } else {
          toast.error(data.error ?? 'Failed to send invite');
        }
        return;
      }
      toast.success(`Invite sent to ${next}`);
      setEmail('');
      setRole('editor');
      onInvited();
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-6"
          onClick={() => { if (!busy) onClose(); }}
          variants={fade}
          initial="hidden"
          animate="show"
          exit="exit"
        >
          <motion.div
            className="w-[460px] max-w-full rounded-xl border border-border-strong bg-panel p-6"
            onClick={(e) => e.stopPropagation()}
            variants={scaleFade}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            <div className="mb-1 font-semibold text-fg">Invite a member</div>
            <div className="mb-5 text-sm text-muted">
              They&apos;ll get an invite link valid for 7 days.
            </div>

            <div className="flex flex-col gap-4">
              <Field label="Email">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teammate@company.com"
                  maxLength={320}
                  autoFocus
                />
              </Field>

              <Field label="Role">
                <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                  <option value="owner">Owner — full access including billing</option>
                  <option value="editor">Editor — create and edit projects</option>
                  <option value="viewer">Viewer — read-only access</option>
                </Select>
              </Field>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
              <Button onClick={send} disabled={busy}>
                {busy ? <Spinner /> : 'Send invite'}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
