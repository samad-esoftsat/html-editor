'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { confirmDialog } from '@/lib/utils/confirm';
import { toast } from '@/lib/utils/toast';

interface Props {
  initialSlug: string;
  initialName: string;
}

const SLUG_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

export function GeneralSettingsForm({ initialSlug, initialName }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [slug, setSlug] = useState(initialSlug);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const dirty = name.trim() !== initialName || slug.trim().toLowerCase() !== initialSlug;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const nextName = name.trim();
    const nextSlug = slug.trim().toLowerCase();

    if (nextName.length === 0) {
      toast.error('Workspace name cannot be empty');
      return;
    }
    if (nextSlug.length < 3 || nextSlug.length > 40 || !SLUG_RE.test(nextSlug)) {
      toast.error('Slug must be 3–40 chars, lowercase letters/digits/hyphens');
      return;
    }

    setSaving(true);
    try {
      const patch: { name?: string; slug?: string } = {};
      if (nextName !== initialName) patch.name = nextName;
      if (nextSlug !== initialSlug) patch.slug = nextSlug;

      const res = await fetch(`/api/workspaces/${initialSlug}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (data.error === 'slug_taken') {
          toast.error('That slug is already taken');
        } else if (data.error === 'invalid_slug') {
          toast.error('Invalid slug format');
        } else if (data.error === 'invalid_name') {
          toast.error('Invalid workspace name');
        } else {
          toast.error(data.error ?? 'Failed to save');
        }
        return;
      }

      const data = (await res.json()) as { slug: string; name: string };
      toast.success('Workspace updated');
      if (data.slug !== initialSlug) {
        router.replace(`/w/${data.slug}/settings/general`);
      } else {
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    const ok = await confirmDialog({
      title: 'Delete workspace?',
      message: `This permanently deletes "${initialName}" and all its projects, brand kits, and members. This cannot be undone.`,
      confirmLabel: 'Delete workspace',
      danger: true,
    });
    if (!ok) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/workspaces/${initialSlug}`, { method: 'DELETE' });
      if (res.status === 204) {
        toast.success('Workspace deleted');
        router.replace('/');
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (data.error === 'last_workspace') {
        toast.error('You cannot delete your last workspace');
      } else if (data.error === 'forbidden') {
        toast.error('Only owners can delete a workspace');
      } else {
        toast.error(data.error ?? 'Failed to delete');
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-12">
      <form onSubmit={save} className="flex flex-col gap-6">
        <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-ink">General</h2>

        <div>
          <label htmlFor="ws-name" className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.05em] text-ink-3">
            Workspace name
          </label>
          <Input
            id="ws-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
            placeholder="Acme Inc."
            className="h-10 w-full rounded-md border border-rule bg-bg-elevated px-3 text-sm text-ink placeholder:text-ink-4 focus:border-brand focus:ring-4 focus:ring-brand-soft"
          />
        </div>

        <div>
          <label htmlFor="ws-slug" className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.05em] text-ink-3">
            Slug
          </label>
          <div className="flex items-stretch overflow-hidden rounded-md border border-rule bg-bg-elevated focus-within:border-brand focus-within:ring-4 focus-within:ring-brand-soft">
            <span className="inline-flex items-center border-r border-rule bg-bg-sunken px-3 font-mono text-[12px] text-ink-3">
              /w/
            </span>
            <Input
              id="ws-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              maxLength={40}
              placeholder="acme"
              className="h-10 flex-1 border-0 bg-transparent px-3 text-sm text-ink focus:outline-none focus:ring-0"
            />
          </div>
          <p className="mt-1.5 text-[12px] text-ink-3">
            Lowercase letters, digits, and hyphens. 3–40 characters.
          </p>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={!dirty || saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>

      <section className="rounded-[14px] border border-danger/40 bg-bg-elevated p-6">
        <h2 className="text-sm font-semibold text-danger">Danger zone</h2>
        <p className="mt-1 text-sm text-ink-2">
          Deleting this workspace removes all projects, brand kits, members, and pending invites. This cannot be undone.
        </p>
        <div className="mt-4">
          <Button variant="danger" onClick={onDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete workspace'}
          </Button>
        </div>
      </section>
    </div>
  );
}
