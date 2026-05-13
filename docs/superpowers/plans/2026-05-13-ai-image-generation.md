# AI Image Generation Implementation Plan

> **For agentic workers:** execute this plan task-by-task with checkbox tracking. Prefer small, reviewable commits after each passing checkpoint.

**Goal:** Add a workspace-scoped asset library plus AI image generation, inpainting, and background removal to the editor, using Gemini as the v1 provider, request-key idempotency for safe retries, and archive-only asset lifecycle semantics so existing project URLs never break.

**Architecture:** One new migration (`0012_assets.sql`) adds `assets`, `image_generation_usage`, `image_generation_requests`, `organizations.image_quota_monthly`, and the quota RPCs. Server-only provider adapters live under `src/lib/images/*`. The editor gets a unified `AssetPicker` that replaces scattered image upload fields. Asset uploads become workspace-scoped through a new `/api/workspace-assets/upload` route, while AI generation/editing lives under `/api/images/*`. Library browsing and archive actions use workspace routes under `/api/workspaces/[slug]/assets/*`.

**Tech Stack:** Next.js 15 · React 19 · TypeScript 5 · Supabase (Postgres + Auth + Storage) · Zustand + zundo · Vitest · Playwright

**Source spec:** `docs/superpowers/specs/2026-05-12-ai-image-generation-design.md`

---

## File structure

### New SQL migration

- `supabase/migrations/0012_assets.sql`

### New server code

- `src/lib/images/provider.ts`
- `src/lib/images/index.ts`
- `src/lib/images/gemini.ts`
- `src/lib/images/gpt-image-2.ts`
- `src/lib/images/mock.ts`
- `src/lib/images/errors.ts`
- `src/lib/images/assets.ts`
- `src/lib/images/request-key.ts`
- `src/app/api/images/generate/route.ts`
- `src/app/api/images/edit/route.ts`
- `src/app/api/workspace-assets/upload/route.ts`
- `src/app/api/workspaces/[slug]/assets/route.ts`
- `src/app/api/workspaces/[slug]/assets/[assetId]/route.ts`

### New client/editor UI

- `src/components/editor/AssetPicker.tsx`
- `src/components/editor/AssetPickerButton.tsx`
- `src/components/editor/AssetLibraryGrid.tsx`
- `src/components/editor/GenerateImageForm.tsx`
- `src/components/editor/MaskCanvas.tsx`
- `src/lib/api/assets.ts`
- `src/lib/api/images.ts`

### Files expected to change

- `src/components/editor/ImageInput.tsx`
- `src/components/editor/panels/HeaderPanel.tsx`
- `src/components/editor/panels/FooterPanel.tsx`
- `src/components/editor/panels/ProductSectionPanel.tsx`
- `src/components/editor/panels/GlobalStylesPanel.tsx`
- `src/app/api/upload/route.ts`
- `src/lib/api/upload.ts`
- `src/lib/editor/store.ts`
- `src/lib/editor/autosave.ts`
- `.env.example`

### Tests

- `tests/unit/images.provider.test.ts`
- `tests/unit/images.quota.test.ts`
- `tests/unit/images.request-idempotency.test.ts`
- `tests/unit/images.route-guards.test.ts`
- `tests/integration/image-generation.test.ts`
- `tests/integration/workspace-asset-upload.test.ts`
- `tests/e2e/asset-picker.spec.ts`

---

## Conventions

- Use the existing `vitest` and Playwright setup already present in the repo.
- Keep provider-specific code server-only; browser bundles must never see provider secrets.
- Treat `requestKey` as required for every mutating AI request.
- Do not hard-delete assets in v1. Archive only.
- Keep the current `src/app/api/upload/route.ts` working for legacy callers unless a change is explicitly additive and safe.

---

## Task 0: Verify current seams and pin implementation assumptions

**Files:**

- Read: `src/lib/auth/workspace.ts`
- Read: `src/components/editor/ImageInput.tsx`
- Read: `src/lib/api/upload.ts`
- Read: `src/lib/editor/store.ts`
- Read: `src/app/api/upload/route.ts`

- [ ] Confirm the current editor already exposes `workspaceSlug`, `projectId`, and role-aware UI hooks needed by the new picker.
- [ ] Confirm `test`, `typecheck`, and `e2e` scripts still run from `package.json`.
- [ ] Verify the current upload path remains project-scoped so the new workspace-scoped upload route can be added without breaking existing callers.
- [ ] At implementation time, verify the current Gemini image API request/response shape against Google’s latest docs before writing `gemini.ts`.

