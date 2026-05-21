# Multi-Layout Templates — Design Spec (Phase 2)

**Date:** 2026-05-21
**Author:** Codex (with jlgarcia@esoftsat.com)
**Status:** Approved for plan writing
**Scope:** Phase 2 of the multi-layout email system. Adds three new block types and three new layout templates on top of the Phase 1 block-model foundation.
**Builds on:** `docs/superpowers/specs/2026-05-21-block-model-foundation-design.md` (Phase 1, merged to `main` at `81a40b7` / `0601d36`).

---

## Motivation

Phase 1 generalized `ProjectData` into a typed `blocks[]` array but shipped only three block types — `header`, `product-section`, `footer` — producing the same product-catalog layout as before. Phase 2 introduces **Hero**, **Article**, and **CTA Banner** block types and three layout templates (**Newsletter**, **Announcement**, **Event Invite**) so the product can credibly position as a multi-layout email builder.

Phase 2 also installs the small affordances that make Phase 3 (heterogeneous drag-and-drop block reordering, optional block palette UI) a UI-polish task rather than another architectural cycle.

---

## Goals

- Add `HeroBlock`, `ArticleBlock`, `CTABannerBlock` to the `Block` discriminated union.
- Relax the Phase 1 invariant: middle blocks may be any non-header / non-footer type, in any order.
- Author three new templates that exercise the new block types and the existing `product-section`.
- Update the editor canvas, sidebar, and HTML exporter to handle the new types via the existing `switch (block.type)` patterns.
- Introduce a small `BLOCK_METADATA` registry that powers the "+ Add block" menu and is structurally reusable for a Phase 3 palette.
- Wire drag handles into every new block view so heterogeneous drag-reorder works the moment Phase 2 lands.
- Maintain strict byte-equal parity for existing Blank and GlobalTT exports.

## Non-goals (Phase 2)

- No new block types beyond Hero, Article, CTABanner (Quote, Spacer deferred to Phase 3).
- No new layout templates beyond the three above.
- No block palette UI (the dropdown menu is the sole insertion affordance in Phase 2).
- No drop-zone affordances between blocks (visual `+` lines showing valid drop targets). Phase 3.
- No header/footer becoming optional. Compliance concern; not on the roadmap.
- No `SCHEMA_VERSION` bump. Phase 2 is purely additive at the schema level; v2 documents written by Phase 1 remain valid.
- No fix for the PDF header/footer-per-page pagination bug. Tracked separately.

---

## Architecture overview

```
ProjectData v2 (unchanged shape; new Block variants)
├─ schemaVersion: 2
├─ global: GlobalStyles
└─ blocks: Block[]
    ├─ [0]     HeaderBlock        (locked)
    ├─ [1..N]  any of:
    │           - ProductSectionBlock   (Phase 1)
    │           - HeroBlock              (Phase 2)
    │           - ArticleBlock           (Phase 2)
    │           - CTABannerBlock         (Phase 2)
    └─ [last]  FooterBlock        (locked)
```

`Block` becomes a six-variant discriminated union. Exhaustive `switch (block.type)` is preserved in the canvas, sidebar, and HTML export — the type-checker enforces every site handles every variant.

A small `BLOCK_METADATA` object centralizes per-type UI metadata (label, icon, factory, insertable flag) for the "+ Add block" menu and any future palette. Renderers do **not** consume this registry — they stay exhaustive switches for compile-time safety.

---

## Schema additions

```ts
export interface HeroBlock extends BlockBase {
  type: 'hero';
  imageSrc: string;
  imageAlt: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaUrl?: string;
  titleFontSize?: number;
  subtitleFontSize?: number;
  backgroundColor?: string;
  textColor?: string;
  buttonColor?: string;
}

export interface ArticleBlock extends BlockBase {
  type: 'article';
  imageSrc: string;
  imageAlt: string;
  title: string;
  body: string;
  ctaText: string;
  ctaUrl?: string;
  imagePosition: 'top' | 'left' | 'right';
  titleFontSize?: number;
  bodyFontSize?: number;
  backgroundColor?: string;
  textColor?: string;
}

export interface CTABannerBlock extends BlockBase {
  type: 'cta-banner';
  title: string;
  subtitle: string;
  ctaText: string;
  ctaUrl?: string;
  align: 'left' | 'center';
  titleFontSize?: number;
  backgroundColor?: string;
  textColor?: string;
  buttonColor?: string;
}

export type Block =
  | HeaderBlock
  | ProductSectionBlock
  | HeroBlock
  | ArticleBlock
  | CTABannerBlock
  | FooterBlock;
```

