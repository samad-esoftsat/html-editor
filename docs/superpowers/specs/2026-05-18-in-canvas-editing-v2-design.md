# In-Canvas Editing v2: Mode Toggle, Inline Alt Text, Inline URLs

**Date:** 2026-05-18
**Status:** Approved for implementation
**Follows:** [`2026-05-18-in-canvas-editing-design.md`](./2026-05-18-in-canvas-editing-design.md)

## Problem

The v1 in-canvas editing feature shipped click-to-edit for visible text and click-to-replace for images, but three follow-ups were deliberately deferred:

- No way to preview the email without the editing affordances getting in the way.
- Alt text is editable only in the sidebar even though the image lives on the canvas.
- URLs (CTA, website, social, phone) are editable only in the sidebar even though the elements they belong to are on the canvas.

The original spec listed each of these as a separate future improvement. This design bundles them into one v2 release because they share infrastructure (a global editor-mode context, a hover-and-click pattern) and ship cleanly together.

## Goals

- A topbar toggle that switches the canvas between an editable surface and a clean preview.
- Click-to-edit alt text under each image, without leaving the canvas.
- Click-to-edit URL for each link on the canvas (CTA, website, social, phone), without leaving the canvas.

## Non-goals

- Persisting the Preview mode choice across reloads.
- A new schema field that decouples the displayed email from the `mailto:` target.
- Editing the social platform identity (Facebook / LinkedIn / etc.) from the canvas.
- URL format validation. The text the user enters is stored verbatim, matching today's sidebar behavior.

## UX

### View / Edit toggle

A segmented control sits in the topbar to the right of the project title:

```
[ Edit | Preview ]
```

- Default is `Edit`. Switching is purely visual state on the editor shell; nothing is persisted.
- In `Preview` mode the canvas renders the email as it will appear in the recipient's inbox: no hover outlines, no contentEditable, no chain-link icons, no alt captions. Anchors are live — clicking the CTA actually navigates.
- In `Edit` mode the canvas behaves exactly as today (with the new alt and URL affordances added).
- The sidebar is always interactive, in both modes.

The toggle is reachable by keyboard (`Tab` order in the topbar) and announces "Edit mode" / "Preview mode" via `aria-pressed`.

### Inline alt text

Each editable image grows a small caption strip directly below it:

```
[ image ]
Alt: Header banner showing the product
```

- Rendered only in `Edit` mode.
- **Hidden by default**, fades in when the user hovers either the image or the strip itself. Stays visible while focused (being edited) regardless of hover, blurs commit the value back to the store.
- The strip itself is an `EditableText singleLine` styled as 12px muted text. Placeholder when empty: `Alt: click to add`.
- Applies to every `EditableImage` on the canvas: `header.logoAlt`, `header.bannerAlt`, `sections[i].imageAlt`, `footer.bannerAlt`.

### Inline URL editing

A new `EditableLink` primitive renders a chain-link icon (`Link` from `lucide-react`). Clicking the icon opens a small popover anchored to it with one `URL` input plus `Save` / `Cancel`:

- `Enter` in the input commits and closes.
- `Escape` in the input cancels and closes.
- Click outside closes without saving.
- `Save` writes through to the bound store field.

Visibility rules:

- For URL icons attached to **text** (CTA text, website label, phone display): appear on hover of the parent text. Hidden otherwise.
- For URL icons attached to **social icons** (which have no visible text label): **always visible in Edit mode**, overlaid on the corner of the social icon. Hidden in Preview mode.

Wired at:

| Field | Trigger | Visibility |
|---|---|---|
| `sections[i].ctaUrl` | Chain icon next to CTA button text | Hover |
| `footer.websites[i].url` | Chain icon next to each website label | Hover |
| `footer.socials[i].url` | Chain icon overlaid on the social icon | Always visible in Edit |
| `footer.phoneTel` | Chain icon next to phone display text | Hover |

**`footer.email` is intentionally skipped.** The `email` field is both the display text on the canvas and the `mailto:` target — editing the canvas text already updates the link.

## Architecture

