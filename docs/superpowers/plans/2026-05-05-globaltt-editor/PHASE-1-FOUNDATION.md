# Phase 1 — Foundation

> **Read [`SPEC.md`](./SPEC.md) first.** Every reference to types, schema, or routes lives there.

**Phase goal:** A logged-in user lands on a dashboard, creates / renames / duplicates / deletes projects backed by Supabase. Editor route exists but is a stub. End of phase = demoable.

**Prereqs:** Supabase project provisioned, anon key + URL on hand. Working directory clean except for the three reference HTMLs.

---

## Task 1 — Move references, init git, scaffold Next.js

**Files:**
- Modify: working directory layout
- Create: `.gitignore`, `package.json`, `tsconfig.json`, etc. (via `create-next-app`)

- [ ] **Step 1: Move reference HTMLs into `reference/`**

```powershell
New-Item -ItemType Directory -Path reference | Out-Null
Move-Item globaltt-email.html, globaltt-email-editor.html, globaltt-editor-presentation.html reference\
```

- [ ] **Step 2: Initialise git**

```powershell
git init -b main
```

- [ ] **Step 3: Scaffold Next.js (TypeScript, Tailwind, App Router, `src/`)**

```powershell
npx --yes create-next-app@15 . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-turbopack
```

When asked "files exist, override?" — accept. The `reference/` folder, `.superpowers/`, and `docs/` are untouched because they're not on the conflict list.

- [ ] **Step 4: Verify dev server starts**

```powershell
npm run dev
```

Open `http://localhost:3000`. Expected: default Next.js welcome page. Stop with Ctrl+C.

- [ ] **Step 5: Append project-specific entries to `.gitignore`**

Append to `.gitignore`:

```
.env.local
.env*.local
.superpowers/
playwright-report/
test-results/
```

- [ ] **Step 6: First commit**

```powershell
git add .
git commit -m "chore: scaffold Next.js 15 app with Tailwind, move reference HTMLs"
```

---

## Task 2 — Install runtime dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Supabase, Zustand, helpers**

```powershell
npm install @supabase/supabase-js@^2.45.0 @supabase/ssr@^0.5.0 zustand@^5.0.0 clsx@^2.1.0 lucide-react@^0.460.0 uuid@^11.0.0
npm install --save-dev @types/uuid
```

- [ ] **Step 2: Install test tooling**

```powershell
npm install --save-dev vitest@^2.1.0 @vitest/ui jsdom @testing-library/react@^16.0.0 @testing-library/jest-dom @testing-library/user-event @playwright/test@^1.48.0
npx playwright install chromium
```

- [ ] **Step 3: Add scripts to `package.json`**

Open `package.json` and replace the `"scripts"` block with:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "test": "vitest run",
  "test:watch": "vitest",
  "e2e": "playwright test",
  "typecheck": "tsc --noEmit"
}
```

- [ ] **Step 4: Commit**

```powershell
git add package.json package-lock.json
git commit -m "chore: add Supabase, Zustand, Vitest, Playwright dependencies"
```

---

## Task 3 — Vitest + Playwright config

**Files:**
- Create: `vitest.config.ts`, `tests/setup.ts`, `playwright.config.ts`

- [ ] **Step 1: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
```

- [ ] **Step 2: Install the React Vite plugin**

```powershell
npm install --save-dev @vitejs/plugin-react
```

- [ ] **Step 3: Create `tests/setup.ts`**

```typescript
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 4: Create `playwright.config.ts`**

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
```

- [ ] **Step 5: Smoke-test Vitest with a trivial test**

Create `tests/unit/smoke.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npm test`. Expected: 1 passing test.

- [ ] **Step 6: Commit**

```powershell
git add vitest.config.ts tests/setup.ts playwright.config.ts tests/unit/smoke.test.ts package.json package-lock.json
git commit -m "chore: configure Vitest and Playwright"
```

---

## Task 4 — Environment variables

**Files:**
- Create: `.env.local.example`, `.env.local`

- [ ] **Step 1: Create `.env.local.example`**

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- [ ] **Step 2: Create `.env.local` from your real Supabase credentials**

Copy `.env.local.example` to `.env.local` and fill in real values from Supabase Dashboard → Project Settings → API.

- [ ] **Step 3: Verify `.env.local` is git-ignored**

```powershell
git status
```

Expected: `.env.local` does NOT appear.

- [ ] **Step 4: Commit the example**

```powershell
git add .env.local.example
git commit -m "chore: document env vars"
```

---

## Task 5 — Apply database migrations

**Files:**
- Create: `supabase/migrations/0001_init.sql`, `supabase/migrations/0002_storage.sql`