`SCHEMA_VERSION` stays `2`. No migration. Pre-Phase-2 v2 documents (containing only `header` + `product-section` + `footer` blocks) remain structurally valid as v2 documents post-Phase-2.

### Relaxed invariant

`validateInvariant` in `src/lib/editor/store.ts` is updated to:

```ts
function validateInvariant(blocks: Block[]): boolean {
  if (blocks.length < 2) return false;
  if (blocks[0].type !== 'header') return false;
  if (blocks[blocks.length - 1].type !== 'footer') return false;
  for (let i = 1; i < blocks.length - 1; i++) {
    if (blocks[i].type === 'header' || blocks[i].type === 'footer') return false;
  }
  if (blocks.filter((b) => b.type === 'header').length !== 1) return false;
  if (blocks.filter((b) => b.type === 'footer').length !== 1) return false;
  return true;
}
```

The middle loop now rejects header/footer rather than requiring product-section. Net effect: header at index 0, footer at last index, exactly one of each, anything else in the middle.

`duplicateBlock` is extended to allow duplicating any non-locked block. It already used `{ ...src, id: uuid() }` plus a `bullets.slice()` deep-copy for product-sections; the deep-copy guard becomes `if (copy.type === 'product-section') copy.bullets = src.bullets.slice();`. Other middle block types are deep-copied implicitly by the shallow spread (none of Hero/Article/CTABanner contain nested mutable arrays).

---

## Block factories + metadata registry

In `src/lib/editor/blocks.ts`, three new factory functions follow the existing `makeProductSectionBlock` pattern:

```ts
export function makeHeroBlock(overrides?: Partial<Omit<HeroBlock, 'type' | 'id'>>): HeroBlock;
export function makeArticleBlock(overrides?: Partial<Omit<ArticleBlock, 'type' | 'id'>>): ArticleBlock;
export function makeCTABannerBlock(overrides?: Partial<Omit<CTABannerBlock, 'type' | 'id'>>): CTABannerBlock;
```

Defaults for each factory provide non-empty placeholder content so an inserted block is immediately visible and editable in the canvas.

### `BLOCK_METADATA` registry

```ts
import type { LucideIcon } from 'lucide-react';
import { Image, FileText, Megaphone, LayoutList } from 'lucide-react';

export interface BlockMetadata {
  label: string;
  icon: LucideIcon;
  factory: () => Block;
  insertable: boolean;
}

export const BLOCK_METADATA: Record<Block['type'], BlockMetadata> = {
  header:          { label: 'Header',          icon: LayoutList, factory: makeHeaderBlock,         insertable: false },
  footer:          { label: 'Footer',          icon: LayoutList, factory: makeFooterBlock,         insertable: false },
  'product-section': { label: 'Product section', icon: LayoutList, factory: makeProductSectionBlock, insertable: true },
  hero:            { label: 'Hero',            icon: Image,      factory: makeHeroBlock,            insertable: true },
  article:         { label: 'Article',         icon: FileText,   factory: makeArticleBlock,         insertable: true },
  'cta-banner':    { label: 'CTA banner',      icon: Megaphone,  factory: makeCTABannerBlock,       insertable: true },
};

export function insertableBlockTypes(): Array<{ type: Block['type']; metadata: BlockMetadata }> {
  return (Object.entries(BLOCK_METADATA) as Array<[Block['type'], BlockMetadata]>)
    .filter(([, m]) => m.insertable)
    .map(([type, metadata]) => ({ type, metadata }));
}
```

The "+ Add block ▾" menu consumes `insertableBlockTypes()`. Renderers don't.

---

