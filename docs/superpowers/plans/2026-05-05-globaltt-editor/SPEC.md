# Technical Specification

This document is the contract. Every phase plan implements pieces of what's defined here. If something is ambiguous in a phase plan, this file wins.

## 1. Architecture overview

```
┌──────────────────────────┐         ┌────────────────────────────────┐
│  Browser (Next.js client)│  HTTPS  │  Vercel (Next.js server)        │
│                          │ ◄────► │  - App Router pages & API routes│
│  - React 19 + Zustand    │         │  - @supabase/ssr cookie-based   │
│  - Live preview iframe   │         │    auth refresh middleware      │
└──────────┬───────────────┘         └─────────────┬───────────────────┘
           │ supabase-js                            │ supabase-js (server)
           ▼                                        ▼
                  ┌─────────────────────────────────┐
                  │  Supabase project               │
                  │  - Postgres (projects table)    │
                  │  - Auth (email + Google OAuth)  │
                  │  - Storage (project-assets)     │
                  │  - RLS enforced on every read   │
                  └─────────────────────────────────┘
```

Two key invariants:

1. **Single source of truth.** A project's complete editor state lives in one `jsonb` column. The live preview, autosave payload, and final HTML export all read from the same `ProjectData` object.
2. **The renderer is pure.** `renderEmail(data: ProjectData): string` has no side effects, no I/O, no React. Live preview wraps its output in an iframe; export downloads the same string as a `.html` file. This is what makes WYSIWYG actually true.

## 2. Tech stack & exact versions

Pin these in `package.json`. Do not float majors.

| Package | Version | Purpose |
| --- | --- | --- |
| `next` | `^15.0.0` | App Router, server components, edge middleware |
| `react`, `react-dom` | `^19.0.0` | UI |
| `typescript` | `^5.6.0` | Types |
| `@supabase/supabase-js` | `^2.45.0` | Client |
| `@supabase/ssr` | `^0.5.0` | Cookie-based auth across server + client |
| `zustand` | `^5.0.0` | Editor state |
| `tailwindcss` | `^4.0.0` | Styling for the editor chrome (NOT the email export) |
| `vitest` | `^2.1.0` | Unit tests for pure functions |
| `@testing-library/react` | `^16.0.0` | Component tests |
| `@playwright/test` | `^1.48.0` | E2E |
| `clsx` | `^2.1.0` | Conditional class names |
| `lucide-react` | `^0.460.0` | Icons |

Node `>=20.0.0`. The dev machine is on Node 24, npm 11 — fine.

## 3. Folder structure

