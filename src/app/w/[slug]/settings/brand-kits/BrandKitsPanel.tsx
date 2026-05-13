'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from '@/components/ui/Button';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Textarea } from '@/components/ui/Textarea';
import { fade, scaleFade } from '@/lib/motion';
import { confirmDialog } from '@/lib/utils/confirm';
import { toast } from '@/lib/utils/toast';

export interface BrandKitRow {
  id: string;
  org_id: string;
  name: string;
  is_default: boolean;
  colors: Record<string, unknown>;
  fonts: Record<string, unknown>;
  logo: Record<string, unknown>;
  footer: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface Props {
  slug: string;
  kits: BrandKitRow[];
  canManage: boolean;
}

interface ColorsShape {
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  background: string;
}

interface FontsShape {
  heading: string;
  body: string;
}

interface LogoShape {
  url: string;
  alt: string;
}

interface FooterShape {
  company: string;
  address: string;
  phone: string;
  email: string;
}

const DEFAULT_COLORS: ColorsShape = {
  primary: '#1e3a8a',
  secondary: '#3b82f6',
  accent: '#f59e0b',
  text: '#0f172a',
  background: '#ffffff',
};

const DEFAULT_FONTS: FontsShape = {
  heading: 'Arial, sans-serif',
  body: 'Arial, sans-serif',
};

const DEFAULT_LOGO: LogoShape = { url: '', alt: '' };

const DEFAULT_FOOTER: FooterShape = { company: '', address: '', phone: '', email: '' };

function getString(obj: Record<string, unknown>, key: string, fallback = ''): string {
  const v = obj[key];
  return typeof v === 'string' ? v : fallback;
}

function readColors(obj: Record<string, unknown>): ColorsShape {
  return {
    primary: getString(obj, 'primary', DEFAULT_COLORS.primary),
    secondary: getString(obj, 'secondary', DEFAULT_COLORS.secondary),
    accent: getString(obj, 'accent', DEFAULT_COLORS.accent),
    text: getString(obj, 'text', DEFAULT_COLORS.text),
    background: getString(obj, 'background', DEFAULT_COLORS.background),
  };
}

function readFonts(obj: Record<string, unknown>): FontsShape {
  return {
    heading: getString(obj, 'heading', DEFAULT_FONTS.heading),
    body: getString(obj, 'body', DEFAULT_FONTS.body),
  };
}

function readLogo(obj: Record<string, unknown>): LogoShape {
  return { url: getString(obj, 'url'), alt: getString(obj, 'alt') };
}

function readFooter(obj: Record<string, unknown>): FooterShape {
  return {
    company: getString(obj, 'company'),
    address: getString(obj, 'address'),
    phone: getString(obj, 'phone'),
    email: getString(obj, 'email'),
  };
}

function mapErrorToToast(code: string | undefined, fallback: string) {
  switch (code) {
    case 'invalid_name':
      return 'Name must be 1–100 characters';
    case 'invalid_colors':
      return 'Invalid colors data';
    case 'invalid_fonts':
      return 'Invalid fonts data';
    case 'invalid_logo':
      return 'Invalid logo data';
    case 'invalid_footer':
      return 'Invalid footer data';
    case 'invalid_is_default':
      return 'Invalid default flag';
    case 'default_conflict':
      return 'Another kit is already marked default — try again';
    case 'forbidden':
      return 'You do not have permission to do that';
    case 'not_found':
      return 'Brand kit not found';
    case 'empty_patch':
      return 'No changes to save';
    default:
      return code ?? fallback;
  }
}

export function BrandKitsPanel({ slug, kits, canManage }: Props) {
  const router = useRouter();
  const [editorKit, setEditorKit] = useState<BrandKitRow | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [pendingKit, setPendingKit] = useState<string | null>(null);

  async function setAsDefault(kit: BrandKitRow) {
    if (kit.is_default) return;
    setPendingKit(kit.id);
    try {
      const res = await fetch(`/api/workspaces/${slug}/brand-kits/${kit.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ is_default: true }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(mapErrorToToast(data.error, 'Failed to set default'));
        return;
      }
      toast.success(`"${kit.name}" is now the default`);
      router.refresh();
    } finally {
      setPendingKit(null);
    }
  }

  async function deleteKit(kit: BrandKitRow) {
    const ok = await confirmDialog({
      title: 'Delete brand kit?',
      message: `Delete "${kit.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;

    setPendingKit(kit.id);
    try {
      const res = await fetch(`/api/workspaces/${slug}/brand-kits/${kit.id}`, {
        method: 'DELETE',
      });
      if (res.status === 204) {
        toast.success('Brand kit deleted');
        router.refresh();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(mapErrorToToast(data.error, 'Failed to delete'));
    } finally {
      setPendingKit(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-fg">Brand kits</h2>
            <p className="mt-1 text-sm text-muted">
              Reusable colors, fonts, logo, and footer info applied to new projects.
            </p>
          </div>
          {canManage && (
            <Button onClick={() => setCreatingNew(true)}>New brand kit</Button>
          )}
        </div>

        {kits.length === 0 ? (
          <div className="rounded-lg border border-border-strong bg-panel p-8 text-center text-sm text-muted">
            No brand kits yet.
            {canManage && (
              <>
                {' '}
                <button
                  onClick={() => setCreatingNew(true)}
                  className="text-brand hover:underline"
                >
                  Create your first one
                </button>
                .
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {kits.map((kit) => {
              const busy = pendingKit === kit.id;
              const colors = readColors(kit.colors);
              return (
                <div
                  key={kit.id}
                  className="flex flex-col gap-3 rounded-lg border border-border-strong bg-panel p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="truncate font-semibold text-fg">{kit.name}</div>
                        {kit.is_default && (
                          <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand">
                            Default
                          </span>
                        )}
                      </div>
                    </div>
                    {busy && <Spinner />}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {[colors.primary, colors.secondary, colors.accent, colors.text, colors.background].map(
                      (c, i) => (
                        <div
                          key={i}
                          className="h-6 w-6 rounded border border-border-strong"
                          style={{ backgroundColor: c }}
                          title={c}
                        />
                      ),
                    )}
                  </div>

                  {canManage && (
                    <div className="mt-1 flex items-center justify-end gap-1">
                      {!kit.is_default && (
                        <Button
                          variant="ghost"
                          onClick={() => setAsDefault(kit)}
                          disabled={busy}
                        >
                          Set default
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        onClick={() => setEditorKit(kit)}
                        disabled={busy}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => deleteKit(kit)}
                        disabled={busy}
                        className="text-danger hover:text-danger hover:bg-danger/10"
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <BrandKitEditor
        open={creatingNew || editorKit !== null}
        kit={editorKit}
        slug={slug}
        onClose={() => {
          setCreatingNew(false);
          setEditorKit(null);
        }}
        onSaved={() => {
          setCreatingNew(false);
          setEditorKit(null);
          router.refresh();
        }}
      />
    </div>
  );
}

interface EditorProps {
  open: boolean;
  kit: BrandKitRow | null;
  slug: string;
  onClose: () => void;
  onSaved: () => void;
}

function BrandKitEditor({ open, kit, slug, onClose, onSaved }: EditorProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-6"
          variants={fade}
          initial="hidden"
          animate="show"
          exit="exit"
          onClick={onClose}
        >
          <motion.div
            className="w-[560px] max-w-full max-h-[90vh] overflow-y-auto rounded-xl border border-border-strong bg-panel p-6"
            variants={scaleFade}
            initial="hidden"
            animate="show"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            <EditorForm kit={kit} slug={slug} onClose={onClose} onSaved={onSaved} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function EditorForm({
  kit,
  slug,
  onClose,
  onSaved,
}: {
  kit: BrandKitRow | null;
  slug: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = kit !== null;
  const [name, setName] = useState(kit?.name ?? '');
  const [isDefault, setIsDefault] = useState(kit?.is_default ?? false);
  const [colors, setColors] = useState<ColorsShape>(
    kit ? readColors(kit.colors) : { ...DEFAULT_COLORS },
  );
  const [fonts, setFonts] = useState<FontsShape>(
    kit ? readFonts(kit.fonts) : { ...DEFAULT_FONTS },
  );
  const [logo, setLogo] = useState<LogoShape>(
    kit ? readLogo(kit.logo) : { ...DEFAULT_LOGO },
  );
  const [footer, setFooter] = useState<FooterShape>(
    kit ? readFooter(kit.footer) : { ...DEFAULT_FOOTER },
  );
  const [busy, setBusy] = useState(false);

  async function save() {
    const trimmed = name.trim();
    if (trimmed.length === 0 || trimmed.length > 100) {
      toast.error('Name must be 1–100 characters');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: trimmed,
        is_default: isDefault,
        colors: { ...colors },
        fonts: { ...fonts },
        logo: { ...logo },
        footer: { ...footer },
      };
      const url = isEdit
        ? `/api/workspaces/${slug}/brand-kits/${kit.id}`
        : `/api/workspaces/${slug}/brand-kits`;
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(mapErrorToToast(data.error, isEdit ? 'Failed to save' : 'Failed to create'));
        return;
      }
      toast.success(isEdit ? 'Brand kit updated' : 'Brand kit created');
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mb-1 font-semibold text-fg">
        {isEdit ? 'Edit brand kit' : 'New brand kit'}
      </div>
      <div className="mb-5 text-sm text-muted">
        Used as defaults when creating projects in this workspace.
      </div>

      <div className="flex flex-col gap-5">
        <Field label="Name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme primary"
            maxLength={100}
            autoFocus
          />
        </Field>

        <label className="flex items-center gap-2 text-sm text-fg">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="h-4 w-4 rounded border-border-strong"
          />
          Use as default for new projects
        </label>

        <Section title="Colors">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Primary">
              <ColorPicker value={colors.primary} onChange={(v) => setColors({ ...colors, primary: v })} />
            </Field>
            <Field label="Secondary">
              <ColorPicker value={colors.secondary} onChange={(v) => setColors({ ...colors, secondary: v })} />
            </Field>
            <Field label="Accent">
              <ColorPicker value={colors.accent} onChange={(v) => setColors({ ...colors, accent: v })} />
            </Field>
            <Field label="Text">
              <ColorPicker value={colors.text} onChange={(v) => setColors({ ...colors, text: v })} />
            </Field>
            <Field label="Background">
              <ColorPicker value={colors.background} onChange={(v) => setColors({ ...colors, background: v })} />
            </Field>
          </div>
        </Section>

        <Section title="Fonts">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Heading">
              <Input
                value={fonts.heading}
                onChange={(e) => setFonts({ ...fonts, heading: e.target.value })}
                placeholder="Arial, sans-serif"
              />
            </Field>
            <Field label="Body">
              <Input
                value={fonts.body}
                onChange={(e) => setFonts({ ...fonts, body: e.target.value })}
                placeholder="Arial, sans-serif"
              />
            </Field>
          </div>
        </Section>

        <Section title="Logo">
          <div className="flex flex-col gap-3">
            <Field label="Image URL">
              <Input
                value={logo.url}
                onChange={(e) => setLogo({ ...logo, url: e.target.value })}
                placeholder="https://…"
              />
            </Field>
            <Field label="Alt text">
              <Input
                value={logo.alt}
                onChange={(e) => setLogo({ ...logo, alt: e.target.value })}
                placeholder="Acme logo"
              />
            </Field>
          </div>
        </Section>

        <Section title="Footer (Name, Address, Phone)">
          <div className="flex flex-col gap-3">
            <Field label="Company name">
              <Input
                value={footer.company}
                onChange={(e) => setFooter({ ...footer, company: e.target.value })}
                placeholder="Acme Inc."
              />
            </Field>
            <Field label="Address">
              <Textarea
                value={footer.address}
                onChange={(e) => setFooter({ ...footer, address: e.target.value })}
                placeholder="123 Main St, Springfield, USA"
                rows={2}
              />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Phone">
                <Input
                  value={footer.phone}
                  onChange={(e) => setFooter({ ...footer, phone: e.target.value })}
                  placeholder="+1 555 555 0100"
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={footer.email}
                  onChange={(e) => setFooter({ ...footer, email: e.target.value })}
                  placeholder="hello@acme.com"
                />
              </Field>
            </div>
          </div>
        </Section>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={save} disabled={busy}>
          {busy ? <Spinner /> : isEdit ? 'Save changes' : 'Create brand kit'}
        </Button>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-brand">
        {title}
      </div>
      {children}
    </div>
  );
}