### EditorMode context

New file `src/components/editor/EditorModeProvider.tsx`:

```ts
type EditorMode = 'edit' | 'preview';
interface EditorModeContextValue {
  mode: EditorMode;
  setMode: (mode: EditorMode) => void;
}
```

Provider holds the mode in `useState('edit')`. `useEditorMode()` returns `{ mode, setMode }`.

Mounted in `EditorShell.tsx` inside `RoleProvider` and outside `AssetPickerProvider`. Both providers are independent.

### Topbar toggle

A small segmented control component (or two adjacent buttons) reading `useEditorMode()`. Renders only when the current user `canEdit`; viewers stay in the default Preview-like view anyway.

```tsx
<button aria-pressed={mode === 'edit'} onClick={() => setMode('edit')}>Edit</button>
<button aria-pressed={mode === 'preview'} onClick={() => setMode('preview')}>Preview</button>
```

Styled to match the existing topbar buttons.

### Mode-awareness in the existing primitives

`EditableText`, `EditableBulletList`, and `EditableImage` already exist. They each read `useEditorMode()`:

- `EditableText` — in `preview` mode, returns the value as plain text inside the supplied `as` tag (default `span`), with no contentEditable, no event handlers, no editable class.
- `EditableBulletList` — in `preview` mode, returns a plain `<ul><li>...</li></ul>` with the bullets as static text. No keyboard handlers, no focus management.
- `EditableImage` — in `preview` mode, returns the `<img>` as-is (no `onClick`, no hover class). When `value` is empty, renders nothing (instead of the placeholder button).

Anchors in `PreviewBody` likewise consult the mode: in Edit they call `e.preventDefault()` on click; in Preview they leave default behavior intact.

### `EditableImage` API additions

```ts
interface EditableImageProps {
  // existing
  value: string;
  onChange: (next: string) => void;
  alt: string;
  placeholderLabel: string;
  placeholderWidth?: number;
  placeholderHeight?: number;
  imgStyle?: React.CSSProperties;

  // new
  altLabel?: string;          // aria label for the alt EditableText, e.g. "Header banner alt text"
  onAltChange?: (next: string) => void;
}
```

If `onAltChange` is supplied and we're in Edit mode, the component renders an outer wrapper (`<span class="editable-image-wrap">`) containing the image and the caption strip. Hover behavior is implemented via CSS only (`:hover .alt-strip { opacity: 1 }`), which avoids extra state.