```
html-editor/
├── reference/                       # original HTMLs, read-only inputs
│   ├── globaltt-email.html
│   ├── globaltt-email-editor.html
│   └── globaltt-editor-presentation.html
├── docs/superpowers/plans/2026-05-05-globaltt-editor/   # this plan
├── supabase/
│   └── migrations/
│       ├── 0001_init.sql
│       └── 0002_storage.sql
├── src/
│   ├── middleware.ts                # auth refresh on every request
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── page.tsx                 # dashboard (protected)
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   ├── reset/page.tsx
│   │   ├── auth/
│   │   │   ├── callback/route.ts    # OAuth + magic-link callback
│   │   │   └── signout/route.ts
│   │   ├── p/[id]/page.tsx          # editor (protected)
│   │   └── api/
│   │       ├── projects/
│   │       │   ├── route.ts                # POST: create
│   │       │   ├── [id]/route.ts           # GET, PATCH, DELETE
│   │       │   └── [id]/duplicate/route.ts # POST
│   │       ├── upload/route.ts             # POST: image upload
│   │       └── import/route.ts             # POST: parse uploaded HTML
│   ├── components/
│   │   ├── ui/                      # generic primitives
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Textarea.tsx
│   │   │   ├── ColorPicker.tsx
│   │   │   ├── NumberInput.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Dialog.tsx
│   │   │   ├── Toast.tsx
│   │   │   └── Spinner.tsx
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx
│   │   │   └── SignupForm.tsx
│   │   ├── dashboard/
│   │   │   ├── ProjectGrid.tsx
│   │   │   ├── ProjectCard.tsx
│   │   │   ├── NewProjectButton.tsx
│   │   │   ├── ImportButton.tsx
│   │   │   └── EmptyState.tsx
│   │   └── editor/
│   │       ├── EditorShell.tsx      # client component, mounts store
│   │       ├── Topbar.tsx
│   │       ├── LeftPanel.tsx
│   │       ├── Preview.tsx          # iframe wrapper
│   │       ├── ImageInput.tsx       # URL OR upload, single control
│   │       ├── BulletList.tsx
│   │       └── panels/
│   │           ├── GlobalStylesPanel.tsx
│   │           ├── HeaderPanel.tsx
│   │           ├── FooterPanel.tsx
│   │           ├── ProductSectionPanel.tsx
│   │           └── ImportWizard.tsx
│   └── lib/
│       ├── supabase/
│       │   ├── client.ts            # createBrowserClient
│       │   ├── server.ts            # createServerClient (cookies)
│       │   └── service.ts           # service-role client (server-only)
│       ├── editor/
│       │   ├── types.ts             # ProjectData and friends
│       │   ├── defaultProject.ts    # the canonical default JSON
│       │   ├── store.ts             # Zustand
│       │   └── autosave.ts          # debounce + persist
│       ├── export/
│       │   ├── renderEmail.ts       # ProjectData -> string
│       │   ├── renderHeader.ts
│       │   ├── renderSection.ts
│       │   ├── renderFooter.ts
│       │   └── escape.ts            # htmlEscape, attrEscape
│       ├── import/
│       │   ├── parseHtml.ts         # HTML string -> ProjectData (+ warnings)
│       │   └── detectors.ts         # element classifiers
│       ├── api/
│       │   ├── projects.ts          # client-side fetch helpers
│       │   └── upload.ts
│       └── utils/
│           ├── cn.ts
│           ├── uuid.ts
│           └── debounce.ts
├── tests/
│   ├── unit/
│   │   ├── export.test.ts
│   │   ├── import.test.ts
│   │   ├── escape.test.ts
│   │   └── defaultProject.test.ts
│   └── e2e/
│       ├── auth.spec.ts
│       ├── dashboard.spec.ts
│       └── editor.spec.ts
├── public/
│   └── favicon.ico
├── .env.local.example
├── .env.local                       # gitignored
├── .gitignore
├── next.config.ts
├── tailwind.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

## 4. Routes

| Path | Auth | Method | Purpose |
| --- | --- | --- | --- |
| `/login` | public | GET | Email/password + Google login |
| `/signup` | public | GET | Sign up |
| `/reset` | public | GET | Request password reset email |
| `/auth/callback` | public | GET | Supabase OAuth/magic-link redirect target |
| `/auth/signout` | auth | POST | Clear session, redirect `/login` |
| `/` | auth | GET | Dashboard (project list + import + new) |
| `/p/[id]` | auth + owner | GET | Editor |
| `/api/projects` | auth | POST | Create project from default template |
| `/api/projects/[id]` | auth + owner | GET / PATCH / DELETE | Read / autosave / delete |
| `/api/projects/[id]/duplicate` | auth + owner | POST | Clone project |
| `/api/upload` | auth | POST `multipart/form-data` (`projectId`, `file`) | Upload image to user's folder |
| `/api/import` | auth | POST `multipart/form-data` (`file`) | Parse uploaded HTML, return `{ data, warnings }` (does NOT persist) |

## 5. Data model — TypeScript types

This is the canonical shape. Anywhere a `ProjectData` appears in code, it conforms to exactly this. **Versioned** via `schemaVersion` so future migrations are safe.

```typescript
// src/lib/editor/types.ts

export const SCHEMA_VERSION = 1;

export interface ProjectData {
  schemaVersion: 1;
  global: GlobalStyles;
  header: Header;
  sections: ProductSection[];
  footer: Footer;
}

export interface GlobalStyles {
  backgroundColor: string;        // body bg, default '#d0d0d0'
  fontFamily: string;             // 'Arial, Helvetica Neue, Helvetica, sans-serif'
  baseFontSize: number;           // bullets default px (16)
  headingFontSize: number;        // product titles default px (25)
  textColor: string;              // '#000000'
  buttonColor: string;            // '#f1592a'
  buttonTextColor: string;        // '#ffffff'
  accentColor: string;            // footer link color, '#f1592a'
  footerBackgroundColor: string;  // '#000000'
  footerTextColor: string;        // '#fafafa'
  contactUrl: string;             // default 'https://www.globaltt.com/en/quickContact-GlobalTT.html'
}

export interface Header {
  logoSrc: string;
  logoAlt: string;
  logoWidth: number;              // default 390
  title: string;                  // small h1 below logo
  titleFontSize: number;          // default 18
  bannerSrc: string;              // full-width coverage map
  bannerAlt: string;
  sectionHeading: string;         // "Satellite High Throughput Connectivity"
  sectionHeadingFontSize: number; // default 25
}

