# Craft.js Migration — v3 Tree Model & Email Templating Engine

**Status:** Design approved, awaiting implementation plan
**Author:** Jorge (jlgarcia@esoftsat.com), with Claude
**Date:** 2026-05-25
**Branch (proposed):** `feat/craftjs-migration` (off `main`, after `feat/asset-picker-resize` is merged)
**Supersedes:** the deferred SaaS roadmap items in [memory](../../../../.claude/projects/C--Users-Developer2-Documents-html-editor/memory/project_saas_architectural_direction.md). Builds on the v2 block-model foundation (`feat/block-model-foundation`).

## 1. Motivation

The editor currently uses a flat `Block[]` discriminated union (v2 schema) with six hand-written, monolithic block types (`header`, `footer`, `hero`, `article`, `cta-banner`, `product-section`). Each block ships its own sidebar panel, its own canvas view component, and its own switch case in three render paths (`PreviewBody`, `renderEmail`, `renderPrintDocument`). Adding a block costs ~6 files. Nesting is not possible: every block is a leaf.

The product target is an email templating engine in the class of Unlayer, Stripo, and Mailchimp's editor — users assemble templates from primitives (Text, Image, Button, etc.) inside Rows and Columns. The flat model can't support that without a ground-up rewrite of the tree state, drag-and-drop semantics, and serialization.