If `onAltChange` is not supplied, the component renders exactly as today (back-compat for callers that don't want alt editing).

### `EditableLink` primitive

New file `src/components/editor/editable/EditableLink.tsx`:

```ts
interface EditableLinkProps {
  value: string;
  onChange: (next: string) => void;
  ariaLabel: string;            // e.g. "Edit section 1 CTA URL"
  alwaysVisible?: boolean;      // default false; true for social icon overlay
  className?: string;           // positioning overrides (e.g. "absolute top-0 right-0")
}
```

Renders a `<button>` with the lucide `Link` icon. On click, mounts a small popover (positioned absolutely beside the button) with one `<Input>` plus `Save` / `Cancel`. The popover state is local to the component (no global modal). Clicking outside closes; `Escape` cancels; `Enter` saves.

In `preview` mode the component renders nothing.

### Hover affordance

`EditableText`, `EditableImage`, and `EditableLink` siblings need to react to hover of their *shared* parent (the chain icon appears when the user hovers the text, not just the icon). Easiest path: each wireup wraps both elements in a `<span class="inline-link-wrap">` and the CSS does:

```css
.inline-link-wrap .editable-link-icon { opacity: 0; transition: opacity 100ms; }
.inline-link-wrap:hover .editable-link-icon,
.inline-link-wrap:focus-within .editable-link-icon { opacity: 1; }
```

For the social-icon case (`alwaysVisible`), the icon uses `opacity: 1` permanently in Edit mode.

### PreviewBody wireup

`PreviewBody.tsx` already maps each field to a primitive. The changes are additive:

- Each `EditableImage` receives `onAltChange` plus a small `altLabel`.
- Each location with a URL gets a sibling `EditableLink` inside an `inline-link-wrap` wrapper.
- The anchor `onClick={(e) => e.preventDefault()}` calls become `mode === 'edit' ? (e) => e.preventDefault() : undefined`.

`renderEmail.ts` stays untouched.

## Data flow

Identical to v1. Every new edit writes through an existing store setter:

- Alt text — `setHeader`, `setSection`, `setFooter` already accept the alt fields.
- CTA URL — `setSection({ ctaUrl })`.
- Website URL — `setFooter({ websites: nextArray })`.
- Social URL — `setFooter({ socials: nextArray })`.
- Phone dial string — `setFooter({ phoneTel })`.

No new API routes, no schema changes, no migration.

## HTML and styling preservation

`renderEmail.ts` is untouched. The new alt-caption strip and link icons are styled with classes that only exist inside the preview canvas (`.preview-canvas` scope from the v1 fix). The exported HTML is identical.

## Accessibility

- The View/Edit toggle uses `aria-pressed` to convey current state and is part of the topbar's `Tab` order.
- `EditableLink` icon is a `<button>` with `aria-label` describing what it edits ("Edit section 1 CTA URL").
- The alt-caption `EditableText` uses `aria-label` like "Header banner alt text".
- Preview mode strips `role="textbox"` and `aria-multiline` (because we render plain spans), restoring the email to a non-interactive document.

## Performance

- The mode is a single `useState` at the editor shell level; consumers read via `useContext`. Switching modes re-renders the canvas once. Acceptable: the canvas is small.
- Hover affordances are pure CSS (`:hover`) — no JS listeners per element.
- Popover for `EditableLink` is unmounted when closed; it's not in the React tree by default.

## Error handling

- Bad URLs are stored verbatim (matches today's sidebar behavior). The user is responsible for entering a valid URL. Future work can add URL validation.
- Alt text accepts any string. The renderer escapes it before injecting into HTML — unchanged behavior.

## Testing

### Unit

**`EditorModeProvider`**
- `mode` defaults to `edit`.
- `setMode('preview')` updates context consumers.

**Mode awareness**
- `EditableText` in preview mode renders plain text (no `contenteditable`, no `inline-editable` class).
- `EditableImage` in preview mode renders just `<img>` (no `onClick`, no `inline-editable-image` class).
- `EditableBulletList` in preview mode renders plain `<ul><li>...</li></ul>`.
- `EditableLink` in preview mode renders nothing.

**`EditableLink`**
- Renders an icon button.
- Clicking opens the popover with the current value pre-filled.
- Enter calls `onChange` and closes the popover.
- Escape closes without calling `onChange`.
- Click outside closes without saving.

**`EditableImage` alt strip**
- When `onAltChange` is supplied, the caption strip is rendered.
- The strip is hidden by default (CSS) and visible on hover (verified via class presence; jsdom can't simulate `:hover` style application).
- Typing into the strip and blurring calls `onAltChange`.

### Manual smoke test

- Toggle the topbar between Edit and Preview. In Preview: no hover outlines, no chain icons, no alt captions, clicking the CTA actually navigates.
- Hover an image in Edit mode → alt strip fades in below. Click it, edit, blur → store updates.
- Hover the CTA text → chain icon appears. Click → popover opens, edit URL → Save → store updates.
- Hover a footer website label → chain icon appears. Same flow.
- A social icon shows its chain icon overlay always in Edit mode. Click → popover → edit → Save.
- Hover the phone display → chain icon appears. Click → popover for `phoneTel`.
- Editing alt or URL in the sidebar continues to update the canvas immediately, and vice versa.
- Autosave and undo/redo still cover the new edits.

## Out of scope (deliberate)

These remain on the v3 list:

- Persistent Preview mode (per project or per user).
- Floating formatting toolbar (bold / italic / color / link).
- Drag-and-drop section reordering.
- Inline section style overrides.
- Add/remove sections from the canvas.
- Drag-and-drop bullet reordering.
- A separate `emailMailto` schema field.
