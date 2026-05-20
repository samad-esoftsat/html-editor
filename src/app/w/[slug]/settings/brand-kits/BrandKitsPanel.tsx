'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ColorPicker } from '@/components/ui/ColorPicker';
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
    <div className="flex flex-col gap-8">
      <section>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-ink">
              Brand kits · <span className="font-mono text-ink-3">{kits.length}</span>
            </h2>
            <p className="mt-2 text-sm text-ink-3">
              Apply a kit to a project to update its colors, fonts, logo, and footer in one click.
            </p>
          </div>
          {canManage && (
            <Button onClick={() => setCreatingNew(true)}>+ New brand kit</Button>
          )}
        </div>

        {kits.length === 0 ? (
          <div className="mt-8 rounded-[14px] border-2 border-dashed border-rule-strong bg-bg-cream p-12 text-center">
            <p className="text-base font-semibold text-ink">No brand kits yet.</p>
            {canManage && (
              <p className="mt-2 text-sm text-ink-3">
                <button
                  onClick={() => setCreatingNew(true)}
                  className="text-ink underline decoration-brand decoration-[1.5px] underline-offset-4"
                >
                  Create your first one
                </button>
                .
              </p>
            )}
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
            {kits.map((kit) => {
              const busy = pendingKit === kit.id;
              const colors = readColors(kit.colors);
              const fonts = readFonts(kit.fonts);
              const swatches = [colors.primary, colors.secondary, colors.accent, colors.text, colors.background];
              return (
                <article
                  key={kit.id}
                  className="group overflow-hidden rounded-[14px] border border-rule bg-bg-elevated transition-all hover:border-rule-strong hover:shadow-[0_8px_24px_-12px_rgba(180,66,28,0.10)]"
                >
                  <div className="flex h-16 overflow-hidden" aria-hidden="true">
                    {swatches.map((c, i) => (
                      <div key={i} className="flex-1" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                  <div className="border-t border-rule p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="truncate text-base font-semibold text-ink">{kit.name}</h3>
                      {kit.is_default && (
                        <span className="inline-flex items-center rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-brand-ink">
                          DEFAULT
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                      {swatches.map((c, i) => (
                        <span key={i} className="font-mono text-[11px] text-ink-3">
                          {c.toUpperCase()}
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 text-sm text-ink-3" suppressHydrationWarning>
                      <span className="text-ink-2">{fonts.heading || 'Sans'} / {fonts.body || 'Sans'}</span> · Updated{' '}
                      <span className="font-mono">{new Date(kit.updated_at).toLocaleDateString()}</span>
                    </p>
                    {canManage && (
                      <div className="mt-3 flex items-center gap-3 border-t border-rule pt-3 text-sm">
                        <button
                          onClick={() => setEditorKit(kit)}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 text-ink-3 transition-colors hover:text-ink disabled:opacity-40"
                        >
                          <Pencil size={14} /> Edit
                        </button>
                        {!kit.is_default && (
                          <button
                            onClick={() => setAsDefault(kit)}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 text-ink-3 transition-colors hover:text-ink disabled:opacity-40"
                          >
                            Set default
                          </button>
                        )}
                        <button
                          onClick={() => deleteKit(kit)}
                          disabled={busy}
                          className="ml-auto inline-flex items-center gap-1.5 text-ink-3 transition-colors hover:text-danger disabled:opacity-40"
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    )}
                    {busy && (
                      <div className="mt-3 flex items-center gap-2 text-sm text-ink-3">
                        <Spinner /> Working…
                      </div>
                    )}
                  </div>
                </article>
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
          className="fixed inset-0 z-[200] flex items-center justify-center bg-ink/40 backdrop-blur-sm p-6"
          variants={fade}
          initial="hidden"
          animate="show"
          exit="exit"
          onClick={onClose}
        >
          <motion.div
            className="w-[560px] max-w-full max-h-[90vh] overflow-y-auto rounded-[14px] border border-rule bg-bg-elevated p-6 shadow-[0_30px_80px_-20px_rgba(20,20,20,0.25)]"
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
      <h3 className="text-[20px] font-semibold tracking-[-0.01em] text-ink">
        {isEdit ? 'Edit brand kit' : 'New brand kit'}
      </h3>
      <p className="mt-1 mb-5 text-sm text-ink-3">
        Used as defaults when creating projects in this workspace.
      </p>

      <div className="flex flex-col gap-5">
        <div>
          <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.05em] text-ink-3">
            Name
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme primary"
            maxLength={100}
            autoFocus
            className="h-10 w-full rounded-md border border-rule bg-bg-elevated px-3 text-sm text-ink placeholder:text-ink-4 focus:border-brand focus:ring-4 focus:ring-brand-soft"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-ink">
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
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.05em] text-ink-3">
                Primary
              </label>
              <ColorPicker value={colors.primary} onChange={(v) => setColors({ ...colors, primary: v })} />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.05em] text-ink-3">
                Secondary
              </label>
              <ColorPicker value={colors.secondary} onChange={(v) => setColors({ ...colors, secondary: v })} />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.05em] text-ink-3">
                Accent
              </label>
              <ColorPicker value={colors.accent} onChange={(v) => setColors({ ...colors, accent: v })} />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.05em] text-ink-3">
                Text
              </label>
              <ColorPicker value={colors.text} onChange={(v) => setColors({ ...colors, text: v })} />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.05em] text-ink-3">
                Background
              </label>
              <ColorPicker value={colors.background} onChange={(v) => setColors({ ...colors, background: v })} />
            </div>
          </div>
        </Section>

        <Section title="Fonts">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.05em] text-ink-3">
                Heading
              </label>
              <Input
                value={fonts.heading}
                onChange={(e) => setFonts({ ...fonts, heading: e.target.value })}
                placeholder="Arial, sans-serif"
                className="h-10 w-full rounded-md border border-rule bg-bg-elevated px-3 text-sm text-ink placeholder:text-ink-4 focus:border-brand focus:ring-4 focus:ring-brand-soft"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.05em] text-ink-3">
                Body
              </label>
              <Input
                value={fonts.body}
                onChange={(e) => setFonts({ ...fonts, body: e.target.value })}
                placeholder="Arial, sans-serif"
                className="h-10 w-full rounded-md border border-rule bg-bg-elevated px-3 text-sm text-ink placeholder:text-ink-4 focus:border-brand focus:ring-4 focus:ring-brand-soft"
              />
            </div>
          </div>
        </Section>

        <Section title="Logo">
          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.05em] text-ink-3">
                Image URL
              </label>
              <Input
                value={logo.url}
                onChange={(e) => setLogo({ ...logo, url: e.target.value })}
                placeholder="https://…"
                className="h-10 w-full rounded-md border border-rule bg-bg-elevated px-3 text-sm text-ink placeholder:text-ink-4 focus:border-brand focus:ring-4 focus:ring-brand-soft"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.05em] text-ink-3">
                Alt text
              </label>
              <Input
                value={logo.alt}
                onChange={(e) => setLogo({ ...logo, alt: e.target.value })}
                placeholder="Acme logo"
                className="h-10 w-full rounded-md border border-rule bg-bg-elevated px-3 text-sm text-ink placeholder:text-ink-4 focus:border-brand focus:ring-4 focus:ring-brand-soft"
              />
            </div>
          </div>
        </Section>

        <Section title="Footer (Name, Address, Phone)">
          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.05em] text-ink-3">
                Company name
              </label>
              <Input
                value={footer.company}
                onChange={(e) => setFooter({ ...footer, company: e.target.value })}
                placeholder="Acme Inc."
                className="h-10 w-full rounded-md border border-rule bg-bg-elevated px-3 text-sm text-ink placeholder:text-ink-4 focus:border-brand focus:ring-4 focus:ring-brand-soft"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.05em] text-ink-3">
                Address
              </label>
              <textarea
                value={footer.address}
                onChange={(e) => setFooter({ ...footer, address: e.target.value })}
                placeholder="123 Main St, Springfield, USA"
                rows={2}
                className="min-h-[80px] w-full rounded-md border border-rule bg-bg-elevated px-3 py-2 text-sm leading-[1.5] text-ink placeholder:text-ink-4 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand-soft"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.05em] text-ink-3">
                  Phone
                </label>
                <Input
                  value={footer.phone}
                  onChange={(e) => setFooter({ ...footer, phone: e.target.value })}
                  placeholder="+1 555 555 0100"
                  className="h-10 w-full rounded-md border border-rule bg-bg-elevated px-3 text-sm text-ink placeholder:text-ink-4 focus:border-brand focus:ring-4 focus:ring-brand-soft"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.05em] text-ink-3">
                  Email
                </label>
                <Input
                  type="email"
                  value={footer.email}
                  onChange={(e) => setFooter({ ...footer, email: e.target.value })}
                  placeholder="hello@acme.com"
                  className="h-10 w-full rounded-md border border-rule bg-bg-elevated px-3 text-sm text-ink placeholder:text-ink-4 focus:border-brand focus:ring-4 focus:ring-brand-soft"
                />
              </div>
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
      <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-2">
        {title}
      </div>
      {children}
    </div>
  );
}
