# Workspaces + Brand Kits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-tenant workspaces with owner/editor/viewer roles and reusable brand kits to the GlobalTT Email Editor, scoping all data via RLS on `org_id` and routing the UI under `/w/[slug]/...`.

**Architecture:** Five new Postgres tables (`organizations`, `organization_members`, `organization_invites`, `brand_kits`) plus `projects.org_id` / `projects.brand_kit_id` columns. RLS uses a `security definer` helper `is_org_member(org, user, min_role)` that resolves the role matrix in one place. A `requireWorkspace(slug)` server helper resolves the active workspace + role per request, the dashboard moves to `/w/[slug]`, and Storage objects are rekeyed from `<user_id>/...` to `<org_id>/<project_id>/...`. Invite emails use Supabase Auth's `auth.admin.inviteUserByEmail()` over Supabase's configured SMTP (no Resend).

**Tech Stack:** Next.js 15 (App Router) · React 19 · TypeScript 5 · Tailwind 4 · Zustand + zundo · Supabase (Postgres + Auth + Storage + SMTP) · `citext`.

**Source spec:** `docs/superpowers/specs/2026-05-11-workspaces-brand-kits-design.md`

---

## File Structure

### New SQL migrations (`supabase/migrations/`)
- `0004_workspaces.sql` — already applied to remote DB; written into repo for replayability. Creates 4 new tables + adds `org_id` / `brand_kit_id` to `projects` + backfill.
- `0005_signup_trigger.sql` — `auth.users` insert trigger that auto-creates a personal workspace and owner membership.
- `0006_rls.sql` — already applied to remote DB; written into repo. Drops legacy `projects_*_own` policies, creates `is_org_member()` helper, enables new RLS for all 5 tables.
- `0007_storage_rls.sql` — drops legacy `project_assets_*_own` storage policies, replaces with `is_org_member()`-gated ones on `<org_id>/...` paths.
- `0008_accept_invite.sql` — `security definer` function `accept_invite(p_token text)` that validates a token, upserts membership, marks the invite accepted.

### New server helpers / API
- `src/lib/auth/workspace.ts` — `requireWorkspace(slug)` / `requireWorkspaceRole(slug, min)` returning `{ org, role, userId }`.
- `src/middleware.ts` — Next middleware guarding `/w/...` routes (auth + membership + `last_ws` cookie).
- `src/app/api/workspaces/route.ts` — POST create workspace.
- `src/app/api/workspaces/[slug]/route.ts` — PATCH rename, DELETE.
- `src/app/api/workspaces/[slug]/members/route.ts` — GET list, PATCH role, DELETE member.
- `src/app/api/workspaces/[slug]/invites/route.ts` — POST send, GET list, DELETE revoke.
- `src/app/api/workspaces/[slug]/brand-kits/route.ts` — GET list, POST create.
- `src/app/api/workspaces/[slug]/brand-kits/[id]/route.ts` — PATCH update, DELETE, POST `/duplicate`, POST `/default`.
- `src/app/api/invites/[token]/accept/route.ts` — POST accept invite.
- Modify `src/app/api/projects/route.ts` — inject `org_id` (resolved from active workspace) on insert.

### New pages
- `src/app/w/[slug]/page.tsx` — workspace dashboard (was `/`).
- `src/app/w/[slug]/p/[id]/page.tsx` — editor route (was `/p/[id]`).
- `src/app/w/[slug]/settings/general/page.tsx`
- `src/app/w/[slug]/settings/members/page.tsx`
- `src/app/w/[slug]/settings/brand-kits/page.tsx`
- `src/app/invite/[token]/page.tsx` — accept-invite landing.
- Modify `src/app/page.tsx` — server redirect to `/w/<last_ws or first membership>`.
- Move `src/app/p/[id]/page.tsx` → `src/app/w/[slug]/p/[id]/page.tsx`.

### New UI components
- `src/components/workspace/WorkspaceSwitcher.tsx`
- `src/components/workspace/CreateWorkspaceDialog.tsx`
- `src/components/workspace/InviteDialog.tsx`
- `src/components/workspace/MembersTable.tsx`
- `src/components/brand-kit/BrandKitCard.tsx`
- `src/components/brand-kit/BrandKitEditor.tsx` (tabs: Identity / Colors / Fonts / Logo / Footer NAP)
- `src/components/brand-kit/BrandKitPicker.tsx`

### Modified files
- `src/components/editor/Topbar.tsx:49-55` — "Projects" → `/w/${slug}`, insert `WorkspaceSwitcher`.
- `src/components/editor/panels/GlobalStylesPanel.tsx` — add brand-kit row (current kit + Apply / Detach).
- `src/components/dashboard/NewProjectDialog.tsx` — add brand-kit row above template grid.
- `src/lib/editor/state/actions.ts` (or current actions file) — `setProjectBrandKit(kitId)` (column-only), `applyBrandKit(kit)` (single zundo entry; mapping spelled out in Task 21).
- `src/lib/editor/persistence.ts` — include `brand_kit_id` in load/save shape.

### Scripts
- `scripts/rekey-storage.ts` — `--dry-run` / `--apply`. Copies `<user_id>/...` objects to `<org_id>/<project_id>/...`, rewrites `data.sections[].imagePath` (and `header.logoSrc`, `header.bannerSrc`, `footer.bannerSrc` if path-keyed). Copy-only; manual delete after verification.

---

## Conventions used in this plan

- TDD where practical. DB migrations are validated by running the migration locally and inspecting `\d+` and policies; UI/API tasks include unit/integration tests via the existing project test setup (`vitest` if present, else `node:test` — Task 4 checks and pins the runner).
- Commit after every passing test. Each commit message uses Conventional Commits.
- All paths absolute from repo root: `C:\Users\Developer2\Documents\html-editor`.

---

## Task 0: Pin the test runner and verify baseline

**Files:**
- Read: `package.json`
- Read: any `vitest.config.*` or `*.test.*` files at repo root

- [ ] **Step 1: Inspect test setup**

Run: `npm run -s test --silent` (in repo root). If the script is missing, run `npx vitest --version` and `node --test --help` to see what's available.

Expected: either a working `test` script or evidence of `vitest` / `node:test`. **If neither exists, install vitest:**

```bash
npm install -D vitest @vitest/ui
```

And add to `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 2: Commit the test setup if changed**

```bash
git add package.json package-lock.json
git commit -m "chore: ensure vitest is available for plan execution"
```

(Skip commit if nothing changed.)

---

## Task 1: Write `0004_workspaces.sql` into repo (DB already applied)

**Files:**
- Create: `supabase/migrations/0004_workspaces.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0004_workspaces.sql
-- NOTE: This migration was applied directly to the remote DB before being checked in.
-- It is written here for replayability / fresh local environments.

create extension if not exists citext;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug citext unique not null,
  name text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.tg_set_updated_at();

