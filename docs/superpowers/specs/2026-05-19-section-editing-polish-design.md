# Section Editing Polish: Bullet DnD, Multi-Select, Motion, Touch

**Date:** 2026-05-19
**Status:** Approved for implementation
**Follows:** [`2026-05-19-structural-section-editing-design.md`](./2026-05-19-structural-section-editing-design.md)

## Problem

The structural-editing pass that just shipped lets users add, duplicate, delete, and drag-reorder whole sections on the canvas. Four follow-ups were deliberately deferred and are now blocking ongoing work:

- **Bullet reordering** is still text-only (Backspace-merge / Enter-split). Users can't reorder bullets without retyping.
- **Multi-section operations** require repeating the same click N times — common when removing several unused sections or duplicating two adjacent sections together.
- **Reorder feels janky** outside of an active drag. Duplicates, inserts, and deletes pop into place with no transition.
- **Touch / tablet** users accidentally trigger drags when tapping to edit, because the grip handles are tiny and the activation is purely distance-based.

This pass addresses all four in one release because they share the existing `@dnd-kit` infrastructure and the section-toolbar pattern.

## Goals

- Drag-and-drop reordering of bullets within a section, including keyboard support.
- Cmd/Ctrl+click and Shift+click to multi-select sections; bulk Duplicate / Delete / Move via a floating action bar.
- Smooth motion on every non-drag section operation (insert, delete, duplicate, multi-move).
- Touch-friendly drag handles and an activation delay that doesn't fight tap-to-edit.
- All affordances hide cleanly in Preview mode.

## Non-goals (this PR)

- Cross-project section clipboard (still on the deferred list).
- Section templates / presets (still on the deferred list).
- Lasso (drag-rectangle) selection.
- Visual preview of post-drop layout (image-left / image-right parity) during drag.
- Workspace setting to skip the delete confirmation dialog.
- Multi-edit of section fields (e.g. set background color on multiple sections at once).

## UX

### A. Bullet drag-and-drop

Inside each section's `<EditableBulletList>`, every bullet `<li>` grows a small `GripVertical` icon as the first child. The grip is hidden by default and fades in on hover of its `<li>`. The cursor over the grip is `grab` / `grabbing`. The grip is the **only** drag handle — clicking inside the bullet text continues to focus the contentEditable as it does today.

Drag → drop → bullet order updates. The store path is the existing `onChange(next)` callback supplied by `PreviewBody` (`setSection(id, { bullets: next })`).

Keyboard support comes free from `@dnd-kit`'s `KeyboardSensor` + `sortableKeyboardCoordinates`:

- `Tab` to a grip, `Space` to pick up.
- `↑` / `↓` to move.
- `Space` to drop, `Escape` to cancel.

In Preview mode no grip is rendered and the list is non-interactive.

### B. Multi-select sections

**Selection state** lives in a new `SectionSelectionProvider` context, mounted inside `EditorModeProvider` so changing modes wipes the selection.

```ts
interface SectionSelectionContextValue {
  selected: Set<string>;                               // section ids
  anchorId: string | null;                             // last toggled id for range selection
  toggle(id: string, modifier: 'single' | 'range'): void;
  clear(): void;
  isSelected(id: string): boolean;
}
```

**Selection rules:**

- **Cmd/Ctrl+click** on a section gutter → call `toggle(id, 'single')`. If the id is in `selected`, remove it; otherwise add it. Sets `anchorId = id`.
- **Shift+click** on a section gutter → call `toggle(id, 'range')`. If `anchorId` is null, behaves like single. Otherwise selects every section between `anchorId` and `id` inclusive, replacing any prior selection.
- **Click on empty canvas area** (outside any section) → `clear()`.
- **Escape** anywhere on the canvas → `clear()`.
- **Mode switch to Preview** → `clear()` (handled inside the provider via a `useEffect` watching `useEditorMode()`).
- **Plain click on a section gutter** (no modifier) → no-op for selection. The plain click continues to do nothing structural; it lets editing keep working.

**Selection visual:** when a section is selected, its `.section-wrap` gains a `.selected` modifier class that applies a 2px brand-color outline (`outline: 2px solid var(--color-brand)`) with `outline-offset: -2px` so it sits inside the section bounds without affecting layout.

**Click target:** the modifier-click target is the section wrapper itself (`.section-wrap`), NOT the inner editable elements. We attach the click handler via React `onMouseDown` on `section-wrap`, then guard:

```ts
function onSectionMouseDown(e: React.MouseEvent) {
  if (mode === 'preview') return;
  if (!(e.metaKey || e.ctrlKey || e.shiftKey)) return;  // plain click → noop
  e.preventDefault();                                     // suppress text selection
  const modifier = e.shiftKey ? 'range' : 'single';
  toggle(s.id, modifier);
}
```

This guarantees the modifier-click never triggers contentEditable focus (because `preventDefault` stops the default mousedown chain), and plain clicks pass through to the existing edit affordances.

**Floating action bar.** When `selected.size > 0`, render a fixed pill toolbar centered at the bottom of the canvas pane:

```
[ N selected ]   ⧉ Duplicate   ✕ Delete   ↑ Move up   ↓ Move down   |   ✕ Clear
```

