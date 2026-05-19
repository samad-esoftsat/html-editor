# Structural Section Editing on Canvas

**Date:** 2026-05-19
**Status:** Approved for implementation
**Follows:** [`2026-05-18-in-canvas-editing-v2-design.md`](./2026-05-18-in-canvas-editing-v2-design.md)

## Problem

The in-canvas editor now lets users edit visible text, images, alt text, and link URLs directly on the canvas. Structural operations on sections — add a new section, remove one, duplicate one, reorder them — still happen only in the left sidebar via the section list. That's a coordination problem: users locate the section they want to manipulate by looking at the canvas, then have to find the matching list row in the sidebar to act on it.

We want the structural operations to live where the section lives.

## Goals

- Add a new section by clicking a `+` button between (or above/below) sections on the canvas.
- Duplicate a section by clicking a button on the section itself.
- Delete a section by clicking a button on the section itself, with a confirmation dialog and undo as the safety net.
- Drag-and-drop reorder sections on the canvas.
- Keep the sidebar's section controls working; both surfaces stay bound to the same store.
- All affordances hide cleanly in Preview mode.

## Non-goals (this PR)

- Drag-and-drop reordering of bullets within a section.
- Cross-project section clipboard (copy a section in one project, paste in another).
- Multi-select section operations.
- FLIP-style reorder animations beyond what @dnd-kit gives us during drag.
- Section-level templates or presets.

## UX

### Section toolbar

Each section on the canvas grows a small floating toolbar anchored to its top-right corner. The toolbar is hidden by default and fades in (`opacity 0 → 1`) on hover of the section. Contents from left to right:

| Icon | Action |
|---|---|
| `GripVertical` | Drag handle. Mouse cursor `grab` / `grabbing`. The only handle the DnD system listens to. |
| `Copy` | Duplicate this section. Insert the copy immediately after the source. |
| `X` | Delete this section. Opens a confirmation dialog (`Delete section?` / `Delete` / `Cancel`). |

The toolbar is rendered inside each section's wrapping `<div>` (which gets `position: relative` for anchoring). It sits above the canvas content with a small panel background so it's readable against any section color. In Preview mode the toolbar is not rendered at all.

### Insert bar between sections

A thin horizontal row appears above every section and below the last one. The row is invisible at rest. On hover of the row, a centered `+` button appears with the label "Add section". Clicking inserts a fresh blank section at that exact index.

The blank section uses the same `blankSection()` factory the sidebar's existing "Add section" button uses today.

In Preview mode the insert rows are not rendered.

### Drag and drop

The grip in the section toolbar is the only drag handle. Holding the grip lets the user drag the section to a new position. While dragging:

- The source section becomes semi-transparent (`opacity: 0.5`).
- Drop targets slide aside with @dnd-kit's default transform.
- Dropping commits the reorder; releasing on the same position is a no-op.

Keyboard support comes free from @dnd-kit:

- `Tab` to the grip, then `Space` to pick up.
- `↑` / `↓` to move the section.
- `Space` to drop, `Escape` to cancel.

### Confirmation dialog

Delete reuses `confirmDialog({ title, message, confirmLabel, danger })` from `src/lib/utils/confirm.ts` — the same component used for member removal and project delete. The wording:

```
Delete section?
This will remove the section "<title>" from the email.
[Cancel] [Delete]   ← Delete is the danger variant
```

Undo (`Cmd/Ctrl+Z`) restores a deleted section, matching every other destructive action in the editor.

### No-section state

The user is allowed to delete every section. When `data.sections.length === 0`, the canvas renders no section blocks at all between header and footer. A single insert row remains visible (the one between header and footer) so the user can add the first section back. The sidebar's add-section button continues to work too.

## Architecture

### New / modified store actions

`src/lib/editor/store.ts`:

```ts
interface EditorStore {
  // existing
  addSection(atIndex?: number): void;            // existing signature gains optional index
  removeSection(id: string): void;               // unchanged
  moveSection(id: string, dir: 'up' | 'down'): void;  // unchanged — used by the sidebar arrows

  // new
  duplicateSection(id: string): void;
  reorderSections(next: ProductSection[]): void;
}
```

