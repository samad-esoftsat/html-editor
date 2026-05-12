# AI Image Generation — Design Spec

**Date:** 2026-05-12
**Status:** Approved (brainstorm) — pending implementation plan
**Owner:** Jean-Louis Garcia (GlobalTT/Esoftsat)
**Depends on:** workspaces + brand kits (shipped on `main`, 0004–0011 migrations)

---

## 1. Goal

Add AI-powered image generation and editing to the email editor so users can produce on-brand imagery (banners, product shots, logos) without leaving the tool. This is the Tier-2 "AI image gen / stock search built in" feature from `docs/ROADMAP-SAAS.md`.

**Success criteria:**

- An Editor in a workspace can type a prompt and have a generated image inserted into a header, footer, product section, or global-styles logo slot within ~30 seconds.
- All generated and uploaded images live in a per-workspace library and can be reused across projects.
- Adding a second provider (gpt-image-2) later requires a new class and an env-var change — no schema or UI changes.

**Out of scope for v1:**

- AI-generated full templates (deferred; will get its own spec).
- Stock image search (Unsplash, etc.).
- Image-to-image style transfer beyond what the chosen model offers natively.
- Per-prompt cost reporting or per-user (within workspace) quotas.
- Asynchronous job queue for generation.

---

## 2. Architecture

```
┌─ Browser ──────────────────────────────┐
│ AssetPicker modal                      │
│   ├─ Library tab (existing assets)     │
│   ├─ Upload tab                        │
│   └─ Generate tab (prompt + opts)      │
└────────────────┬───────────────────────┘
                 │ POST /api/images/generate
                 │ POST /api/images/edit
                 ▼
┌─ Next.js server route ─────────────────┐
│ 1. requireWorkspace(slug, "editor")    │
│ 2. consume_image_quota(org_id, cap)    │
│ 3. provider = getImageProvider()       │
│ 4. result = provider.generate(...)     │
│ 5. upload to Storage:                  │
│    <org_id>/assets/<uuid>.png          │
│ 6. INSERT into assets row              │
│ 7. return { id, url, ... }             │
└────────────────┬───────────────────────┘
                 │
                 ▼
┌─ ImageProvider (interface) ────────────┐
│  • GeminiImageProvider (v1)            │
│  • GptImage2Provider (v2 stub)         │
└────────────────────────────────────────┘
```

**Approach: Minimal provider abstraction.** A single `ImageProvider` interface, one concrete implementation per provider, selected by `IMAGE_PROVIDER` env var. No per-workspace provider configuration, no capability negotiation. Reasoning: both candidate providers support the same v1 operations, and YAGNI applies until a real divergence forces it.

**Key boundaries:**

- Provider API keys live only in server env. Browser never calls a provider directly.
- Quota check, provider call, Storage upload, and DB insert all happen in the same server request. A 200 response always means "image is saved and counted."
- Provider selection is a single env var; swapping providers is a deploy.

---

## 3. Data model

### 3.1 New table: `assets`

```sql
create table assets (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  created_by    uuid not null references auth.users(id),
  storage_path  text not null,
  mime_type     text not null,
  width         int,
  height        int,
  source        text not null check (source in ('upload','generate','edit')),
  prompt        text,
  provider      text,
  alt_text      text,
  created_at    timestamptz not null default now()
);
create index on assets (org_id, created_at desc);
```

`storage_path` always matches `<org_id>/assets/<uuid>.<ext>`. `prompt` and `provider` are null for uploads. `source = 'edit'` covers both inpainting and background removal (background removal is implemented as an edit with a fixed prompt).

**RLS:**

- `select`: `is_org_member(org_id, auth.uid(), 'viewer')`
- `insert`/`update`/`delete`: `is_org_member(org_id, auth.uid(), 'editor')`

Mirrors the policy pattern used by `projects` (0006_rls.sql).

### 3.2 New table: `image_generation_usage`

```sql
create table image_generation_usage (
  org_id  uuid not null references organizations(id) on delete cascade,
  period  date not null,
  count   int  not null default 0,
  primary key (org_id, period)
);
```

`period` is the first day of the month, UTC. One row per workspace per month, written lazily on first generation of the month.

### 3.3 New RPC: `consume_image_quota`

```sql
create or replace function consume_image_quota(p_org_id uuid, p_limit int)
returns table(ok boolean, remaining int, period date)
language plpgsql security definer
as $$
declare v_period date := date_trunc('month', now() at time zone 'utc')::date;
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

Atomic via `for update`. Caller passes the per-workspace cap so the function stays generic. Counted before provider call; rolled back inside the request transaction if the provider throws (see §6).

### 3.4 New column: `organizations.image_quota_monthly`

```sql
alter table organizations
  add column image_quota_monthly int not null default 100;
