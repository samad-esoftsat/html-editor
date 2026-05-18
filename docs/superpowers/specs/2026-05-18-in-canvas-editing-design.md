# In-Canvas Editing for Text and Images

**Date:** 2026-05-18
**Status:** Approved for implementation

## Problem

All editing today happens in the left sidebar. To change a title, the user must locate the right panel (Header / a specific section / Footer), expand it, find the title input, and type. The visual location of the text on the canvas and the input field on the sidebar are physically apart. This is the single biggest piece of friction in the editor.

Adjacent tools (Notion, Canva, Figma, Webflow) let users click text on the canvas and type. We want that.

## Goals

- Click any visible text on the canvas to edit it in place.
- Click any image to swap it via the existing asset picker.
- Keep the sidebar for the things that have no direct on-canvas representation: colors, font sizes, section style overrides, URLs that aren't visible as text, and structural operations (add/remove/reorder sections).
- Preserve all current autosave, history (undo/redo), and validation behavior.

## Non-goals

- Replacing or removing the sidebar.
- Floating rich-text formatting toolbar (bold, italic, color picker per character).
- Drag-and-drop section reordering on the canvas.
- Inline editing for section style overrides (font sizes, button colors, section background).
- Adding, deleting, or reordering sections directly from the canvas.

## UX

### Affordances

- **Hover** on any editable text or image: a 1px outline in the brand color at low opacity (`border-brand/40`), plus a cursor change — I-beam over text, pointer over images.
- **Active / focused** (text being edited): outline becomes solid brand color.
- **Empty text fields**: a low-opacity placeholder string ("Click to add title…") is rendered in place. The placeholder is purely visual and is not part of the data model. It vanishes the instant the user focuses the element.

### Text editing

- Click any editable text → cursor lands where the user clicked. Type to edit.
- **Enter** on a single-line field (header title, section title, CTA text, etc.) commits the value and blurs.
- **Enter** in a bullet creates a new bullet immediately below; focus moves to the new bullet.
- **Backspace** at the start of an empty bullet removes that bullet and merges focus into the previous bullet's end.
- **Escape** reverts the field to its last committed value and blurs. Nothing is saved.
- **Blur** commits the current value.
- **Paste** is intercepted: only `clipboardData.getData('text/plain')` is inserted. Formatting, HTML, and styles are stripped.

### Image editing

- Click any image (or any placeholder, for an empty image field) → the existing asset picker modal opens. The user uploads, picks from the library, or generates a new image.
- On confirm: the canvas updates immediately via the existing store setter.
- Alt text is NOT inline-editable in v1 (stays in the sidebar). Adding alt text directly under the image in a focusable caption is a reasonable follow-up.

### Sidebar coexistence

The sidebar continues to render and edit the same fields. Both surfaces are bound to the same Zustand state — a change in either updates the other in real time. The sidebar is the canonical place for fields that have no on-canvas representation (colors, font sizes, style overrides, contact URLs, social URLs, website URLs).

## Architecture

### Iframe removal

`src/components/editor/Preview.tsx` currently wraps `<PreviewBody>` in an iframe via a React portal. Replace it with:

```tsx
export function Preview() {
  return (
    <div className="w-full h-full overflow-auto bg-white">
      <PreviewBody />
    </div>
  );
}
```

`PreviewBody` already renders its own React tree with inline styles — there is no external stylesheet that would leak into the editor chrome. Dropping the iframe means:

- contentEditable works directly with the parent React tree.
- Hover/active outlines and any future overlays use simple absolute positioning, no `iframe.contentDocument` or `getBoundingClientRect` gymnastics.
- The existing global modals (asset picker, confirm dialog, prompt dialog) mount where they already do and need no changes.

### New primitives

Three small, reusable components in `src/components/editor/editable/`:

**`EditableText.tsx`**

```ts
interface EditableTextProps {
  value: string;
  onChange: (next: string) => void;
  singleLine?: boolean;       // Enter commits and blurs; default true
  placeholder?: string;       // displayed when value === ''
  ariaLabel: string;
  className?: string;
  style?: React.CSSProperties;
}
```

Renders a `contentEditable` element styled to match the surrounding text (the wrapping element supplies size/color/font; this component only adds focus/hover styles). Tracks the committed value via a ref; updates the DOM `textContent` only when the external `value` changes AND the element is not focused. On focus, mounts a draft state; on blur/Enter, fires `onChange(draft)` if the draft differs from the committed value. On Escape, restores the DOM to the committed value and blurs.

**`EditableBulletList.tsx`**

```ts
interface EditableBulletListProps {
  bullets: string[];
  onChange: (next: string[]) => void;
  itemStyle?: React.CSSProperties;
  ariaLabel: string;
}
```