**Checkpoint:** no code changes yet; implementation assumptions are documented in the PR or task notes before writing code.

---

## Task 1: Add migration `0012_assets.sql`

**Files:**

- Create: `supabase/migrations/0012_assets.sql`

- [ ] Create `assets` with `original_filename` and `archived_at`, matching the spec.
- [ ] Create `image_generation_usage`.
- [ ] Create `image_generation_requests` keyed by `(org_id, request_key)`.
- [ ] Add `consume_image_quota(p_org_id uuid, p_limit int)`.
- [ ] Add `refund_image_quota(p_org_id uuid)`.
- [ ] Add `organizations.image_quota_monthly int not null default 100`.
- [ ] Add RLS for `assets`:
  - `select` for viewers+
  - `insert`/`update` for editors+
  - no user-facing delete policy
- [ ] Add indexes for library listing and request lookup.

**Validation:**

- Run the migration locally against the dev database.
- Inspect the resulting tables and policies.
- Verify `storage.objects` policies from `0007_storage_rls.sql` already allow `<org_id>/assets/...` paths without changes.

**Checkpoint:** migration applies cleanly and schema matches the spec.

---

## Task 2: Add provider abstraction and server-only image helpers

**Files:**

- Create: `src/lib/images/provider.ts`
- Create: `src/lib/images/errors.ts`
- Create: `src/lib/images/index.ts`
- Create: `src/lib/images/gemini.ts`
- Create: `src/lib/images/gpt-image-2.ts`
- Create: `src/lib/images/mock.ts`
- Create: `src/lib/images/assets.ts`
- Create: `src/lib/images/request-key.ts`

- [ ] Define `AspectRatio`, `GenerateOpts`, `EditOpts`, `GeneratedImage`, and `ImageProvider`.
- [ ] Add `getImageProvider()` with `gemini-image`, `gpt-image-2`, and `mock`.
- [ ] Implement typed provider error mapping so routes can distinguish bad requests from upstream failures.
- [ ] Implement `GeminiImageProvider` behind one interface only.
- [ ] Implement `GptImage2Provider` as a stub that throws `Not implemented`.
- [ ] Implement `MockImageProvider` returning deterministic fixture bytes for tests.
- [ ] Add helper functions for:
  - storage path generation: `<org_id>/assets/<uuid>.<ext>`
  - asset row insertion
  - request row lookup/update
  - safe request-key validation

**Validation:**

- Unit tests for provider request/response mapping exist before routes are wired.
- No client imports reference anything under `src/lib/images/gemini.ts`.

---

## Task 3: Add workspace asset library API

**Files:**

- Create: `src/app/api/workspaces/[slug]/assets/route.ts`
- Create: `src/app/api/workspaces/[slug]/assets/[assetId]/route.ts`

- [ ] Add `GET /api/workspaces/[slug]/assets` for library listing.
- [ ] Support query params:
  - `q` for search
  - `includeArchived=false` by default
  - optional pagination if needed, but newest-first ordering is required
- [ ] Search across `alt_text`, `prompt`, and `original_filename`.
- [ ] Add `PATCH /api/workspaces/[slug]/assets/[assetId]` to archive an asset by setting `archived_at`.
- [ ] Prevent hard-delete semantics in the route surface.
- [ ] Gate listing at viewer+, archive at editor+ using `requireWorkspaceRole`.

**Validation:**

- Viewer can list assets.
- Viewer cannot archive.
- Archived assets disappear from default results but remain in storage and DB.

---

## Task 4: Add workspace-scoped upload route and client API

**Files:**

- Create: `src/app/api/workspace-assets/upload/route.ts`
- Modify: `src/lib/api/upload.ts`
- Modify: `src/app/api/upload/route.ts`

- [ ] Create a new upload route that accepts `file`, `workspaceSlug`, and optional `altText`.
- [ ] Resolve the workspace with `requireWorkspaceRole(slug, 'editor')`.
- [ ] Upload to `project-assets` at `<org_id>/assets/<uuid>.<ext>`.
- [ ] Insert an `assets` row with:
  - `source='upload'`
  - `original_filename`
  - `alt_text`
  - width/height when available
- [ ] Return `{ assetId, url, width, height, originalFilename }`.
- [ ] Keep the legacy `/api/upload` route working for existing project-scoped callers.
- [ ] Split the client helper into:
  - existing project upload path for legacy/editor flows still using `ImageInput`
  - new workspace asset upload path for the AssetPicker