## Canvas: new block view components

Three new files under `src/components/editor/blocks/`, mirroring the `ProductSectionView` pattern:

- `HeroBlockView.tsx`
- `ArticleView.tsx`
- `CTABannerView.tsx`

Each:

- Takes `{ block, global, index, total }` props.
- Calls `useSortable({ id: block.id })` so it participates in heterogeneous drag-reorder.
- Wraps in a `motion.div` with the same drag-transform style and `isDragging` opacity treatment as `ProductSectionView`.
- Renders a `BlockToolbar` (renamed from `SectionToolbar` — see below) carrying drag attributes/listeners plus move/duplicate/delete buttons.
- Emits a leading `<SectionInsertBar atIndex={index} />` so insertion sites exist between any two middle blocks.
- Reads style overrides off the block, falling back to `global` defaults (`bg = block.backgroundColor ?? g.backgroundColor`, etc.).
- Uses `EditableText` / `EditableImage` / `EditableLink` for in-canvas editing of every text and image field.
- For `ArticleView`, the layout branches on `block.imagePosition`:
  - `'top'`: image full-width, then title + body below (single column).
  - `'left'`: two-column CSS flex on canvas (`flex-row` with 40%/60% basis).
  - `'right'`: same as `'left'` with `flex-row-reverse`.

### Rename: `SectionToolbar` → `BlockToolbar`

`src/components/editor/canvas/SectionToolbar.tsx` is renamed to `BlockToolbar.tsx`. Its internal mechanics already operate on a `blockId` (passed in by the consumer), not on section-specific data. The rename is purely for accuracy now that the toolbar attaches to four block types in the middle.

`SectionInsertBar` keeps its name (it really does conceptually sit between two adjacent middle blocks — "insert bar" with "Section" as a slight legacy nod is acceptable).
`SectionSelectionProvider` keeps its name (multi-select still operates on middle-block ids; "section" is the user-facing word for "thing in the middle of the email").

### `PreviewBody.tsx` switch

The existing `data.blocks.map((block) => switch (block.type) { ... })` grows three cases that dispatch to the new view components. The `product-section` case is unchanged. Each new case computes its own `index` analogue (an index within the **middle slice**, not the full blocks array — same pattern `ProductSectionView` uses, but now over the full middle, not just product-sections):

```ts
const middleBlocks = data.blocks.slice(1, -1);
const indexInMiddle = (block: Block) => middleBlocks.findIndex((b) => b.id === block.id);
const total = middleBlocks.length;
```

The `SortableContext` `items` expands from product-section ids only to **all middle-block ids**, enabling heterogeneous drag-reorder. `onDragEnd` rebuilds the new block order over the full middle slice (not just product-sections) and calls `reorderBlocks([header, ...newMiddle, footer])`.

---

## Sidebar: new panel components

Three new files under `src/components/editor/panels/`:

- `HeroPanel.tsx` — controls for image, heading, subtitle, CTA, background.
- `ArticlePanel.tsx` — controls for image, image-position segmented (`Top | Left | Right`), heading, body (textarea), CTA, background.
- `CTABannerPanel.tsx` — controls for heading, subtitle, CTA, alignment segmented (`Left | Center`), background.

Each accepts `block: <SpecificBlock>` as a prop. Internal logic uses `store.getState().updateBlock(block.id, patch)` for every edit.

### `LeftPanel.tsx` changes

The block-walker switch grows three new cases dispatching to the new panels. Net visual structure of the sidebar becomes:

```
GlobalStylesPanel
HeaderPanel (block)            ← always at top of block list
<middle blocks, in document order>:
  ProductSectionPanel  (block, index, total)
  HeroPanel            (block, index, total)
  ArticlePanel         (block, index, total)
  CTABannerPanel       (block, index, total)
FooterPanel (block)            ← always at bottom of block list
+ Add block ▾                  ← dropdown menu
```

**The Phase 1 `Products · N` sub-header is removed.** The heterogeneous middle makes the label misleading. Block panels carry their own visual identity (label + icon in the panel header) so the sub-header is no longer needed for orientation.