- [ ] **Step 1: Create `supabase/migrations/0001_init.sql`**

Paste the exact SQL from `SPEC.md` §7.1 into this file.

- [ ] **Step 2: Create `supabase/migrations/0002_storage.sql`**

Paste the exact SQL from `SPEC.md` §7.2 into this file.

- [ ] **Step 3: Run both migrations against your Supabase project**

In Supabase Dashboard → SQL Editor → New Query → paste contents of `0001_init.sql` → Run. Repeat for `0002_storage.sql`.

- [ ] **Step 4: Verify in Dashboard**

- Table editor: `public.projects` exists with all columns from `SPEC.md` §7.1.
- Storage: bucket `project-assets` exists, marked public.
- Authentication → Policies: 4 policies on `projects`, 3 on `storage.objects`.

- [ ] **Step 5: Commit**

```powershell
git add supabase/
git commit -m "feat(db): projects table with RLS and project-assets storage bucket"
```

---

## Task 6 — Supabase client helpers

**Files:**
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/service.ts`

- [ ] **Step 1: Browser client `src/lib/supabase/client.ts`**

```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 2: Server client `src/lib/supabase/server.ts`**

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (entries) => {
          try {
            entries.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll called from a Server Component — harmless when middleware refreshes
          }
        },
      },
    },
  );
}
```

- [ ] **Step 3: Service-role client `src/lib/supabase/service.ts`**

```typescript
import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
```

- [ ] **Step 4: Commit**

```powershell
git add src/lib/supabase
git commit -m "feat(supabase): browser, server, and service-role client helpers"
```

---

## Task 7 — Auth refresh middleware

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Create `src/middleware.ts`**

Paste the exact code from `SPEC.md` §11.1.

- [ ] **Step 2: Manual sanity test**

```powershell
npm run dev
```

Open `http://localhost:3000`. Expected: redirected to `/login` (which 404s for now — that's fine; we build it next). Stop server.

- [ ] **Step 3: Commit**

```powershell
git add src/middleware.ts
git commit -m "feat(auth): cookie-based middleware with route guard"
```

---

## Task 8 — Editor types and default project

**Files:**
- Create: `src/lib/editor/types.ts`, `src/lib/editor/defaultProject.ts`
- Test: `tests/unit/defaultProject.test.ts`

- [ ] **Step 1: Create `src/lib/editor/types.ts`**

Paste the exact TypeScript from `SPEC.md` §5.

- [ ] **Step 2: Write the failing test for `defaultProject`**

Create `tests/unit/defaultProject.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createDefaultProject } from '@/lib/editor/defaultProject';
import { SCHEMA_VERSION } from '@/lib/editor/types';

describe('createDefaultProject', () => {
  it('returns schemaVersion 1', () => {
    expect(createDefaultProject().schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('has 8 product sections matching the reference template titles', () => {
    const expected = [
      'Starlink Solutions',
      'V-Sat GEO Satellite Ku-Band',
      'V-Sat Satellite PRO',
      'V-Sat GEO Satellite Ka-Band',
      'BGAN/Thuraya-IP',
      'Iridium GO Exec',
      'Iridium PTT',
      'Wi-Fi Long Range',
    ];
    const titles = createDefaultProject().sections.map(s => s.title);
    expect(titles).toEqual(expected);
  });

  it('section index 1 has titleFontSize 21', () => {
    expect(createDefaultProject().sections[1].titleFontSize).toBe(21);
  });

  it('section index 6 has bulletFontSize 14', () => {
    expect(createDefaultProject().sections[6].bulletFontSize).toBe(14);
  });

  it('section ids are unique uuids', () => {
    const ids = createDefaultProject().sections.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach(id => expect(id).toMatch(/^[0-9a-f-]{36}$/i));
  });

  it('global defaults match the reference', () => {
    const g = createDefaultProject().global;
    expect(g.backgroundColor).toBe('#d0d0d0');
    expect(g.buttonColor).toBe('#f1592a');
    expect(g.fontFamily).toBe('Arial, Helvetica Neue, Helvetica, sans-serif');
  });

  it('footer carries default GlobalTT contact info', () => {
    const f = createDefaultProject().footer;
    expect(f.companyName).toBe('GlobalTT Satellite Teleport');
    expect(f.email).toBe('info@globaltt.com');
    expect(f.socials.length).toBe(2);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```powershell
npm test
```

Expected: cannot resolve `@/lib/editor/defaultProject`.

- [ ] **Step 4: Implement `src/lib/editor/defaultProject.ts`**

```typescript
import { v4 as uuid } from 'uuid';
import type { ProjectData, ProductSection } from './types';
import { SCHEMA_VERSION } from './types';