**Validation:**

- Uploading through the new route does not require `projectId`.
- Uploaded assets show up in library listing immediately.

---

## Task 5: Add AI generation and edit routes

**Files:**

- Create: `src/app/api/images/generate/route.ts`
- Create: `src/app/api/images/edit/route.ts`

- [ ] `POST /api/images/generate` accepts `{ prompt, aspectRatio, count, workspaceSlug, requestKey }`.
- [ ] `POST /api/images/edit` accepts multipart `image`, `mask`, `prompt`, `workspaceSlug`, `requestKey`, `mode`.
- [ ] Implement the exact request pipeline from the spec:
  1. `requireWorkspaceRole(slug, 'editor')`
  2. validate `requestKey`
  3. create/find `image_generation_requests`
  4. short-circuit completed or in-flight duplicates
  5. read `organizations.image_quota_monthly`
  6. call `consume_image_quota`
  7. call provider
  8. upload returned bytes to storage
  9. insert `assets` row
  10. mark request completed
- [ ] On failures after quota consumption:
  - call `refund_image_quota`
  - mark request failed
  - delete partial storage object if one exists
- [ ] For `remove_bg`, override prompt/mask server-side.
- [ ] Return 409 for duplicate in-flight `requestKey`.

**Validation:**

- Repeating a completed request with the same key returns the original asset.
- Repeating an in-flight request with the same key does not create a second asset.
- Failed requests can be retried safely with the same key.

---

## Task 6: Add client-side image API helpers

**Files:**

- Create: `src/lib/api/assets.ts`
- Create: `src/lib/api/images.ts`

- [ ] Add library functions:
  - `listWorkspaceAssets(slug, query?)`
  - `archiveWorkspaceAsset(slug, assetId)`
  - `uploadWorkspaceAsset(slug, file, altText?)`
  - `generateImage(payload)`
  - `editImage(formData)`
- [ ] Centralize request-key creation and reuse semantics in one helper.
- [ ] Normalize common error codes into user-facing categories:
  - `quota_exhausted`
  - `still_processing`
  - `provider_unavailable`
  - `unauthorized`

**Validation:**

- AssetPicker can consume one typed client API surface instead of raw `fetch` calls scattered through UI components.

---

## Task 7: Build the AssetPicker UI shell

**Files:**

- Create: `src/components/editor/AssetPicker.tsx`
- Create: `src/components/editor/AssetPickerButton.tsx`
- Create: `src/components/editor/AssetLibraryGrid.tsx`
- Create: `src/components/editor/GenerateImageForm.tsx`

- [ ] `AssetPickerButton` opens a modal and accepts:
  - current image URL
  - current alt text if applicable
  - workspace slug
  - role/can-edit state
  - callback to write selected asset URL back into editor state
- [ ] Add Library, Upload, and Generate tabs.
- [ ] Library tab:
  - newest first
  - thumbnail grid
  - hover metadata
  - search input
  - `Use` and `Archive` actions
- [ ] Upload tab:
  - drag/drop or file picker
  - upload via `/api/workspace-assets/upload`
- [ ] Generate tab:
  - prompt
  - aspect ratio
  - variant count
  - in-flight state
  - result thumbnails with `Use`
- [ ] Footer shows quota usage for editor+.
- [ ] Viewer sees library only; mutating tabs/actions are disabled.

**Validation:**

- Modal is reusable across all image fields rather than copied per panel.

---

## Task 8: Build mask editing and background removal UX

**Files:**

- Create: `src/components/editor/MaskCanvas.tsx`
- Modify: `src/components/editor/AssetPicker.tsx`

- [ ] Add the inpaint flow starting from a library asset.
- [ ] `MaskCanvas` supports:
  - drawing a transparent mask over an image
  - exporting a PNG mask
  - clearing/resetting the mask
- [ ] Edit results are always saved as a new asset.
- [ ] Background removal is a one-click action from the library card menu.
- [ ] Keep brush UX intentionally minimal in v1; do not expand scope into a full image editor.

**Validation:**

- Inpaint and background removal both land as `source='edit'` assets.

---

## Task 9: Replace current image inputs in editor panels

**Files:**

- Modify: `src/components/editor/ImageInput.tsx`
- Modify: `src/components/editor/panels/HeaderPanel.tsx`
- Modify: `src/components/editor/panels/FooterPanel.tsx`
- Modify: `src/components/editor/panels/ProductSectionPanel.tsx`
- Modify: `src/components/editor/panels/GlobalStylesPanel.tsx`