### `+ Add block ▾` dropdown

Replaces the Phase 1 `+ Add Product Section` button. Implemented with the existing shadcn-style Dropdown primitive (or its equivalent in the codebase). Reads `insertableBlockTypes()` from `BLOCK_METADATA`. Selecting an entry calls:

```ts
store.getState().addBlock(BLOCK_METADATA[type].factory());
```

`addBlock` with no `atIndex` defaults to "just before the footer" — matches the Phase 1 add-section behavior.

---

## HTML export: new render functions

`src/lib/export/renderEmail.ts` is refactored to dispatch the per-block render via a `switch`:

```ts
function renderBlock(block: Block, data: ProjectData, indexInMiddle: number): string {
  switch (block.type) {
    case 'header':          return renderHeader(block, data.global.contactUrl);
    case 'product-section': return renderSection(block, indexInMiddle, data);
    case 'hero':            return renderHero(block, data);
    case 'article':         return renderArticle(block, data);
    case 'cta-banner':      return renderCTABanner(block, data);
    case 'footer':          return renderFooter(block, data);
  }
}
```

`renderBody` iterates `data.blocks`, computing `indexInMiddle` as a counter for middle blocks only.

### `renderHero(block, data)`

Returns a single full-width `<table>` row:

```html
<tr><td style="padding: 40px 24px; background-color: ${bg}; color: ${fg}; text-align: center;">
  ${imageHtml}
  <h1 style="font-size:${titleSize}px; font-weight:700; margin:0 0 12px;">${title}</h1>
  ${subtitleHtml}
  <a href="${ctaUrl}" style="display:inline-block; padding:14px 28px; background:${buttonColor}; color:${buttonTextColor}; text-decoration:none; font-weight:600; border-radius:4px;">${ctaText}</a>
</td></tr>
```

Image is `<img>` with `max-width:100%; height:auto;`. Subtitle row only emitted when `block.subtitle` is non-empty.

### `renderArticle(block, data)`

Branches on `block.imagePosition`:

- **`'top'`** — single `<td>` with image full-width, then title + body + optional CTA stacked below.
- **`'left'`** — nested `<table>` with two `<td>` columns (40% / 60% by default). Image left, text right. Outlook-safe using MSO conditional comments.
- **`'right'`** — mirror of `'left'`.

Body text supports newlines (rendered with `white-space: pre-wrap` inline style). CTA emitted only when `ctaText` is non-empty.

### `renderCTABanner(block, data)`

Single full-width `<td>` with `text-align: ${block.align}` and the button-style anchor:

```html
<tr><td style="padding: 32px 24px; background-color: ${bg}; color: ${fg}; text-align: ${align};">
  ${titleHtml}
  ${subtitleHtml}
  <a href="${ctaUrl}" style="display:inline-block; padding:12px 24px; background:${buttonColor}; color:${buttonTextColor}; text-decoration:none;">${ctaText}</a>
</td></tr>
```

Title and subtitle rows omitted when their respective fields are empty (CTA is the only required content).

### Style override resolution

Each render function applies the same fallback pattern:

```ts
const bg = block.backgroundColor ?? data.global.backgroundColor;
const fg = block.textColor ?? data.global.textColor;
const buttonColor = block.buttonColor ?? data.global.buttonColor;
const buttonTextColor = data.global.buttonTextColor;
```

Per-block overrides win over global styles. This matches how `renderSection` already resolves overrides for product-sections. `buttonTextColor` is intentionally **not** a per-block override in Phase 2 — it always comes from `data.global.buttonTextColor`. (Phase 3 may promote it if users ask, but doing so now would just add schema surface without a real use case.)

---

## Templates

Three new factory functions in `src/lib/editor/templates.ts`:

### `createNewsletterTemplate()`

`[Header, Hero, Article (top), Article (top), Article (top), CTABanner, Footer]`

- Header: generic logo + "Monthly update" title.
- Hero: large heading "This month at our company", subtitle, primary CTA "See the full update".
- 3 Articles with `imagePosition: 'top'`: short news/blog-style items.
- CTABanner: center-aligned, "Want more? Subscribe →".