create table if not exists public.organization_members (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','editor','viewer')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index if not exists organization_members_user_id_idx
  on public.organization_members(user_id);

create table if not exists public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email citext not null,
  role text not null check (role in ('owner','editor','viewer')),
  token text not null unique,
  invited_by uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists organization_invites_org_id_idx
  on public.organization_invites(org_id);
create index if not exists organization_invites_email_idx
  on public.organization_invites(email);

create table if not exists public.brand_kits (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  colors jsonb not null default '{}'::jsonb,
  fonts jsonb not null default '{}'::jsonb,
  logo jsonb not null default '{}'::jsonb,
  footer jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger brand_kits_set_updated_at
before update on public.brand_kits
for each row execute function public.tg_set_updated_at();

create unique index if not exists brand_kits_one_default_per_org
  on public.brand_kits(org_id) where is_default;

-- Add org_id / brand_kit_id to projects
alter table public.projects
  add column if not exists org_id uuid references public.organizations(id) on delete cascade,
  add column if not exists brand_kit_id uuid references public.brand_kits(id) on delete set null;

create index if not exists projects_org_id_updated_at_idx
  on public.projects(org_id, updated_at desc);

-- Backfill: one personal workspace per existing owner
do $
declare
  u record;
  new_org uuid;
  base_slug text;
  candidate text;
  suffix int;
begin
  for u in
    select distinct p.user_id, coalesce(au.email, 'user') as email
    from public.projects p
    join auth.users au on au.id = p.user_id
    where p.org_id is null
  loop
    base_slug := lower(regexp_replace(split_part(u.email, '@', 1), '[^a-z0-9]+', '-', 'g'));
    if base_slug = '' then base_slug := 'workspace'; end if;
    candidate := base_slug;
    suffix := 1;
    while exists (select 1 from public.organizations where slug = candidate) loop
      suffix := suffix + 1;
      candidate := base_slug || '-' || suffix;
    end loop;

    insert into public.organizations (slug, name, created_by)
    values (candidate, initcap(replace(base_slug, '-', ' ')) || ' Workspace', u.user_id)
    returning id into new_org;

    insert into public.organization_members (org_id, user_id, role)
    values (new_org, u.user_id, 'owner');

    update public.projects set org_id = new_org where user_id = u.user_id and org_id is null;
  end loop;
end$;

alter table public.projects alter column org_id set not null;
```

- [ ] **Step 2: Verify the file matches what's in production**

Run (PowerShell):

```powershell
psql $env:SUPABASE_DB_URL -c "\d public.organizations"
psql $env:SUPABASE_DB_URL -c "\d public.organization_members"
psql $env:SUPABASE_DB_URL -c "\d public.organization_invites"
psql $env:SUPABASE_DB_URL -c "\d public.brand_kits"
psql $env:SUPABASE_DB_URL -c "\d public.projects"
```

Expected: every column declared in the migration appears in production. If anything diverges, **stop** and reconcile before continuing (the prod schema is the source of truth).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0004_workspaces.sql
git commit -m "feat(db): check in 0004 workspaces migration (already applied)"
```

---

## Task 2: Write `0005_signup_trigger.sql` and apply it

**Files:**
- Create: `supabase/migrations/0005_signup_trigger.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0005_signup_trigger.sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $
declare
  base_slug text;
  candidate text;
  suffix int := 1;
  new_org uuid;
begin
  base_slug := lower(regexp_replace(split_part(coalesce(new.email, 'user'), '@', 1), '[^a-z0-9]+', '-', 'g'));
  if base_slug = '' then base_slug := 'workspace'; end if;
  candidate := base_slug;
  while exists (select 1 from public.organizations where slug = candidate) loop
    suffix := suffix + 1;
    candidate := base_slug || '-' || suffix;
  end loop;

  insert into public.organizations (slug, name, created_by)
  values (candidate, initcap(replace(base_slug, '-', ' ')) || ' Workspace', new.id)
  returning id into new_org;

  insert into public.organization_members (org_id, user_id, role)
  values (new_org, new.id, 'owner');

  return new;
end;
$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
```

- [ ] **Step 2: Apply locally / to dev**

Run:

```powershell
psql $env:SUPABASE_DB_URL -f supabase/migrations/0005_signup_trigger.sql
```

Expected: `CREATE FUNCTION` + `CREATE TRIGGER` with no errors.

- [ ] **Step 3: Smoke-test via SQL**

Run:

```sql
-- simulate: create a user, confirm an org + membership land automatically
-- run in a transaction so we don't leave junk behind
begin;
  insert into auth.users (id, email, instance_id, aud, role)
  values (gen_random_uuid(), 'plan-test+' || floor(random()*1e9)::text || '@example.com',
          '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
  returning id \gset
  select count(*) from public.organization_members where user_id = :'id';
rollback;
```

Expected: `count` = 1.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0005_signup_trigger.sql
git commit -m "feat(db): auto-create personal workspace on signup"
```

---

## Task 3: Write `0006_rls.sql` into repo (DB already applied)

**Files:**
- Create: `supabase/migrations/0006_rls.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0006_rls.sql
-- NOTE: Already applied to the remote DB. Checked in for replayability.

-- Drop legacy owner-only policies (from 0001_init.sql)
drop policy if exists "projects_select_own"  on public.projects;
drop policy if exists "projects_insert_own"  on public.projects;
drop policy if exists "projects_update_own"  on public.projects;
drop policy if exists "projects_delete_own"  on public.projects;

-- Role-resolver helper
create or replace function public.is_org_member(p_org uuid, p_user uuid, p_min_role text default 'viewer')
returns boolean
language sql
stable
security definer
set search_path = public
as $
  select exists (
    select 1 from public.organization_members m
    where m.org_id = p_org and m.user_id = p_user
      and case p_min_role
            when 'viewer' then m.role in ('viewer','editor','owner')
            when 'editor' then m.role in ('editor','owner')
            when 'owner'  then m.role = 'owner'
          end
  );
$;

alter table public.organizations         enable row level security;
alter table public.organization_members  enable row level security;
alter table public.organization_invites  enable row level security;
alter table public.brand_kits            enable row level security;

-- organizations
create policy "orgs_select_member" on public.organizations
  for select to authenticated
  using (public.is_org_member(id, auth.uid(), 'viewer'));
create policy "orgs_update_owner" on public.organizations
  for update to authenticated
  using (public.is_org_member(id, auth.uid(), 'owner'))
  with check (public.is_org_member(id, auth.uid(), 'owner'));
create policy "orgs_delete_owner" on public.organizations
  for delete to authenticated
  using (public.is_org_member(id, auth.uid(), 'owner'));
create policy "orgs_insert_self" on public.organizations
  for insert to authenticated
  with check (created_by = auth.uid());

-- organization_members
create policy "members_select_self_or_org" on public.organization_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_org_member(org_id, auth.uid(), 'viewer'));
create policy "members_mutate_owner" on public.organization_members
  for all to authenticated
  using (public.is_org_member(org_id, auth.uid(), 'owner'))
  with check (public.is_org_member(org_id, auth.uid(), 'owner'));

-- organization_invites
create policy "invites_select_member" on public.organization_invites
  for select to authenticated
  using (public.is_org_member(org_id, auth.uid(), 'viewer'));
create policy "invites_mutate_owner" on public.organization_invites
  for all to authenticated
  using (public.is_org_member(org_id, auth.uid(), 'owner'))
  with check (public.is_org_member(org_id, auth.uid(), 'owner'));

-- brand_kits
create policy "brand_kits_select_member" on public.brand_kits
  for select to authenticated
  using (public.is_org_member(org_id, auth.uid(), 'viewer'));
create policy "brand_kits_mutate_editor" on public.brand_kits
  for all to authenticated
  using (public.is_org_member(org_id, auth.uid(), 'editor'))
  with check (public.is_org_member(org_id, auth.uid(), 'editor'));

-- projects (new role-aware policies)
create policy "projects_select_member" on public.projects
  for select to authenticated
  using (public.is_org_member(org_id, auth.uid(), 'viewer'));
create policy "projects_insert_editor" on public.projects
  for insert to authenticated
  with check (public.is_org_member(org_id, auth.uid(), 'editor') and user_id = auth.uid());
create policy "projects_update_editor" on public.projects
  for update to authenticated
  using (public.is_org_member(org_id, auth.uid(), 'editor'))
  with check (public.is_org_member(org_id, auth.uid(), 'editor'));
create policy "projects_delete_editor" on public.projects
  for delete to authenticated
  using (public.is_org_member(org_id, auth.uid(), 'editor'));
```

- [ ] **Step 2: Verify the policies in production match**

Run:

```powershell
psql $env:SUPABASE_DB_URL -c "select schemaname, tablename, policyname from pg_policies where schemaname='public' order by tablename, policyname;"
```

Expected: every `create policy` declared above appears; no legacy `projects_*_own` policies remain.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0006_rls.sql
git commit -m "feat(db): check in 0006 RLS migration (already applied)"
```

---

## Task 4: Add `requireWorkspace` / `requireWorkspaceRole` helpers

**Files:**
- Create: `src/lib/auth/workspace.ts`
- Test: `src/lib/auth/workspace.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/auth/workspace.test.ts
import { describe, it, expect, vi } from 'vitest';
import { resolveMinRole } from './workspace';

describe('resolveMinRole', () => {
  it('allows owner to satisfy any min', () => {
    expect(resolveMinRole('owner', 'viewer')).toBe(true);
    expect(resolveMinRole('owner', 'editor')).toBe(true);
    expect(resolveMinRole('owner', 'owner')).toBe(true);
  });
  it('blocks viewer from editor/owner', () => {
    expect(resolveMinRole('viewer', 'editor')).toBe(false);
    expect(resolveMinRole('viewer', 'owner')).toBe(false);
    expect(resolveMinRole('viewer', 'viewer')).toBe(true);
  });
  it('allows editor for editor and viewer but not owner', () => {
    expect(resolveMinRole('editor', 'viewer')).toBe(true);
    expect(resolveMinRole('editor', 'editor')).toBe(true);
    expect(resolveMinRole('editor', 'owner')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test**

Run: `npx vitest run src/lib/auth/workspace.test.ts`
Expected: FAIL — `resolveMinRole` not exported.

- [ ] **Step 3: Implement the helper**

```ts
// src/lib/auth/workspace.ts
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';

export type Role = 'owner' | 'editor' | 'viewer';

export interface WorkspaceContext {
  org: { id: string; slug: string; name: string };
  role: Role;
  userId: string;
}

const ORDER: Record<Role, number> = { viewer: 0, editor: 1, owner: 2 };

export function resolveMinRole(role: Role, min: Role): boolean {
  return ORDER[role] >= ORDER[min];
}

export async function requireWorkspace(slug: string): Promise<WorkspaceContext> {
  const sb = await createServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');

  const { data: org, error: orgErr } = await sb
    .from('organizations')
    .select('id, slug, name')
    .eq('slug', slug)
    .single();
  if (orgErr || !org) redirect('/');

  const { data: member, error: memErr } = await sb
    .from('organization_members')
    .select('role')
    .eq('org_id', org.id)
    .eq('user_id', user.id)
    .single();
  if (memErr || !member) redirect('/');

  return { org, role: member.role as Role, userId: user.id };
}

export async function requireWorkspaceRole(slug: string, min: Role): Promise<WorkspaceContext> {
  const ctx = await requireWorkspace(slug);
  if (!resolveMinRole(ctx.role, min)) redirect(`/w/${slug}`);
  return ctx;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/auth/workspace.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/workspace.ts src/lib/auth/workspace.test.ts
git commit -m "feat(auth): add requireWorkspace and requireWorkspaceRole helpers"
```

---

## Task 5: Next middleware for `/w/...` guard

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Implement middleware**

```ts
// src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { createMiddlewareClient } from '@/lib/supabase/middleware';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const url = req.nextUrl.clone();

  // Only guard /w/[slug]/... and /invite
  const wMatch = url.pathname.match(/^\/w\/([^/]+)/);
  if (!wMatch && !url.pathname.startsWith('/invite')) return res;

  const sb = createMiddlewareClient(req, res);
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    url.pathname = '/login';
    url.searchParams.set('next', req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (wMatch) {
    const slug = wMatch[1];
    const { data: org } = await sb
      .from('organizations').select('id').eq('slug', slug).single();
    if (!org) {
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
    const { data: member } = await sb
      .from('organization_members').select('role')
      .eq('org_id', org.id).eq('user_id', user.id).single();
    if (!member) {
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
    res.cookies.set('last_ws', slug, { path: '/', sameSite: 'lax' });
  }

  return res;
}

export const config = {
  matcher: ['/w/:path*', '/invite/:path*'],
};
```

- [ ] **Step 2: Confirm `createMiddlewareClient` exists**

Run: `npx tsc --noEmit`

Expected: PASS. If `@/lib/supabase/middleware` doesn't exist, create a thin wrapper around `@supabase/ssr` `createServerClient(req, res)` similar to `src/lib/supabase/server.ts` — see the Supabase SSR docs.

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts src/lib/supabase/middleware.ts
git commit -m "feat(auth): add /w/[slug] middleware guard"
```

---

## Task 6: New `/` root redirect

**Files:**
- Modify: `src/app/page.tsx` (overwrite)

- [ ] **Step 1: Replace with server redirect**

```tsx
// src/app/page.tsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';

export default async function RootPage() {
  const sb = await createServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');

  const last = (await cookies()).get('last_ws')?.value;
  if (last) {
    const { data: ok } = await sb
      .from('organizations').select('id').eq('slug', last).single();
    if (ok) redirect(`/w/${last}`);
  }

  const { data: rows } = await sb
    .from('organization_members')
    .select('organizations(slug)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1);
  // @ts-expect-error embed shape
  const slug = rows?.[0]?.organizations?.slug as string | undefined;
  if (!slug) redirect('/login'); // signup trigger should have created one
  redirect(`/w/${slug}`);
}
```

- [ ] **Step 2: Move former dashboard to `/w/[slug]`**

Run (PowerShell):

```powershell
git mv src/app/page.tsx src/app/w/[slug]/page.tsx
```

Wait — this will conflict with Step 1. **Do Step 2 BEFORE Step 1**, then write the redirect file fresh. Re-order in execution: (a) `git mv` first, (b) then create the new redirect file.

- [ ] **Step 3: Update the moved page to consume `params.slug` and `requireWorkspace`**

In `src/app/w/[slug]/page.tsx`, replace the top of the file:

```tsx
import { requireWorkspace } from '@/lib/auth/workspace';

export default async function WorkspaceDashboard({
  params,
}: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { org, role, userId } = await requireWorkspace(slug);
  // … (existing dashboard code reads its projects, but the project query
  //     now filters by org.id — see Task 7.)
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/w
git commit -m "feat(routing): move dashboard to /w/[slug] and add root redirect"
```

---

## Task 7: Scope dashboard project list to `org.id`

**Files:**
- Modify: `src/app/w/[slug]/page.tsx`

- [ ] **Step 1: Update the projects query**

In the dashboard server component, change the projects SELECT from `.eq('user_id', user.id)` to `.eq('org_id', org.id)` and pass `slug`, `role` down to client components so the "+ New Project" button can be disabled for `viewer`.

```tsx
const { data: projects } = await sb
  .from('projects')
  .select('id, name, updated_at, brand_kit_id')
  .eq('org_id', org.id)
  .order('updated_at', { ascending: false });
```

- [ ] **Step 2: Update child dashboard components**

Wherever the dashboard renders project links, change `href={`/p/${p.id}`}` → `href={`/w/${slug}/p/${p.id}`}`. Disable "+ New Project" if `role === 'viewer'`.

- [ ] **Step 3: Type-check + manual smoke**

Run: `npx tsc --noEmit`
Run: `npm run dev` and visit `/` — expect redirect to `/w/<your-slug>` and the dashboard renders.

- [ ] **Step 4: Commit**

```bash
git add src/app/w
git commit -m "feat(dashboard): scope project list to org_id"
```

---

## Task 8: Move editor route to `/w/[slug]/p/[id]`

**Files:**
- Move: `src/app/p/[id]/page.tsx` → `src/app/w/[slug]/p/[id]/page.tsx`

- [ ] **Step 1: Move the file**

Run (PowerShell):

```powershell
git mv "src/app/p" "src/app/w/[slug]/p"
```

- [ ] **Step 2: Update the page signature**

In `src/app/w/[slug]/p/[id]/page.tsx`:

```tsx
import { requireWorkspaceRole } from '@/lib/auth/workspace';

export default async function EditorPage({
  params,
}: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const ctx = await requireWorkspaceRole(slug, 'viewer');
  // viewer = read-only mode (Task 19); editor/owner = full.
  // …existing editor code, but now load project by id AND org_id = ctx.org.id.
}
```

- [ ] **Step 3: Update server project fetch**

Replace any `.eq('user_id', user.id)` on the project SELECT with `.eq('org_id', ctx.org.id)`.

- [ ] **Step 4: Type-check + smoke**

Run: `npx tsc --noEmit` and visit `/w/<slug>/p/<an existing project id>`.
Expected: editor loads.

- [ ] **Step 5: Commit**

```bash
git add src/app/w/[slug]/p
git rm src/app/p/[id]/page.tsx 2>$null
git commit -m "feat(routing): nest editor under /w/[slug]/p/[id]"
```

---

## Task 9: Update Topbar "Projects" link

**Files:**
- Modify: `src/components/editor/Topbar.tsx:49-55`

- [ ] **Step 1: Replace the hard-coded `/` link**

Change line 49–54 from:

```tsx
<Link href="/" ...>
  <ArrowLeft size={14} /> Projects
</Link>
```

to:

```tsx
<Link href={`/w/${workspaceSlug}`} ...>
  <ArrowLeft size={14} /> Projects
</Link>
```

And add the prop on the editor page that uses `<Topbar />`. Plumb `workspaceSlug` from `params.slug` through whatever component owns `<Topbar />`.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/Topbar.tsx src/app/w/[slug]/p
git commit -m "feat(editor): scope Topbar Projects link to active workspace"
```

---

## Task 10: Retrofit `POST /api/projects` to inject `org_id`

**Files:**
- Modify: `src/app/api/projects/route.ts`

- [ ] **Step 1: Resolve workspace from body or `last_ws` cookie**

The new client always passes `slug` in the POST body. Server reads it, resolves `org_id`, asserts `editor` role, and inserts.

```ts
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { requireWorkspaceRole } from '@/lib/auth/workspace';

export async function POST(req: Request) {
  const body = await req.json();
  const slug = body.slug as string | undefined;
  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 });

  const ctx = await requireWorkspaceRole(slug, 'editor');
  const sb = await createServerClient();
  const { data, error } = await sb.from('projects').insert({
    org_id: ctx.org.id,
    user_id: ctx.userId,
    name: body.name ?? 'Untitled',
    data: body.data,
    template_source: body.template_source ?? null,
    brand_kit_id: body.brand_kit_id ?? null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
```

- [ ] **Step 2: Update client callers**

In `src/lib/api/projects.ts`, `createProject()` now requires `slug`. Update `NewProjectDialog` (see Task 17) to pass `slug` from the current route.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/projects/route.ts src/lib/api/projects.ts
git commit -m "feat(api): require workspace slug and inject org_id on project create"
```

---

## Task 11: `POST /api/workspaces` — create workspace

**Files:**
- Create: `src/app/api/workspaces/route.ts`
- Test: `src/app/api/workspaces/route.test.ts`

- [ ] **Step 1: Write a failing test for slug-collision suffixing**

```ts
// src/app/api/workspaces/route.test.ts
import { describe, it, expect } from 'vitest';
import { nextAvailableSlug } from './route';

describe('nextAvailableSlug', () => {
  it('returns base when free', () => {
    expect(nextAvailableSlug('acme', new Set())).toBe('acme');
  });
  it('appends -2 when base taken', () => {
    expect(nextAvailableSlug('acme', new Set(['acme']))).toBe('acme-2');
  });
  it('walks until free', () => {
    expect(nextAvailableSlug('acme', new Set(['acme','acme-2','acme-3']))).toBe('acme-4');
  });
});
```

- [ ] **Step 2: Run — verify it fails**

Run: `npx vitest run src/app/api/workspaces/route.test.ts`
Expected: FAIL — `nextAvailableSlug` not exported.

- [ ] **Step 3: Implement route + helper**

```ts
// src/app/api/workspaces/route.ts
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export function nextAvailableSlug(base: string, taken: Set<string>): string {
  let candidate = base;
  let i = 1;
  while (taken.has(candidate)) {
    i += 1;
    candidate = `${base}-${i}`;
  }
  return candidate;
}

function toSlug(name: string): string {
  const s = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s || 'workspace';
}

export async function POST(req: Request) {
  const sb = await createServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { name } = await req.json();
  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name required' }, { status: 400 });
  }
  const base = toSlug(name);
  const { data: existing } = await sb.from('organizations').select('slug')
    .ilike('slug', `${base}%`);
  const slug = nextAvailableSlug(base, new Set(existing?.map(r => r.slug) ?? []));

  const { data: org, error } = await sb.from('organizations')
    .insert({ slug, name, created_by: user.id }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await sb.from('organization_members').insert({
    org_id: org.id, user_id: user.id, role: 'owner',
  });

  return NextResponse.json(org);
}
```

- [ ] **Step 4: Run — verify it passes**

Run: `npx vitest run src/app/api/workspaces/route.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/workspaces/route.ts src/app/api/workspaces/route.test.ts
git commit -m "feat(api): POST /api/workspaces with slug-collision suffixing"
```

---

## Task 12: `PATCH/DELETE /api/workspaces/[slug]`

**Files:**
- Create: `src/app/api/workspaces/[slug]/route.ts`

- [ ] **Step 1: Implement**

```ts
// src/app/api/workspaces/[slug]/route.ts
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { requireWorkspaceRole } from '@/lib/auth/workspace';

export async function PATCH(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireWorkspaceRole(slug, 'owner');
  const { name, newSlug } = await req.json();
  const sb = await createServerClient();
  const patch: Record<string, string> = {};
  if (typeof name === 'string') patch.name = name;
  if (typeof newSlug === 'string') patch.slug = newSlug;
  const { data, error } = await sb.from('organizations')
    .update(patch).eq('id', ctx.org.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireWorkspaceRole(slug, 'owner');
  const sb = await createServerClient();
  const { error } = await sb.from('organizations').delete().eq('id', ctx.org.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Type-check + commit**

```bash
npx tsc --noEmit
git add src/app/api/workspaces/[slug]/route.ts
git commit -m "feat(api): rename and delete workspace"
```

---

## Task 13: Members + Invites API

**Files:**
- Create: `src/app/api/workspaces/[slug]/members/route.ts`
- Create: `src/app/api/workspaces/[slug]/invites/route.ts`
- Create: `src/app/api/invites/[token]/accept/route.ts`

- [ ] **Step 1: Members route (GET/PATCH/DELETE)**

```ts
// src/app/api/workspaces/[slug]/members/route.ts
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { requireWorkspaceRole, requireWorkspace } from '@/lib/auth/workspace';

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireWorkspace(slug);
  const sb = await createServerClient();
  const { data, error } = await sb.from('organization_members')
    .select('user_id, role, created_at')
    .eq('org_id', ctx.org.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireWorkspaceRole(slug, 'owner');
  const { user_id, role } = await req.json();
  if (!['owner','editor','viewer'].includes(role)) {
    return NextResponse.json({ error: 'bad role' }, { status: 400 });
  }
  const sb = await createServerClient();
  const { error } = await sb.from('organization_members')
    .update({ role }).eq('org_id', ctx.org.id).eq('user_id', user_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireWorkspaceRole(slug, 'owner');
  const { user_id } = await req.json();
  const sb = await createServerClient();
  const { error } = await sb.from('organization_members')
    .delete().eq('org_id', ctx.org.id).eq('user_id', user_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Invites route — POST send (Supabase SMTP), GET list, DELETE revoke**

```ts
// src/app/api/workspaces/[slug]/invites/route.ts
import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { createServerClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireWorkspaceRole, requireWorkspace } from '@/lib/auth/workspace';

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireWorkspace(slug);
  const sb = await createServerClient();
  const { data, error } = await sb.from('organization_invites')
    .select('id, email, role, token, expires_at, accepted_at, created_at')
    .eq('org_id', ctx.org.id).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireWorkspaceRole(slug, 'owner');
  const { email, role } = await req.json();
  if (!email || !['owner','editor','viewer'].includes(role)) {
    return NextResponse.json({ error: 'bad input' }, { status: 400 });
  }
  const token = randomBytes(24).toString('base64url');
  const expires = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

  const sb = await createServerClient();
  const { data: invite, error } = await sb.from('organization_invites').insert({
    org_id: ctx.org.id, email, role, token, invited_by: ctx.userId, expires_at: expires,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}`;
  const svc = createServiceClient();
  const { error: mailErr } = await svc.auth.admin.inviteUserByEmail(email, {
    redirectTo: acceptUrl,
  });
  if (mailErr) {
    return NextResponse.json({ invite, acceptUrl, warning: mailErr.message });
  }
  return NextResponse.json({ invite, acceptUrl });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireWorkspaceRole(slug, 'owner');
  const { id } = await req.json();
  const sb = await createServerClient();
  const { error } = await sb.from('organization_invites')
    .delete().eq('org_id', ctx.org.id).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Accept-invite route**

```ts
// src/app/api/invites/[token]/accept/route.ts
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sb = await createServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await sb.rpc('accept_invite', { p_token: token });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/workspaces/[slug]/members src/app/api/workspaces/[slug]/invites src/app/api/invites
git commit -m "feat(api): members + invites endpoints via Supabase SMTP"
```

---

## Task 14: Brand-kit API

**Files:**
- Create: `src/app/api/workspaces/[slug]/brand-kits/route.ts`
- Create: `src/app/api/workspaces/[slug]/brand-kits/[id]/route.ts`
- Create: `src/app/api/workspaces/[slug]/brand-kits/[id]/duplicate/route.ts`
- Create: `src/app/api/workspaces/[slug]/brand-kits/[id]/default/route.ts`

- [ ] **Step 1: List/create route**

```ts
// src/app/api/workspaces/[slug]/brand-kits/route.ts
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { requireWorkspaceRole, requireWorkspace } from '@/lib/auth/workspace';

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireWorkspace(slug);
  const sb = await createServerClient();
  const { data, error } = await sb.from('brand_kits')
    .select('*').eq('org_id', ctx.org.id).order('updated_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireWorkspaceRole(slug, 'editor');
  const body = await req.json();
  const sb = await createServerClient();
  const { data, error } = await sb.from('brand_kits').insert({
    org_id: ctx.org.id,
    name: body.name ?? 'Untitled kit',
    colors: body.colors ?? {},
    fonts: body.fonts ?? {},
    logo: body.logo ?? {},
    footer: body.footer ?? {},
    is_default: false,
    created_by: ctx.userId,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
```

- [ ] **Step 2: Single kit PATCH/DELETE**

```ts
// src/app/api/workspaces/[slug]/brand-kits/[id]/route.ts
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { requireWorkspaceRole } from '@/lib/auth/workspace';

export async function PATCH(req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const ctx = await requireWorkspaceRole(slug, 'editor');
  const patch = await req.json();
  const sb = await createServerClient();
  const { data, error } = await sb.from('brand_kits')
    .update(patch).eq('org_id', ctx.org.id).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const ctx = await requireWorkspaceRole(slug, 'editor');
  const sb = await createServerClient();
  const { error } = await sb.from('brand_kits')
    .delete().eq('org_id', ctx.org.id).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Duplicate + default routes**

```ts
// src/app/api/workspaces/[slug]/brand-kits/[id]/duplicate/route.ts
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { requireWorkspaceRole } from '@/lib/auth/workspace';

export async function POST(_req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const ctx = await requireWorkspaceRole(slug, 'editor');
  const sb = await createServerClient();
  const { data: src, error: e1 } = await sb.from('brand_kits')
    .select('*').eq('org_id', ctx.org.id).eq('id', id).single();
  if (e1 || !src) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const { data, error } = await sb.from('brand_kits').insert({
    org_id: ctx.org.id, name: `${src.name} (copy)`,
    colors: src.colors, fonts: src.fonts, logo: src.logo, footer: src.footer,
    is_default: false, created_by: ctx.userId,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
```

```ts
// src/app/api/workspaces/[slug]/brand-kits/[id]/default/route.ts
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { requireWorkspaceRole } from '@/lib/auth/workspace';

export async function POST(_req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const ctx = await requireWorkspaceRole(slug, 'editor');
  const sb = await createServerClient();
  // unset existing default, set this one
  await sb.from('brand_kits').update({ is_default: false })
    .eq('org_id', ctx.org.id).eq('is_default', true);
  const { error } = await sb.from('brand_kits').update({ is_default: true })
    .eq('org_id', ctx.org.id).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/workspaces/[slug]/brand-kits
git commit -m "feat(api): brand-kit CRUD, duplicate, set-default"
```

---

## Task 15: `WorkspaceSwitcher` + `CreateWorkspaceDialog`

**Files:**
- Create: `src/components/workspace/WorkspaceSwitcher.tsx`
- Create: `src/components/workspace/CreateWorkspaceDialog.tsx`

- [ ] **Step 1: Switcher**

```tsx
// src/components/workspace/WorkspaceSwitcher.tsx
'use client';
import Link from 'next/link';
import { ChevronsUpDown, Plus } from 'lucide-react';
import { useState } from 'react';
import { CreateWorkspaceDialog } from './CreateWorkspaceDialog';

interface WS { id: string; slug: string; name: string }

export function WorkspaceSwitcher({ current, workspaces }: { current: WS; workspaces: WS[] }) {
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState(false);
  return (
    <>
      <div className="relative">
        <button
          onClick={() => setOpen(o => !o)}
          className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-2.5 py-1 text-xs text-fg hover:bg-panel transition-colors"
        >
          {current.name} <ChevronsUpDown size={12} />
        </button>
        {open && (
          <div className="absolute z-50 top-full mt-1 left-0 w-56 bg-panel-2 border border-border-strong rounded-md shadow-lg p-1">
            {workspaces.map(w => (
              <Link key={w.id} href={`/w/${w.slug}`} onClick={() => setOpen(false)}
                    className="block px-2 py-1.5 rounded text-sm hover:bg-panel">
                {w.name}
              </Link>
            ))}
            <button
              onClick={() => { setOpen(false); setDialog(true); }}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-sm hover:bg-panel text-brand"
            >
              <Plus size={12} /> New workspace
            </button>
          </div>
        )}
      </div>
      <CreateWorkspaceDialog open={dialog} onClose={() => setDialog(false)} />
    </>
  );
}
```

- [ ] **Step 2: Create dialog (mirror `NewProjectDialog`)**

```tsx
// src/components/workspace/CreateWorkspaceDialog.tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { fade, scaleFade } from '@/lib/motion';
import { toast } from '@/lib/utils/toast';

interface Props { open: boolean; onClose: () => void }

export function CreateWorkspaceDialog({ open, onClose }: Props) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) setName(''); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  async function go() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      const ws = await res.json();
      router.push(`/w/${ws.slug}`);
    } catch (e) {
      toast.error(`Couldn't create workspace: ${(e as Error).message}`);
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-6"
                    onClick={() => { if (!busy) onClose(); }}
                    variants={fade} initial="hidden" animate="show" exit="exit">
          <motion.div className="bg-panel border border-border-strong rounded-xl p-6 w-[480px] max-w-full"
                      onClick={(e) => e.stopPropagation()}
                      variants={scaleFade} initial="hidden" animate="show" exit="exit">
            <div className="font-semibold text-fg mb-1">New workspace</div>
            <div className="text-sm text-muted mb-5">Workspaces hold projects, brand kits, and members.</div>
            <input autoFocus className="w-full bg-panel-2 border border-border-strong rounded px-3 py-2 mb-5"
                   placeholder="Workspace name" value={name} onChange={e => setName(e.target.value)} />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
              <Button onClick={go} disabled={busy || !name.trim()}>
                {busy ? <Spinner /> : 'Create workspace'}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 3: Insert into Topbar**

Modify `src/components/editor/Topbar.tsx` between line 54 and 55 (between `</Link>` and `<span>|</span>`):

```tsx
<WorkspaceSwitcher current={currentWorkspace} workspaces={workspaces} />
```

Pass `currentWorkspace` and `workspaces` from the page (server component fetches `organization_members` joined with `organizations`).

- [ ] **Step 4: Type-check + commit**

```bash
npx tsc --noEmit
git add src/components/workspace src/components/editor/Topbar.tsx
git commit -m "feat(ui): workspace switcher + create dialog"
```

---

## Task 16: Settings pages — General / Members / Brand Kits

**Files:**
- Create: `src/app/w/[slug]/settings/general/page.tsx`
- Create: `src/app/w/[slug]/settings/members/page.tsx`
- Create: `src/app/w/[slug]/settings/brand-kits/page.tsx`
- Create: `src/components/workspace/MembersTable.tsx`
- Create: `src/components/workspace/InviteDialog.tsx`
- Create: `src/components/brand-kit/BrandKitCard.tsx`
- Create: `src/components/brand-kit/BrandKitEditor.tsx`

- [ ] **Step 1: General settings (rename + delete)**

```tsx
// src/app/w/[slug]/settings/general/page.tsx
import { requireWorkspaceRole } from '@/lib/auth/workspace';
import { GeneralSettingsForm } from '@/components/workspace/GeneralSettingsForm';

export default async function GeneralSettings({
  params,
}: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireWorkspaceRole(slug, 'owner');
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-semibold text-fg mb-1">General</h1>
      <p className="text-sm text-muted mb-6">Rename or delete this workspace.</p>
      <GeneralSettingsForm slug={ctx.org.slug} name={ctx.org.name} />
    </div>
  );
}
```

`GeneralSettingsForm` is a client component with a name input that POSTs PATCH /api/workspaces/[slug] and a "Delete workspace" button with a confirm dialog (typed slug to confirm).

- [ ] **Step 2: Members page**

```tsx
// src/app/w/[slug]/settings/members/page.tsx
import { requireWorkspace } from '@/lib/auth/workspace';
import { MembersTable } from '@/components/workspace/MembersTable';
import { createServerClient } from '@/lib/supabase/server';

export default async function MembersPage({
  params,
}: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireWorkspace(slug);
  const sb = await createServerClient();
  const [{ data: members }, { data: invites }] = await Promise.all([
    sb.from('organization_members').select('user_id, role, created_at').eq('org_id', ctx.org.id),
    sb.from('organization_invites').select('id, email, role, accepted_at, expires_at')
      .eq('org_id', ctx.org.id).is('accepted_at', null),
  ]);
  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-xl font-semibold text-fg mb-4">Members</h1>
      <MembersTable
        slug={slug}
        canManage={ctx.role === 'owner'}
        members={members ?? []}
        invites={invites ?? []}
      />
    </div>
  );
}
```

`MembersTable` is a client component that shows a list, role dropdowns (disabled unless `canManage`), a "Remove" button, pending invites with "Revoke", and an "+ Invite" button that opens `InviteDialog` (email + role).

- [ ] **Step 3: Brand kits page**

```tsx
// src/app/w/[slug]/settings/brand-kits/page.tsx
import { requireWorkspace } from '@/lib/auth/workspace';
import { createServerClient } from '@/lib/supabase/server';
import { BrandKitsList } from '@/components/brand-kit/BrandKitsList';

export default async function BrandKitsPage({
  params,
}: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireWorkspace(slug);
  const sb = await createServerClient();
  const { data } = await sb.from('brand_kits').select('*')
    .eq('org_id', ctx.org.id).order('updated_at', { ascending: false });
  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-xl font-semibold text-fg mb-4">Brand kits</h1>
      <BrandKitsList slug={slug} canEdit={ctx.role !== 'viewer'} kits={data ?? []} />
    </div>
  );
}
```

`BrandKitsList` renders `BrandKitCard` for each kit + a "+ New brand kit" button. Clicking a card opens `BrandKitEditor` (modal or drawer) with tabs Identity / Colors / Fonts / Logo / Footer NAP. Save calls PATCH /api/workspaces/[slug]/brand-kits/[id].

- [ ] **Step 4: Commit**

```bash
npx tsc --noEmit
git add src/app/w/[slug]/settings src/components/workspace src/components/brand-kit
git commit -m "feat(ui): workspace settings (general, members, brand kits)"
```

---

## Task 17: Add brand-kit row to `NewProjectDialog`

**Files:**
- Modify: `src/components/dashboard/NewProjectDialog.tsx`

- [ ] **Step 1: Fetch kits client-side and add picker**

Above the template grid (between line 69 and 70 in the current file), insert a `BrandKitPicker` row. Pass `slug` (from `useParams()` on the dashboard or a prop). The selected kit id is sent in the create payload.

```tsx
const [kitId, setKitId] = useState<string | null>(null);
const [kits, setKits] = useState<{id:string;name:string;is_default:boolean}[]>([]);
useEffect(() => {
  if (!open) return;
  fetch(`/api/workspaces/${slug}/brand-kits`).then(r => r.json()).then(setKits);
}, [open, slug]);
useEffect(() => {
  if (kits.length && kitId === null) setKitId(kits.find(k => k.is_default)?.id ?? null);
}, [kits, kitId]);
```

Render the picker (a styled `<select>` is fine) above the template grid, then pass `brand_kit_id: kitId` to `createProject()`.

- [ ] **Step 2: Update `createProject` signature**

```ts
// src/lib/api/projects.ts
export async function createProject(name?: string, templateSource?: string, brandKitId?: string|null) {
  const slug = /* read from cookie or pass through */;
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ slug, name, template_source: templateSource, brand_kit_id: brandKitId }),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
  return res.json();
}
```

(Simplest: read `slug` from the page that opens the dialog and pass it as a prop on `NewProjectDialog`.)

- [ ] **Step 3: Type-check + commit**

```bash
npx tsc --noEmit
git add src/components/dashboard/NewProjectDialog.tsx src/lib/api/projects.ts src/app/w/[slug]/page.tsx
git commit -m "feat(dashboard): brand-kit picker on new project"
```

---

## Task 18: Brand-kit row in `GlobalStylesPanel`

**Files:**
- Modify: `src/components/editor/panels/GlobalStylesPanel.tsx`
- Create: `src/components/brand-kit/BrandKitPicker.tsx`

- [ ] **Step 1: Picker component**

```tsx
// src/components/brand-kit/BrandKitPicker.tsx
'use client';
import { useEffect, useState } from 'react';

export interface BrandKit { id: string; name: string; is_default: boolean }

export function BrandKitPicker({
  slug, value, onChange, disabled,
}: { slug: string; value: string|null; onChange: (id: string|null) => void; disabled?: boolean }) {
  const [kits, setKits] = useState<BrandKit[]>([]);
  useEffect(() => {
    fetch(`/api/workspaces/${slug}/brand-kits`).then(r => r.json()).then(setKits);
  }, [slug]);
  return (
    <select
      disabled={disabled}
      value={value ?? ''}
      onChange={e => onChange(e.target.value || null)}
      className="w-full bg-panel-2 border border-border-strong rounded px-2 py-1 text-sm"
    >
      <option value="">— None —</option>
      {kits.map(k => (
        <option key={k.id} value={k.id}>{k.name}{k.is_default ? ' (default)' : ''}</option>
      ))}
    </select>
  );
}
```

- [ ] **Step 2: Insert into `GlobalStylesPanel`**

At the top of the panel (above the existing color/font controls), add:

```tsx
<div className="flex items-center gap-2">
  <BrandKitPicker
    slug={slug}
    value={brandKitId}
    onChange={(id) => store.getState().setProjectBrandKit(id)}
    disabled={role === 'viewer'}
  />
  <Button size="sm" onClick={() => store.getState().applyBrandKit(currentKit)} disabled={!currentKit || role === 'viewer'}>
    Apply
  </Button>
  <Button size="sm" variant="ghost" onClick={() => store.getState().setProjectBrandKit(null)} disabled={!brandKitId || role === 'viewer'}>
    Detach
  </Button>
</div>
```

Plumb `slug` and `role` into the panel via props or a context provider on the editor page.

- [ ] **Step 3: Type-check + commit**

```bash
npx tsc --noEmit
git add src/components/brand-kit/BrandKitPicker.tsx src/components/editor/panels/GlobalStylesPanel.tsx
git commit -m "feat(editor): brand-kit picker in Global Styles"
```

---

## Task 19: Read-only mode for viewers

**Files:**
- Modify: editor page + child panels

- [ ] **Step 1: Provide `role` via context**

In `src/app/w/[slug]/p/[id]/page.tsx`, after `requireWorkspaceRole`, pass `role` to a client wrapper. Add a `RoleProvider` (simple React context) at `src/lib/editor/RoleProvider.tsx`.

```tsx
// src/lib/editor/RoleProvider.tsx
'use client';
import { createContext, useContext } from 'react';
import type { Role } from '@/lib/auth/workspace';

const RoleCtx = createContext<Role>('viewer');
export const useRole = () => useContext(RoleCtx);
export function RoleProvider({ role, children }: { role: Role; children: React.ReactNode }) {
  return <RoleCtx.Provider value={role}>{children}</RoleCtx.Provider>;
}
```

Wrap editor JSX with `<RoleProvider role={ctx.role}>` and add `useRole()` checks in panels. When `role === 'viewer'`, disable inputs, hide save / undo / redo, hide all "+ Add" buttons. Save endpoint already rejects viewers via RLS.

- [ ] **Step 2: Manual smoke**

Run `npm run dev`. Sign in as a viewer member (create one via SQL or the members UI), open a project — verify the UI is read-only.

- [ ] **Step 3: Commit**

```bash
git add src/lib/editor/RoleProvider.tsx src/app/w src/components/editor
git commit -m "feat(editor): read-only mode for viewer role"
```

---

## Task 20: `setProjectBrandKit` action

**Files:**
- Modify: the editor store actions file (search with `grep` first to locate)
- Test: `src/lib/editor/state/actions.test.ts`

- [ ] **Step 1: Locate the actions file**

Run: `Grep "addSection" src/lib/editor` (the existing `addSection` action lives in the same file you'll modify). Note the file path.

- [ ] **Step 2: Write failing test**

```ts
// src/lib/editor/state/actions.test.ts
import { describe, it, expect } from 'vitest';
import { createEditorStore } from '@/lib/editor/StoreProvider'; // adjust path

describe('setProjectBrandKit', () => {
  it('updates brand_kit_id without touching data', () => {
    const store = createEditorStore({ /* minimal init */ });
    const before = store.getState().data;
    store.getState().setProjectBrandKit('kit-123');
    expect(store.getState().brandKitId).toBe('kit-123');
    expect(store.getState().data).toBe(before);
  });
});
```

- [ ] **Step 3: Run — verify FAIL**

Run: `npx vitest run src/lib/editor/state/actions.test.ts`
Expected: FAIL — `setProjectBrandKit` not defined.

- [ ] **Step 4: Implement**

In the store file (where `addSection` is defined), add:

```ts
setProjectBrandKit: (id: string | null) => set((s) => ({ ...s, brandKitId: id })),
```

Add `brandKitId: string | null` to the state type. Make sure `brandKitId` is **outside** the temporal-tracked slice (zundo's `partialize` should exclude it, or alternatively this setter calls `store.flushHistoryCooldown()` and bypasses zundo). Track this in persistence: load from `projects.brand_kit_id`, write back on save.

- [ ] **Step 5: Verify PASS + commit**

```bash
npx vitest run src/lib/editor/state/actions.test.ts
git add src/lib/editor src/lib/editor/state/actions.test.ts
git commit -m "feat(editor): setProjectBrandKit action (column-only, no zundo entry)"
```

---

## Task 21: `applyBrandKit` action (single zundo entry, footer mapping)

**Files:**
- Modify: same store file as Task 20
- Test: extend `src/lib/editor/state/actions.test.ts`

- [ ] **Step 1: Document the mapping**

`brand_kits.footer` shape from spec §1 has NAP fields. The project's `data.footer` uses different keys (per `src/lib/editor/templates.ts`):

| `brand_kits.footer` field | maps to `data.footer.*`               |
|---------------------------|---------------------------------------|
| `company`                 | `companyName`                         |
| `address` + `city` + `region` + `postal` | `address` (joined with `, ` when present) |
| `phone`                   | `phone` (full); also `phoneTel` = digits-only |
| `email`                   | `email`                               |
| `website`                 | `websites: [website]` (replaces array)|

Colors map (`brand_kits.colors` → `data.global.*`):
- `brand`  → `accentColor` and `buttonColor`
- `text`   → `textColor`
- `background` → `backgroundColor`
- `footerBg`   → `footerBackgroundColor`
- `footerText` → `footerTextColor`
- `buttonText` → `buttonTextColor`

Fonts (`brand_kits.fonts` → `data.global.*`):
- `body` → `fontFamily`
- `baseSize` → `baseFontSize`
- `headingSize` → `headingFontSize`

Logo (`brand_kits.logo`) is informational for now; surface in the kit editor preview but do not auto-write to `data.header` (avoid surprising overwrites of section-level imagery). Spec §5.3 confirms Apply touches `globalStyles` + `footer` only.

- [ ] **Step 2: Failing test**

```ts
it('applyBrandKit overwrites global + footer in one zundo entry', () => {
  const store = createEditorStore({
    data: {
      global: { backgroundColor: '#fff', textColor: '#000', accentColor: '#abc', buttonColor: '#abc', buttonTextColor: '#000', fontFamily: 'A', baseFontSize: 14, headingFontSize: 28, footerBackgroundColor: '#222', footerTextColor: '#eee', contactUrl: '' },
      footer: { companyName: 'old', address: 'old', phone: '', phoneTel: '', email: '', websites: [], socials: [], bannerSrc: '', bannerAlt: '' },
      sections: [],
      header: {},
    } as any,
  });
  const before = store.getState().data;
  store.getState().applyBrandKit({
    id: 'k1', name: 'k', is_default: false, org_id: 'o',
    colors: { brand: '#ff0000', text: '#111111', background: '#fafafa', buttonText: '#ffffff', footerBg: '#000000', footerText: '#ffffff' },
    fonts: { body: 'Inter', baseSize: 16, headingSize: 32 },
    logo: {},
    footer: { company: 'Acme', address: '1 Main', city: 'Town', region: 'ST', postal: '00000', phone: '+1 555 111 2222', email: 'hi@acme.com', website: 'https://acme.com' },
  } as any);
  const after = store.getState().data;
  expect(after.global.accentColor).toBe('#ff0000');
  expect(after.global.fontFamily).toBe('Inter');
  expect(after.footer.companyName).toBe('Acme');
  expect(after.footer.address).toBe('1 Main, Town, ST, 00000');
  expect(after.footer.phoneTel).toBe('15551112222');
  expect(after.footer.websites).toEqual(['https://acme.com']);
  // History: undo should fully restore prior data
  store.temporal.getState().undo();
  expect(store.getState().data).toEqual(before);
});
```

- [ ] **Step 3: Run — verify FAIL**

Run: `npx vitest run src/lib/editor/state/actions.test.ts`
Expected: FAIL — `applyBrandKit` not defined.

- [ ] **Step 4: Implement**

```ts
applyBrandKit: (kit: BrandKit) => set((s) => {
  const c = kit.colors ?? {};
  const f = kit.fonts ?? {};
  const fk = kit.footer ?? {};
  const addressParts = [fk.address, fk.city, fk.region, fk.postal].filter(Boolean);
  const phoneTel = (fk.phone ?? '').replace(/\D+/g, '');
  return {
    ...s,
    data: {
      ...s.data,
      global: {
        ...s.data.global,
        backgroundColor: c.background ?? s.data.global.backgroundColor,
        textColor: c.text ?? s.data.global.textColor,
        accentColor: c.brand ?? s.data.global.accentColor,
        buttonColor: c.brand ?? s.data.global.buttonColor,
        buttonTextColor: c.buttonText ?? s.data.global.buttonTextColor,
        footerBackgroundColor: c.footerBg ?? s.data.global.footerBackgroundColor,
        footerTextColor: c.footerText ?? s.data.global.footerTextColor,
        fontFamily: f.body ?? s.data.global.fontFamily,
        baseFontSize: f.baseSize ?? s.data.global.baseFontSize,
        headingFontSize: f.headingSize ?? s.data.global.headingFontSize,
      },
      footer: {
        ...s.data.footer,
        companyName: fk.company ?? s.data.footer.companyName,
        address: addressParts.length ? addressParts.join(', ') : s.data.footer.address,
        phone: fk.phone ?? s.data.footer.phone,
        phoneTel: phoneTel || s.data.footer.phoneTel,
        email: fk.email ?? s.data.footer.email,
        websites: fk.website ? [fk.website] : s.data.footer.websites,
      },
    },
  };
}),
```

Because this is a single `set()` call, zundo produces one history entry.

- [ ] **Step 5: Verify PASS + commit**

```bash
npx vitest run src/lib/editor/state/actions.test.ts
git add src/lib/editor
git commit -m "feat(editor): applyBrandKit maps kit to global + footer in one history step"
```

---

## Task 22: Storage rekey script

**Files:**
- Create: `scripts/rekey-storage.ts`

- [ ] **Step 1: Implement**

```ts
// scripts/rekey-storage.ts
// Usage:
//   tsx scripts/rekey-storage.ts --dry-run
//   tsx scripts/rekey-storage.ts --apply
//
// Copies each project's assets from <user_id>/... to <org_id>/<project_id>/...
// and rewrites project.data.sections[].imagePath (and header/footer banners
// if they reference object paths) accordingly. Copy-only; deletion is manual.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET = process.env.SUPABASE_BUCKET ?? 'project-assets';
const APPLY = process.argv.includes('--apply');

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function rewritePath(p: string, userId: string, orgId: string, projectId: string): string {
  if (!p?.startsWith(`${userId}/`)) return p;
  const rest = p.slice(userId.length + 1);
  return `${orgId}/${projectId}/${rest}`;
}

async function copyObject(src: string, dst: string) {
  if (!APPLY) return console.log(`[dry] copy ${src} -> ${dst}`);
  const { data, error } = await sb.storage.from(BUCKET).copy(src, dst);
  if (error && !/already exists/i.test(error.message)) throw error;
  console.log(`copied ${src} -> ${dst}`);
}

async function main() {
  const { data: projects, error } = await sb.from('projects')
    .select('id, user_id, org_id, data');
  if (error) throw error;
  if (!projects) return;

  for (const p of projects) {
    const manifest: { from: string; to: string }[] = [];
    const data = structuredClone(p.data ?? {});
    const sections = (data?.sections ?? []) as Array<Record<string, unknown>>;
    for (const sec of sections) {
      const ip = sec.imagePath as string | undefined;
      if (ip?.startsWith(`${p.user_id}/`)) {
        const to = rewritePath(ip, p.user_id, p.org_id, p.id);
        manifest.push({ from: ip, to });
        sec.imagePath = to;
      }
    }
    for (const k of ['logoSrc','bannerSrc'] as const) {
      const h = (data?.header ?? {}) as Record<string, unknown>;
      const v = h[k] as string | undefined;
      if (v?.startsWith(`${p.user_id}/`)) {
        const to = rewritePath(v, p.user_id, p.org_id, p.id);
        manifest.push({ from: v, to });
        h[k] = to;
      }
    }
    const f = (data?.footer ?? {}) as Record<string, unknown>;
    const fb = f.bannerSrc as string | undefined;
    if (fb?.startsWith(`${p.user_id}/`)) {
      const to = rewritePath(fb, p.user_id, p.org_id, p.id);
      manifest.push({ from: fb, to });
      f.bannerSrc = to;
    }
    if (!manifest.length) continue;

    console.log(`project ${p.id}: ${manifest.length} object(s) to rekey`);
    for (const { from, to } of manifest) await copyObject(from, to);

    if (APPLY) {
      const { error: uerr } = await sb.from('projects')
        .update({ data }).eq('id', p.id);
      if (uerr) throw uerr;
      console.log(`updated project ${p.id} paths`);
    } else {
      console.log(`[dry] would update project ${p.id} data with new paths`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Dry run**

Run: `tsx scripts/rekey-storage.ts --dry-run`
Expected: log lines like `[dry] copy <user>/abc.png -> <org>/<proj>/abc.png` and `[dry] would update project ...`.

- [ ] **Step 3: Apply**

Run: `tsx scripts/rekey-storage.ts --apply`
Expected: real copies + DB updates. **Do not delete originals yet** — keep them until Storage RLS migration (Task 23) is applied and the editor is verified end-to-end.

- [ ] **Step 4: Commit**

```bash
git add scripts/rekey-storage.ts
git commit -m "feat(storage): rekey script for user→org paths"
```

---

## Task 23: `0007_storage_rls.sql`

**Files:**
- Create: `supabase/migrations/0007_storage_rls.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0007_storage_rls.sql

drop policy if exists "project_assets_insert_own" on storage.objects;
drop policy if exists "project_assets_update_own" on storage.objects;
drop policy if exists "project_assets_delete_own" on storage.objects;

-- Read: any member of the org that owns the folder
create policy "project_assets_select_member" on storage.objects
  for select to authenticated using (
    bucket_id = 'project-assets'
    and public.is_org_member((storage.foldername(name))[1]::uuid, auth.uid(), 'viewer')
  );

-- Write: editor or owner
create policy "project_assets_insert_editor" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'project-assets'
    and public.is_org_member((storage.foldername(name))[1]::uuid, auth.uid(), 'editor')
  );
create policy "project_assets_update_editor" on storage.objects
  for update to authenticated using (
    bucket_id = 'project-assets'
    and public.is_org_member((storage.foldername(name))[1]::uuid, auth.uid(), 'editor')
  );
create policy "project_assets_delete_editor" on storage.objects
  for delete to authenticated using (
    bucket_id = 'project-assets'
    and public.is_org_member((storage.foldername(name))[1]::uuid, auth.uid(), 'editor')
  );
```

- [ ] **Step 2: Apply**

Run: `psql $env:SUPABASE_DB_URL -f supabase/migrations/0007_storage_rls.sql`
Expected: 3 `DROP POLICY` + 4 `CREATE POLICY` lines, no errors.

- [ ] **Step 3: Smoke**

In the running dev app, upload a new image in the editor; verify it lands at `<org_id>/<project_id>/...` and renders. As a viewer, verify uploads are blocked.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0007_storage_rls.sql
git commit -m "feat(storage): RLS gated on org membership"
```

---

## Task 24: `0008_accept_invite.sql`

**Files:**
- Create: `supabase/migrations/0008_accept_invite.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0008_accept_invite.sql
create or replace function public.accept_invite(p_token text)
returns table(org_id uuid, slug text)
language plpgsql
security definer
set search_path = public
as $
declare
  v_inv organization_invites%rowtype;
  v_email text;
  v_slug text;
begin
  select email into v_email from auth.users where id = auth.uid();
  if v_email is null then
    raise exception 'unauthorized';
  end if;

  select * into v_inv from public.organization_invites
   where token = p_token
   limit 1;

  if v_inv.id is null then raise exception 'invite not found'; end if;
  if v_inv.accepted_at is not null then raise exception 'invite already accepted'; end if;
  if v_inv.expires_at < now() then raise exception 'invite expired'; end if;
  if lower(v_inv.email) <> lower(v_email) then raise exception 'invite is for a different email'; end if;

  insert into public.organization_members (org_id, user_id, role)
  values (v_inv.org_id, auth.uid(), v_inv.role)
  on conflict (org_id, user_id) do update set role = excluded.role;

  update public.organization_invites set accepted_at = now() where id = v_inv.id;

  select slug into v_slug from public.organizations where id = v_inv.org_id;
  return query select v_inv.org_id, v_slug;
end;
$;
```

- [ ] **Step 2: Apply**

Run: `psql $env:SUPABASE_DB_URL -f supabase/migrations/0008_accept_invite.sql`
Expected: `CREATE FUNCTION`.

- [ ] **Step 3: Build the accept-invite page**

```tsx
// src/app/invite/[token]/page.tsx
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';

export default async function AcceptInvitePage({
  params,
}: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sb = await createServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  const { data, error } = await sb.rpc('accept_invite', { p_token: token });
  if (error) {
    return (
      <div className="p-10 max-w-md mx-auto">
        <h1 className="text-lg font-semibold text-fg mb-2">Couldn’t accept invite</h1>
        <p className="text-sm text-muted">{error.message}</p>
      </div>
    );
  }
  const slug = (data as { slug: string }[] | null)?.[0]?.slug;
  redirect(slug ? `/w/${slug}` : '/');
}
```

- [ ] **Step 4: Manual smoke**

Send an invite from the Members UI, accept it as another logged-in user, confirm the redirect lands on the new workspace.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0008_accept_invite.sql src/app/invite
git commit -m "feat(invites): accept_invite RPC + landing page"
```

---

## Task 25: Self-review

- [ ] **Step 1: Spec coverage scan**

Open `docs/superpowers/specs/2026-05-11-workspaces-brand-kits-design.md` and tick every section against the task list:
- §1 Data Model → Tasks 1, 3
- §2 Migration & Backfill → Task 1
- §3 RLS + `is_org_member()` → Task 3
- §4 Routing/Auth/API → Tasks 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14
- §5 UI Surfaces → Tasks 15, 16, 17, 18, 19
- §6 Storage & Rekey → Tasks 22, 23
- §7 Invites → Tasks 13, 24
- §9 Rollout Checklist → covered in apply-and-verify steps within each task

- [ ] **Step 2: Placeholder scan**

Grep your changes:

```bash
git grep -nE "TODO|TBD|fixme|@ts-ignore" -- src supabase scripts
```

Fix anything in your new code (`@ts-expect-error` on the embed shape in Task 6 step 1 is OK with an explanatory comment).

- [ ] **Step 3: Type-check + tests**

```bash
npx tsc --noEmit
npx vitest run
```

Expected: both pass.

- [ ] **Step 4: Final smoke**

Run `npm run dev`. As owner: create a second workspace, invite an editor and a viewer, create a brand kit, apply it to a project, upload an image, undo Apply, sign in as the viewer in another browser → confirm read-only.

- [ ] **Step 5: Final commit (if anything was touched)**

```bash
git add -A
git commit -m "chore: workspaces + brand kits cleanup after self-review"
```

---

## Done

Plan complete and saved to `docs/superpowers/plans/2026-05-11-workspaces-brand-kits.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration
**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
