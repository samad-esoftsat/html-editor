# Phase 4 — Polish & Deploy

> Phases 1–3 are functional. This phase is the difference between "demoable to engineers" and "demoable to the boss". UX states, OAuth, password reset, and a production deploy.

**Phase goal:** App feels finished — every state has a UX, Google login works, password reset round-trips, deployed to Vercel with environment variables set, smoke-test passes against the live URL.

---

## Task 1 — Toast notifications

**Files:**
- Create: `src/components/ui/Toast.tsx`, `src/lib/utils/toast.ts`

- [ ] **Step 1: `src/lib/utils/toast.ts` — tiny event-bus**

```typescript
type Kind = 'info' | 'success' | 'error';
export interface Toast { id: number; kind: Kind; message: string; ttl: number; }

type Listener = (toasts: Toast[]) => void;
const listeners = new Set<Listener>();
let toasts: Toast[] = [];
let nextId = 1;

function emit() { listeners.forEach(l => l(toasts)); }

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  l(toasts);
  return () => listeners.delete(l);
}

export function pushToast(message: string, kind: Kind = 'info', ttl = 4000) {
  const t: Toast = { id: nextId++, kind, message, ttl };
  toasts = [...toasts, t];
  emit();
  setTimeout(() => {
    toasts = toasts.filter(x => x.id !== t.id);
    emit();
  }, ttl);
}

export const toast = {
  info: (m: string) => pushToast(m, 'info'),
  success: (m: string) => pushToast(m, 'success'),
  error: (m: string) => pushToast(m, 'error', 6000),
};
```

- [ ] **Step 2: `src/components/ui/Toast.tsx`**

```typescript
'use client';
import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { subscribe, type Toast as T } from '@/lib/utils/toast';

const KIND_STYLE: Record<T['kind'], string> = {
  info: 'border-border-strong text-fg',
  success: 'border-success/40 text-success',
  error: 'border-danger/40 text-danger',
};

const ICON: Record<T['kind'], React.ComponentType<{ size?: number }>> = {
  info: Info, success: CheckCircle2, error: AlertCircle,
};

export function ToastViewport() {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => subscribe(setItems), []);
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {items.map(t => {
        const Icon = ICON[t.kind];
        return (
          <div key={t.id} className={`flex items-start gap-2 rounded-lg bg-panel-2 border ${KIND_STYLE[t.kind]} px-4 py-3 text-sm shadow-lg`}>
            <Icon size={16} />
            <span>{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Mount in root layout**

Edit `src/app/layout.tsx`:

```typescript
import './globals.css';
import type { Metadata } from 'next';
import { ToastViewport } from '@/components/ui/Toast';

export const metadata: Metadata = {
  title: 'GlobalTT Editor',
  description: 'Email campaign editor',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        {children}
        <ToastViewport />
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Replace `alert(...)` calls with `toast.error(...)`**

Search for `alert(` across the codebase and replace each with `toast.error(...)` from `@/lib/utils/toast`. For dashboard `confirm(...)` flows, leave the `confirm(...)` as-is (real confirmation dialogs land in Task 2).

Example in `NewProjectButton.tsx`:

```typescript
} catch (e) {
  toast.error(`Couldn't create project: ${(e as Error).message}`);
  setBusy(false);
}
```

- [ ] **Step 5: Commit**

```powershell
git add src/lib/utils/toast.ts src/components/ui/Toast.tsx src/app/layout.tsx src/components/dashboard
git commit -m "feat(ui): toast notifications, replace alert() calls"
```

---

## Task 2 — Confirmation dialog

**Files:**
- Create: `src/components/ui/ConfirmDialog.tsx`, `src/lib/utils/confirm.ts`

Replace native `confirm(...)` with a styled modal.

- [ ] **Step 1: `src/lib/utils/confirm.ts` — promise-based controller**

```typescript
type Listener = (state: ConfirmState | null) => void;
export interface ConfirmState {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}

const listeners = new Set<Listener>();
let current: ConfirmState | null = null;

export function subscribe(l: Listener) {
  listeners.add(l);
  l(current);
  return () => listeners.delete(l);
}

export function confirmDialog(opts: { title: string; message: string; confirmLabel?: string; danger?: boolean }): Promise<boolean> {
  return new Promise((resolve) => {
    current = {
      title: opts.title,
      message: opts.message,
      confirmLabel: opts.confirmLabel ?? 'Confirm',
      danger: opts.danger,
      resolve: (ok) => { current = null; listeners.forEach(l => l(null)); resolve(ok); },
    };
    listeners.forEach(l => l(current));
  });
}
```

- [ ] **Step 2: `src/components/ui/ConfirmDialog.tsx`**

```typescript
'use client';
import { useEffect, useState } from 'react';
import { Button } from './Button';
import { subscribe, type ConfirmState } from '@/lib/utils/confirm';

