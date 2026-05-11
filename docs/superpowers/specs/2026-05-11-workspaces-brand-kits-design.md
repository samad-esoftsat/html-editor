# Workspaces and Brand Kits — Design Spec

Date: 2026-05-11
Status: Approved (design); some migrations applied, others designed-only.
Source: Tier 1 of `docs/ROADMAP-SAAS.md`.

## 0. Goal

Convert the single-user editor into a multi-tenant SaaS by introducing **organizations** (workspaces) with role-based membership, scoping all data and storage to `org_id` via RLS, and adding **brand kits** as reusable per-workspace presets (colors, fonts, logo, footer NAP) that can be applied to projects.

Roles: `owner` / `editor` / `viewer`.

Non-goals (Tier 1):
- Billing, plans, seat limits.
- Per-resource ACLs (only org-level membership).
- SSO / SAML.
- Multi-org single email auto-merge.

## 1. Data Model

Five new/changed tables in `public` schema.

### organizations
| col | type | notes |
|---|---|---|
| `id` | uuid pk | `default gen_random_uuid()` |
| `slug` | citext unique | URL key; auto-generated `ws-<8-hex>` |
| `name` | text | display name |
| `created_by` | uuid | references `auth.users` |
| `created_at` | timestamptz | default now() |

### organization_members
| col | type | notes |
|---|---|---|
| `org_id` | uuid | fk → organizations, cascade |
| `user_id` | uuid | fk → auth.users, cascade |
| `role` | text | check in (`owner`,`editor`,`viewer`) |
| `created_at` | timestamptz | default now() |
| PK | (`org_id`,`user_id`) | |

### organization_invites
| col | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `org_id` | uuid | fk |
| `email` | citext | invited address |
| `role` | text | target role |
| `token` | text unique | url-safe random, 32+ bytes |
| `invited_by` | uuid | fk → auth.users |
| `created_at` | timestamptz | |
| `expires_at` | timestamptz | created + 7 days |
| `accepted_at` | timestamptz | null until accepted |

### brand_kits
| col | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `org_id` | uuid | fk |
| `name` | text | |
| `is_default` | boolean | default false |
| `colors` | jsonb | `{ brand, accent, bg, fg, ... }` matches `GlobalStyles` shape |
| `fonts` | jsonb | `{ heading, body }` |
| `logo_path` | text | storage key under `project-assets` bucket |
| `footer` | jsonb | NAP fields: `{ company, address, city, region, postal, phone, email, website }` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| Partial unique | `(org_id) where is_default` | enforces ≤1 default per org |

### projects (additive change)
- Add `org_id uuid not null` (fk → organizations).
- Add `brand_kit_id uuid null` (fk → brand_kits, on delete set null).
- Drop legacy `user_id`-scoped policies (handled in §3).

Indexes: `(org_id, updated_at desc)` on projects; `(org_id)` on brand_kits and organization_members; `(token)` already unique on invites.

## 2. Migration & Backfill

Migration file: `supabase/migrations/0004_workspaces.sql` — **applied**.

Steps:
1. Create the four new tables and indexes.
2. Add `org_id` (nullable initially) and `brand_kit_id` to `projects`.
3. Backfill: for every distinct `projects.user_id`, create one organization (`ws-<8hex>`, name from email local-part + " workspace"), insert `(org_id, user_id, 'owner')` into members, then update all that user's projects with the new `org_id`.
4. For any auth user with zero projects, also create a personal workspace + owner row so they have somewhere to land after login.
5. `alter table projects alter column org_id set not null`.

Idempotency: guarded by `not exists` checks on each insert so the migration can re-run safely.

## 3. RLS

Migration file: `supabase/migrations/0006_rls.sql` — **applied**.

### Helper function
```sql
create or replace function public.is_org_member(p_org uuid, p_user uuid, p_min_role text default 'viewer')
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organization_members m
    where m.org_id = p_org and m.user_id = p_user
      and case p_min_role
            when 'viewer' then m.role in ('viewer','editor','owner')
            when 'editor' then m.role in ('editor','owner')
            when 'owner'  then m.role = 'owner'
          end
  );
$$;
```

### Role → capability matrix
| Action | viewer | editor | owner |
|---|---|---|---|
| Read org / projects / brand kits | ✓ | ✓ | ✓ |
| Create/update/delete projects | – | ✓ | ✓ |
| Create/update brand kits | – | ✓ | ✓ |
| Delete brand kits | – | – | ✓ |
| Invite / remove members, change roles | – | – | ✓ |
| Rename / delete org | – | – | ✓ |

### Policies (summary)
- **organizations**: select if `is_org_member(id, auth.uid())`; update/delete if `is_org_member(id, auth.uid(), 'owner')`.
- **organization_members**: select if `is_org_member(org_id, auth.uid())`; insert/update/delete only by owner. Accepting an invite goes through `accept_invite()` security-definer fn (see §7), bypassing the owner-only write rule.
- **organization_invites**: select/insert/update/delete restricted to owners.
- **brand_kits**: select for any member; insert/update for editor+; delete for owner.
- **projects**: drop the old `auth.uid() = user_id` policies. Replace with `is_org_member(org_id, auth.uid())` for select; `is_org_member(org_id, auth.uid(), 'editor')` for insert/update/delete.

