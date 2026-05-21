# Block Model Foundation — Design Spec

**Date:** 2026-05-21
**Author:** Codex (with jlgarcia@esoftsat.com)
**Status:** Approved for plan writing
**Scope:** Phase 1 of the multi-layout email system. Foundation refactor only — no user-visible change.

---

## Motivation

The current `ProjectData` schema locks every project to a single layout: one header, a vertical stack of identical product sections, one footer. As a SaaS offering this is a non-starter — users expect to pick from materially different email types (newsletter, announcement, event invite, product catalog, etc.).

Solving that long-term means generalizing the container: sections become typed *blocks*, and an email is an ordered list of blocks of various types. Phase 1 lays that foundation with **zero user-visible change**. Phase 2 introduces new block types and templates that actually deliver new layouts. Phase 3 (later, optional) adds free-form block library / drag-drop authoring.

This spec covers **Phase 1 only**.

---

## Goals

- Generalize `ProjectData` into a `blocks[]` array of discriminated-union `Block` types.
- Refactor the canvas renderer, export renderer, editor sidebar, and store to walk blocks instead of `header / sections[] / footer`.
- Migrate v1 documents to v2 on read; persist as v2 thereafter.
- Maintain **strict parity** with current behavior — visual, functional, and byte-equal HTML export for the existing Blank and GlobalTT templates.

## Non-goals (Phase 1)