This spec covers the full migration to a tree model backed by [Craft.js](https://craft.js.org/), preserving the live render targets (MSO email + PagedJS print) and existing v2 projects.

## 2. End-state UX

A primitives-first editor. Users drag `Text`, `Image`, `Button`, `Heading`, `Divider`, `Spacer`, `List` into `Row`s with 1–4 `Column`s, grouped into `Section` bands. Existing branded blocks (Hero, Article, ProductSection, CTABanner) become **code-defined presets** — toolbox items that insert a pre-built Craft subtree the user can then edit at primitive granularity.

Header and footer remain locked top-level sections: their position is fixed, but their contents are editable as primitives.

## 3. Architecture

```
┌─ ProjectData (Zustand store) ──────────────────────────┐
│   schemaVersion: 3                                     │
│   global: GlobalStyles                                 │
│   tree: SerializedNodes      ← Craft.js JSON           │
└────────────────────────────────────────────────────────┘
              ↑ serialize/deserialize
┌─ <Editor resolver={RESOLVERS}> ────────────────────────┐
│   <Frame>                                              │
│     <Element is={Page} canvas>     ← root              │
│       <Element is={Section} locked>  ← header          │
│       <Element is={Section} canvas>* ← user sections   │
│       <Element is={Section} locked>  ← footer          │
│     </Element>                                         │
│   </Frame>                                             │
└────────────────────────────────────────────────────────┘
              ↓ same RESOLVERS, isSSR=true
┌─ Renderers ────────────────────────────────────────────┐
│   renderEmail(tree, global)         → MSO HTML         │
│   renderPrintDocument(tree, global) → PagedJS HTML     │
│   translateFields(tree, target)     → tree             │
└────────────────────────────────────────────────────────┘
```

**Layering principles:**

- Craft.js owns tree state in the editor. The Zustand store keeps `global` (project-wide styles) and a *mirrored* serialized snapshot of the tree for autosave, undo/redo persistence, translate, and export.
- The same `RESOLVERS` map drives the live editor AND the static renderers, via [dbousamra's SSR-aware `<Element>` wrapper](https://github.com/prevwong/craft.js/issues/42).
- Renderers move from "switch on `block.type`" to "walk Craft nodes, dispatch on `node.type.resolvedName`".

## 4. Data model

```ts
// src/lib/editor/types.ts (v3)
export const SCHEMA_VERSION = 3;

export interface ProjectData {
  schemaVersion: 3;
  global: GlobalStyles;        // unchanged from v2
  tree: SerializedNodes;       // Craft.js serialized output
}
```

`SerializedNodes` is Craft.js's native format: `Record<NodeId, { type, props, parent, nodes, linkedNodes, displayName, isCanvas, hidden, custom }>`.

### 4.1 Node taxonomy

| Kind       | Component  | `isCanvas` | Children allowed                          |
|------------|------------|------------|-------------------------------------------|
| Root       | `Page`     | yes        | only `Section`                            |
| Structural | `Section`  | yes        | `Row`                                     |
| Structural | `Row`      | yes        | only `Column` (1–4)                       |
| Structural | `Column`   | yes        | any leaf primitive                        |
| Leaf       | `Heading`  | no         | —                                         |
| Leaf       | `Text`     | no         | —                                         |
| Leaf       | `Image`    | no         | —                                         |
| Leaf       | `Button`   | no         | —                                         |
| Leaf       | `Divider`  | no         | —                                         |
| Leaf       | `Spacer`   | no         | —                                         |
| Leaf       | `List`     | no         | —                                         |

**Total: 11 primitives.**

Containment is enforced by Craft's `craft.rules` (`canMoveIn` / `canDrop`) declared on each container. Invalid drops are blocked at drag time; the tree cannot enter a malformed state.

### 4.2 Header/footer locking

`Page` always has exactly:
- 1 locked `Section` (first child) with `custom.role: 'header'` and `props.locked: true`
- N user `Section`s (middle, freely added/removed/reordered)
- 1 locked `Section` (last child) with `custom.role: 'footer'` and `props.locked: true`

Lock rules forbid: deleting locked sections, moving them, inserting siblings before the header or after the footer. Inside a locked section the user freely edits children.

### 4.3 Typed props per node

A `NodeProps` discriminated union (one interface per `resolvedName`) is exported alongside the schema for use in settings panels, renderers, and the translation registry.

## 5. Primitive component shape

Every primitive follows a single pattern. Reference: `Image`.

```ts
// src/components/editor/craft/Image.tsx
import { useNode } from '@craftjs/core';

interface ImageProps {
  src: string;
  alt: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  linkHref?: string;
}

export function Image({ src, alt, width, align = 'center', linkHref }: ImageProps) {
  const { connectors: { connect, drag } } = useNode();
  const img = (
    <img
      ref={(el) => el && connect(drag(el))}
      src={src}
      alt={alt}
      style={{ width, maxWidth: '100%', display: 'block', margin: marginFor(align) }}
    />
  );
  return linkHref ? <a href={linkHref}>{img}</a> : img;
}

Image.craft = {
  displayName: 'Image',
  props: { src: '', alt: '', align: 'center' } satisfies ImageProps,
  related: { settings: ImageSettings },
  rules: { canDrag: () => true },
};

function ImageSettings() {
  const { props, setProp } = useNode((node) => ({ props: node.data.props as ImageProps }));
  // ... colocated settings UI
}
```

**Conventions:**
- Props are a single named interface, no untyped bags.
- `useNode()` is called once at the top; `connect(drag(el))` attaches to the outermost rendered element only.
- Same JSX in editor and SSR. No `useEffect`, no client-only branches — the SSR-aware `<Element>` wrapper handles the enable/disable distinction.
- `craft.rules` colocated with the component.
- `*Settings` colocated in the same file.

**File layout:**

```
src/components/editor/craft/
  Element.tsx          ← SSR-aware wrapper
  RenderContext.tsx    ← 'editor' | 'email' | 'print'
  Page.tsx
  Section.tsx
  Row.tsx
  Column.tsx
  Heading.tsx
  Text.tsx
  Image.tsx
  Button.tsx
  Divider.tsx
  Spacer.tsx
  List.tsx
  resolver.ts          ← RESOLVERS = { Page, Section, Row, Column, ... }
```

## 6. Renderer adapter (SSR-aware tree walk)

The load-bearing piece. Same component tree drives the live editor and the static renderers, so what you see on canvas is what ships.

### 6.1 SSR-aware Element wrapper

```ts
// src/components/editor/craft/Element.tsx
import { Element as CraftElement, NodeId } from '@craftjs/core';
import { createElement, type ElementType, type ReactNode } from 'react';

interface Props<T extends ElementType> {
  is: T;
  id?: NodeId;
  isSSR?: boolean;
  children?: ReactNode;
}

export function Element<T extends ElementType>({ is, id, isSSR, children, ...rest }: Props<T> & React.ComponentProps<T>) {
  return isSSR
    ? createElement(is, rest, children)
    : <CraftElement id={id} {...rest as any}>{children}</CraftElement>;
}
```

### 6.2 Tree walker

```ts
// src/lib/export/renderTree.ts
export function renderTreeToReact(tree: SerializedNodes, opts: { isSSR: true }): ReactElement;
```

Walks the node map from `ROOT`, resolves each via `RESOLVERS`, recurses over `node.nodes`, wraps each rendered element in a stub `NodeContext.Provider` so `useNode()` inside primitives returns props only (no connectors). Algorithm follows dbousamra's `renderNodesToJSX` (codesandbox: https://codesandbox.io/s/keen-fast-m3y2z).

### 6.3 Renderer entry points

```ts
// src/lib/export/renderEmail.ts
export function renderEmail(data: ProjectData): string {
  const react = renderTreeToReact(data.tree, { isSSR: true });
  const html = renderToStaticMarkup(
    <RenderContext.Provider value="email">
      <EmailFrame global={data.global}>{react}</EmailFrame>
    </RenderContext.Provider>
  );
  return msoEnvelope(html, data.global);
}
```

`renderPrintDocument` follows the same shape with `RenderContext = 'print'`.

### 6.4 Target-specific rendering inside primitives

A `RenderContext` (`'editor' | 'email' | 'print'`) is read via `useContext` inside each primitive. Editor mode is the default and renders with normal CSS. SSR renderers set the context at the root once.

| Target  | Wrapper                     | RenderContext | Image attrs                | Row/Column layout    |
|---------|-----------------------------|---------------|----------------------------|----------------------|
| Editor  | `<Editor><Frame>`           | `editor`      | CSS only                   | flex                 |
| Email   | `renderTreeToReact` (SSR)   | `email`       | `width` attr + `border=0`  | nested `<table>`     |
| Print   | `renderTreeToReact` (SSR)   | `print`       | CSS only                   | flex (PagedJS OK)    |

**MSO-safe primitives in email mode:**
- `Row` / `Column` render as `<table><tr><td>`.
- `Image` adds `border="0"` and an explicit `width` attribute.
- `Button` becomes a VML-fallback table-button (bulletproof button pattern).
- `Spacer` / `Divider` use inline-styled `<td>` with explicit heights.

### 6.5 Snapshot parity

`renderEmail.snapshot.test.ts` and `renderPrintDocument.snapshot.test.ts` regenerate baselines once against migrated v3 trees from the preset templates. Visual parity verified by Playwright `blocks-parity` against the canvas.

### 6.6 Risk: API drift

dbousamra's pattern was demonstrated on 2020-era Craft.js. Phase 0 clones his codesandbox and verifies against the currently-installed `@craftjs/core` (~v0.2.10). If `NodeContext` / `Resolver` shapes drifted, the *shape* of the solution (SSR-aware Element wrapper + manual tree walk + disabled Editor wrapper) still applies — only the import paths and types change. Estimated mapping cost if drift: 1–2 days.

## 7. Data migration (v2 → v3)

```ts
// src/lib/editor/migrate.ts (extended)
export function migrate(data: unknown): ProjectData {
  if (isV1(data)) data = migrateV1toV2(data);
  if (isV2(data)) data = migrateV2toV3(data);
  return data as ProjectData;
}
```

### 7.1 Per-block mapping

| v2 Block          | v3 subtree                                                                                                                                  |
|-------------------|---------------------------------------------------------------------------------------------------------------------------------------------|
| `header`          | Section(role=header, locked) → Row(1col) → Image(logo), Heading(title), Image(banner), Heading(sectionHeading)                              |
| `hero`            | Section → Row(1col) → Image, Heading(title), Text(subtitle), Button(cta)                                                                    |
| `article`         | Section → Row(`imagePosition === 'top' ? 1col : 2col`) → Image + (Heading, Text, Button)                                                    |
| `product-section` | Section → Row(2col) → Image + (Heading, List(bullets), Button)                                                                              |
| `cta-banner`      | Section(bg=accent) → Row(1col, align=`block.align`) → Heading + Text + Button                                                               |
| `footer`          | Section(role=footer, locked) → Row(1col) → Image(banner), Text(company+address), Text(contact links), Row(socials)                          |

Conversion is pure and deterministic — same v2 input always produces the same v3 tree, snapshot-tested.

### 7.2 Trigger sites

Mirrors the v1→v2 pattern in commit `ada9ffc`:
- `loadProject` (store) — first read from Supabase
- `renderEmail` / `renderPrintDocument` — defensive wrap
- `translateFields` — same
- `parseHtml` (import path) — emit v3 directly, no migrate step

### 7.3 On-disk migration

Projects stay as-is in Supabase until the user opens them. First save after open writes v3 back. An optional one-time backfill script (`scripts/migrate-v2-projects.ts`) flushes the GlobalTT workspace in one go — included as a deliverable; the decision to run it is operational.

## 8. Inspector / sidebar

### 8.1 Right sidebar — `<NodeInspector>`

Single component subscribing to `query.getEvent('selected').first()`. When a node is selected, renders the colocated `*Settings` of that node's component. Falls back to `GlobalStylesPanel` when nothing is selected.

```ts
// src/components/editor/sidebar/NodeInspector.tsx
export function NodeInspector() {
  const { settings } = useEditor((_, query) => {
    const id = query.getEvent('selected').first();
    if (!id) return { settings: null };
    return { settings: query.node(id).get().related?.settings ?? null };
  });
  if (!settings) return <GlobalStylesPanel />;
  return createElement(settings);
}
```

### 8.2 Left sidebar — palette + outline

Tabs: `Add` (palette) | `Outline` (tree).

- **Palette** items wrap `useEditor().connectors.create(el, <Element is={Image} />)`. Drag onto canvas; Craft handles drop validation via `canMoveIn`. Presets (Hero, Article, ProductSection, CTABanner) appear as palette items that insert a pre-built subtree.
- **Outline** renders `query.node(id).descendants(true)` as a collapsible tree with click-to-select and hover-to-highlight.

### 8.3 Deletions

- `LeftPanel.tsx` (block-list-driven panel switcher)
- All 6 `panels/*.tsx` (Header, Footer, ProductSection, Hero, Article, CTABanner) — each panel's logic moves into its primitive's colocated `*Settings`
- `BlockToolbar`, `SectionInsertBar`, `SelectionActionBar` — folded into a thin `<SelectedToolbar>` (delete, duplicate, move up/down) rendered next to the selected node
- `useSectionSelection`, `SectionSelectionProvider` — replaced by `query.getEvent('selected')`
- All 6 `blocks/*View.tsx` — replaced by primitives + presets
- `useUndoRedoShortcuts.ts` — Craft.js owns history; shortcuts rewired to `actions.history.undo/redo`
- `blocks.ts` (block helpers), all legacy v2 type aliases

### 8.4 Survivors

- `GlobalStylesPanel` (project-wide globals, no node selection)
- `Topbar`, `TranslateMenu`, `DownloadMenu`, `BrandKitPicker`, `AssetPicker` — unchanged, none touch tree shape

### 8.5 Dropped feature: multi-select

The current heterogeneous multi-select (Ctrl/Cmd-click sections, bulk action bar) is dropped for v3. Craft.js has single-select natively. Re-added in a follow-up spec only if real users ask.

## 9. Cross-cutting concerns

### 9.1 Brand kit

`ProjectData.global` is unchanged. Themed primitives (`Button.color`, `Section.backgroundColor`, `Heading.color`, etc.) accept an optional `brandToken` field — `'primary' | 'accent' | 'text' | 'footerBg' | ...`. At render time, `brandToken` wins over an explicit color and resolves from `global`. Editor shows the resolved color in the canvas; settings panel exposes a `SwatchChip` row of brand tokens above the free color picker.

### 9.2 Translation field-walker

```ts
// src/lib/translate/registry.ts
export const TRANSLATABLE: Record<string, string[]> = {
  Heading: ['text'],
  Text: ['text'],
  Button: ['label'],
  Image: ['alt'],
  List: ['items[]'],   // array notation handled by the walker
  Section: [],
  Row: [], Column: [],
  Divider: [], Spacer: [],
};
```

`extractFields(tree)` returns `Record<NodeId, Record<string, string>>`. `applyFields(tree, translated)` clones the tree map and writes back. Adding a new primitive = one registry entry.

### 9.3 Autosave & undo/redo

Store still owns `global` and a *mirrored* `tree: SerializedNodes`. A `<TreeSyncBridge>` component inside `<Editor>` listens via `useEditor((state) => state)` and writes `query.serialize()` into the store on a debounced tick. Autosave keeps debouncing on store updates — no other change.

Undo/redo: drop the custom `useUndoRedoShortcuts` hook. Rewire keyboard shortcuts to Craft's built-in `actions.history.undo/redo`. Same UX, less code.

## 10. Testing strategy

Three layers, all required:

1. **Unit (Vitest).** Per primitive: serialization round-trip, default props, `craft.rules` enforcement. Per migrator: v2 fixtures → v3 snapshot, golden files committed. Renderer adapter: `renderTreeToReact` over hand-built trees → snapshot HTML.
2. **Snapshot (Vitest).** Rewrite `renderEmail.snapshot.test.ts` and `renderPrintDocument.snapshot.test.ts` against migrated v3 trees from the three preset templates. Baselines regenerated once; thereafter snapshot diffs are the regression gate.
3. **E2E (Playwright).** Extend `blocks-parity` to load each preset, screenshot the canvas, screenshot `renderEmail` output rendered in a hidden iframe, screenshot `renderPrintDocument` output, diff with a tight threshold. Plus a tree-mutation test (drag Image into Column, set props, undo, redo) to lock in Craft.js behavior.

## 11. Sequencing

Each phase lands behind a build flag until the next is green. Phase 0 is a hard kill-switch.

| # | Phase                                                                                                  | Verified by                                                          |
|---|--------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------|
| 0 | Clone dbousamra codesandbox locally; validate SSR pattern against current `@craftjs/core`              | Standalone repro renders to string                                   |
| 1 | Install `@craftjs/core`; SSR-aware `<Element>`; resolver scaffold; `Page` only                         | Empty canvas renders, serializes, round-trips                        |
| 2 | `Section` + `Row` + `Column` + containment rules                                                       | Unit tests on `canMoveIn`                                            |
| 3 | Leaf primitives (`Heading`, `Text`, `Image`, `Button`, `Divider`, `Spacer`, `List`) with settings      | Per-primitive unit tests                                             |
| 4 | `<NodeInspector>` + palette + outline; delete old panels                                               | Manual editor test                                                   |
| 5 | `renderTreeToReact` + `renderEmail` rewrite (`RenderContext = 'email'`)                                | Snapshot tests pass on hand-built v3 trees                           |
| 6 | `renderPrintDocument` rewrite (`RenderContext = 'print'`)                                              | Snapshot tests pass                                                  |
| 7 | `migrateV2toV3` + per-block converter                                                                  | Migrator unit tests, all v2 fixtures map cleanly                     |
| 8 | Translation registry + walker rewrite                                                                  | Per-primitive fixture tests, full-template snapshot                  |
| 9 | Rewrite `templates/{announcement,eventInvite,newsletter}.ts` to return v3 trees; rewrite `defaultProject.ts` | E2E preset load test                                            |
| 10 | Brand-kit `brandToken` wiring on themed primitives                                                    | Snapshot tests with brand-kit swap                                   |
| 11 | Autosave bridge + drop custom undo/redo                                                               | Manual save/reload + undo/redo E2E                                   |
| 12 | Optional `scripts/migrate-v2-projects.ts` backfill                                                    | Dry-run report + ops decision                                        |

## 12. Deliverables

**New files:**
- `src/components/editor/craft/{Element,RenderContext,Page,Section,Row,Column,Heading,Text,Image,Button,Divider,Spacer,List}.tsx`
- `src/components/editor/craft/resolver.ts`
- `src/components/editor/sidebar/{NodeInspector,Palette,Outline,SelectedToolbar,TreeSyncBridge}.tsx`
- `src/lib/export/renderTree.ts`
- `src/lib/translate/registry.ts`
- `scripts/migrate-v2-projects.ts`

**Rewritten files:**
- `src/lib/editor/types.ts` (v3 schema)
- `src/lib/editor/migrate.ts` (+ v2→v3)
- `src/lib/editor/store.ts` (mirror tree slice)
- `src/lib/editor/templates/{announcement,eventInvite,newsletter}.ts`
- `src/lib/editor/defaultProject.ts`
- `src/lib/export/renderEmail.ts`
- `src/lib/export/renderPrintDocument.ts`
- `src/lib/translate/fields.ts`
- `src/components/editor/EditorShell.tsx`
- `src/components/editor/PreviewBody.tsx`
- `src/lib/export/renderEmail.snapshot.test.ts`
- `src/lib/export/renderPrintDocument.snapshot.test.ts`
- `tests/e2e/blocks-parity.spec.ts`

**Deleted files:**
- `src/components/editor/LeftPanel.tsx`
- `src/components/editor/panels/{Header,Footer,ProductSection,Hero,Article,CTABanner}Panel.tsx`
- `src/components/editor/canvas/{BlockToolbar,SectionInsertBar,SelectionActionBar}.tsx`
- `src/components/editor/SectionSelectionProvider.tsx`
- `src/lib/editor/useUndoRedoShortcuts.ts`
- `src/lib/editor/blocks.ts`
- `src/components/editor/blocks/HeaderBlockView.tsx`, `FooterBlockView.tsx`, `HeroBlockView.tsx`, `ProductSectionView.tsx`, `ArticleView.tsx`, `CTABannerView.tsx`
- All legacy v2 type aliases (`Header`, `ProductSection`, `Footer`) in `types.ts`

## 13. Estimate

~4–6 weeks of focused work, matching the prior memory estimate. Phase 0 is the kill switch — if dbousamra's pattern doesn't survive on current Craft.js, the architecture gets revisited before sinking time into the rest.

## 14. Out of scope (follow-up specs)

- Templates-as-data (`block_templates` table, workspace-scoped, CRUD/ACL)
- User-saved blocks ("save this section as a reusable block")
- Multi-select restored
- AI-assisted block generation
- Mobile-responsive variant editing per node (mobile/desktop toggle)
- AMP for Email renderer