### `createAnnouncementTemplate()`

`[Header, Hero, Article (left), CTABanner, Footer]`

- Header: generic.
- Hero: announcement headline + supporting image + primary CTA.
- Article with `imagePosition: 'left'`: secondary supporting paragraph.
- CTABanner: center-aligned, contrasting button.

### `createEventInviteTemplate()`

`[Header, Hero, Article (left), ProductSection, ProductSection, ProductSection, CTABanner, Footer]`

- Header: generic.
- Hero: event name, date, location, "RSVP" CTA.
- Article with `imagePosition: 'left'`: event details paragraph.
- 3 ProductSections: speakers or sessions (title + 5 bullets + image + "Learn more").
- CTABanner: center-aligned, "Reserve your spot →".

Note the third template **reuses the Phase 1 `ProductSectionBlock`** — verification that the foundation is genuinely mix-and-match, not just a separate-types extension.

### Updated `TEMPLATES` array

```ts
export const TEMPLATES: TemplateDefinition[] = [
  { id: 'blank',        label: 'Blank',        description: 'Same layout, empty fields. Fill in your own logo, sections, and footer.', factory: createBlankProject,           group: 'Quick start' },
  { id: 'globaltt',     label: 'GlobalTT',     description: 'Pre-filled with GlobalTT\'s default copy and product sections.',         factory: createDefaultProject,         group: 'Quick start' },
  { id: 'newsletter',   label: 'Newsletter',   description: 'Hero + articles + CTA. Recurring digest format.',                         factory: createNewsletterTemplate,     group: 'Layouts' },
  { id: 'announcement', label: 'Announcement', description: 'Hero + supporting article + CTA. Single big message.',                    factory: createAnnouncementTemplate,   group: 'Layouts' },
  { id: 'event-invite', label: 'Event invite', description: 'Hero, agenda, speakers/sessions, RSVP CTA.',                              factory: createEventInviteTemplate,    group: 'Layouts' },
];
```

`TemplateDefinition` gains a `group: 'Quick start' | 'Layouts'` field. `getTemplate(id)` is unchanged.

### NewProjectDialog grouping

`src/components/dashboard/NewProjectDialog.tsx` now renders templates grouped by their `group` field. Layout:

```
Quick start
┌─────────────┬─────────────┐
│  Blank      │  GlobalTT   │
└─────────────┴─────────────┘

Layouts
┌─────────────┬─────────────┐
│ Newsletter  │Announcement │
└─────────────┴─────────────┘
┌─────────────┐
│Event invite │
└─────────────┘
```

Each group renders as a labelled section: a small uppercase heading ("Quick start" / "Layouts") followed by the 2-column grid of cards for that group. Selection logic is unchanged — clicking a card sets `selected = template.id`.

---

## Parity & testing

### Existing-parity criteria

- `npx tsc --noEmit`, `npm run lint`, `npx vitest run` all green.
- Existing E2E tests (`tests/e2e/*.spec.ts`) pass without modification.
- `baseline-blank.html` and `baseline-globaltt.html` snapshot tests still pass byte-equal. (Phase 2 must not change exports for Blank or GlobalTT templates.)

### New tests

- **Snapshot baselines** for the three new templates: `baseline-newsletter.html`, `baseline-announcement.html`, `baseline-event-invite.html`. Captured via the existing `scripts/capture-render-baseline.ts` (extended). Snapshot test asserts byte-equal output across re-renders.
- **`store.blocks.test.ts` additions**:
  - Heterogeneous middle reorder: build a project with `[header, productSection, hero, article, footer]`, call `reorderBlocks([header, article, productSection, hero, footer])`, assert success and order.
  - `addBlock(makeHeroBlock())` inserts before the footer; `validateInvariant` passes.
  - `duplicateBlock(heroId)` creates a sibling hero immediately after; new id is unique; footer still last.
- **`BLOCK_METADATA` correctness test** (new file `blocks.metadata.test.ts`): for every entry with `insertable: true`, asserts `factory().type === entryKey`.
- **`addBlock` invariant** test extended: passing an `atIndex` of 0 (would put a block before the header) is clamped/rejected; passing `atIndex = blocks.length` (after footer) is clamped/rejected.