- No new block types beyond ports of the three existing shapes (`header`, `product-section`, `footer`).
- No new templates.
- No relaxation of the "header at top, footer at bottom" invariant.
- No drag/reorder across heterogeneous block types (today's product-section reorder is preserved as-is).
- No block library / palette UI.
- No fix for the PDF header/footer-per-page pagination bug (tracked separately).

---

## Architecture overview

```
ProjectData v2
├─ schemaVersion: 2
├─ global: GlobalStyles            (unchanged)
└─ blocks: Block[]
    ├─ Block #0  — HeaderBlock         (locked at index 0)
    ├─ Block #1  — ProductSectionBlock
    ├─ Block #2  — ProductSectionBlock
    ├─ …
    └─ Block #N  — FooterBlock         (locked at last index)
```

Block is a discriminated union (`type` field). Renderers and editor panels dispatch on `block.type` via exhaustive `switch`. Phase 1 ships exactly three variants — `header`, `product-section`, `footer` — that are 1:1 ports of today's `Header`, `ProductSection`, `Footer` interfaces.

---

## Schema (v2)

```ts
export const SCHEMA_VERSION = 2;

export interface ProjectData {
  schemaVersion: 2;
  global: GlobalStyles;
  blocks: Block[];
}

export type Block = HeaderBlock | ProductSectionBlock | FooterBlock;

export interface BlockBase {
  id: string;          // uuid, stable across edits
  locked?: boolean;    // Phase 1: true on header & footer
}

export interface HeaderBlock extends BlockBase {
  type: 'header';
  logoSrc: string; logoAlt: string; logoWidth: number;
  title: string; titleFontSize: number;
  bannerSrc: string; bannerAlt: string;
  sectionHeading: string; sectionHeadingFontSize: number;
}

export interface ProductSectionBlock extends BlockBase {
  type: 'product-section';
  title: string;
  bullets: string[];
  imageSrc: string; imageAlt: string;
  ctaText: string; ctaUrl?: string;
  titleFontSize?: number; bulletFontSize?: number;
  textColor?: string; buttonColor?: string; backgroundColor?: string;
}

export interface FooterBlock extends BlockBase {
  type: 'footer';
  bannerSrc: string; bannerAlt: string;
  companyName: string; address: string; phone: string; phoneTel: string;
  email: string;
  websites: WebsiteLink[];
  socials: SocialLink[];
  backgroundColor?: string; textColor?: string;
}

// GlobalStyles, WebsiteLink, SocialLink, SocialPlatform: unchanged from v1.
```

**Phase 1 invariant** (enforced by the store): a `blocks` array contains exactly one `header` at index 0 and exactly one `footer` at the last index; everything between is `product-section`. The invariant is loosened in Phase 2.

---

## Migration

A pure function `migrate(raw): ProjectData` lives in `src/lib/editor/migrate.ts`:

```ts
export function migrate(raw: unknown): ProjectData {
  const v = (raw as { schemaVersion?: number }).schemaVersion;
  if (v === 2) return raw as ProjectData;
  if (v === 1 || v === undefined) return v1ToV2(raw as V1ProjectData);
  throw new Error(`Unsupported schemaVersion: ${v}`);
}

function v1ToV2(v1: V1ProjectData): ProjectData {
  return {
    schemaVersion: 2,
    global: v1.global,
    blocks: [
      { id: uuid(), type: 'header', locked: true, ...v1.header },
      ...v1.sections.map(s => ({ ...s, type: 'product-section' as const })),
      { id: uuid(), type: 'footer',  locked: true, ...v1.footer  },
    ],
  };
}
```

Migration entry points:

- `loadProject(...)` in the server-side fetch path: `data = migrate(row.data)` before returning.
- `/api/import`: response is wrapped into v2.
- Translate API / AI refine endpoints: call `migrate(data)` on receipt.
- Editor save path always writes v2.

No DB backfill is required for Phase 1 — v1 documents upgrade lazily as they are opened and saved. (An optional one-off `scripts/backfill-v2.ts` is left out of scope but is mechanically trivial if we later want to drop v1 support.)

---

## Canvas renderer (`PreviewBody.tsx`)

The current `PreviewBody.tsx` is split into a thin walker plus three block view components under `src/components/editor/blocks/`:

```
src/components/editor/blocks/
├─ HeaderBlockView.tsx           // extracted from PreviewBody
├─ ProductSectionView.tsx        // extracted from PreviewBody (the per-section JSX)
└─ FooterBlockView.tsx           // extracted from PreviewBody
```

`PreviewBody` becomes:

```tsx
const blocks = useEditor(s => s.data.blocks);
return (
  <div onMouseDown={onCanvasMouseDown}>
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={productSectionIds} strategy={verticalListSortingStrategy}>
        {blocks.map(b => {
          switch (b.type) {
            case 'header':          return <HeaderBlockView   key={b.id} block={b} />;
            case 'product-section': return <ProductSectionView key={b.id} block={b} />;
            case 'footer':          return <FooterBlockView   key={b.id} block={b} />;
          }
        })}
      </SortableContext>
    </DndContext>
  </div>
);
```

- DnD sortable context still only contains `product-section` block ids — header/footer are not draggable in Phase 1.
- All Editable* components, `SectionToolbar`, `SectionInsertBar`, `SelectionActionBar` continue to work because they key off the block (formerly section) `id`.
- The `switch` is intentionally not abstracted into a registry — three cases is below the threshold where abstraction pays off. Phase 2 can introduce a registry when there are 5+ block types.

---

## Export renderer (`lib/export/renderEmail.ts`)

Same block-walker pattern: `switch (block.type)` over `data.blocks`, emit the same email-safe HTML for each type as today. Goal is **byte-equal output** for the existing two templates (asserted by snapshot test against a pre-refactor capture).

---

## Editor sidebar (`LeftPanel.tsx`)

`LeftPanel` becomes a block-walker that selects the appropriate panel component per block type:

```tsx
const blocks = useEditor(s => s.data.blocks);
const productSectionCount = useEditor(s => s.data.blocks.filter(b => b.type === 'product-section').length);
return (
  <aside>
    <GlobalStylesPanel />
    {blocks.map((b, idx) => {
      switch (b.type) {
        case 'header':          return <HeaderPanel          key={b.id} block={b} />;
        case 'product-section': return <ProductSectionPanel  key={b.id} block={b} index={idx} total={productSectionCount} />;
        case 'footer':          return <FooterPanel          key={b.id} block={b} />;
      }
    })}
    {canEdit && <AddProductSectionButton />}
  </aside>
);
```

- `HeaderPanel`, `ProductSectionPanel`, `FooterPanel` accept a `block` prop and call store mutations via `updateBlock(block.id, patch)`. Their internal markup is unchanged.
- The "Products · N" header is computed from `blocks.filter(...)`. Visual equivalence preserved.
- `+ Add Product Section` button inserts a fresh `ProductSectionBlock` immediately before the footer block.

---

## Store (`lib/editor/store.ts`)

New block-generic core actions:

```ts
updateBlock(id: string, patch: Partial<Block>): void;
addBlock(block: Block, atIndex: number): void;
removeBlock(id: string): void;          // refuses if locked
moveBlock(id: string, dir: 'up' | 'down'): void;
duplicateBlock(id: string): void;
reorderBlocks(next: Block[]): void;     // validates header-at-0, footer-at-end
```

Convenience wrappers (kept for the duration of Phase 1, to minimize call-site churn during the refactor):

```ts
setHeader(patch)         → updateBlock(headerId, patch)
setFooter(patch)         → updateBlock(footerId, patch)
setSection(id, patch)    → updateBlock(id, patch)
addSection(atIndex?)     → addBlock(newProductSectionBlock(), atIndex ?? lastIndex)
removeSection(id)        → removeBlock(id)
moveSection(id, dir)     → moveBlock(id, dir)
duplicateSection(id)     → duplicateBlock(id)
reorderSections(next)    → reorderBlocks([header, ...next, footer])
```

Wrappers delegate to the block-generic core. They can be removed in Phase 2 once all call sites have migrated. Internal store helpers `findHeader()`, `findFooter()`, `findBlock(id)` centralize lookups.

**Validation invariants** (asserted inside the core actions):

- `removeBlock(id)`: refuses to remove a block with `locked === true`.
- `reorderBlocks(next)`: refuses if `next[0].type !== 'header'`, `next[next.length-1].type !== 'footer'`, or any header/footer count ≠ 1.
- `moveBlock(headerId, 'down')` / `moveBlock(footerId, 'up')`: refused.

Brand-kit application (`applyBrandKit(snapshot)`) updates `data.global` (unchanged) and patches the footer block via `updateBlock(footerId, snapshot.footer)`.

Undo / redo (zundo) is unaffected — it snapshots `data` as a whole.

---

## Downstream features

| Feature | Touch point | Phase 1 change |
|---|---|---|
| Autosave | `lib/editor/autosave.ts`, `lastSavedData` | Types update with new `ProjectData`; serialization is unchanged JSONB. |
| Undo / redo | zundo temporal store | None. |
| Duplicate project | API route + helper | Regenerate block `id`s in the clone; ensure no code reaches for `data.sections` by name. |
| Translate project | `TranslateMenu`, translate API | Translator walks `blocks` and dispatches on `block.type` for translatable string fields. |
| Import HTML | `ImportButton`, `/api/import`, importer | Importer wraps its parse result in v2 shape (`{ schemaVersion: 2, global, blocks: [headerBlock, ...sectionBlocks, footerBlock] }`). |
| HTML export | `lib/export/renderEmail.ts` | Block-walker described above. |
| PDF export | print stylesheet + (server PDF renderer if present) | Block-walker. **The PDF header/footer-per-page bug is explicitly NOT fixed in this spec.** |
| Brand-kit apply | store `applyBrandKit` | Patches footer block via `updateBlock(footerId, …)`. |
| AI / chat refine | `ChatRefinePanel` + API | Server-side endpoint calls `migrate(data)` on receipt. |
| Canvas toolbars | `SectionToolbar`, `SectionInsertBar`, `SelectionActionBar` | Keyed on block `id` — work as-is. Internal calls route through wrappers. |
| E2E tests | `tests/e2e/*` | Pass unchanged. Any failure is a regression to be fixed before merge. |

---

## Templates

`createBlankProject()` and `createDefaultProject()` return v2 documents directly. The blueprint copy in `defaultProject.ts` (SECTION_BLUEPRINTS) is unchanged — it's mapped into `ProductSectionBlock` shape by adding `type: 'product-section'` and `id: uuid()`.

`TEMPLATES` array in `lib/editor/templates.ts` keeps its existing two entries (`blank`, `globaltt`). No new entries in Phase 1.

---

## Parity and testing

**Parity criteria (definition of done):**

1. All existing E2E tests (`tests/e2e/*.spec.ts`) pass without modification.
2. Opening a v1-stored project: loads, renders identically, saves back as v2.
3. Opening the Blank or GlobalTT template via "+ New Project": pixel-identical to today.
4. Duplicate, translate, import, HTML export, PDF export, brand-kit apply produce identical results for a v1 fixture before vs after the refactor.
5. `npm run typecheck` clean, `npm run lint` clean, `npm test` green.

**New tests added in Phase 1:**

- `lib/editor/migrate.test.ts` — feed v1 fixtures (one Blank, one GlobalTT, one freshly imported), assert the v2 output deep-equals expected.
- `lib/editor/store.blocks.test.ts` — invariant guards: `removeBlock` on locked block rejected; `reorderBlocks` with footer out-of-place rejected; `moveBlock` on header `down` rejected.
- `lib/export/renderEmail.snapshot.test.ts` — render the Blank and GlobalTT templates to HTML, snapshot. (A pre-refactor capture is taken as the baseline so this catches any drift.)

**Rollout:**

- Single feature branch `feat/block-model-foundation` off `main`.
- One cohesive PR. Splitting leaves the codebase in a broken intermediate state.
- Lazy migration on read → no coordinated DB migration. v1 projects upgrade on open.
- Rollback strategy: revert the merge commit. v2 documents written post-merge can be downgraded by an inverse migration utility if needed (the utility is included as `migrate.ts` exports `downgradeV2ToV1`, not exercised in normal flow).

---

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Hidden call site that reaches into `data.sections` / `data.header` / `data.footer` directly. | After landing the schema change, TypeScript will flag every such call site at compile time. `git grep "data\.sections\|data\.header\|data\.footer"` as a final pre-merge sweep. |
| Export HTML drifts by whitespace / attribute order, breaking client-side workflows. | Pre-refactor snapshot baseline + byte-equal assertion in `renderEmail.snapshot.test.ts`. |
| Server-side endpoint accepts v1 payload from older client cache and rejects. | Centralized `migrate()` in every server route that parses `data`. |
| Phase 2 reveals the chosen block-base shape was wrong. | The block discriminator is the load-bearing decision; field-level additions in Phase 2 are cheap to make non-breaking. We accept this risk and revisit if Phase 2 design surfaces a structural issue. |

---

## Out of scope (deferred to later phases or other specs)

- New block types: `HeroBlock`, `ArticleBlock`, `CTABannerBlock`, `QuoteBlock`, `SpacerBlock`. (Phase 2)
- New templates beyond Blank + GlobalTT. (Phase 2)
- Heterogeneous reorder (moving header/footer, mixing block types in the middle). (Phase 2)
- Block library / palette / drag-drop authoring. (Phase 3)
- "Save current project as template" SaaS feature. (Future)
- PDF header/footer-per-page pagination bug. (Separate bugfix; tracked in memory)
- Removing convenience wrappers in `store.ts`. (Phase 2 cleanup)