- `addSection(atIndex?)` — if `atIndex` is provided, splice the new blank section into that position; otherwise append (current behavior).
- `duplicateSection(id)` — deep-clone the section by id, generate a fresh `uuid()` for the copy, insert immediately after the source. If the id is not found, no-op.
- `reorderSections(next)` — replace `data.sections` with the provided array. The DnD layer computes the next array via `arrayMove(...)` and dispatches this single setter; no need for from/to indices in the store.

All three new/extended setters participate in the Zustand `temporal` history exactly the way the existing setters do — no special-casing needed.

### New components

`src/components/editor/canvas/SectionToolbar.tsx`

```ts
interface SectionToolbarProps {
  sectionId: string;
  sectionTitle: string;
  dragAttributes: ReturnType<typeof useSortable>['attributes'];
  dragListeners: ReturnType<typeof useSortable>['listeners'];
}
```

Renders a small absolute-positioned cluster of three icon buttons. The grip button spreads `attributes` and `listeners` from `useSortable`. The duplicate and delete buttons call the store directly. The delete button awaits `confirmDialog` before invoking `removeSection`.

`src/components/editor/canvas/SectionInsertBar.tsx`

```ts
interface SectionInsertBarProps {
  atIndex: number;
}
```

A thin row with a centered hover-only `+` button. On click, calls `addSection(atIndex)`.

Both components consult `useEditorMode()` and return `null` in preview.

### PreviewBody changes

`src/components/editor/PreviewBody.tsx`:

1. Import `DndContext`, `closestCenter`, `KeyboardSensor`, `PointerSensor`, `useSensor`, `useSensors` from `@dnd-kit/core` and `SortableContext`, `arrayMove`, `sortableKeyboardCoordinates`, `useSortable`, `verticalListSortingStrategy` from `@dnd-kit/sortable`.
2. Move each section render into a `<SortableSection s={s} idx={idx} />` child component that calls `useSortable({ id: s.id })` and applies the resulting `style` + `setNodeRef` to the section's wrapping `<div>`.
3. Wrap the `data.sections.map(...)` block in `<DndContext sensors={...} collisionDetection={closestCenter} onDragEnd={onDragEnd}><SortableContext items={data.sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>...</SortableContext></DndContext>`.
4. Interleave `<SectionInsertBar atIndex={n} />` rows above each section and one final bar after the last section.
5. Render `<SectionToolbar ... />` inside each section's wrapper.

`onDragEnd`:

```ts
function onDragEnd(e: DragEndEvent) {
  const { active, over } = e;
  if (!over || active.id === over.id) return;
  const oldIndex = data.sections.findIndex((s) => s.id === active.id);
  const newIndex = data.sections.findIndex((s) => s.id === over.id);
  if (oldIndex < 0 || newIndex < 0) return;
  reorderSections(arrayMove(data.sections, oldIndex, newIndex));
}
```

### Sidebar coexistence

The existing `ProductSectionPanel` / `LeftPanel` controls stay. Both surfaces are bound to the same Zustand store, so any operation on the canvas is reflected in the sidebar immediately. The sidebar's per-section "Up" / "Down" arrows continue to use `moveSection` — they are not removed.

### Dependency

Add `@dnd-kit/core` and `@dnd-kit/sortable` to `package.json`. Both are small (~30 KB combined) and have no peer-dep conflicts with React 19.

## HTML and styling preservation

`renderEmail.ts` is untouched. The toolbar and insert bars are styled with classes that exist only inside the `.preview-canvas` scope and are never emitted to the exported HTML. The DnD wrappers (`setNodeRef` + `transform/transition` styles) only affect the canvas-side preview; the renderer emits sections in store order without any DnD attributes.

## Accessibility