export function ConfirmDialog() {
  const [state, setState] = useState<ConfirmState | null>(null);
  useEffect(() => subscribe(setState), []);
  if (!state) return null;
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-6">
      <div className="bg-panel border border-border-strong rounded-xl p-6 w-[420px]">
        <div className="font-semibold text-fg mb-2">{state.title}</div>
        <div className="text-sm text-muted mb-6">{state.message}</div>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={() => state.resolve(false)}>Cancel</Button>
          <Button variant={state.danger ? 'danger' : 'primary'} onClick={() => state.resolve(true)}>
            {state.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Mount in layout**

Add `<ConfirmDialog />` to `src/app/layout.tsx`:

```typescript
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
// ...
{children}
<ToastViewport />
<ConfirmDialog />
```

- [ ] **Step 4: Replace `confirm(...)` calls**

In `src/components/dashboard/ProjectCard.tsx`:

```typescript
import { confirmDialog } from '@/lib/utils/confirm';
// ...
async function onDelete() {
  const ok = await confirmDialog({
    title: 'Delete project?',
    message: `"${project.name}" will be permanently deleted. This cannot be undone.`,
    confirmLabel: 'Delete',
    danger: true,
  });
  if (!ok) return;
  start(async () => {
    await deleteProject(project.id);
    onChanged();
  });
}
```

In `src/components/editor/panels/ProductSectionPanel.tsx` for the trash button:

```typescript
import { confirmDialog } from '@/lib/utils/confirm';
// ...
<button onClick={async () => {
  const ok = await confirmDialog({
    title: 'Remove section?',
    message: `"${section.title}" will be removed.`,
    confirmLabel: 'Remove',
    danger: true,
  });
  if (ok) store.getState().removeSection(section.id);
}}>
```

- [ ] **Step 5: Commit**

```powershell
git add src/lib/utils/confirm.ts src/components/ui/ConfirmDialog.tsx src/app/layout.tsx src/components/dashboard/ProjectCard.tsx src/components/editor/panels/ProductSectionPanel.tsx
git commit -m "feat(ui): styled confirmation dialog, replace native confirm()"
```

---

## Task 3 — Loading skeleton on dashboard

**Files:**
- Create: `src/components/dashboard/CardSkeleton.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: `src/components/dashboard/CardSkeleton.tsx`**

```typescript
export function CardSkeleton() {
  return (
    <div className="rounded-xl bg-panel border border-border p-5 animate-pulse">
      <div className="h-4 bg-border-strong rounded w-2/3 mb-2" />
      <div className="h-3 bg-border rounded w-1/2 mb-6" />
      <div className="flex gap-2">
        <div className="flex-1 h-8 bg-border rounded" />
        <div className="h-8 w-10 bg-border rounded" />
        <div className="h-8 w-10 bg-border rounded" />
        <div className="h-8 w-10 bg-border rounded" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wrap dashboard fetch in Suspense — convert page to use `loading.tsx`**

Create `src/app/loading.tsx`:

```typescript
import { CardSkeleton } from '@/components/dashboard/CardSkeleton';

export default function Loading() {
  return (
    <main className="max-w-6xl mx-auto p-8">
      <header className="flex items-center justify-between mb-8">
        <div>
          <div className="h-3 w-24 bg-border rounded mb-2" />
          <div className="h-7 w-48 bg-border rounded" />
        </div>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Commit**

```powershell
git add src/components/dashboard/CardSkeleton.tsx src/app/loading.tsx
git commit -m "feat(ui): dashboard loading skeleton"
```

---

## Task 4 — Google OAuth

**Files:**
- Modify: `src/components/auth/LoginForm.tsx`, `src/components/auth/SignupForm.tsx`

Configure in Supabase first.

- [ ] **Step 1: Configure Google provider in Supabase Dashboard**

1. Open Supabase Dashboard → Authentication → Providers → Google.
2. Enable. Paste OAuth client ID + secret from Google Cloud Console (create OAuth 2.0 client → Web → authorized redirect URI: the value Supabase shows in the Google panel — `https://<project>.supabase.co/auth/v1/callback`).
3. Save.
4. Authentication → URL Configuration → Site URL = `http://localhost:3000` (dev) and add `https://<your-vercel-url>` to Additional Redirect URLs.

- [ ] **Step 2: Add the Google button to `LoginForm.tsx`**

After the Sign In button, add:

```typescript
async function googleSignIn() {
  const supabase = createClient();
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
}
// ... in JSX:
<Button type="button" variant="secondary" className="w-full" onClick={googleSignIn}>
  G &nbsp; Continue with Google
</Button>
```

Same change in `SignupForm.tsx` (button labelled "Sign up with Google").

- [ ] **Step 3: Manual test**

Run dev. Click Continue with Google → Google consent → land on `/`. Stop.

- [ ] **Step 4: Commit**

```powershell
git add src/components/auth
git commit -m "feat(auth): Google OAuth on login and signup"
```

---

## Task 5 — Empty preview placeholder & deleted-image guard

**Files:**
- Modify: `src/components/editor/PreviewBody.tsx`

The preview should never show broken-image icons. Add a transparent placeholder when `imageSrc` is empty.

- [ ] **Step 1: Add placeholder rendering**

In `PreviewBody.tsx`, replace bare `<img src={...}>` calls with a small helper:

```typescript
function PlaceholderImg({ width, height, label }: { width?: number; height?: number; label: string }) {
  return (
    <div style={{
      width: '100%', maxWidth: width ?? 355, aspectRatio: width && height ? `${width} / ${height}` : '4/3',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: '#eaeaea', color: '#888', border: '1px dashed #bbb', fontSize: 12,
    }}>{label}</div>
  );
}
```

Then for each `<img>` rendered from `data`, fall back to `<PlaceholderImg />` when src is empty. For example, header logo:

```typescript
{data.header.logoSrc ? (
  <img src={data.header.logoSrc} alt={data.header.logoAlt} style={{ maxWidth: data.header.logoWidth, width: '100%' }} />
) : (
  <PlaceholderImg width={data.header.logoWidth} label="Logo image — add a URL or upload" />
)}
```

Apply the same pattern to header banner, section image, footer banner.

- [ ] **Step 2: Commit**

```powershell
git add src/components/editor/PreviewBody.tsx
git commit -m "feat(editor): preview placeholder when image src is empty"
```

---

## Task 6 — Service-role import lint guard

**Files:**
- Modify: `eslint.config.mjs` (or `.eslintrc.json`, depending on `create-next-app` output)

Prevent `SUPABASE_SERVICE_ROLE_KEY` from being referenced in any client-bundled file.

- [ ] **Step 1: Locate the ESLint config**

```powershell
Get-ChildItem -Filter eslint.config.* ; Get-ChildItem -Filter .eslintrc.*
```

- [ ] **Step 2: Add a `no-restricted-syntax` rule for client code**

If `eslint.config.mjs`, append a config block:

```javascript
{
  files: ['src/components/**/*.{ts,tsx}', 'src/app/**/page.tsx', 'src/app/**/layout.tsx', 'src/lib/api/**/*.ts'],
  rules: {
    'no-restricted-syntax': ['error', {
      selector: "MemberExpression[object.name='process'][property.name='env'] > Identifier[name='SUPABASE_SERVICE_ROLE_KEY']",
      message: 'SUPABASE_SERVICE_ROLE_KEY must never be referenced in client-bundled code.',
    }],
  },
}
```

- [ ] **Step 3: Verify**

```powershell
npm run lint
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```powershell
git add eslint.config.mjs
git commit -m "chore(lint): forbid service-role key in client-bundled code"
```

---

## Task 7 — README

**Files:**
- Create/replace: `README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# GlobalTT Email Editor

Multi-tenant Next.js + Supabase web app for creating, customising, and exporting GlobalTT email campaigns. Replaces the manual HTML-editing workflow with a visual editor anyone on the team can use.

## Quick start

```powershell
npm install
cp .env.local.example .env.local      # then fill in Supabase URL + anon key
npm run dev
```

Open http://localhost:3000.

## Database

Apply migrations once per Supabase project, in order:

1. Paste `supabase/migrations/0001_init.sql` into Supabase Dashboard → SQL Editor → Run.
2. Paste `supabase/migrations/0002_storage.sql` → Run.

## Tests

| Command | Scope |
| --- | --- |
| `npm test`        | Vitest unit tests (export, import, store, debounce). |
| `npm run e2e`     | Playwright end-to-end (requires `E2E_EMAIL` / `E2E_PASSWORD` in `.env.local`). |
| `npm run lint`    | ESLint. |
| `npm run typecheck` | `tsc --noEmit`. |

## Project layout

See `docs/superpowers/plans/2026-05-05-globaltt-editor/SPEC.md` §3.

## Deployment

Hosted on Vercel. `main` branch auto-deploys to production. Required env vars on Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `NEXT_PUBLIC_SITE_URL`
```

- [ ] **Step 2: Commit**

```powershell
git add README.md
git commit -m "docs: README with quick start, db setup, tests, deployment"
```

---

## Task 8 — Production build sanity

**Files:**
- None (verification only)

- [ ] **Step 1: Run a production build locally**

```powershell
npm run build
```

Expected: build succeeds, no TS errors, no ESLint errors blocking the build.

- [ ] **Step 2: Smoke-test the production build**

```powershell
npm run start
```

Open http://localhost:3000, sign in, edit a project, download HTML, sign out. Stop with Ctrl+C.

- [ ] **Step 3: Commit (no-op if no changes; otherwise fixes go here)**

If the build flagged unused vars, missing types, or the like, fix those and commit:

```powershell
git add -A
git commit -m "fix: production build clean"
```

---

## Task 9 — Push to GitHub

**Files:**
- None

- [ ] **Step 1: Create a GitHub repo (private)**

In GitHub, create a new private repository named `globaltt-email-editor`. Do NOT initialise with README/license — we already have one.

- [ ] **Step 2: Push**

```powershell
git remote add origin https://github.com/<your-org>/globaltt-email-editor.git
git push -u origin main
```

---

## Task 10 — Vercel deploy

**Files:**
- None on disk; Vercel dashboard configuration only

- [ ] **Step 1: Import the GitHub repo into Vercel**

Vercel Dashboard → Add New → Project → Import the GitHub repo.

- [ ] **Step 2: Set environment variables**

In the import wizard, add:

```
NEXT_PUBLIC_SUPABASE_URL=<from .env.local>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from .env.local>
SUPABASE_SERVICE_ROLE_KEY=<from Supabase Settings → API>
NEXT_PUBLIC_SITE_URL=https://<your-vercel-domain>.vercel.app
```

Set them for **Production** and **Preview** environments.

- [ ] **Step 3: Deploy**

Click Deploy. Wait for build.

- [ ] **Step 4: Add the production URL to Supabase Auth**

Supabase Dashboard → Authentication → URL Configuration:
- Set **Site URL** to your Vercel production URL.
- Add the Vercel preview URL pattern (`https://*-<your-vercel-team>.vercel.app`) under Additional Redirect URLs.

- [ ] **Step 5: Production smoke test**

Visit the production URL. Sign up with a real email. Confirm. Sign in. Create a project. Edit a section. Reload — persists. Download HTML. Sign out. Sign in again. All works.

- [ ] **Step 6: Commit and tag**

```powershell
git tag v0.1.0
git push origin v0.1.0
```

---

## Task 11 — Production smoke test E2E

**Files:**
- Create: `tests/e2e/smoke.prod.spec.ts`

Optional but recommended — a Playwright smoke test pointed at production.

- [ ] **Step 1: Create the test**

```typescript
import { test, expect } from '@playwright/test';

const BASE = process.env.PROD_URL;

test.skip(!BASE, 'Set PROD_URL to run prod smoke');

test.use({ baseURL: BASE });

test('prod login + dashboard renders', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
});
```

- [ ] **Step 2: Run with PROD_URL set**

```powershell
$env:PROD_URL="https://<your-vercel-domain>.vercel.app" ; npm run e2e -- tests/e2e/smoke.prod.spec.ts
```

- [ ] **Step 3: Commit**

```powershell
git add tests/e2e/smoke.prod.spec.ts
git commit -m "test(e2e): production smoke test guarded by PROD_URL"
```

---

## Phase 4 acceptance

- ☑ Toasts replace `alert(...)`; success on save, error on conflict.
- ☑ Styled confirm dialog replaces native `confirm()`.
- ☑ Dashboard shows loading skeleton during initial fetch.
- ☑ Google OAuth works end-to-end (sign in → land on dashboard).
- ☑ Empty image fields render placeholder, not broken-image icon.
- ☑ ESLint blocks any client file from referencing the service-role key.
- ☑ `npm run build` succeeds; `npm run start` serves production build cleanly.
- ☑ Deployed to Vercel, custom Supabase Site URL set, full sign-up → editor → download flow works on the live URL.
- ☑ All four phases' acceptance bullets demonstrably pass.

---

## After v1

Items deliberately deferred — track in your project board, not here:

- Drag-and-drop section reordering (DnD-kit).
- Project sharing across user accounts (`projects.shared_with` join table).
- Template marketplace.
- Direct Nutshell CRM API push (replace HTML download with a "Send to Nutshell" button).
- Undo/redo (`zundo` middleware on Zustand).
- Versioning / project history (`project_versions` table snapshotting on `data` changes).
- Full a11y audit and remediation.
- I18n of editor UI.
- Custom domain on Vercel.

**v1 ships when Phase 4 acceptance is green.**