export interface ProductSection {
  id: string;                     // uuid v4, stable React key
  title: string;
  bullets: string[];
  imageSrc: string;
  imageAlt: string;
  ctaText: string;                // default 'Contact Us'
  ctaUrl?: string;                // override of global.contactUrl

  // section-level style overrides (each undefined = inherit from global)
  titleFontSize?: number;
  bulletFontSize?: number;
  textColor?: string;
  buttonColor?: string;
  backgroundColor?: string;
}

export interface Footer {
  bannerSrc: string;              // teleport image
  bannerAlt: string;
  companyName: string;            // 'GlobalTT Satellite Teleport'
  address: string;                // multi-line, '\n' separated
  phone: string;                  // display string '+32 (0)10 39 50 70'
  phoneTel: string;               // tel: link target '+3210395070'
  email: string;
  websites: WebsiteLink[];
  socials: SocialLink[];
  backgroundColor?: string;       // override global.footerBackgroundColor
  textColor?: string;             // override global.footerTextColor
}

export interface WebsiteLink {
  label: string;                  // 'www.globaltt.com'
  url: string;                    // 'https://www.globaltt.com'
}

export type SocialPlatform = 'facebook' | 'linkedin' | 'twitter' | 'youtube' | 'instagram';

export interface SocialLink {
  platform: SocialPlatform;
  url: string;
}
```

### Database row vs ProjectData

The DB row carries `name`, `template_source`, `raw_html_path`, timestamps. **`name` is NOT inside `ProjectData`** — it's promoted to a column for indexing/filtering. Every place that needs both, fetch the row and treat them as siblings:

```typescript
export interface ProjectRow {
  id: string;
  user_id: string;
  name: string;
  data: ProjectData;
  template_source: 'default' | 'imported';
  raw_html_path: string | null;
  created_at: string;
  updated_at: string;
}
```

## 6. Default project template

`src/lib/editor/defaultProject.ts` exports a function that produces a fresh `ProjectData` mirroring `reference/globaltt-email.html` exactly. The renderer applied to this output must produce HTML byte-equivalent (modulo whitespace) to the reference file. This is the acceptance test for the renderer.

The 8 default product sections, their default copy, and image URLs are taken verbatim from `reference/globaltt-email.html`:

| Idx | Title | Bullet font px | Image URL |
| --- | --- | --- | --- |
| 0 | Starlink Solutions | 16 | https://ipseos.eu/wp-content/uploads/2024/08/Starlink-Mini-Dish-on-a-field-next-to-laptop.png |
| 1 | V-Sat GEO Satellite Ku-Band | 15 | https://ipseos.eu/wp-content/uploads/2024/07/Ku-Band-1-2.png |
| 2 | V-Sat Satellite PRO | 16 | https://ipseos.eu/wp-content/uploads/2024/07/C-Band-1-1.png |
| 3 | V-Sat GEO Satellite Ka-Band | 16 | https://ipseos.eu/wp-content/uploads/2024/07/Ka-Band-1-3.png |
| 4 | BGAN/Thuraya-IP | 16 | https://ipseos.eu/wp-content/uploads/2024/05/bgan76D58270-copy-1.jpg |
| 5 | Iridium GO Exec | 16 | https://ipseos.eu/wp-content/uploads/2024/05/1677665900145-copy.png |
| 6 | Iridium PTT | 14 | https://ipseos.eu/wp-content/uploads/2024/08/sATTELITE-PHONE.png |
| 7 | Wi-Fi Long Range | 16 | https://ipseos.eu/wp-content/uploads/2024/08/DSCF0503-222Copy.png |

Index 1 has a smaller `titleFontSize` of 21 (others are 25). Phase 1 has the task that codifies all of these.

## 7. Database schema

Two migrations. Apply by pasting into Supabase Dashboard → SQL Editor, or via `supabase db push` if the CLI is set up locally.

### 7.1 `supabase/migrations/0001_init.sql`

```sql
-- Projects table
create table public.projects (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null check (length(name) between 1 and 200),
  data            jsonb not null,
  template_source text not null default 'default'
                    check (template_source in ('default', 'imported')),
  raw_html_path   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index projects_user_id_updated_at_idx
  on public.projects (user_id, updated_at desc);

-- updated_at trigger
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.tg_set_updated_at();

-- RLS
alter table public.projects enable row level security;

create policy "projects_select_own" on public.projects
  for select to authenticated
  using (auth.uid() = user_id);

create policy "projects_insert_own" on public.projects
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "projects_update_own" on public.projects
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "projects_delete_own" on public.projects
  for delete to authenticated
  using (auth.uid() = user_id);
```

### 7.2 `supabase/migrations/0002_storage.sql`

Bucket is **public** because the resulting URLs go into outbound emails — recipients are unauthenticated. RLS on `storage.objects` still gates writes/deletes to the owning user. Path includes a per-file UUID to make URLs unguessable in practice.

```sql
insert into storage.buckets (id, name, public)
values ('project-assets', 'project-assets', true)
on conflict (id) do nothing;

-- Anyone can read (bucket is public). Writes/deletes restricted to owner.
create policy "project_assets_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'project-assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "project_assets_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'project-assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "project_assets_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'project-assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
```

### 7.3 Storage path convention

```
project-assets/{userId}/{projectId}/{fileUuid}.{ext}
```

`storage.foldername(name)[1]` is `{userId}` — that's the RLS hook.

## 8. HTML export contract

`renderEmail(data: ProjectData): string` produces a full `<!DOCTYPE html>...</html>` document. Constraints:

1. **Email-client safe.** Outlook 2019, Gmail web, Apple Mail. Implies: table-based layout, inline styles for everything visible, `<style>` block only for media queries / pseudo-classes.
2. **Byte-equivalent to `reference/globaltt-email.html`** for the default project (allowing whitespace differences). This is the renderer's acceptance test.
3. **All user-supplied strings escaped.** `htmlEscape` for text content, `attrEscape` for attribute values, URL whitelist (`http:`, `https:`, `mailto:`, `tel:`) for href targets.
4. **Alternating layout.** Even-indexed product sections → image left / text right. Odd-indexed → text left (`class="reverse"`) / image right. This matches the reference.
5. **Section overrides win.** When a section has `titleFontSize`, use it; else fall back to `global.headingFontSize`. Same for every other override.
6. **Images: src is always exactly the URL passed in.** Renderer never resolves, never proxies.

### Render function decomposition

```typescript
// src/lib/export/renderEmail.ts
export function renderEmail(data: ProjectData): string {
  return [
    '<!DOCTYPE html>',
    '<html xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="en">',
    renderHead(),
    renderBody(data),
    '</html>',
  ].join('\n');
}
```

The full renderer is built in Phase 3 with TDD. Reference output for the default project is locked into a snapshot test.

## 9. HTML import contract

`parseHtml(html: string): { data: ProjectData; warnings: ImportWarning[] }`

**Best-effort, never throws.** Designed for HTMLs produced by BEE Free, Mailchimp, and the GlobalTT reference template. Detection rules (in `detectors.ts`):

| Element kind | Detector |
| --- | --- |
| **Logo image** | First `<img>` whose width attr ≤ 500 OR alt contains "logo" (case-insensitive). |
| **Banner image** | Full-width `<img>` (width attr ≥ 600) appearing before the first `<h1>`/`<h3>` section heading. |
| **Section heading** | First `<h2>` or `<h3>` after the banner. |
| **Product section** | A subtree containing both `<h1>` (or `<h2>`) AND `<ul>` AND `<img>` AND a button-styled `<a>`. Walk siblings within the same `<table class="row">`. |
| **Bullet** | `<li>` text content (HTML stripped). |
| **CTA URL** | The `<a>`'s `href` whose inline style contains `background-color`. |
| **Footer** | The last `<table>` whose computed background is dark (`#000`, `#111`, or close). |
| **Background color** | `<body>`'s `style="background-color: ..."` or `bgcolor` attr. |
| **Button color** | First `<a>` whose inline style contains `background-color`. |
| **Font family** | First `font-family` value found in `<h1>` styles. |

**Warnings emitted** when:
- Number of detected product sections is 0
- One or more sections missing image
- Footer not found (use defaults, warn)
- Background color not detected (use default, warn)
- Unmatched `<p>` blocks not consumed by header/footer/sections (count, sample)

The wizard's "Step 2 — Review" surfaces warnings before persisting.

## 10. State management

Editor uses **one Zustand store** mounted on the editor page. The store holds the `ProjectData` plus a `dirty` flag, a `saving` flag, and the last-known `updated_at` from the server (for optimistic concurrency).

```typescript
// src/lib/editor/store.ts (skeleton — full version in Phase 2)
interface EditorState {
  projectId: string;
  name: string;
  data: ProjectData;
  serverUpdatedAt: string;
  saving: 'idle' | 'pending' | 'saving' | 'error';
  lastError: string | null;

  // mutations
  setGlobal:    (patch: Partial<GlobalStyles>) => void;
  setHeader:    (patch: Partial<Header>) => void;
  setFooter:    (patch: Partial<Footer>) => void;
  addSection:   () => void;
  removeSection:(id: string) => void;
  moveSection:  (id: string, dir: 'up' | 'down') => void;
  setSection:   (id: string, patch: Partial<ProductSection>) => void;
  setName:      (name: string) => void;
}
```

Components read with selectors (`useStore(s => s.data.global.backgroundColor)`) for granular re-renders. The preview iframe subscribes to the whole `data` and re-renders on any change.

## 11. Authentication flows

Use `@supabase/ssr` (cookie-based) — server components and route handlers can read the session, middleware refreshes it on every request.

### 11.1 `src/middleware.ts`

```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value, options }) => {
            req.cookies.set(name, value);
            res = NextResponse.next({ request: req });
            res.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Refresh
  const { data: { user } } = await supabase.auth.getUser();

  // Route guard
  const path = req.nextUrl.pathname;
  const isPublic = path.startsWith('/login')
                || path.startsWith('/signup')
                || path.startsWith('/reset')
                || path.startsWith('/auth');

  if (!user && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }

  if (user && (path === '/login' || path === '/signup')) {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

### 11.2 Sign-up flow

1. User submits `/signup` form.
2. Client calls `supabase.auth.signUp({ email, password })`.
3. Supabase sends confirmation email (Project → Auth settings → email templates).
4. User clicks link → lands on `/auth/callback?code=...` → server exchanges code → redirect to `/`.

### 11.3 Sign-in flow

Same shape: `signInWithPassword` → success → middleware redirects.

### 11.4 Google OAuth

Phase 4. `signInWithOAuth({ provider: 'google', options: { redirectTo: '<origin>/auth/callback' } })`. Configure in Supabase Dashboard → Auth → Providers.

### 11.5 Sign-out

POST `/auth/signout` calls `supabase.auth.signOut()` server-side, redirects `/login`.

## 12. Autosave strategy

- Debounce: **800 ms** after last edit.
- PATCH `/api/projects/[id]` with full `{ name, data, ifUnmodifiedSince: serverUpdatedAt }`.
- Server compares `If-Unmodified-Since` against current `updated_at`. Mismatch → 409 Conflict.
- Client on 409: pop a non-blocking toast "This project changed in another tab — reload to continue." Editor remains read-able but disabled.
- `saving` state (`idle | pending | saving | error`) drives the topbar indicator.
- Page unload while `pending`/`saving`: `beforeunload` handler with `e.preventDefault()` to warn.

## 13. Image upload

Client-side resize before upload to keep email payload reasonable:

- Max dimension: 1400 px (longest edge).
- Output format: keep PNG if input PNG with alpha; else convert to JPEG quality 0.85.
- Max file size accepted by `/api/upload`: 5 MB (rejected with 413).
- Server validates MIME (`image/png`, `image/jpeg`, `image/webp`, `image/gif`) and size; uploads to `{userId}/{projectId}/{uuid}.{ext}`; returns `{ publicUrl }`.

## 14. Environment variables

```
# .env.local.example
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-only, never imported in client code
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

`SUPABASE_SERVICE_ROLE_KEY` is only used by `src/lib/supabase/service.ts` and only by code that runs in route handlers (e.g. signed URL minting if we ever add private buckets). Phase 1 of v1 doesn't need it; ship the env var anyway so we don't forget later.

Lint rule (Phase 1): a custom ESLint check that fails the build if a file imported by anything in `app/**/page.tsx` or `components/**` references `SUPABASE_SERVICE_ROLE_KEY`.

## 15. Testing strategy

| Layer | Tool | What gets tested |
| --- | --- | --- |
| Unit | Vitest | `renderEmail`, `parseHtml`, `htmlEscape`, `defaultProject`, debounce util. **TDD-first.** |
| Component | RTL | Form components, complex panels (e.g. ProductSectionPanel reorder). |
| E2E | Playwright | Auth golden path, dashboard CRUD, editor → autosave → reload → state preserved, export round-trip. |
| Visual | Playwright snapshot | Default project rendered HTML matches `reference/globaltt-email.html` (whitespace-normalised). |

## 16. Out-of-scope (do not build)

Repeated from INDEX. Worth restating because every "what about X?" question for v1 should be checked against this list.

- Real-time collab.
- Undo/redo.
- Drag-and-drop reorder (buttons only).
- Sharing projects between accounts.
- Direct Nutshell integration.
- Full a11y audit.
- Editor UI translation (English only).
- Server-side image processing pipeline (client resizes before upload).
- Email send (no SMTP / no transactional service — exported HTML is the deliverable).
- Versioning / history of a single project.

---

**Done with spec. Open `PHASE-1-FOUNDATION.md` next.**