- `Duplicate` calls `duplicateSection(id)` for each selected id in document order. Each duplicate is inserted right after its source — same behavior as the per-section button.
- `Delete` opens a single confirmation dialog (`Delete N sections?`). On confirm, iterates the selected ids and calls `removeSection(id)` for each. After deletion, selection clears.
- `Move up` calls `moveSection(id, 'up')` for each selected id in document order — visit forward so each move sees the next element where expected.
- `Move down` calls `moveSection(id, 'down')` for each selected id in **reverse** document order so the bottom-most moves first and the others don't collide.
- `Clear` calls `clear()`. The same as Escape.

The bar respects Preview mode (renders nothing).

### C. Motion on non-drag operations

Each `SortableSection` becomes a `motion.div layout transition={{ duration: 0.18, ease: 'easeOut' }}`. The whole sections list is wrapped in `<AnimatePresence initial={false}>` so:

- Duplicates fade in and slide into place.
- Deletes fade out and shrink to zero height before disappearing.
- Drag-end reorders use the existing `@dnd-kit` transform during drag; the `layout` prop kicks in after the drop to settle smoothly.
- Multi-section moves animate as a group.

`AnimatePresence` is used in `popLayout` mode to avoid jumpy heights as items leave.

### D. Touch DnD polish

Replace the single `PointerSensor` in `PreviewBody` (and add similarly to `EditableBulletList`) with two sensors:

- `MouseSensor` with `activationConstraint: { distance: 4 }` — desktop unchanged.
- `TouchSensor` with `activationConstraint: { delay: 250, tolerance: 5 }` — touch users must long-press for 250 ms (with up to 5 px tolerance) before drag begins. Short taps still hit the underlying button to open edit popovers / focus contentEditable.

Drag handle hit targets grow:

- Grip icon stays 14 px visual.
- Button padding grows from `p-1` (4 px) to `p-1.5` (6 px), giving the handle a ~26 × 26 px hit area. With `min-w-[28px] min-h-[28px]` it meets Apple's HIG recommendation.

Bullets get the same treatment — even though most touch users won't reorder bullets often, the same `TouchSensor` configuration applies once the DnD context wraps the list.

## Architecture

### `SectionSelectionProvider`

New file `src/components/editor/SectionSelectionProvider.tsx`. Standard React context plus `useState<Set<string>>` and `useState<string | null>` for the anchor. A small internal `useEffect` listens for `Escape` keydown on `document` while there's a selection, and for `useEditorMode()` mode changes to clear.

Mount in `EditorShell.tsx` inside `EditorModeProvider` (which it must be inside) and outside `AssetPickerProvider`.

### `SelectionActionBar`

New file `src/components/editor/canvas/SelectionActionBar.tsx`. Reads `useSectionSelection()` and `useEditorStore()`. Returns `null` if `selected.size === 0` or `mode === 'preview'`. Renders the fixed-position toolbar described above. Uses `confirmDialog` for the bulk-delete confirm. Renders inline lucide icons.

### Selection wiring in `PreviewBody`

The `SortableSection` wrapper grows two responsibilities: render the `section-wrap` with `data-selected={isSelected(s.id)}` and `onMouseDown={onSectionMouseDown}`. The `.selected` outline lives in `globals.css`.

The clear-on-empty-canvas behavior attaches to the outer `.preview-canvas` `<div>`'s `onMouseDown` — if `e.target === currentTarget`, call `clear()`. The provider already handles `Escape`.

### Bullet DnD in `EditableBulletList`

`EditableBulletList.tsx` already manages `bullets` as a string array. Add:

- A `useSensors` setup like the section one (Mouse + Touch + Keyboard).
- A new `BulletSortableItem` sub-component wrapping each `<li>` with `useSortable({ id: \`${ariaLabel}::${i}\` })` — the id is synthetic but stable per list+index. Important: when bullets are reordered, the *array order* is what's authoritative; the id mapping shifts naturally because we re-derive `items` from the new array on the next render.
- A grip button rendered as the first child of each `<li>`, with `dragAttributes` / `dragListeners` from `useSortable`.
- `onDragEnd` calls `onChange(arrayMove(bullets, oldIndex, newIndex))`.

Crucially, the existing Enter/Backspace handlers continue to live on the `<li>` keydown — `@dnd-kit`'s listeners are on the grip button only, so typing in the bullet's `EditableText` is unaffected. Focus restoration after split/merge still works because it queries `ul.children[idx]`.

### Mode awareness

All new affordances (grips, selection outlines, action bar) consult `useEditorMode()` and return `null` (or the no-op render path) in `preview`. The existing section toolbar / insert bars already do this.

### Sensor consolidation

A small helper `useDragSensors()` at `src/components/editor/canvas/useDragSensors.ts` returns the standard sensor tuple. Both `PreviewBody` (section DnD) and `EditableBulletList` (bullet DnD) call it. Keeps the constants in one place.

```ts
export function useDragSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}
```

Replaces the existing inline sensor declaration in `PreviewBody`.

### Motion

Already a dep (`motion/react`). The change is structural:

- `SortableSection` wraps its existing `<div>` in `<motion.div layout transition={...}>` (the `setNodeRef` moves to the motion.div via its `ref` prop).
- The sections map gets wrapped in `<AnimatePresence initial={false} mode="popLayout">`.
- Each `motion.div` gets `initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}`.

### Selection invariants

- Selection set only contains ids that currently exist in `data.sections`. When a section is removed via any path (single delete, bulk delete, undo erasing a section), the provider runs a `useEffect` over `useEditor((s) => s.data.sections)` and prunes the set.
- `anchorId` is also pruned if its section is gone.

## Data flow

No new schema. No new endpoints. Existing store actions cover every operation. The selection set lives only in client memory; it is not persisted.

## Accessibility

- Bullet grips are real `<button>`s with `aria-label="Drag to reorder bullet"`. Keyboard reorder works via `@dnd-kit`.
- The floating selection action bar buttons each have `aria-label`s ("Duplicate selected sections", "Delete selected sections", "Move selected sections up", "Move selected sections down", "Clear selection").
- The selection outline (`outline: 2px solid var(--color-brand)`) doubles as a visual focus indicator; `aria-pressed` on the section's `section-wrap` isn't possible because it's a `<div>`, so we rely on the outline plus a `data-selected="true"` attribute for assistive tech that supports state queries.
- Escape and the explicit Clear button both have clear semantics.

## Performance

- Selection state changes re-render only `PreviewBody` (which is small) plus the `SelectionActionBar`. The per-section visual update is a class flip, no layout work.
- `<motion.div layout>` is FLIP-based — it only animates when the bounding rect actually changes. Inactive sections during a drag don't run animations until drop.
- The touch sensor's 250 ms delay doesn't add latency to taps — it only delays the start of a drag.

## Error handling

- Bulk delete with selection that spans the entire section list works (and degenerates to the 0-section state already handled in `PreviewBody`).
- Move up on the topmost section is a no-op for that id; the others still move. Same for Move down.
- Dragging a bullet onto itself is a no-op (guarded in `onDragEnd`).

## Testing

### Unit (Vitest + @testing-library/react)

**Bullet DnD**
- `EditableBulletList` renders a grip button per bullet (in edit mode).
- Grip renders nothing in preview mode.
- Calling the internal `onDragEnd` with valid `active`/`over` events calls `onChange(arrayMove(...))`.

**`SectionSelectionProvider`**
- Defaults: `selected.size === 0`, `anchorId === null`.
- `toggle(id, 'single')` toggles set membership; updates anchor.
- `toggle(id, 'range')` selects the inclusive range from anchor to id.
- `clear()` empties the set and resets anchor.
- Mode change to `preview` clears selection.
- Pruning: removing a section from `data.sections` removes that id from `selected`.

**`SelectionActionBar`**
- Renders nothing when selection is empty.
- Shows the count.
- Duplicate button calls `duplicateSection` once per id in order.
- Delete button awaits `confirmDialog` and calls `removeSection` per id only on confirm.
- Move up / Move down call `moveSection` per id in the right traversal order.

**Motion + Touch polish:** smoke-only — verified in the manual test (no jsdom-realistic motion testing).

### Manual smoke

- In a multi-section project, hover a bullet → grip fades in.
- Drag a bullet up/down within the section → order updates; sidebar reflects nothing here (bullets are section-internal).
- Cmd/Ctrl+click two non-adjacent sections → both outline; floating bar appears; count is "2 selected".
- Shift+click a third section → range fills in.
- Click Duplicate → all selected sections duplicated. Selection persists on the originals (not the copies).
- Click Delete → confirm "Delete 3 sections?" → yes → all gone; Cmd+Z brings them back; selection cleared.
- Click Move up / Move down → group migrates by one position.
- Click empty canvas (outside any section) → selection clears.
- Press Escape → selection clears.
- Toggle to Preview → all outlines and the action bar disappear.
- On an iPad (or touch-emulation devtools), tap a section CTA → it opens an edit popover. Long-press the grip → drag works.

## Out of scope (still deferred — revisit later)

Recorded again so they remain visible.

- **Cross-project section clipboard.** Copy a section in one project, paste in another. From the manager's email. Separate spec needed.
- **Section templates / presets.** "+ Add" becomes a chooser: Blank / Testimonial / Pricing / Feature grid. Needs a template schema.
- **Lasso selection.** Drag-rectangle on empty canvas to select multiple sections. Powerful but easy to trigger accidentally — skipped.
- **Inline preview of post-drop layout during drag.** Sections alternate image-left / image-right based on parity; the drag preview shows pre-drop position. Skipped.
- **"Skip confirmation" workspace setting.** Lets owners bypass the delete dialog. Easy to add later in workspace settings.
- **Multi-edit of section fields.** With sections selected, expose a small batch-edit panel (background color, button color, etc.) in the sidebar. Useful for branded campaigns.
- **Drag-to-clone.** Hold Option/Alt while dragging a section to duplicate-at-target. Niche.
- **Bullet copy/paste between sections.** Cut/paste of bullets across sections. Same idea as section clipboard but for bullets.

None of these block this design.