const CONTACT_URL = 'https://www.globaltt.com/en/quickContact-GlobalTT.html';

const SECTION_BLUEPRINTS: Array<Omit<ProductSection, 'id'>> = [
  {
    title: 'Starlink Solutions',
    bullets: [
      'NEW - Worldwide satellite internet.',
      'Low Earth Orbit(LEO)',
      'Latency <45msec',
      'From 150 Mbps Up to 450 Mbps.',
      'Land, Vehicle, Maritime, Aero.',
    ],
    imageSrc: 'https://ipseos.eu/wp-content/uploads/2024/08/Starlink-Mini-Dish-on-a-field-next-to-laptop.png',
    imageAlt: 'Starlink',
    ctaText: 'Contact Us',
  },
  {
    title: 'V-Sat GEO Satellite Ku-Band',
    bullets: [
      'Direct from Belgium (EU Teleport).',
      'One single satellite direct connectivity.',
      'Fully secured, reliable, high availability 99,8%.',
      'Up to 50 Mbps.',
      'Mining, Oil & Gaz, Embassies...',
    ],
    imageSrc: 'https://ipseos.eu/wp-content/uploads/2024/07/Ku-Band-1-2.png',
    imageAlt: 'Ku Band',
    ctaText: 'Contact Us',
    titleFontSize: 21,
    bulletFontSize: 15,
  },
  {
    title: 'V-Sat Satellite PRO',
    bullets: [
      'Direct from Belgium.',
      'One Satellite direct connectivity.',
      'Fully secured, high availability & reliability of 99,99%',
      'Up to 50 Mbps.',
      'Embassies, Mining, Camp...',
    ],
    imageSrc: 'https://ipseos.eu/wp-content/uploads/2024/07/C-Band-1-1.png',
    imageAlt: 'C-Band',
    ctaText: 'Contact Us',
  },
  {
    title: 'V-Sat GEO Satellite Ka-Band',
    bullets: [
      'Direct from Belgium.',
      'Fully secured, availability 95%.',
      'Up to 50 Mbps.',
      'SOHO, Small Office, Back-up.',
    ],
    imageSrc: 'https://ipseos.eu/wp-content/uploads/2024/07/Ka-Band-1-3.png',
    imageAlt: 'Ka-Band',
    ctaText: 'Contact Us',
  },
  {
    title: 'BGAN/Thuraya-IP',
    bullets: [
      'Worldwide secured access.',
      'GEO, L-Band, Internet',
      '1,2 Mbps internet.',
      'Battery & AC.',
      'Voice/tel. line & internet.',
    ],
    imageSrc: 'https://ipseos.eu/wp-content/uploads/2024/05/bgan76D58270-copy-1.jpg',
    imageAlt: 'BGAN',
    ctaText: 'Contact Us',
  },
  {
    title: 'Iridium GO Exec',
    bullets: [
      'Worldwide coverage.',
      'Satellite LEO.',
      'Phone & data access.',
      '88 Kbps/22 Kbps.',
      'Battery and AC.',
    ],
    imageSrc: 'https://ipseos.eu/wp-content/uploads/2024/05/1677665900145-copy.png',
    imageAlt: 'Iridium GO Exec',
    ctaText: 'Contact Us',
  },
  {
    title: 'Iridium PTT',
    bullets: [
      'Dual Mode: PTT and Phone modes.',
      'Secure Dialogue: AES-256 encryption.',
      'Walkie Talkie : two way radio',
      'Satellite: instant communication',
    ],
    imageSrc: 'https://ipseos.eu/wp-content/uploads/2024/08/sATTELITE-PHONE.png',
    imageAlt: 'Iridium PTT',
    ctaText: 'Contact Us',
    bulletFontSize: 14,
  },
  {
    title: 'Wi-Fi Long Range',
    bullets: [
      'Wi-Fi 2.4 GHz/5 GHz',
      'Radio WI-FI Range : 1.5 Km',
      'Repeater 10 Km radio link.',
      'Adaptive interference control.',
      'Security Access, Cyber, and ISP billing',
    ],
    imageSrc: 'https://ipseos.eu/wp-content/uploads/2024/08/DSCF0503-222Copy.png',
    imageAlt: 'WiFi Long Range',
    ctaText: 'Contact Us',
  },
];