- [ ] Decide whether `ImageInput` becomes a thin wrapper around `AssetPickerButton` or whether panels switch directly to the new component.
- [ ] Replace the current upload button flow in:
  - header logo
  - header banner
  - footer banner
  - product section images
  - global styles logo slot if present there
- [ ] Preserve existing preview behavior so users still see the currently selected image.
- [ ] Respect `useCanEdit()` and existing fieldset disable behavior.

**Validation:**

- All four target panels use the same picker.
- No editor panel still depends on project-scoped uploads for the new asset workflow.

---

## Task 10: Wire editor state, autosave, and request semantics

**Files:**

- Modify: `src/lib/editor/store.ts`
- Modify: `src/lib/editor/autosave.ts`

- [ ] Keep selected asset insertion as URL-based to match current `projects` schema.
- [ ] Ensure no editor-state changes are needed beyond normal field updates when a user picks an asset.
- [ ] If autosave or persistence code assumes all image uploads are project-scoped, remove that assumption.
- [ ] Keep request-key generation local to image actions only; do not store request keys in long-lived editor state.

**Validation:**

- Picking a generated or uploaded asset updates the relevant editor field and autosaves like any other change.

---

## Task 11: Add unit and integration coverage

**Files:**

- Create: `tests/unit/images.provider.test.ts`
- Create: `tests/unit/images.quota.test.ts`
- Create: `tests/unit/images.request-idempotency.test.ts`
- Create: `tests/unit/images.route-guards.test.ts`
- Create: `tests/integration/image-generation.test.ts`
- Create: `tests/integration/workspace-asset-upload.test.ts`

- [ ] Provider tests cover request-shape mapping and response parsing.
- [ ] Quota tests cover atomic increment, limit exhaustion, lazy row creation, and refund floor behavior.
- [ ] Idempotency tests cover:
  - duplicate completed request
  - duplicate in-flight request
  - retry after failure
- [ ] Route guard tests cover viewer rejection, quota rejection, and provider failure refund behavior.
- [ ] Integration tests assert:
  - storage object path
  - `assets` row correctness
  - request row completion
  - quota increments exactly once
  - workspace upload does not require `projectId`

**Validation:**

- `npm test` passes with `IMAGE_PROVIDER=mock`.

---

## Task 12: Add Playwright coverage for the new picker

**Files:**

- Create: `tests/e2e/asset-picker.spec.ts`

- [ ] Cover editor happy path:
  - open editor
  - open picker
  - generate image
  - use result
  - field updates
- [ ] Cover viewer restrictions.
- [ ] Cover timeout/retry behavior with the same `requestKey`.
- [ ] Cover archive flow so the asset disappears from default listing but existing content still renders.

**Validation:**

- E2E runs with `IMAGE_PROVIDER=mock`.

---

## Task 13: Environment, documentation, and rollout notes

**Files:**

- Modify: `.env.example`
- Modify: this plan if implementation details change materially

- [ ] Add:
  - `IMAGE_PROVIDER=gemini-image`
  - `GEMINI_API_KEY=`
  - `GEMINI_IMAGE_MODEL=gemini-3.1-flash-image-preview`
- [ ] Document any provider-specific install or runtime notes discovered during implementation.
- [ ] Record manual smoke steps in the PR description or release checklist:
  - real generate
  - real edit with mask
  - timeout/retry with same key
  - archive behavior
  - quota footer display

---

## Task 14: Final verification and self-review

- [ ] Run `npm run typecheck`.
- [ ] Run `npm test`.
- [ ] Run `npm run e2e` or the targeted picker spec.
- [ ] Manually verify in the app:
  - editor can generate and insert an image
  - uploaded image appears in library
  - archive hides without breaking existing uses
  - viewer sees read-only library access
  - duplicate retry does not create duplicate assets
- [ ] Re-scan the source spec and confirm every locked decision is reflected in code:
  - archive-only lifecycle
  - request-key idempotency
  - workspace-scoped uploads
  - compensating quota refunds
  - no provider secrets in client code

---

## Suggested commit slices

1. `feat(db): add workspace assets and image quota schema`
2. `feat(images): add provider abstraction and request-key helpers`
3. `feat(api): add workspace asset library and upload routes`
4. `feat(api): add image generate and edit routes`
5. `feat(editor): add unified asset picker`
6. `test(images): cover quota, idempotency, and picker flows`

---

## Done

Plan complete and saved to `docs/superpowers/plans/2026-05-13-ai-image-generation.md`.