Renders a `<ul>` with one `<li>` per bullet, each wrapping an `<EditableText singleLine={false}>`. Keyboard handling at the list level:

- Enter inside a bullet: split the bullet at the caret position, insert a new bullet after the current one, focus the new bullet at offset 0.
- Backspace at the start of a bullet: if the bullet is empty, remove it and focus the previous bullet at its end; if non-empty, merge into the previous bullet (concatenate text), focus at the join point.
- Arrow Up/Down at the start/end: move focus to the adjacent bullet.

Focus management uses a ref array; new-bullet creation and merges adjust focus in a `useLayoutEffect` after the state update.

**`EditableImage.tsx`**

```ts
interface EditableImageProps {
  value: string;             // image URL, '' for empty
  onChange: (next: string) => void;
  alt: string;
  placeholderLabel: string;  // e.g. "Logo image - click to add"
  placeholderWidth?: number;
  placeholderHeight?: number;
  style?: React.CSSProperties;
}
```

If `value` is set: renders an `<img>` with the hover-outline class and an onClick that opens the asset picker. If empty: renders the existing `PlaceholderImg`-style div, also clickable. The asset picker is the existing one from the editor; this component just calls a context-provided "open picker" function with an `onSelect` callback that fires `onChange(url)`.

### Wiring the asset picker

The asset picker is currently invoked from `src/components/editor/AssetPickerButton.tsx`. Move the picker-open logic into a small React context (`AssetPickerProvider`) that:

- Wraps the editor shell.
- Exposes `openAssetPicker({ onSelect }): void` via context.
- Mounts a single `AssetPicker` modal at the provider level; the modal listens for `onSelect` from whichever caller opened it.

This avoids each `EditableImage` mounting its own picker instance and matches the singleton pattern used by `ConfirmDialog`/`PromptDialog`.

### Restructured `PreviewBody`

`PreviewBody` is updated so every text node and image is wrapped in the appropriate primitive. Wiring is straightforward: each editable element imports the relevant setter from the store. Example for `header.title`:

```tsx
<EditableText
  value={data.header.title}
  onChange={(v) => store.getState().setHeader({ title: v })}
  singleLine
  placeholder="Click to add a title…"
  ariaLabel="Header title"
  style={{ fontSize: data.header.titleFontSize, color: g.textColor, fontWeight: 400 }}
/>
```

### Full list of editable elements

| Field | Primitive | Notes |
|---|---|---|
| `header.logoSrc` | `EditableImage` | Width from `header.logoWidth` |
| `header.title` | `EditableText` single-line | Header `<h1>` |
| `header.bannerSrc` | `EditableImage` | Full-width banner |
| `header.sectionHeading` | `EditableText` single-line | `<h3>` between banner and sections |
| `sections[].title` | `EditableText` single-line | Section `<h1>` |
| `sections[].imageSrc` | `EditableImage` | 355px max-width |
| `sections[].bullets` | `EditableBulletList` | Per-bullet editing + Enter/Backspace |
| `sections[].ctaText` | `EditableText` single-line | Inline button label |
| `footer.bannerSrc` | `EditableImage` | Full-width banner |
| `footer.companyName` | `EditableText` single-line | Bold paragraph |
| `footer.address` | `EditableText` multiline | Preserves `\n` |
| `footer.phone` | `EditableText` single-line | Display text (phoneTel URL stays in sidebar) |
| `footer.email` | `EditableText` single-line | Email address — see "Linked text fields" below |
| `footer.websites[].label` | `EditableText` single-line | One editable text per website |

**Linked text fields:** `footer.phone` and `footer.email` are rendered inside `<a>` tags with `href` derived from other fields (`phoneTel`, `email`). The editable text on the canvas updates the display text; the `href` is regenerated by `renderEmail` from the same field. For `footer.email` the display IS the URL — editing the display also updates the `mailto:` link. For `footer.phone`, the display string and the dial string (`phoneTel`) are separate; the canvas edits the display only.

### Non-editable on the canvas (stays in sidebar)

- All colors, font sizes, font family, font weights.
- Section-level style overrides.
- `header.logoAlt`, `header.bannerAlt`, `sections[].imageAlt`, `footer.bannerAlt` (alt text).
- `footer.phoneTel` (dial string).
- `footer.websites[].url`, `footer.socials[].url`, `global.contactUrl`.
- Section add/remove/reorder.

## Data flow

Edit on the canvas → `EditableText` calls `onChange(value)` → store setter mutates Zustand state → autosave debounce triggers → server persists → state is also reflected in the sidebar inputs (already bound to the same store).

No new API routes. No new endpoints. No schema change. The store setters that already exist (`setHeader`, `setSection`, `setFooter`, etc.) are reused unchanged.