- Each toolbar button has an `aria-label` (`"Drag to reorder section"`, `"Duplicate section"`, `"Delete section"`).
- The grip is keyboard-reachable; @dnd-kit's `KeyboardSensor` with `sortableKeyboardCoordinates` provides space-to-pick-up / arrow-to-move / space-to-drop / escape-to-cancel.
- The insert bar's `+` button has `aria-label="Add section"` and is in the `Tab` order in Edit mode.
- The confirmation dialog is the existing accessible `confirmDialog` modal.

## Performance

- @dnd-kit doesn't re-render non-active sortables during a drag; only the active one and the over target update.
- Toolbar visibility is pure CSS (`:hover { opacity: 1 }`); no JS listeners per section.
- `reorderSections` is a single `set()` call producing a new sections array — same shape as today's `moveSection` swap.

## Error handling

- Deleting the last section is allowed (see "No-section state" above). The render path handles `sections.length === 0` cleanly.
- Dropping a section on itself is a no-op (guarded in `onDragEnd`).
- Duplicating a section that doesn't exist (race with delete) is a no-op.

## Testing

### Unit (Vitest)

**Store**
- `addSection(atIndex)` inserts at the given index.
- `addSection()` (no argument) appends to the end.
- `duplicateSection(id)` inserts a deep copy with a fresh id immediately after the source.
- `duplicateSection('nonexistent')` is a no-op.
- `reorderSections(next)` replaces the array.

**`SectionToolbar`**
- Renders three buttons with the correct aria labels.
- Clicking the duplicate button calls `duplicateSection` with the section id.
- Clicking the delete button opens the confirm dialog; confirming calls `removeSection`.
- Mode-aware: returns null in preview.

**`SectionInsertBar`**
- Renders a button with aria-label "Add section".
- Clicking calls `addSection(atIndex)`.
- Returns null in preview.

### Manual smoke test

- Hover a section → toolbar fades in at the top-right.
- Click the duplicate button → identical copy appears immediately below.
- Click the delete button → confirmation dialog appears → confirm → section disappears.
- Hover above/below a section → `+` button appears → click → a fresh blank section appears at that position.
- Grab the grip → drag the section over another section → drop → order updates; sidebar reflects the new order.
- Same flow with keyboard: Tab to grip, Space, ArrowDown, Space.
- Undo (`Cmd/Ctrl+Z`) after each operation restores the previous state.
- Switch to Preview mode → all toolbars and insert bars disappear; canvas renders sections without any editing chrome.
- Delete every section → the canvas shows only header and footer plus the single insert bar; clicking it adds the first section back.

## Out of scope (deliberate) — revisit later

These were considered and explicitly deferred. They are recorded here so they remain visible in the spec tree and can be picked up as separate designs.

- **Drag-and-drop bullet reordering inside a section.** Same `@dnd-kit/sortable` infrastructure applies. Skipped in this PR to keep scope tight; revisit once section DnD is in production.
- **Cross-project section clipboard.** Copy a section in one project, paste it into another. Requires a small per-user clipboard store (likely Supabase-backed) and a paste affordance on the canvas. Raised by management; tracked separately.
- **Multi-select section operations.** Shift-click to select multiple sections, then duplicate/delete/move as a batch. Useful for power users; not blocking v1 of this feature.
- **FLIP-style reorder animation.** @dnd-kit's drag transform is sufficient; a full FLIP animation on every change (including non-drag duplicates / inserts) would feel nicer but is a polish concern.
- **Section templates / presets.** "Insert section: testimonial / pricing / feature grid" — would replace the current "blank section" insert with a small picker. Requires a template schema and design work; tracked as a v3 idea.
- **Drag-and-drop section reordering on touch devices.** @dnd-kit's `PointerSensor` covers touch out of the box, but the UX of touching a tiny grip on a phone is unproven. May want a long-press affordance or a dedicated mobile reorder mode. Punt until we have mobile traffic.
- **Inline preview during DnD of the destination layout.** Sections alternate image-left / image-right based on index parity. Dragging changes parity for some sections. The drag preview shows them in their pre-drop position; we accept this for now.
- **Confirmation toggle.** A user setting to skip the delete confirmation. Could live in workspace settings later if users find the dialog tedious.

None of these block this design. Each can become its own spec when prioritised.