export function createDefaultProject(): ProjectData {
  return {
    schemaVersion: SCHEMA_VERSION,
    global: {
      backgroundColor: '#d0d0d0',
      fontFamily: 'Arial, Helvetica Neue, Helvetica, sans-serif',
      baseFontSize: 16,
      headingFontSize: 25,
      textColor: '#000000',
      buttonColor: '#f1592a',
      buttonTextColor: '#ffffff',
      accentColor: '#f1592a',
      footerBackgroundColor: '#000000',
      footerTextColor: '#fafafa',
      contactUrl: CONTACT_URL,
    },
    header: {
      logoSrc: 'https://36af7d465b.imgdist.com/pub/bfra/wpnsx7uw/j2q/4ah/ptb/logo%20%282%29.png',
      logoAlt: 'GlobalTT Logo',
      logoWidth: 390,
      title: 'Critical communication - Satellite - RadioLink - TwoWay Radio overIP',
      titleFontSize: 18,
      bannerSrc: 'https://ipseos.eu/wp-content/uploads/2024/05/Untitled-11x-1-e1718357911485.png',
      bannerAlt: 'Coverage Map',
      sectionHeading: 'Satellite High Throughput Connectivity',
      sectionHeadingFontSize: 25,
    },
    sections: SECTION_BLUEPRINTS.map(s => ({ ...s, id: uuid() })),
    footer: {
      bannerSrc: 'https://ipseos.eu/wp-content/uploads/2024/05/TELEPORT-8-Copy.png',
      bannerAlt: 'Teleport',
      companyName: 'GlobalTT Satellite Teleport',
      address: 'Scientifique Parc Einstein,\nLouvain-la-Neuve, Belgium',
      phone: '+32 (0)10 39 50 70',
      phoneTel: '+3210395070',
      email: 'info@globaltt.com',
      websites: [
        { label: 'www.globaltt.com', url: 'https://www.globaltt.com' },
        { label: 'www.Ipseos.eu', url: 'https://www.ipseos.eu' },
      ],
      socials: [
        { platform: 'facebook', url: 'https://www.facebook.com/pages/GlobalTT-Broadband-High-Speed-Internet-Satellite/182799832710' },
        { platform: 'linkedin', url: 'https://www.linkedin.com/company/globaltt?trk=top_nav_home' },
      ],
    },
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

```powershell
npm test
```

Expected: all defaultProject tests green.

- [ ] **Step 6: Commit**

```powershell
git add src/lib/editor tests/unit/defaultProject.test.ts
git commit -m "feat(editor): ProjectData types and createDefaultProject factory"
```

---

## Task 9 — Tailwind tokens for the editor chrome

**Files:**
- Modify: `src/app/globals.css`, `tailwind.config.ts` (or `tailwind.config.js` if generated as JS)

- [ ] **Step 1: Replace `src/app/globals.css`**

```css
@import "tailwindcss";

@theme {
  --color-bg: #0f0f0f;
  --color-panel: #161616;
  --color-panel-2: #1a1a1a;
  --color-border: #252525;
  --color-border-strong: #333333;
  --color-fg: #e0e0e0;
  --color-muted: #888888;
  --color-muted-2: #666666;
  --color-brand: #f1592a;
  --color-brand-soft: #f1592a22;
  --color-success: #6ab06a;
  --color-danger: #c45151;
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

html, body {
  background: var(--color-bg);
  color: var(--color-fg);
  font-family: var(--font-sans);
}

* { box-sizing: border-box; }
```

- [ ] **Step 2: Verify Tailwind compiles**

```powershell
npm run dev
```

Open `http://localhost:3000/login`. Expected: blank or 404 with dark background. Stop.

- [ ] **Step 3: Commit**

```powershell
git add src/app/globals.css
git commit -m "style: editor chrome design tokens"
```

---

## Task 10 — UI primitives: Button and Input

**Files:**
- Create: `src/lib/utils/cn.ts`, `src/components/ui/Button.tsx`, `src/components/ui/Input.tsx`

- [ ] **Step 1: Create `src/lib/utils/cn.ts`**

```typescript
import clsx, { type ClassValue } from 'clsx';
export const cn = (...args: ClassValue[]) => clsx(args);
```

- [ ] **Step 2: Create `src/components/ui/Button.tsx`**

```typescript
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const VARIANTS: Record<Variant, string> = {
  primary:   'bg-brand text-white hover:opacity-90',
  secondary: 'bg-panel-2 text-fg border border-border-strong hover:border-brand',
  ghost:     'text-muted hover:text-fg',
  danger:    'bg-transparent border border-danger text-danger hover:bg-danger/10',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant = 'primary', ...rest }, ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    />
  );
});
```

- [ ] **Step 3: Create `src/components/ui/Input.tsx`**

```typescript
import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'w-full rounded-md bg-panel-2 border border-border-strong px-3 py-2 text-sm text-fg placeholder:text-muted-2 focus:outline-none focus:border-brand',
          className,
        )}
        {...rest}
      />
    );
  },
);
```

- [ ] **Step 4: Commit**

```powershell
git add src/lib/utils src/components/ui
git commit -m "feat(ui): Button and Input primitives"
```

---

## Task 11 — Login page

**Files:**
- Create: `src/components/auth/LoginForm.tsx`, `src/app/login/page.tsx`

- [ ] **Step 1: Create `src/components/auth/LoginForm.tsx`**

```typescript
'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { setError(error.message); return; }
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="w-80 rounded-xl bg-panel-2 border border-border-strong p-8 space-y-4">
      <div className="text-center">
        <div className="text-2xl font-extrabold text-brand">GT</div>
        <div className="text-sm text-muted">GlobalTT Email Editor</div>
      </div>
      <Input type="email" required placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} />
      <Input type="password" required placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
      {error && <div className="text-danger text-xs">{error}</div>}
      <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign In'}</Button>
      <div className="text-xs text-muted-2 text-center">
        No account? <Link href="/signup" className="text-brand">Sign up</Link>
        {' · '}<Link href="/reset" className="text-brand">Forgot password</Link>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Create `src/app/login/page.tsx`**

```typescript
import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/LoginForm';

export const metadata = { title: 'Sign in — GlobalTT Editor' };

export default function LoginPage() {
  return (
    <main className="min-h-dvh flex items-center justify-center p-6">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
```

- [ ] **Step 3: Manual test**

`npm run dev`, visit `/login`. Form renders. Submit invalid creds → "Invalid login credentials". Stop.

- [ ] **Step 4: Commit**

```powershell
git add src/app/login src/components/auth/LoginForm.tsx
git commit -m "feat(auth): /login page with email + password"
```

---

## Task 12 — Signup, reset, callback, signout

**Files:**
- Create: `src/components/auth/SignupForm.tsx`, `src/app/signup/page.tsx`, `src/app/reset/page.tsx`, `src/app/auth/callback/route.ts`, `src/app/auth/signout/route.ts`

- [ ] **Step 1: Create `src/components/auth/SignupForm.tsx`**

```typescript
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function SignupForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (error) { setMsg({ kind: 'err', text: error.message }); return; }
    setMsg({ kind: 'ok', text: 'Check your email to confirm your account.' });
  }

  return (
    <form onSubmit={onSubmit} className="w-80 rounded-xl bg-panel-2 border border-border-strong p-8 space-y-4">
      <div className="text-center">
        <div className="text-2xl font-extrabold text-brand">GT</div>
        <div className="text-sm text-muted">Create account</div>
      </div>
      <Input type="email" required placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} />
      <Input type="password" required minLength={8} placeholder="Password (8+ chars)" value={password} onChange={e => setPassword(e.target.value)} />
      {msg && <div className={msg.kind === 'ok' ? 'text-success text-xs' : 'text-danger text-xs'}>{msg.text}</div>}
      <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Creating…' : 'Sign Up'}</Button>
      <div className="text-xs text-muted-2 text-center">
        Already have an account? <Link href="/login" className="text-brand">Sign in</Link>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Create `src/app/signup/page.tsx`**

```typescript
import { SignupForm } from '@/components/auth/SignupForm';
export const metadata = { title: 'Sign up — GlobalTT Editor' };
export default function SignupPage() {
  return <main className="min-h-dvh flex items-center justify-center p-6"><SignupForm /></main>;
}
```

- [ ] **Step 3: Create `src/app/reset/page.tsx`**

```typescript
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function ResetPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/`,
    });
    setBusy(false);
    setMsg(error ? error.message : 'Check your email for the reset link.');
  }

  return (
    <main className="min-h-dvh flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-80 rounded-xl bg-panel-2 border border-border-strong p-8 space-y-4">
        <div className="text-center text-sm text-muted">Reset password</div>
        <Input type="email" required placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} />
        {msg && <div className="text-xs text-muted">{msg}</div>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</Button>
        <div className="text-xs text-muted-2 text-center">
          <Link href="/login" className="text-brand">Back to sign in</Link>
        </div>
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Create `src/app/auth/callback/route.ts`**

```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/';
  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
```

- [ ] **Step 5: Create `src/app/auth/signout/route.ts`**

```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/login', req.url), { status: 303 });
}
```

- [ ] **Step 6: Manual test the round-trip**

`npm run dev`. Sign up. Check inbox, click link. Should land on `/`. Stop.

- [ ] **Step 7: Commit**

```powershell
git add src/app/signup src/app/reset src/app/auth src/components/auth/SignupForm.tsx
git commit -m "feat(auth): signup, password reset, OAuth callback, signout"
```

---

## Task 13 — Project API routes

**Files:**
- Create: `src/app/api/projects/route.ts`, `src/app/api/projects/[id]/route.ts`, `src/app/api/projects/[id]/duplicate/route.ts`

- [ ] **Step 1: Create `src/app/api/projects/route.ts` (POST = create)**

```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createDefaultProject } from '@/lib/editor/defaultProject';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === 'string' && body.name.trim().length > 0
    ? body.name.trim().slice(0, 200)
    : 'Untitled project';

  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      name,
      data: createDefaultProject(),
      template_source: 'default',
    })
    .select('id, name, updated_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
```

- [ ] **Step 2: Create `src/app/api/projects/[id]/route.ts` (GET / PATCH / DELETE)**

```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ProjectData } from '@/lib/editor/types';

interface Ctx { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)  return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const ifUnmodifiedSince = req.headers.get('if-unmodified-since');

  const body = (await req.json()) as { name?: string; data?: ProjectData };
  const update: Record<string, unknown> = {};
  if (typeof body.name === 'string') update.name = body.name.trim().slice(0, 200);
  if (body.data) update.data = body.data;
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'empty_patch' }, { status: 400 });
  }

  // Concurrency check
  if (ifUnmodifiedSince) {
    const { data: current } = await supabase
      .from('projects').select('updated_at').eq('id', id).maybeSingle();
    if (current && current.updated_at !== ifUnmodifiedSince) {
      return NextResponse.json({ error: 'conflict' }, { status: 409 });
    }
  }

  const { data, error } = await supabase
    .from('projects')
    .update(update)
    .eq('id', id)
    .select('id, name, updated_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 3: Create `src/app/api/projects/[id]/duplicate/route.ts`**

```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface Ctx { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: src, error } = await supabase
    .from('projects').select('*').eq('id', id).maybeSingle();
  if (error)  return NextResponse.json({ error: error.message }, { status: 500 });
  if (!src)   return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data, error: insErr } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      name: `${src.name} (copy)`,
      data: src.data,
      template_source: src.template_source,
    })
    .select('id')
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
```

- [ ] **Step 4: Manual test with curl/PowerShell while signed in**

Skip API curl tests — exercise via dashboard UI in Task 15.

- [ ] **Step 5: Commit**

```powershell
git add src/app/api/projects
git commit -m "feat(api): projects CRUD with optimistic concurrency and duplicate"
```

---

## Task 14 — Client API helpers

**Files:**
- Create: `src/lib/api/projects.ts`

- [ ] **Step 1: Create `src/lib/api/projects.ts`**

```typescript
import type { ProjectData } from '@/lib/editor/types';

