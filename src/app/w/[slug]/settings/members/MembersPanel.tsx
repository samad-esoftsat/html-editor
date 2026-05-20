'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { RolePill } from '@/components/ui/RolePill';
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
  token: string;
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

function inviteUrl(token: string): string {
  if (typeof window === 'undefined') return `/invite/${token}`;
  return `${window.location.origin}/invite/${token}`;
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function MembersPanel({ slug, members, invites, canManage, currentUserId }: Props) {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [pendingMember, setPendingMember] = useState<string | null>(null);
  const [pendingInvite, setPendingInvite] = useState<string | null>(null);
  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null);

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
    <div className="flex flex-col gap-12">
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-ink">Members</h2>
          {canManage && (
            <Button onClick={() => setInviteOpen(true)}>+ Invite member</Button>
          )}
        </div>
        <p className="mt-2 text-sm text-ink-3">
          People with access to this workspace. Pending invites appear at the bottom.
        </p>

        <table className="mt-8 w-full">
          <thead>
            <tr className="border-b border-rule">
              {['Email', 'Role', 'Joined', ''].map((h, i) => (
                <th
                  key={i}
                  className={`pb-2 text-left text-[11px] font-medium uppercase tracking-[0.18em] text-ink-3 ${i === 3 ? 'text-right' : ''}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const isSelf = m.user_id === currentUserId;
              const busy = pendingMember === m.user_id;
              return (
                <tr key={m.user_id} className="border-b border-rule transition-colors hover:bg-bg-sunken">
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-brand-soft text-[12px] font-semibold text-brand-ink">
                        {(m.email[0] ?? '?').toUpperCase()}
                      </span>
                      <span className="text-sm text-ink">{m.email}</span>
                    </div>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-2">
                      {canManage && !isSelf ? (
                        <Select
                          value={m.role}
                          disabled={busy}
                          onChange={(e) => changeRole(m.user_id, e.target.value as Role)}
                          className="h-8 w-32 rounded-md border border-rule bg-bg-elevated text-sm text-ink"
                        >
                          <option value="owner">Owner</option>
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </Select>
                      ) : (
                        <RolePill>{ROLE_LABEL[m.role].toUpperCase()}</RolePill>
                      )}
                      {isSelf && <RolePill variant="soft">YOU</RolePill>}
                    </div>
                  </td>
                  <td className="py-4 font-mono text-[12px] text-ink-3" suppressHydrationWarning>
                    {formatDate(m.created_at)}
                  </td>
                  <td className="py-4 text-right">
                    {(canManage || isSelf) && (
                      <button
                        type="button"
                        onClick={() => removeMember(m)}
                        disabled={busy}
                        className="rounded-md px-2 py-1 text-sm text-ink-3 transition-colors hover:bg-bg-sunken hover:text-danger disabled:opacity-40"
                      >
                        {isSelf ? 'Leave' : 'Remove'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section>
        <h3 className="text-sm font-medium text-ink-2">
          Pending invitations · <span className="font-mono text-ink-3">{invites.length}</span>
        </h3>
        <p className="mt-1 text-sm text-ink-3">
          Invite links don&apos;t send emails yet — share the link manually until email delivery lands.
        </p>
        {invites.length === 0 ? (
          <div className="mt-4 rounded-md border border-dashed border-rule-strong bg-bg-cream p-6 text-sm text-ink-3">
            No pending invitations.
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {invites.map((inv) => {
              const busy = pendingInvite === inv.id;
              return (
                <li key={inv.id} className="flex items-center gap-4 rounded-md border border-rule bg-bg-sunken px-4 py-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-bg-elevated text-ink-3">
                    <Mail size={14} />
                  </span>
                  <span className="flex-1 text-sm text-ink">{inv.email}</span>
                  <RolePill>{ROLE_LABEL[inv.role].toUpperCase()}</RolePill>
                  <span className="font-mono text-[12px] text-ink-3" suppressHydrationWarning>
                    exp {formatDate(inv.expires_at)}
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await copyToClipboard(inviteUrl(inv.token));
                      if (ok) toast.success('Invite link copied');
                      else toast.error('Failed to copy');
                    }}
                    className="text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline"
                  >
                    Copy link
                  </button>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => revokeInvite(inv)}
                      disabled={busy}
                      className="text-sm text-ink-3 underline-offset-4 hover:text-danger hover:underline disabled:opacity-40"
                    >
                      Revoke
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {invites.length > 0 && (
          <p className="mt-3 text-sm text-ink-3">Invitations expire in 7 days.</p>
        )}
      </section>

      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        slug={slug}
        onInvited={(token) => {
          setInviteOpen(false);
          if (token) setCreatedInviteUrl(inviteUrl(token));
          router.refresh();
        }}
      />

      <CreatedInviteDialog url={createdInviteUrl} onClose={() => setCreatedInviteUrl(null)} />
    </div>
  );
}

interface InviteDialogProps {
  open: boolean;
  onClose: () => void;
  slug: string;
  onInvited: (token: string) => void;
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
      const data = (await res.json().catch(() => ({}))) as
        | { invite?: { token?: string } }
        | { error?: string };

      if (!res.ok) {
        const err = (data as { error?: string }).error;
        if (err === 'invalid_email') toast.error('Invalid email address');
        else if (err === 'invalid_role') toast.error('Invalid role');
        else if (err === 'forbidden') toast.error('Only owners can invite members');
        else if (err === 'token_conflict') toast.error('Could not generate invite token, please retry');
        else toast.error(err ?? 'Failed to send invite');
        return;
      }

      const token = (data as { invite?: { token?: string } }).invite?.token ?? '';
      toast.success(`Invite created for ${next}`);
      setEmail('');
      setRole('editor');
      onInvited(token);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-ink/40 backdrop-blur-sm p-6"
          onClick={() => { if (!busy) onClose(); }}
          variants={fade}
          initial="hidden"
          animate="show"
          exit="exit"
        >
          <motion.div
            className="w-[460px] max-w-full rounded-[14px] border border-rule bg-bg-elevated p-6 shadow-[0_30px_80px_-20px_rgba(20,20,20,0.25)]"
            onClick={(e) => e.stopPropagation()}
            variants={scaleFade}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            <div className="mb-1 text-[20px] font-semibold tracking-[-0.01em] text-ink">Invite a member</div>
            <div className="mb-5 text-sm text-ink-3">
              They&apos;ll get an invite link valid for 7 days.
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label htmlFor="invite-email" className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.05em] text-ink-3">Email</label>
                <Input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teammate@company.com"
                  maxLength={320}
                  autoFocus
                  className="h-10 w-full rounded-md border border-rule bg-bg-elevated px-3 text-sm text-ink placeholder:text-ink-4 focus:border-brand focus:ring-4 focus:ring-brand-soft"
                />
              </div>

              <div>
                <label htmlFor="invite-role" className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.05em] text-ink-3">Role</label>
                <Select
                  id="invite-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="h-10 w-full rounded-md border border-rule bg-bg-elevated px-3 text-sm text-ink"
                >
                  <option value="owner">Owner — full access including billing</option>
                  <option value="editor">Editor — create and edit projects</option>
                  <option value="viewer">Viewer — read-only access</option>
                </Select>
              </div>
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

interface CreatedInviteDialogProps {
  url: string | null;
  onClose: () => void;
}

function CreatedInviteDialog({ url, onClose }: CreatedInviteDialogProps) {
  const [copied, setCopied] = useState(false);
  if (!url) return null;
  async function copy() {
    const ok = await copyToClipboard(url!);
    if (ok) {
      setCopied(true);
      toast.success('Invite link copied');
      window.setTimeout(() => setCopied(false), 1500);
    } else {
      toast.error('Failed to copy');
    }
  }
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-ink/40 backdrop-blur-sm p-6"
        onClick={onClose}
        variants={fade}
        initial="hidden"
        animate="show"
        exit="exit"
      >
        <motion.div
          className="w-[500px] max-w-full rounded-[14px] border border-rule bg-bg-elevated p-6 shadow-[0_30px_80px_-20px_rgba(20,20,20,0.25)]"
          onClick={(e) => e.stopPropagation()}
          variants={scaleFade}
          initial="hidden"
          animate="show"
          exit="exit"
        >
          <div className="mb-1 text-[20px] font-semibold tracking-[-0.01em] text-ink">Invite link ready</div>
          <div className="mb-5 text-sm text-ink-3">
            Email delivery isn&apos;t set up yet. Copy this link and send it to your teammate manually. It expires in 7 days.
          </div>
          <div>
            <label htmlFor="invite-url" className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.05em] text-ink-3">Invite URL</label>
            <Input
              id="invite-url"
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="h-10 w-full rounded-md border border-rule bg-bg-elevated px-3 text-sm text-ink placeholder:text-ink-4 focus:border-brand focus:ring-4 focus:ring-brand-soft"
            />
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Done</Button>
            <Button onClick={copy}>{copied ? 'Copied!' : 'Copy link'}</Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