## 4. Routing, Auth, API

### 4.1 URL shape
- `/w/[slug]` — workspace dashboard (project list scoped to org).
- `/w/[slug]/p/[id]` — editor.
- `/w/[slug]/settings/general` — rename org, change slug.
- `/w/[slug]/settings/members` — invites + role management.
- `/w/[slug]/settings/brand-kits` — brand kit list/editor.
- `/invite/[token]` — public-ish accept-invite page (still requires sign-in).
- `/` — redirect to `/w/<last-used-slug>` (cookie `last_ws`) or first membership.

### 4.2 Middleware: `src/middleware.ts`
- Run on all paths except `_next`, `/api/auth/*`, static assets.
- If unauthenticated and path requires auth → redirect to `/login?next=...`.
- On `/w/[slug]/...`: verify membership via a cheap RLS-backed query; 404 if not a member.
- Write `last_ws` cookie (slug) on every successful workspace request.
- On `/` after sign-in: redirect to `/w/<last_ws>` if the cookie's slug is still a valid membership, else the user's first membership ordered by `organization_members.created_at asc`.

### 4.3 Server helper: `src/lib/auth/workspace.ts`
```ts
type WorkspaceContext = { org: { id: string; slug: string; name: string }; role: 'owner'|'editor'|'viewer'; userId: string };
export async function requireWorkspace(slug: string): Promise<WorkspaceContext>;
export async function requireWorkspaceRole(slug: string, min: 'viewer'|'editor'|'owner'): Promise<WorkspaceContext>;
```
Single source of truth for slug → org resolution and role check. Throws (or returns 404/403) when missing.

### 4.4 API routes (additive)
| Method | Path | Min role |
|---|---|---|
| POST | `/api/workspaces` | (signed-in) — create new org, creator becomes owner |
| GET | `/api/workspaces/[slug]/members` | viewer |
| POST | `/api/workspaces/[slug]/invites` | owner |
| DELETE | `/api/workspaces/[slug]/invites/[id]` | owner |
| PATCH | `/api/workspaces/[slug]/members/[userId]` | owner — change role |
| DELETE | `/api/workspaces/[slug]/members/[userId]` | owner |
| GET/POST | `/api/workspaces/[slug]/brand-kits` | editor for write |
| PATCH/DELETE | `/api/workspaces/[slug]/brand-kits/[id]` | editor (delete=owner) |
| POST | `/api/invites/[token]/accept` | (signed-in) — calls `accept_invite()` |

Existing `/api/projects/*` endpoints get a workspace check: project must belong to the caller's accessible org.

### 4.5 Existing routes
- `src/app/page.tsx` (dashboard) becomes `/w/[slug]/page.tsx`.
- `Topbar.tsx` (`src/components/editor/Topbar.tsx:49-54`) — "Projects" link href becomes `/w/${slug}` instead of `/`.
- Project create flow passes the current workspace slug.

### 4.6 Signup trigger
Migration `supabase/migrations/0005_signup_trigger.sql` — **designed**, not applied.
On new `auth.users` insert, auto-create a personal workspace (slug `ws-<8hex>`, name `<email-local-part> workspace`) and add the user as owner. Mirrors the backfill logic in §2.

## 5. UI Surfaces

### 5.1 New components
```
src/components/workspace/
  WorkspaceSwitcher.tsx       — dropdown in topbar; lists user's orgs + "Create workspace"
  CreateWorkspaceDialog.tsx   — mirrors NewProjectDialog.tsx pattern (modal w/ fade+scaleFade)
  InviteDialog.tsx            — email + role select
  MembersTable.tsx            — list, change role (owner only), remove
  BrandKitCard.tsx            — grid card with preview swatches + default badge
  BrandKitEditor.tsx          — side sheet with tabs: Identity / Colors / Fonts / Logo / Footer NAP
  BrandKitPicker.tsx          — combo used in GlobalStylesPanel + NewProjectDialog
```

### 5.2 Workspace switcher placement
Topbar gains a switcher to the left of the project name (between "Projects" link and the divider). Dropdown shows current org, list of memberships, "Create workspace…", and a link to "Workspace settings".

### 5.3 Brand kit picker integration
- Added to `GlobalStylesPanel` (left panel) as a row at the top of the panel with `[Brand kit ▾] [Apply] [Detach]`.
- **Apply**: copies the kit's `colors`, `fonts`, `footer` into the live `data.globalStyles` + `data.footer` as a **single zundo history entry** so it's one undo step.
- **Detach**: clears `projects.brand_kit_id` but leaves the doc values intact.
- **setProjectBrandKit(kitId)** action: persists to the `projects.brand_kit_id` column (not to the JSON doc) so swapping the kit doesn't dirty the document.

### 5.4 NewProjectDialog changes
Add a brand-kit row above the template grid: "Start from brand kit" + picker. When org has zero kits, show hint text "Create a brand kit in Settings to reuse colors and footer across projects." Default = none selected.