### Manual smoke (Phase 2)

In addition to the Phase 1 smoke checklist, verify:

- "+ New Project" shows two subheadings: "Quick start" (2 cards) and "Layouts" (3 cards).
- Selecting each of the three new templates opens an editor with the expected block structure.
- "+ Add block ▾" in the sidebar shows four entries (Product section, Hero, Article, CTA banner). Each inserts before the footer.
- Drag a Hero past an Article past a ProductSection — order persists, save indicator pulses, reload preserves order.
- Toolbar duplicate / move-up / move-down / delete works on each new block type.
- HTML export of each new template downloads a file that renders correctly in Gmail web and a desktop Outlook client (or the closest available approximation).
- Translate flow on a Newsletter project produces a new sibling project with translated copy in every translatable field (article titles/bodies/CTAs, hero title/subtitle/CTA, CTA-banner title/subtitle/CTA, plus all the Phase 1 header/footer fields).

---

## Translate path

`src/lib/translate/fields.ts` is extended with `extractTranslatable` and `applyTranslations` cases for the three new block types. New key namespaces:

- `blocks.${i}.hero.title`, `blocks.${i}.hero.subtitle`, `blocks.${i}.hero.imageAlt`, `blocks.${i}.hero.ctaText`
- `blocks.${i}.article.title`, `blocks.${i}.article.body`, `blocks.${i}.article.imageAlt`, `blocks.${i}.article.ctaText`
- `blocks.${i}.ctaBanner.title`, `blocks.${i}.ctaBanner.subtitle`, `blocks.${i}.ctaBanner.ctaText`

The existing `header.X` / `sections.X.Y` / `footer.X` keys remain unchanged for backwards-compatible behavior on existing translations. The new `blocks.${i}.*` namespace is purely additive — extracting from a project that has only Phase-1 block types produces only the existing keys, exactly as before. The `i` index is the position of the block in the full `blocks` array (including header/footer for stability across reorders).

Updated `applyTranslations` walks blocks by position and applies any matching keys for the block's type; unknown keys are ignored (graceful for forward-compat).

---

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Hero/Article CSS doesn't render cleanly in Outlook (the perpetual email-dev villain). | Snapshot tests capture the byte-exact output; manual smoke includes an Outlook check. Use `<table>`-based layouts and MSO conditional comments for the Article `'left'`/`'right'` two-column variant — same techniques the Phase 1 `renderSection` already uses successfully. |
| Heterogeneous drag-reorder via `@dnd-kit` works for product-sections in Phase 1 but might surprise on mixed types. | `SortableContext items` expansion is a one-line change; `onDragEnd` is rewritten over the middle slice. Add an E2E test that drags a Hero past an Article. |
| `BLOCK_METADATA` registry diverges from the renderer switch as types are added/removed. | A unit test asserts every metadata entry has a corresponding renderer case (via `factory().type` check). Future block-type additions in Phase 3 must update both files. |
| Translate path silently drops new fields if user has stale translation cache. | Unknown translation keys are ignored in `applyTranslations`. Stale cache means the block keeps its source-language copy — not a data-loss scenario. |
| NewProjectDialog grouping breaks the existing 2-column responsive grid. | Wrap each group in its own `<section>` with the same grid styles; nothing about cell rendering changes. |

---

## Out of scope (deferred)

- **Phase 3:** Quote and Spacer block types. Block palette UI in the sidebar. Drop-zone affordances between blocks (drag visualization). Optional rename pass on `SectionInsertBar` / `SectionSelectionProvider`.
- **Phase 4 (if ever):** Optional header/footer. Brand-kit application extended to per-block style overrides. Block-level locking by users.
- **Future SaaS:** "Save current project as template" — turn a user project into a workspace-level reusable template.
- **Out of scope for this spec:** The PDF header/footer-per-page pagination bug. Translation of newly-translatable `subtitle`/`body`/`ctaText` strings into pre-existing Phase-1 user projects (those projects don't have the new block types, so no new strings to translate).