```

Owner-editable later via workspace settings UI (out of scope for v1; default value sufficient).

### 3.5 Storage layout

Reuses the existing project upload bucket. Path: `<org_id>/assets/<uuid>.<ext>`. Storage RLS (migration 0007) already gates by `org_id` prefix; verify the existing path regex matches `assets/` before relying on it — adjust the regex in 0012 if needed.

### 3.6 `projects` table

No schema change. Image fields continue to store public Storage URLs. A follow-up cleanup to store `asset_id` references is possible but explicitly out of scope.

### 3.7 Migration file

Single new file: `supabase/migrations/0012_assets.sql` containing the table, the RPC, the column, the RLS policies, and (if needed) the Storage path-regex update.

---

## 4. UX flow

### 4.1 AssetPicker modal

One new component replaces the scattered "image URL" text inputs in `HeaderPanel`, `FooterPanel`, `ProductSectionPanel`, and `GlobalStylesPanel` (logo).

```
┌─ AssetPicker ─────────────────────────────────────┐
│ [Library] [Upload] [Generate]                     │
├───────────────────────────────────────────────────┤
│  Library tab:                                     │
│    Grid of thumbnails, newest first.              │
│    Hover: filename, source, "Use" / "Delete".     │
│    Search by alt-text/prompt.                     │
│                                                   │
│  Upload tab:                                      │
│    Drop zone, writes to assets table              │
│    at <org_id>/assets/<uuid>.<ext>.               │
│                                                   │
│  Generate tab:                                    │
│    [textarea: prompt]                             │
│    [select: aspect ratio — 1:1, 16:9, 9:16, 4:3]  │
│    [select: # of variants — 1, 2, 4]              │
│    [Generate] button                              │
│    Below: spinner → 1–4 result thumbnails.        │
│    Click thumbnail → "Use" inserts into field     │
│    AND persists to library.                       │
│                                                   │
│  Footer:                                          │
│    "Quota: 47/100 this month" (Editor+ only)      │
└───────────────────────────────────────────────────┘
```

### 4.2 Edit / inpaint flow

Entered from the Library tab via "Edit" on a thumbnail.

- Canvas shows the source image. User paints a mask with a brush tool (transparent = "regenerate this area").
- Prompt textarea + "Regenerate masked area" button.
- Result is offered as either a replacement or a new asset (user choice). Default: new asset, to preserve the original.

### 4.3 Background removal

One-click action in the Library tab thumbnail menu. No prompt. Internally sends an edit request with a fixed prompt (`"remove the background, output transparent PNG"`) and a full-image mask. Result saved as a new asset with `source = 'edit'`.

### 4.4 Role gating in UI

- **Viewer:** Library tab only. Upload, Generate, Edit tabs render disabled with a tooltip explaining role requirement.
- **Editor / Owner:** All tabs available.

### 4.5 Loading and error states

- Generate button disabled while a request is in flight.
- Spinner shows elapsed seconds (Gemini image responses can take 10–20 s).
- Errors render inline above the button:
  - `"Quota exhausted (100/100). Resets on <date>."` (429)
  - `"Provider unavailable, try again."` (502)
  - `"You don't have permission to generate images."` (403; should not happen if UI gating works)
- 30 s client-side timeout → `"Taking longer than expected. Refresh to retry."`

### 4.6 Code touch points

- **New files:**
  - `src/components/editor/AssetPicker.tsx`
  - `src/components/editor/AssetPickerButton.tsx`
  - `src/components/editor/MaskCanvas.tsx`
- **Modified files:** every panel with an image-URL input swaps the input for `<AssetPickerButton field="..." />`. Affected: `HeaderPanel`, `FooterPanel`, `ProductSectionPanel`, `GlobalStylesPanel`.
- **Existing upload flow:** `src/app/api/upload/route.ts` is updated (or wrapped) to write an `assets` row in addition to the Storage object, so uploads appear in the Library tab.

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
  mask: Buffer;        // PNG; transparent pixels = region to edit
  prompt: string;
};

export type GeneratedImage = {
  bytes: Buffer;
  mimeType: string;    // 'image/png'
  width: number;
  height: number;
};

export interface ImageProvider {
  name: 'gemini-image' | 'gpt-image-2';
  generate(opts: GenerateOpts): Promise<GeneratedImage[]>;
  edit(opts: EditOpts): Promise<GeneratedImage>;
}
```

Background removal is **not** a separate method; it is a wrapper around `edit()` with a fixed prompt and a full-image mask. This keeps the interface minimal.

Providers return bytes, not URLs. The route handler owns Storage upload, so provider implementations stay uniform.

### 5.2 Provider selection

`src/lib/images/index.ts`:

```ts
export function getImageProvider(): ImageProvider {
  const name = process.env.IMAGE_PROVIDER ?? 'gemini-image';
  switch (name) {
    case 'gemini-image': return new GeminiImageProvider();
    case 'gpt-image-2':  return new GptImage2Provider();
    case 'mock':         return new MockImageProvider();
    default: throw new Error(`Unknown IMAGE_PROVIDER: ${name}`);
  }
}
```

### 5.3 Gemini implementation

`src/lib/images/gemini.ts`:

- Model: `gemini-3.1-flash-image-preview` (env-overridable as `GEMINI_IMAGE_MODEL` so we can pin or upgrade without code change).
- Auth: single `GEMINI_API_KEY` env var.
- SDK: `@google/genai` (current Google GenAI JS SDK), or direct REST `fetch` to `https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent`. Decision deferred to implementation, but the choice must not leak into the `ImageProvider` interface.
- `generate()` maps `count` to multiple variants and `aspectRatio` to the model's aspect-ratio parameter.
- `edit()` sends the source image and mask as additional `inlineData` parts. Background removal calls `edit()` with the fixed prompt described in §4.3.
- Output: PNG with SynthID watermark (Google embeds this automatically; acceptable for marketing emails).

**Known risks for the implementation plan to address:**

- `gemini-3.1-flash-image-preview` is in preview; Google may rename or change behaviour. The provider abstraction absorbs this — only the model string changes.
- Exact request shape (especially for mask-based editing) must be verified against current Google docs at implementation time, since preview-model APIs evolve.

### 5.4 gpt-image-2 stub

`src/lib/images/gpt-image-2.ts`: a stub class whose methods throw `Error('Not implemented')`. The file includes a short comment block listing what the next implementer needs to fill in (endpoint, env var, parameter mapping). v1 ships with this stub so the switch is visible in code.

### 5.5 Server routes

All under `src/app/api/images/`. Two routes — background removal is a parameter on `/edit`, not its own route.

- **`POST /api/images/generate`**
  Body: `{ prompt, aspectRatio, count, workspaceSlug }`.
  Returns: `[{ assetId, url, width, height }]`.

- **`POST /api/images/edit`**
  Multipart form: `image` (file), `mask` (file), `prompt` (text), `workspaceSlug` (text), `mode` ('inpaint' | 'remove_bg').
  Returns: `{ assetId, url, width, height }`.
  When `mode = 'remove_bg'`, the server overrides `prompt` and `mask` per §4.3.

Each handler runs the identical pipeline:

1. `requireWorkspace(slug, 'editor')` — 403 on failure.
2. Look up `organizations.image_quota_monthly` for the workspace.
3. Call `consume_image_quota` RPC. If `ok = false`, return 429 with `{ error: 'quota_exhausted', resetsOn }`.
4. Call provider. On failure, call `refund_image_quota` and return 502.
5. Upload bytes to Storage. On failure, call `refund_image_quota` and return 500.
6. Insert `assets` row. On failure, delete the Storage object, call `refund_image_quota`, and return 500.
7. Return JSON.

The provider call is intentionally *not* wrapped in a Postgres transaction — that would hold a DB connection open for the 10–20 s the provider takes. Instead, quota consumption is its own atomic RPC up front, and any downstream failure issues a compensating decrement via `refund_image_quota`. See §6.

### 5.6 Env vars

Additions to `.env.example`:

```
IMAGE_PROVIDER=gemini-image
GEMINI_API_KEY=
GEMINI_IMAGE_MODEL=gemini-3.1-flash-image-preview
# Later, for swap:
# OPENAI_API_KEY=
```

---

## 6. Error handling

| Failure                               | HTTP | Quota consumed? | Client behaviour                                           |
|---------------------------------------|------|------------------|------------------------------------------------------------|
| Not signed in                         | 401  | no               | Redirect to login (middleware handles this)                |
| Wrong role                            | 403  | no               | Inline error; UI should already have gated the action      |
| Quota exhausted                       | 429  | no               | Inline error with reset date; Generate button stays disabled |
| Provider 4xx (bad prompt, etc.)       | 400  | no               | Inline error with provider message                         |
| Provider 5xx / network                | 502  | no (rolled back) | Inline error; user can retry                               |
| Storage upload fails                  | 500  | no (rolled back) | Inline error; user can retry                               |
| Client timeout (30 s, no server resp) | —    | unknown          | "Taking longer than expected" message; surface server logs |

**Rollback mechanism:** quota consumption is a single atomic RPC (`consume_image_quota`) committed up front. After that, the provider call, Storage upload, and `assets` insert run sequentially *without* a wrapping DB transaction (a wrapping transaction would hold a connection open across the 10–20 s provider call). Any failure after the quota is consumed issues a compensating decrement via `refund_image_quota`, and any partial Storage upload is cleaned up by the route before returning the error.

**Compensating decrement** is implemented as a second RPC `refund_image_quota(p_org_id uuid)` that decrements `count` by 1 for the current period, floored at 0. Idempotent on repeated calls within the same request — a worst-case crash between provider success and refund leaves the counter slightly over-consumed, which is acceptable.

---

## 7. Testing

### 7.1 Unit tests (`tests/unit/`)

- **`images/provider.test.ts`** — Mock HTTP layer. Verify `GeminiImageProvider` builds correct request bodies for `generate` (aspect ratio mapping, variant count) and `edit` (image + mask in `inlineData` parts). Verify response parsing into `GeneratedImage[]`. Verify provider errors surface as typed errors.
- **`images/quota.test.ts`** — Real Supabase test instance (same pattern as `workspace.test.ts`). Verify `consume_image_quota` increments atomically, returns `{ ok: false }` at limit, creates row lazily on first call of the month, and that `refund_image_quota` decrements without going below 0.
- **`images/route-guards.test.ts`** — Verify `/api/images/generate` returns 403 for Viewer, 429 when over quota, and 502 when provider throws. After a 502 case, read the DB and confirm the quota counter is unchanged.

### 7.2 Integration test

**`tests/integration/image-generation.test.ts`** — Signed-in Editor posts to `/api/images/generate` with `IMAGE_PROVIDER=mock` returning fixture PNG bytes. Asserts:

- Storage object exists at `<org_id>/assets/<uuid>.png`.
- `assets` row has correct `org_id`, `source = 'generate'`, prompt stored.
- Quota counter incremented by exactly one.

### 7.3 E2E test

**`tests/e2e/asset-picker.spec.ts`** (Playwright):

- Editor flow: open editor → click image field → AssetPicker opens → Generate tab → enter prompt → click Generate → mock provider responds in <1 s → click "Use" → field updated, modal closed.
- Viewer flow: open AssetPicker → Generate tab is disabled with tooltip.

### 7.4 Manual smoke

A short checklist committed to the spec, run before each deploy that touches image generation:

- One real `generate` request against Gemini API.
- One real `edit` request with mask.
- Visual inspection of SynthID watermark in exported email render.
- Quota counter displays the correct value in the AssetPicker footer.

### 7.5 What is explicitly not tested

- Provider output quality (Google's job).
- Network retries and circuit breaking — v1 surfaces failures to the user; revisit if real usage shows flakiness.
- gpt-image-2 swap path — the stub remains untested until the swap is actually performed.

### 7.6 CI configuration

- Unit and integration suites run on every PR with `IMAGE_PROVIDER=mock`.
- E2E runs against preview deploys with `IMAGE_PROVIDER=mock`.
- Real-provider smoke is manual, gated by `RUN_PROVIDER_SMOKE=1`, to avoid billing CI.

---

## 8. Open questions for implementation plan

The following decisions are deferred to plan-writing or implementation, not to v1 design:

- Exact Gemini SDK vs. raw `fetch` choice — verified against current docs at impl time.
- Owner-facing UI for editing `organizations.image_quota_monthly` (v1 ships with default 100; settings UI is a follow-up).
- Whether to also write a Storage RLS update in 0012 (depends on whether the existing path regex in 0007 already allows `assets/`).
- Mask brush-tool UX details (brush sizes, undo within the canvas). Sufficient detail for plan-writing: it's a small canvas component, not a major scope item.

---

## 9. Recap of locked decisions

| Decision                  | Choice                                                          |
|---------------------------|------------------------------------------------------------------|
| UX surface                | Unified AssetPicker modal with Library / Upload / Generate tabs |
| v1 operations             | Text-to-image, inpaint with mask, background removal            |
| Provider abstraction      | Minimal `ImageProvider` interface, env-var selection            |
| v1 provider               | Gemini API, model `gemini-3.1-flash-image-preview`              |
| Auth                      | `GEMINI_API_KEY`                                                |
| Role gating               | Editor and Owner                                                |
| Cost control              | Monthly per-workspace cap (`organizations.image_quota_monthly`) |
| Asset library             | Per-workspace, Supabase Storage + `assets` table                |
| Generation flow           | Synchronous request with loading spinner                        |
| Migration                 | Single new file `supabase/migrations/0012_assets.sql`           |