export interface ProjectSummary {
  id: string;
  name: string;
  updated_at: string;
}

export async function createProject(name?: string): Promise<ProjectSummary> {
  const res = await fetch('/api/projects', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function patchProject(
  id: string,
  patch: { name?: string; data?: ProjectData },
  ifUnmodifiedSince?: string,
): Promise<ProjectSummary> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (ifUnmodifiedSince) headers['if-unmodified-since'] = ifUnmodifiedSince;
  const res = await fetch(`/api/projects/${id}`, {
    method: 'PATCH', headers, body: JSON.stringify(patch),
  });
  if (res.status === 409) throw Object.assign(new Error('conflict'), { code: 'conflict' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) throw new Error(await res.text());
}

export async function duplicateProject(id: string): Promise<{ id: string }> {
  const res = await fetch(`/api/projects/${id}/duplicate`, { method: 'POST' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

- [ ] **Step 2: Commit**

```powershell
git add src/lib/api
git commit -m "feat(api): client-side projects helpers"
```

---

## Task 15 — Dashboard

**Files:**
- Create: `src/components/ui/Spinner.tsx`, `src/components/dashboard/ProjectCard.tsx`, `src/components/dashboard/ProjectGrid.tsx`, `src/components/dashboard/EmptyState.tsx`, `src/components/dashboard/NewProjectButton.tsx`
- Modify: `src/app/page.tsx`, `src/app/layout.tsx`

- [ ] **Step 1: `src/components/ui/Spinner.tsx`**

```typescript
export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin">
      <circle cx="12" cy="12" r="10" strokeWidth="3" stroke="currentColor" strokeOpacity="0.2" fill="none" />
      <path d="M22 12a10 10 0 0 1-10 10" strokeWidth="3" stroke="currentColor" fill="none" strokeLinecap="round" />
    </svg>
  );
}
```

- [ ] **Step 2: `src/components/dashboard/EmptyState.tsx`**

```typescript
export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-16 text-center text-muted">
      {children}
    </div>
  );
}
```

- [ ] **Step 3: `src/components/dashboard/NewProjectButton.tsx`**

```typescript
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createProject } from '@/lib/api/projects';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';

export function NewProjectButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      const p = await createProject();
      router.push(`/p/${p.id}`);
    } catch (e) {
      alert(`Couldn't create project: ${(e as Error).message}`);
      setBusy(false);
    }
  }
  return (
    <Button onClick={go} disabled={busy}>
      {busy ? <Spinner /> : '+ New Project'}
    </Button>
  );
}
```

- [ ] **Step 4: `src/components/dashboard/ProjectCard.tsx`**

```typescript
'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Copy, Pencil, Trash2 } from 'lucide-react';
import { deleteProject, duplicateProject, patchProject } from '@/lib/api/projects';
import type { ProjectSummary } from '@/lib/api/projects';
import { Button } from '@/components/ui/Button';

interface Props {
  project: ProjectSummary;
  onChanged: () => void;
}

export function ProjectCard({ project, onChanged }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(project.name);

  async function rename() {
    setRenaming(false);
    if (name.trim() === project.name) return;
    await patchProject(project.id, { name: name.trim() });
    onChanged();
  }

  function onDelete() {
    if (!confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
    start(async () => {
      await deleteProject(project.id);
      onChanged();
    });
  }

  function onDuplicate() {
    start(async () => {
      const { id } = await duplicateProject(project.id);
      router.push(`/p/${id}`);
    });
  }

  return (
    <div className="rounded-xl bg-panel border border-border p-5">
      {renaming ? (
        <input
          autoFocus
          className="w-full bg-panel-2 border border-border-strong rounded px-2 py-1 text-sm text-fg mb-1"
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={rename}
          onKeyDown={e => {
            if (e.key === 'Enter') rename();
            if (e.key === 'Escape') { setName(project.name); setRenaming(false); }
          }}
        />
      ) : (
        <div className="text-sm font-semibold text-fg mb-1 truncate">{project.name}</div>
      )}
      <div className="text-xs text-muted-2 mb-4">
        Updated {new Date(project.updated_at).toLocaleString()}
      </div>
      <div className="flex gap-2">
        <Link
          href={`/p/${project.id}`}
          className="flex-1 inline-flex items-center justify-center rounded bg-brand-soft text-brand border border-brand/30 px-3 py-1.5 text-xs font-semibold"
        >
          Open
        </Link>
        <Button variant="secondary" className="px-2.5 py-1.5" onClick={onDuplicate} disabled={pending} title="Duplicate"><Copy size={14} /></Button>
        <Button variant="secondary" className="px-2.5 py-1.5" onClick={() => setRenaming(true)} title="Rename"><Pencil size={14} /></Button>
        <Button variant="secondary" className="px-2.5 py-1.5" onClick={onDelete} disabled={pending} title="Delete"><Trash2 size={14} /></Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: `src/components/dashboard/ProjectGrid.tsx`**

```typescript
'use client';
import { useEffect, useState, useCallback } from 'react';
import { ProjectCard } from './ProjectCard';
import { EmptyState } from './EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import type { ProjectSummary } from '@/lib/api/projects';

export function ProjectGrid({ initial }: { initial: ProjectSummary[] }) {
  const [items, setItems] = useState(initial);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/projects/list');
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { setItems(initial); }, [initial]);

  if (items.length === 0) {
    return (
      <EmptyState>
        No projects yet — click <strong className="text-fg">+ New Project</strong> to start your first campaign.
      </EmptyState>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {loading && <div className="col-span-full text-muted text-sm flex items-center gap-2"><Spinner /> Refreshing…</div>}
      {items.map(p => (
        <ProjectCard key={p.id} project={p} onChanged={reload} />
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Add the list API endpoint `src/app/api/projects/list/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, updated_at')
    .order('updated_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
```

- [ ] **Step 7: Replace `src/app/page.tsx`**

```typescript
import { createClient } from '@/lib/supabase/server';
import { ProjectGrid } from '@/components/dashboard/ProjectGrid';
import { NewProjectButton } from '@/components/dashboard/NewProjectButton';

export const metadata = { title: 'My Projects — GlobalTT Editor' };

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, updated_at')
    .order('updated_at', { ascending: false });

  return (
    <main className="max-w-6xl mx-auto p-8">
      <header className="flex items-center justify-between mb-8">
        <div>
          <div className="text-xs uppercase tracking-widest text-brand mb-1">Dashboard</div>
          <h1 className="text-2xl font-bold">My Projects</h1>
          <p className="text-xs text-muted-2 mt-1">{user?.email}</p>
        </div>
        <div className="flex gap-2">
          <form action="/auth/signout" method="post">
            <button className="text-xs text-muted hover:text-fg">Sign out</button>
          </form>
          <NewProjectButton />
        </div>
      </header>
      <ProjectGrid initial={projects ?? []} />
    </main>
  );
}
```

- [ ] **Step 8: Replace `src/app/layout.tsx` to keep it minimal**

```typescript
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'GlobalTT Editor',
  description: 'Email campaign editor',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
```

- [ ] **Step 9: Manual smoke test**

`npm run dev`. Sign in. Land on dashboard. Click "+ New Project" → redirect to `/p/<id>` (404 expected for now). Back on dashboard, click rename, change name, hit Enter — name updates. Click Duplicate, click Delete (confirm) — works. Stop.

- [ ] **Step 10: Commit**

```powershell
git add src/app src/components/dashboard src/components/ui/Spinner.tsx
git commit -m "feat(dashboard): list, create, rename, duplicate, delete projects"
```

---

## Task 16 — Editor stub

**Files:**
- Create: `src/app/p/[id]/page.tsx`

- [ ] **Step 1: Create the stub**

```typescript
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

interface Props { params: Promise<{ id: string }> }

export default async function EditorPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from('projects').select('*').eq('id', id).maybeSingle();
  if (!project) notFound();
  return (
    <main className="min-h-dvh p-8">
      <Link href="/" className="text-brand text-sm">← Projects</Link>
      <h1 className="text-2xl font-bold mt-2">{project.name}</h1>
      <pre className="mt-6 text-xs text-muted-2 bg-panel-2 p-4 rounded overflow-auto">
        {JSON.stringify(project.data, null, 2)}
      </pre>
      <div className="text-xs text-muted-2 mt-4">Editor UI lands in Phase 2.</div>
    </main>
  );
}
```

- [ ] **Step 2: Manual test**

`npm run dev`. From dashboard, open a project. JSON renders. Stop.

- [ ] **Step 3: Commit**

```powershell
git add src/app/p
git commit -m "feat(editor): stub route showing raw project JSON"
```

---

## Task 17 — Dashboard E2E test

**Files:**
- Create: `tests/e2e/dashboard.spec.ts`

- [ ] **Step 1: Decide on a test user**

Create a dedicated Supabase user `e2e-test-1@globaltt.test` with password `Passw0rd!E2E` via Supabase Dashboard → Authentication → Users → Add User (mark email as confirmed).

- [ ] **Step 2: Add test env vars**

Append to `.env.local`:

```
E2E_EMAIL=e2e-test-1@globaltt.test
E2E_PASSWORD=Passw0rd!E2E
```

- [ ] **Step 3: Create `tests/e2e/dashboard.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';

test('login, create, rename, delete a project', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('Email address').fill(process.env.E2E_EMAIL!);
  await page.getByPlaceholder('Password').fill(process.env.E2E_PASSWORD!);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL('/');

  const initialCount = await page.getByText(/Updated/).count();

  await page.getByRole('button', { name: /new project/i }).click();
  await expect(page).toHaveURL(/\/p\//);

  await page.goto('/');
  await expect(page.getByText(/Updated/)).toHaveCount(initialCount + 1);

  // Delete the just-created (most recent) project
  page.once('dialog', d => d.accept());
  await page.getByRole('button', { name: 'Delete' }).first().click();
  await expect(page.getByText(/Updated/)).toHaveCount(initialCount);
});
```

- [ ] **Step 4: Run E2E**

```powershell
npm run e2e
```

Expected: 1 passing test.

- [ ] **Step 5: Commit**

```powershell
git add tests/e2e/dashboard.spec.ts
git commit -m "test(e2e): dashboard create + delete golden path"
```

---

## Phase 1 acceptance

- ☑ Visit `/` while signed out → redirected to `/login`.
- ☑ Sign up → confirm email → land on dashboard with empty state.
- ☑ "+ New Project" creates a row, opens stub editor showing populated `data` JSON.
- ☑ Rename, duplicate, delete all work.
- ☑ Sign out clears session and redirects to `/login`.
- ☑ `npm test` and `npm run e2e` both green.
- ☑ Try opening a project from another browser/incognito while signed in as a different user → 404 (RLS works).

**Phase complete. Move to `PHASE-2-EDITOR.md`.**