## HTML and styling preservation

`renderEmail` is untouched. The canvas in the editor and the rendered email HTML are independent renderings of the same data model. As long as the store correctly reflects user edits, the exported HTML is unchanged in structure — only the text content updates.

The new primitives apply hover/focus styles via class names that exist only in the editor's preview scope. None of those classes appear in `renderEmail`'s output.

## Accessibility

- Each editable element has an `aria-label` describing what it edits ("Header title", "Section 1 title", "Section 1 bullet 2", "Footer address").
- contentEditable elements implicitly get `role="textbox"`. Multi-line variants get `aria-multiline="true"`.
- Empty placeholder text uses `aria-placeholder` so screen readers announce it.
- Focus order follows document order: header fields, then section by section, then footer.
- Escape, Enter, Tab, and arrow keys behave the way assistive tech users expect.

## Performance

- Each editable element holds its own draft state internally during editing. The store is only updated on commit (Enter / blur), not on every keystroke. This avoids re-rendering the entire `PreviewBody` for every keypress.
- The bullet list's keyboard handling adjusts state in batches (e.g. one state change per Enter, not per character).
- No measurable change in autosave traffic — the existing debounce was already coarser than per-keystroke.

## Error handling

- contentEditable does not produce errors in normal use. Paste sanitization is best-effort: if `getData('text/plain')` returns empty (e.g. user pasted an image), the default paste is prevented and nothing happens.
- AssetPicker errors (upload fail, generation fail) are already handled by the existing modal — no new error surface.

## Testing

### Unit (Vitest + @testing-library/react)

**`EditableText`:**
- Renders `value` as `textContent`.
- Typing in the contentEditable updates an internal draft; the store is NOT updated until blur/Enter.
- Enter on a single-line field calls `onChange` with the current draft.
- Escape reverts the DOM to the committed value and does not call `onChange`.
- Paste with HTML clipboard content inserts only the plain-text fallback.
- Empty `value` renders the placeholder string; the placeholder is invisible to the store.

**`EditableBulletList`:**
- Enter inside a non-empty bullet splits at caret, inserts new bullet, focuses it.
- Backspace at the start of an empty bullet removes it and focuses the previous bullet at its end.
- Backspace at the start of a non-empty bullet merges into the previous bullet (concat).
- Arrow Up/Down at the boundary moves focus to the adjacent bullet.

**`EditableImage`:**
- Renders an `<img>` when `value` is set.
- Renders the placeholder when `value` is empty; placeholder is clickable.
- Click triggers `openAssetPicker` with an `onSelect` that calls `onChange`.

### Manual smoke test

- Hover every text and image on a sample project; outline + cursor change appears.
- Click and type into the header title, a section title, a bullet, the CTA, the footer fields.
- Add and remove bullets via Enter and Backspace.
- Click an image; the asset picker opens; selecting an asset updates the canvas.
- Click an empty image placeholder; same behavior.
- Edit a field in the sidebar; the canvas reflects the change immediately.
- Edit a field on the canvas; the sidebar reflects the change immediately.
- Trigger autosave; reload the project; edits persist.
- Undo/redo works for canvas-originated edits.

## Out of scope (deliberate)

Documented as future follow-ups so they're visible in the spec but not built in v1:

- **Floating formatting toolbar on text selection.** Bold, italic, color, link — would let users style mid-paragraph from the canvas. Real engineering: rich text means parsing HTML, mapping back to a richer schema, and preserving the email-renderer's existing escape behavior.
- **Drag-and-drop section reordering on the canvas.** Drag a section by a handle to a new position. Replaces the sidebar's up/down arrows for power users.
- **Inline section style overrides.** A small contextual toolbar that appears next to a selected section: font size, button color, section background. Replaces the "Section style overrides" panel in the sidebar.
- **Add/remove sections from the canvas.** A "+ Add section" target between sections, and a delete button on hover of a section's gutter.
- **Inline alt text editing.** A small toggle below each image to edit alt text without going to the sidebar.
- **Direct manipulation of phone/website URLs from the canvas.** A small popover next to the text shows the URL field. Currently those edits live only in the sidebar.
- **Editor mode toggle ("View" vs "Edit").** A topbar toggle that hides all editing affordances for a clean preview while reviewing.
- **Hide or remove the sidebar.** Once enough lives on the canvas, the sidebar shrinks or becomes a collapsible drawer. This is the long arc of "simplify the UX."
- **Drag-and-drop reordering of bullets within a section.** Today bullets only reorder via the sidebar control; in-canvas drag would be natural.
- **Section reuse across projects ("section clipboard").** Separate feature, already raised by the manager — covered by a different design.

These are all worth doing eventually. None of them are required for this design to deliver value.
