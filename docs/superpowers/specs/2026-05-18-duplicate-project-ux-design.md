# Duplicate Project — Name Choice + Feedback

**Date:** 2026-05-18
**Status:** Approved for implementation

## Problem

Today, clicking the duplicate button on a `ProjectCard`:

1. Gives no visible feedback while the request is in flight.
2. Always names the copy `"<original name> (copy)"` — the user has no say.
3. Navigates straight into the new project's editor, even when the user just wanted a copy in the grid.

## Goals

- Let the user choose the new project's name (or accept an auto-generated default).
- Show clear feedback during and after the operation.
- Leave the user on the dashboard; the new card appears in the grid. The user can click it if they want to open it.

## Non-goals

- Bulk duplicate.
- Cross-workspace duplicate.
- Customising any field other than the name (template, brand kit, etc. remain copied from the source as today).

## UX

1. User clicks the duplicate icon on a `ProjectCard`.
2. A small prompt dialog opens:
   - Title: **Duplicate project**
   - Single text input, pre-filled with `"<original name> (copy)"`, auto-focused and fully selected.
   - Buttons: **Cancel** and **Duplicate** (primary). Enter submits, Escape cancels.
   - Helper text: "Leave blank to use the default name."
3. On **Cancel** — nothing happens.
4. On **Duplicate**:
   - The dialog closes immediately.
   - The duplicate icon on the source card swaps to a spinner and the button is disabled until the request resolves.
   - On success: a success toast `"Project duplicated"` appears; the grid refetches so the new card appears (sorted by `updated_at`, so usually at the top). **The user is not navigated anywhere.**
   - On error: an error toast with the server message (or `"Could not duplicate project"` fallback) appears; nothing else changes.

## Components and changes

### New: `src/lib/utils/prompt.ts`

Parallel to `src/lib/utils/confirm.ts`. Exposes:

```ts
promptDialog(opts: {
  title: string;
  message?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
}): Promise<string | null>;
```

Resolves to the trimmed user-entered string on confirm, or `null` on cancel. Uses the same singleton-listener pattern as `confirm.ts`.

### New: `src/components/ui/PromptDialog.tsx`

Renders the modal when state is non-null. Mirrors `ConfirmDialog.tsx` visually (same overlay, panel, motion variants). Contains a single text input bound to local state; Enter triggers confirm, Escape triggers cancel. Mounted once in `src/app/layout.tsx` alongside `ConfirmDialog`.

### Modified: `src/app/api/projects/[id]/duplicate/route.ts`

- Parse optional JSON body `{ name?: string }`. Tolerate missing/invalid bodies (treat as `{}`).
- If `name` is a non-empty trimmed string, use it; otherwise fall back to `${src.name} (copy)`.
- Apply the same name length cap as the existing project name field (mirror whatever validation `POST /api/projects` already enforces, if any — otherwise do nothing extra).

### Modified: `src/lib/api/projects.ts`

```ts
export async function duplicateProject(id: string, name?: string): Promise<{ id: string }>;
```

Sends `JSON.stringify({ name })` only when `name` is provided.

### Modified: `src/components/dashboard/ProjectCard.tsx`

- Replace the existing `onDuplicate` body:
  - Call `promptDialog({ title: 'Duplicate project', label: 'Name', defaultValue: \`${project.name} (copy)\`, confirmLabel: 'Duplicate' })`.
  - If result is `null`, return.
  - Otherwise `startTransition` → `duplicateProject(project.id, result || undefined)` → on success `toast.success('Project duplicated')` and `onChanged()`. On error `toast.error(...)`.
- Swap the duplicate button's `<Copy />` icon for `<Loader2 className="animate-spin" />` while `pending`.
- Remove the `router.push` and the `useRouter` import if no longer used.

## Error handling

- Network or 5xx: error toast with server message or generic fallback. Source card returns to its idle state.
- 401/403: error toast `"You can't duplicate this project"`.
- 404: error toast `"Project not found"`.

## Testing

Manual:

- Duplicate with default name → new card appears with `<name> (copy)`, no navigation, success toast.
- Duplicate with custom name → new card appears with the chosen name.
- Cancel the dialog → nothing happens.
- Submit empty name → behaves like default (auto-name).
- Press Enter / Escape in the dialog → confirm / cancel.
- Force a 500 from the API → error toast, source card returns to idle.
- Rapid double-click on the duplicate button → second click is no-op while pending.

## Out of scope

- Sharing `PromptDialog` with other features (rename, new project) — current rename has an inline input that should stay as-is; `NewProjectDialog` is its own component. We are only adding the prompt primitive, not refactoring callers.
