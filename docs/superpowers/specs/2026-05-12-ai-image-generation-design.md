# AI Image Generation - Design Spec

**Date:** 2026-05-12
**Status:** Approved (brainstorm) - pending implementation plan
**Owner:** Jean-Louis Garcia (GlobalTT/Esoftsat)
**Depends on:** workspaces + brand kits (shipped on `main`, 0004-0011 migrations)

---

## 1. Goal

Add AI-powered image generation and editing to the email editor so users can produce on-brand imagery (banners, product shots, logos) without leaving the tool. This is the Tier-2 "AI image gen / stock search built in" feature from `docs/ROADMAP-SAAS.md`.

**Success criteria:**

- An Editor in a workspace can type a prompt and have a generated image inserted into a header, footer, product section, or global-styles logo slot within about 30 seconds.
- All generated and uploaded images live in a per-workspace library and can be reused across projects in that workspace.
- Adding a second provider (`gpt-image-2`) later requires a new class and an env-var change - no schema or UI changes.
- A retry after a slow or failed generation does not create duplicate assets or double-consume quota for the same logical request.

**Out of scope for v1:**

- AI-generated full templates (deferred; will get its own spec).
- Stock image search (Unsplash, etc.).
- Image-to-image style transfer beyond what the chosen model offers natively.
- Per-prompt cost reporting or per-user (within workspace) quotas.
- Asynchronous job queue for generation.
- Asset reference migration from raw image URLs to `asset_id` foreign keys.

---

## 2. Architecture

```text
+- Browser ----------------------------------------------+
| AssetPicker modal                                      |
|   |- Library tab (existing assets)                     |
|   |- Upload tab                                        |
|   `- Generate tab (prompt + opts)                      |
+-------------------+-------------------------------------+
                    | POST /api/images/generate
                    | POST /api/images/edit
                    | POST /api/workspace-assets/upload
                    v
+- Next.js server route ---------------------------------+
| 1. requireWorkspace(slug, "editor")                    |
| 2. ensure request_key is unique for the workspace      |
| 3. consume_image_quota(org_id, cap)                    |
| 4. provider = getImageProvider()                       |
| 5. result = provider.generate/edit(...)                |
| 6. upload to Storage: <org_id>/assets/<uuid>.<ext>     |
| 7. INSERT assets row                                   |
| 8. mark request complete and return asset payload      |
+-------------------+-------------------------------------+
                    |
                    v