### 5.5 Settings pages
- **General**: rename org (owner), change slug (owner, with availability check).
- **Members**: table + invite button + pending invites list with copy-link + revoke.
- **Brand kits**: grid of cards + "New kit" button; clicking opens editor sheet.

## 6. Storage & Rekey

### 6.1 Path scheme
- Old: `<user_id>/<project_id>/<file>` in `project-assets` bucket.
- New: `<org_id>/<project_id>/<file>` in same bucket.
- Brand kit logos: same bucket, `<org_id>/brand-kits/<kit_id>/<file>`.

### 6.2 Rekey script: `scripts/rekey-storage.ts`
One-shot Node script with `--dry-run` and `--apply` modes.
1. Build user→org and project→org maps from DB.
2. For each project, list objects under the old `<user_id>/<project_id>/` prefix.
3. **Copy** (not move) each object to `<org_id>/<project_id>/<file>` — keeps old keys reachable during the cutover.
4. Rewrite each project's `data.sections[].imagePath` (and any other path refs) from the old prefix to the new one in the same transaction.
5. Log a manifest (old → new) per project for audit.

Two-phase rollout chosen to avoid a race where Storage RLS is swapped before all copies finish.

### 6.3 Old key cleanup
Manual, after a verification window. Not part of the auto rekey script.

### 6.4 Storage RLS
Migration `supabase/migrations/0007_storage_rls.sql` — **designed**, not applied.
Drops the old `*-own` policies on `storage.objects` and creates new ones gated on:
```sql
public.is_org_member((storage.foldername(name))[1]::uuid, auth.uid(), <role>)
```
- Select for any member.
- Insert / update / delete for editor+.

### 6.5 Migration ordering (applied vs designed)
| Order | File | State |
|---|---|---|
| 1 | 0004_workspaces.sql | applied |
| 2 | 0006_rls.sql | applied |
| 3 | 0005_signup_trigger.sql | designed |
| 4 | rekey-storage.ts (copy phase) | designed |
| 5 | 0007_storage_rls.sql | designed |
| 6 | 0008_accept_invite.sql | designed |
| 7 | rekey-storage.ts (delete phase) | manual, post-soak |

Step 5 (Storage RLS swap) **must** run after step 4 (copies present at new keys), otherwise live editors lose image access.

## 7. Invites Flow

### 7.1 Sending
Owner opens `InviteDialog`, enters email + role. Server route:
1. Validates role and that caller is owner of `[slug]`.
2. Generates 32-byte URL-safe token.
3. Inserts row in `organization_invites` with `expires_at = now() + interval '7 days'`.
4. Sends the invite email via **Supabase only** — no third-party email provider. The server route uses the Supabase service-role client to call `auth.admin.inviteUserByEmail(email, { redirectTo: '<app>/invite/<token>' })`, which delivers through Supabase's configured SMTP using the "Invite user" email template. The accept URL with our `token` is preserved as the redirect target, so the existing `accept_invite()` flow (§7.4) still validates the token. If the Supabase send fails, the API still returns the accept URL in the response so the owner can copy/share the link manually (no silent failure). Configuring SMTP credentials in the Supabase project is a deployment prerequisite.

### 7.2 Accept page: `/invite/[token]`
- If unauthenticated, push to `/login?next=/invite/<token>`.
- If authenticated, show org name + role + invited-by; "Accept" button calls `/api/invites/[token]/accept`.

### 7.3 Email matching
**Strict**: the accepting user's auth email must match (case-insensitive) the invite's email. Mismatch → friendly error with "Sign in with the invited address" link.

### 7.4 `accept_invite()` function
Migration `supabase/migrations/0008_accept_invite.sql` — **designed**.
`security definer` so non-owners can write `organization_members` only via this controlled path. Validates token unused, non-expired, and email matches; upserts membership; marks invite accepted.

### 7.5 Revocation & expiry
- Owners can delete pending invites from the members settings page.
- Expired invites are filtered out of the accept flow (the function refuses them) and listed as "Expired" in settings; no auto-cleanup job in Tier 1.

## 8. Open Items / Out of Scope

- Org rename across the URL: changing the slug breaks bookmarks; we accept this for Tier 1 and could add slug-history redirects later.
- Per-user "last visited project" memory is not migrated.
- Multi-org per email auto-merge during signup is deferred — first signup with that email gets the personal workspace; later invites attach as additional memberships.
- Audit log of role changes / invite events: deferred to Tier 2.

## 9. Rollout Checklist

1. ☑ Apply `0004_workspaces.sql` (schema + backfill).
2. ☑ Apply `0006_rls.sql`.
3. ☐ Apply `0005_signup_trigger.sql`.
4. ☐ Ship code changes (middleware, helpers, API, UI) behind a deploy.
5. ☐ Run `rekey-storage.ts --apply` (copy phase).
6. ☐ Apply `0007_storage_rls.sql`.
7. ☐ Apply `0008_accept_invite.sql`.
8. ☐ Verify a member can read images, owner can invite, editor can save.
9. ☐ Soak for one week, then manually delete legacy `<user_id>/...` keys.