+- ImageProvider (interface) ----------------------------+
|  - GeminiImageProvider (v1)                            |
|  - GptImage2Provider (v2 stub)                         |
+--------------------------------------------------------+
```

**Approach: Minimal provider abstraction.** A single `ImageProvider` interface, one concrete implementation per provider, selected by `IMAGE_PROVIDER` env var. No per-workspace provider configuration, no capability negotiation. Reasoning: both candidate providers support the same v1 operations, and YAGNI applies until a real divergence forces it.

**Key boundaries:**

- Provider API keys live only in server env. Browser never calls a provider directly.
- Quota check, provider call, Storage upload, and DB insert all happen in the same server request. A 200 response always means "image is saved and counted."
- Provider selection is a single env var; swapping providers is a deploy.
- Long-running provider calls are not wrapped in a DB transaction. Quota is consumed first, and downstream failures are handled by compensating cleanup.
- Every mutating image request carries a client-generated `requestKey` so retries are idempotent within a workspace.

---

## 3. Data model

### 3.1 New table: `assets`

```sql
create table assets (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations(id) on delete cascade,
  created_by        uuid not null references auth.users(id),
  storage_path      text not null unique,
  mime_type         text not null,
  width             int,
  height            int,
  source            text not null check (source in ('upload','generate','edit')),
  prompt            text,
  provider          text,
  alt_text          text,
  original_filename text,
  archived_at       timestamptz,
  created_at        timestamptz not null default now()
);
create index on assets (org_id, created_at desc);
create index on assets (org_id, archived_at, created_at desc);
```

`storage_path` always matches `<org_id>/assets/<uuid>.<ext>`. `prompt` and `provider` are null for uploads. `source = 'edit'` covers both inpainting and background removal (background removal is implemented as an edit with a fixed prompt).

`original_filename` preserves the user-facing upload name for hover labels and search. Generated and edited images may leave `original_filename` null.

`archived_at` soft-hides an asset from the default library grid without breaking existing project URLs. **v1 does not support hard delete from the UI.** This is a locked decision because projects still store raw public URLs rather than `asset_id` references, so hard deletion would silently break existing content.

**RLS:**

- `select`: `is_org_member(org_id, auth.uid(), 'viewer')`
- `insert`/`update`: `is_org_member(org_id, auth.uid(), 'editor')`
- no user-facing `delete` policy is required for v1 because assets are archived, not deleted

Mirrors the policy pattern used by `projects` (`0006_rls.sql`) with the delete policy intentionally omitted.

### 3.2 New table: `image_generation_usage`

```sql
create table image_generation_usage (
  org_id  uuid not null references organizations(id) on delete cascade,
  period  date not null,
  count   int not null default 0,
  primary key (org_id, period)
);
```

`period` is the first day of the month, UTC. One row per workspace per month, written lazily on first generation of the month.

### 3.3 New table: `image_generation_requests`

```sql
create table image_generation_requests (
  org_id          uuid not null references organizations(id) on delete cascade,
  request_key     text not null,
  created_by      uuid not null references auth.users(id),
  kind            text not null check (kind in ('generate','edit','remove_bg')),
  status          text not null check (status in ('processing','completed','failed')),
  asset_id        uuid references assets(id) on delete set null,
  error_code      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (org_id, request_key)
);
create index on image_generation_requests (org_id, created_at desc);
```

This table makes retries idempotent:

- a new request inserts `processing`
- a completed request returns the existing asset instead of regenerating
- a failed request may be retried by reusing the same `requestKey`, which transitions the row back through the normal flow

The table is operational state, not user-facing history. Old rows can be cleaned up later by a maintenance job if needed.

### 3.4 New RPC: `consume_image_quota`

```sql
create or replace function consume_image_quota(p_org_id uuid, p_limit int)
returns table(ok boolean, remaining int, period date)
language plpgsql security definer
as $$
declare
  v_period date := date_trunc('month', now() at time zone 'utc')::date;
  v_count  int;
begin
  insert into image_generation_usage (org_id, period, count)
       values (p_org_id, v_period, 0)
  on conflict (org_id, period) do nothing;

  select count into v_count
    from image_generation_usage
   where org_id = p_org_id and period = v_period
   for update;

  if v_count >= p_limit then
    return query select false, 0, v_period;
    return;
  end if;

  update image_generation_usage
     set count = count + 1
   where org_id = p_org_id and period = v_period;

  return query select true, p_limit - (v_count + 1), v_period;
end;
$$;
```

Atomic via `for update`. Caller passes the per-workspace cap so the function stays generic.

### 3.5 New RPC: `refund_image_quota`

```sql
create or replace function refund_image_quota(p_org_id uuid)
returns void
language plpgsql security definer
as $$
declare
  v_period date := date_trunc('month', now() at time zone 'utc')::date;
begin
  update image_generation_usage
     set count = greatest(count - 1, 0)
   where org_id = p_org_id and period = v_period;
end;
$$;
```

This is the compensating action used after quota was consumed but the provider call, Storage upload, or `assets` insert failed. There is **no wrapping request transaction** around the entire provider flow.

### 3.6 New column: `organizations.image_quota_monthly`

```sql
alter table organizations
  add column image_quota_monthly int not null default 100;
```

Owner-editable later via workspace settings UI (out of scope for v1; default value sufficient).

### 3.7 Storage layout

Reuses the existing project upload bucket. Path: `<org_id>/assets/<uuid>.<ext>`. Storage RLS from `0007_storage_rls.sql` already authorizes by top-level `<org_id>` folder rather than by subfolder name, so `assets/` fits the current policy shape and does not require a regex change.

### 3.8 `projects` table

No schema change. Image fields continue to store public Storage URLs. Because of that, v1 uses archive instead of hard delete in the asset library.

### 3.9 Migration file

Single new file: `supabase/migrations/0012_assets.sql` containing:

- `assets`
- `image_generation_usage`
- `image_generation_requests`
- `consume_image_quota`
- `refund_image_quota`
- `organizations.image_quota_monthly`
- RLS policies for `assets`

---

## 4. UX flow

### 4.1 AssetPicker modal

One new component replaces the scattered "image URL" text inputs in `HeaderPanel`, `FooterPanel`, `ProductSectionPanel`, and `GlobalStylesPanel` (logo).

```text
+- AssetPicker ------------------------------------------+
| [Library] [Upload] [Generate]                          |
+--------------------------------------------------------+
| Library tab:                                           |
|   Grid of thumbnails, newest first.                    |
|   Hover: display name, source, "Use" / "Archive".      |
|   Search by alt text, prompt, or original filename.    |
|                                                        |
| Upload tab:                                            |
|   Drop zone, writes to assets table                    |
|   at <org_id>/assets/<uuid>.<ext>.                     |
|                                                        |
| Generate tab:                                          |
|   [textarea: prompt]                                   |
|   [select: aspect ratio - 1:1, 16:9, 9:16, 4:3]        |
|   [select: # of variants - 1, 2, 4]                    |
|   [Generate] button                                    |
|   Below: spinner -> 1-4 result thumbnails.             |
|   Click thumbnail -> "Use" inserts into field          |
|   and persists to library.                             |
|                                                        |
| Footer:                                                |
|   "Quota: 47/100 this month" (Editor+ only)            |
+--------------------------------------------------------+
```

### 4.2 Library tab rules

- Default filter shows only `archived_at is null`.
- Archived assets are omitted from the normal picker grid but remain accessible to existing project URLs.
- The UI action is labeled **Archive**, not Delete.
- A later restore/archive-management UI is optional and out of scope for v1.

### 4.3 Edit / inpaint flow

Entered from the Library tab via "Edit" on a thumbnail.

- Canvas shows the source image. User paints a mask with a brush tool (transparent = "regenerate this area").
- Prompt textarea + "Regenerate masked area" button.
- Result is always saved as a **new asset** in v1. Replace-in-place is removed from the design to avoid ambiguity while projects still store raw URLs.

### 4.4 Background removal

One-click action in the Library tab thumbnail menu. No prompt. Internally sends an edit request with a fixed prompt (`"remove the background, output transparent PNG"`) and a full-image mask. Result is always saved as a new asset with `source = 'edit'`.

### 4.5 Role gating in UI

- **Viewer:** Library tab only. Upload, Generate, and Edit actions render disabled with a tooltip explaining role requirement.
- **Editor / Owner:** All tabs available.

### 4.6 Loading, timeout, and retry states

- Generate button disabled while a request is in flight.
- Spinner shows elapsed seconds (Gemini image responses can take 10-20 s).
- The client creates one `requestKey` per click and reuses it for retries of the same logical request.
- The client-side timeout is **45 seconds**, not 30. This keeps the UX target ("about 30 s") while leaving enough headroom for slow but successful responses.
- On client timeout, the UI does **not** create a new request key automatically. Instead it shows: `"Still processing. Check status or retry safely."`
- A retry with the same `requestKey` must either:
  - return the completed asset if the original request finished
  - report `"still_processing"` if the original request is still running
  - restart the request only if the prior attempt is marked failed

Errors render inline above the button:

- `"Quota exhausted (100/100). Resets on <date>."` (429)
- `"Provider unavailable, try again."` (502)
- `"You don't have permission to generate images."` (403; should not happen if UI gating works)
- `"Request still processing. Please wait."` (409)

### 4.7 Code touch points

- **New files:**
  - `src/components/editor/AssetPicker.tsx`
  - `src/components/editor/AssetPickerButton.tsx`
  - `src/components/editor/MaskCanvas.tsx`
- **Modified files:** every panel with an image-URL input swaps the input for `<AssetPickerButton field="..." />`. Affected: `HeaderPanel`, `FooterPanel`, `ProductSectionPanel`, `GlobalStylesPanel`.
- **Uploads:** v1 adds a new workspace-scoped route instead of overloading the current project-scoped one:
  - new route: `src/app/api/workspace-assets/upload/route.ts`
  - existing `src/app/api/upload/route.ts` remains project-oriented for legacy callers

---

## 5. Provider integration

### 5.1 Interface

`src/lib/images/provider.ts`:

```ts
export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3';

export type GenerateOpts = {
  prompt: string;
  aspectRatio: AspectRatio;
  count: 1 | 2 | 4;
};

export type EditOpts = {
  image: Buffer;
  mask: Buffer; // PNG; transparent pixels = region to edit
  prompt: string;
};

export type GeneratedImage = {
  bytes: Buffer;
  mimeType: string; // 'image/png'
  width: number;
  height: number;
};

export interface ImageProvider {
  name: 'gemini-image' | 'gpt-image-2';
  generate(opts: GenerateOpts): Promise<GeneratedImage[]>;
  edit(opts: EditOpts): Promise<GeneratedImage>;
}
```

Background removal is not a separate method; it is a wrapper around `edit()` with a fixed prompt and a full-image mask. This keeps the interface minimal.

Providers return bytes, not URLs. The route handler owns Storage upload, so provider implementations stay uniform.

### 5.2 Provider selection

`src/lib/images/index.ts`:

```ts
export function getImageProvider(): ImageProvider {
  const name = process.env.IMAGE_PROVIDER ?? 'gemini-image';
  switch (name) {
    case 'gemini-image':
      return new GeminiImageProvider();
    case 'gpt-image-2':
      return new GptImage2Provider();
    case 'mock':
      return new MockImageProvider();
    default:
      throw new Error(`Unknown IMAGE_PROVIDER: ${name}`);
  }
}
```

### 5.3 Gemini implementation

`src/lib/images/gemini.ts`:

- Model: `gemini-3.1-flash-image-preview` (env-overridable as `GEMINI_IMAGE_MODEL` so we can pin or upgrade without code change).
- Auth: single `GEMINI_API_KEY` env var.
- SDK: `@google/genai` or direct REST `fetch` to `https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent`. Decision deferred to implementation, but the choice must not leak into the `ImageProvider` interface.
- `generate()` maps `count` to multiple variants and `aspectRatio` to the model's aspect-ratio parameter.
- `edit()` sends the source image and mask as additional `inlineData` parts. Background removal calls `edit()` with the fixed prompt described in Section 4.4.
- Output: PNG with SynthID watermark (Google embeds this automatically; acceptable for marketing emails).

**Known risks for the implementation plan to address:**

- `gemini-3.1-flash-image-preview` is in preview; Google may rename or change behavior. The provider abstraction absorbs this - only the model string changes.
- Exact request shape (especially for mask-based editing) must be verified against current Google docs at implementation time, since preview-model APIs evolve.

### 5.4 `gpt-image-2` stub

`src/lib/images/gpt-image-2.ts`: a stub class whose methods throw `Error('Not implemented')`. The file includes a short comment block listing what the next implementer needs to fill in (endpoint, env var, parameter mapping). v1 ships with this stub so the switch is visible in code.

### 5.5 Server routes

All under `src/app/api/images/`. Two routes - background removal is a parameter on `/edit`, not its own route.

- **`POST /api/images/generate`**
  Body: `{ prompt, aspectRatio, count, workspaceSlug, requestKey }`.
  Returns: `[{ assetId, url, width, height }]`.

- **`POST /api/images/edit`**
  Multipart form: `image` (file), `mask` (file), `prompt` (text), `workspaceSlug` (text), `requestKey` (text), `mode` (`'inpaint' | 'remove_bg'`).
  Returns: `{ assetId, url, width, height }`.
  When `mode = 'remove_bg'`, the server overrides `prompt` and `mask` per Section 4.4.

- **`POST /api/workspace-assets/upload`**
  Multipart form: `file` (file), `workspaceSlug` (text), optional `altText` (text).
  Returns: `{ assetId, url, width, height, originalFilename }`.

The current `src/app/api/upload/route.ts` remains unchanged for legacy project-scoped uploads. The AssetPicker uses the new workspace-scoped route only.

Each generate/edit handler runs the identical pipeline:

1. `requireWorkspace(slug, 'editor')` - 403 on failure.
2. Validate `requestKey`.
3. Attempt to insert `image_generation_requests(org_id, request_key, ..., status='processing')`.
4. If the row already exists:
   - `completed` -> return the previously created asset payload with 200
   - `processing` -> return 409 with `{ error: 'still_processing' }`
   - `failed` -> update status back to `processing` and continue
5. Look up `organizations.image_quota_monthly` for the workspace.
6. Call `consume_image_quota`. If `ok = false`, mark request `failed` and return 429 with `{ error: 'quota_exhausted', resetsOn }`.
7. Call provider. On failure, call `refund_image_quota`, mark request `failed`, and return 502 or 400 depending on provider error class.
8. Upload bytes to Storage. On failure, call `refund_image_quota`, mark request `failed`, and return 500.
9. Insert `assets` row. On failure, delete the Storage object, call `refund_image_quota`, mark request `failed`, and return 500.
10. Update `image_generation_requests` to `completed` with `asset_id`.
11. Return JSON.

The provider call is intentionally not wrapped in a Postgres transaction - that would hold a DB connection open for the 10-20 s the provider takes. Quota consumption is its own atomic RPC up front, and any downstream failure issues a compensating decrement via `refund_image_quota`.

### 5.6 Env vars

Additions to `.env.example`:

```dotenv
IMAGE_PROVIDER=gemini-image
GEMINI_API_KEY=
GEMINI_IMAGE_MODEL=gemini-3.1-flash-image-preview
# Later, for swap:
# OPENAI_API_KEY=
```

---

## 6. Error handling

| Failure | HTTP | Quota consumed? | Client behavior |
|---|---:|---|---|
| Not signed in | 401 | no | Redirect to login (middleware handles this) |
| Wrong role | 403 | no | Inline error; UI should already have gated the action |
| Duplicate in-flight request key | 409 | no new consume | Inline error; keep waiting or poll with same key |
| Quota exhausted | 429 | no | Inline error with reset date; Generate button stays disabled |
| Provider 4xx (bad prompt, etc.) | 400 | no (refunded) | Inline error with provider message |
| Provider 5xx / network | 502 | no (refunded) | Inline error; user can retry with same key |
| Storage upload fails | 500 | no (refunded) | Inline error; user can retry with same key |
| Client timeout (45 s, no server response) | - | unknown to client, tracked by request row | UI keeps same `requestKey` and retries safely |

**Rollback mechanism:** quota consumption is a single atomic RPC (`consume_image_quota`) committed up front. After that, the provider call, Storage upload, and `assets` insert run sequentially without a wrapping DB transaction. Any failure after the quota is consumed issues a compensating decrement via `refund_image_quota`, and any partial Storage upload is cleaned up by the route before returning the error.

**Compensating decrement** is implemented as `refund_image_quota(p_org_id uuid)` and floors at 0. A worst-case crash between a successful provider result and the refund may leave the counter slightly over-consumed; the idempotency row still prevents duplicate asset creation on retry.

---

## 7. Testing

### 7.1 Unit tests (`tests/unit/`)

- **`images/provider.test.ts`** - Mock HTTP layer. Verify `GeminiImageProvider` builds correct request bodies for `generate` (aspect ratio mapping, variant count) and `edit` (image + mask in `inlineData` parts). Verify response parsing into `GeneratedImage[]`. Verify provider errors surface as typed errors.
- **`images/quota.test.ts`** - Real Supabase test instance (same pattern as `workspace.test.ts`). Verify `consume_image_quota` increments atomically, returns `{ ok: false }` at limit, creates row lazily on first call of the month, and that `refund_image_quota` decrements without going below 0.
- **`images/request-idempotency.test.ts`** - Verify duplicate `requestKey` handling:
  - second request returns the original asset after completion
  - concurrent second request returns `still_processing`
  - failed request can be retried with the same key
- **`images/route-guards.test.ts`** - Verify `/api/images/generate` returns 403 for Viewer, 429 when over quota, and 502 when provider throws. After a 502 case, read the DB and confirm the quota counter is unchanged.

### 7.2 Integration tests

- **`tests/integration/image-generation.test.ts`** - Signed-in Editor posts to `/api/images/generate` with `IMAGE_PROVIDER=mock` returning fixture PNG bytes. Asserts:
  - Storage object exists at `<org_id>/assets/<uuid>.png`
  - `assets` row has correct `org_id`, `source = 'generate'`, prompt stored
  - quota counter incremented by exactly one
  - request row marked `completed`
- **`tests/integration/workspace-asset-upload.test.ts`** - Signed-in Editor posts to `/api/workspace-assets/upload`. Asserts:
  - upload does not require `projectId`
  - `assets.original_filename` is populated
  - uploaded asset appears in workspace library queries

### 7.3 E2E test

**`tests/e2e/asset-picker.spec.ts`** (Playwright):

- Editor flow: open editor -> click image field -> AssetPicker opens -> Generate tab -> enter prompt -> click Generate -> mock provider responds in <1 s -> click "Use" -> field updated, modal closed.
- Viewer flow: open AssetPicker -> Generate tab is disabled with tooltip.
- Timeout flow: first response is artificially delayed -> retry uses the same `requestKey` -> UI does not create a duplicate asset.
- Archive flow: archive an asset -> asset disappears from default picker grid but existing field URLs still render.

### 7.4 Manual smoke

A short checklist committed to the spec, run before each deploy that touches image generation:

- One real `generate` request against Gemini API.
- One real `edit` request with mask.
- One timeout/retry verification using the same `requestKey`.
- Visual inspection of SynthID watermark in exported email render.
- Quota counter displays the correct value in the AssetPicker footer.

### 7.5 What is explicitly not tested

- Provider output quality (Google's job).
- Network retries and circuit breaking beyond the request-key idempotency guarantee - v1 surfaces failures to the user; revisit if real usage shows flakiness.
- `gpt-image-2` swap path - the stub remains untested until the swap is actually performed.

### 7.6 CI configuration

- Unit and integration suites run on every PR with `IMAGE_PROVIDER=mock`.
- E2E runs against preview deploys with `IMAGE_PROVIDER=mock`.
- Real-provider smoke is manual, gated by `RUN_PROVIDER_SMOKE=1`, to avoid billing CI.

---

## 8. Open questions for implementation plan

The following decisions are deferred to plan-writing or implementation, not to v1 design:

- Exact Gemini SDK vs. raw `fetch` choice - verified against current docs at implementation time.
- Owner-facing UI for editing `organizations.image_quota_monthly` (v1 ships with default 100; settings UI is a follow-up).
- Mask brush-tool UX details (brush sizes, undo within the canvas). Sufficient detail for plan-writing: it is a small canvas component, not a major scope item.
- Whether archived assets need a hidden admin/debug view in v1 or can remain backend-visible only.

---

## 9. Recap of locked decisions

| Decision | Choice |
|---|---|
| UX surface | Unified AssetPicker modal with Library / Upload / Generate tabs |
| v1 operations | Text-to-image, inpaint with mask, background removal |
| Provider abstraction | Minimal `ImageProvider` interface, env-var selection |
| v1 provider | Gemini API, model `gemini-3.1-flash-image-preview` |
| Auth | `GEMINI_API_KEY` |
| Role gating | Editor and Owner |
| Cost control | Monthly per-workspace cap (`organizations.image_quota_monthly`) |
| Asset library | Per-workspace, Supabase Storage + `assets` table |
| Delete behavior | No hard delete in v1; archive only |
| Retry safety | Request-key idempotency via `image_generation_requests` |
| Upload scope | New workspace-scoped upload route; legacy project upload route unchanged |
| Generation flow | Synchronous request with loading spinner |
| Migration | Single new file `supabase/migrations/0012_assets.sql` |
