# Multi-Layout Templates Implementation Plan (Phase 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Hero, Article, and CTA Banner block types plus Newsletter, Announcement, and Event Invite layout templates on top of the Phase 1 block-model foundation, with heterogeneous drag-reorder wired in.

**Architecture:** Extend the `Block` discriminated union with three new variants. Relax the store's `validateInvariant` so the middle slice accepts any non-header/non-footer block. Add a `BLOCK_METADATA` registry to drive the new "+ Add block ▾" dropdown. Add canvas view components and sidebar panels for each new type, route them through the existing exhaustive `switch (block.type)` patterns, and extend the HTML exporter and translate field walker with new cases. Three new template factories author canonical layouts that exercise the new types.

**Tech Stack:** Next.js 15, TypeScript strict mode, Zustand + zundo, @dnd-kit (sortable), motion/react, @radix-ui/react-dropdown-menu (new dep), vitest, shadcn-style UI primitives.

**Spec reference:** `docs/superpowers/specs/2026-05-21-multilayout-templates-design.md` (commit `78bbfb5`).

---

## File Structure

**New files (create):**

- `src/components/editor/blocks/HeroBlockView.tsx` — canvas view for hero blocks
- `src/components/editor/blocks/ArticleView.tsx` — canvas view for article blocks (with `top|left|right` image position)
- `src/components/editor/blocks/CTABannerView.tsx` — canvas view for CTA banner blocks
- `src/components/editor/panels/HeroPanel.tsx` — sidebar editor for hero blocks
- `src/components/editor/panels/ArticlePanel.tsx` — sidebar editor for article blocks
- `src/components/editor/panels/CTABannerPanel.tsx` — sidebar editor for CTA banner blocks
- `src/components/editor/canvas/AddBlockMenu.tsx` — "+ Add block ▾" dropdown menu
- `src/components/ui/dropdown-menu.tsx` — shadcn-style Radix dropdown primitive
- `src/lib/editor/templates/newsletter.ts` — `createNewsletterTemplate()`
- `src/lib/editor/templates/announcement.ts` — `createAnnouncementTemplate()`
- `src/lib/editor/templates/eventInvite.ts` — `createEventInviteTemplate()`
- `src/lib/export/__fixtures__/baseline-newsletter.html`
- `src/lib/export/__fixtures__/baseline-announcement.html`
- `src/lib/export/__fixtures__/baseline-event-invite.html`
- `tests/unit/blocks.metadata.test.ts`
- `tests/unit/store.heterogeneous.test.ts`
- `tests/unit/templates.phase2.test.ts`

**Files to modify:**

- `src/lib/editor/types.ts` — add `HeroBlock`, `ArticleBlock`, `CTABannerBlock`; widen `Block` union
- `src/lib/editor/blocks.ts` — add `makeHeroBlock`, `makeArticleBlock`, `makeCTABannerBlock`, `BLOCK_METADATA`, `insertableBlockTypes`
- `src/lib/editor/store.ts` — relax `validateInvariant`; extend `duplicateBlock` to allow non-locked blocks
- `src/lib/editor/templates.ts` — extend `TemplateDefinition` with `group`, register three new templates
- `src/components/editor/PreviewBody.tsx` — heterogeneous switch + heterogeneous `SortableContext`
- `src/components/editor/LeftPanel.tsx` — block-walker switch grows three cases, drop "Products · N" subheader, swap "+ Add Product Section" button for `<AddBlockMenu />`
- `src/components/editor/canvas/SectionToolbar.tsx` → rename to `BlockToolbar.tsx`; update consumers
- `src/components/editor/blocks/ProductSectionView.tsx` — update import to `BlockToolbar`
- `src/components/dashboard/NewProjectDialog.tsx` — render templates grouped by `group`
- `src/lib/export/renderEmail.ts` — dispatch switch + three new render functions
- `src/lib/translate/fields.ts` — extract/apply for three new block types under `blocks.${i}.*` namespace
- `scripts/capture-render-baseline.ts` — also write the three new baselines
- `package.json` — add `@radix-ui/react-dropdown-menu`

**Tasks (T1–T18) below produce these changes incrementally; each ends in a commit.**

---

## Task 1: Schema — add three new block interfaces

**Files:**
- Modify: `src/lib/editor/types.ts`

- [ ] **Step 1: Write failing test**

Append to `tests/unit/store.test.ts` (new describe at end of file):

```ts
import type { ArticleBlock, CTABannerBlock, HeroBlock } from '@/lib/editor/types';

describe('Phase 2 block type shapes', () => {
  it('HeroBlock has the spec-required fields', () => {
    const h: HeroBlock = {
      type: 'hero', id: 'h1',
      imageSrc: '', imageAlt: '',
      title: 't', subtitle: 's',
      ctaText: 'c',
    };
    expect(h.type).toBe('hero');
  });

  it('ArticleBlock has imagePosition', () => {
    const a: ArticleBlock = {
      type: 'article', id: 'a1',
      imageSrc: '', imageAlt: '',
      title: 't', body: 'b',
      ctaText: 'c',
      imagePosition: 'top',
    };
    expect(a.imagePosition).toBe('top');
  });

  it('CTABannerBlock has align', () => {
    const c: CTABannerBlock = {
      type: 'cta-banner', id: 'c1',
      title: 't', subtitle: 's',
      ctaText: 'c',
      align: 'center',
    };
    expect(c.align).toBe('center');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/store.test.ts`
Expected: FAIL — `HeroBlock`, `ArticleBlock`, `CTABannerBlock` not exported from types.

- [ ] **Step 3: Add the three interfaces to `src/lib/editor/types.ts`**

After the `FooterBlock` interface (around line 69) and before the `Block` union (line 71), insert:

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
```

Then replace the `Block` union (line 71) with the six-variant version:

```ts
export type Block =
  | HeaderBlock
  | ProductSectionBlock
  | HeroBlock
  | ArticleBlock
  | CTABannerBlock
  | FooterBlock;
```

`SCHEMA_VERSION` stays at `2`. No migration change.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/store.test.ts -t "Phase 2 block type shapes"`
Expected: PASS — all three blocks instantiate.

Also run `npx tsc --noEmit` to confirm the union widening compiles cleanly.

- [ ] **Step 5: Commit**

```bash
git add src/lib/editor/types.ts tests/unit/store.test.ts
git commit -m "feat(types): add Hero, Article, CTA banner block interfaces"
```

---

## Task 2: Relax store invariant + extend `duplicateBlock`

**Files:**
- Modify: `src/lib/editor/store.ts`
- Create: `tests/unit/store.heterogeneous.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/unit/store.heterogeneous.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '@/lib/editor/defaultProject';
import { createEditorStore } from '@/lib/editor/store';
import { findHeader, findFooter, productSections } from '@/lib/editor/blocks';
import type { HeroBlock, ArticleBlock, CTABannerBlock } from '@/lib/editor/types';

const NOW = '2026-05-21T10:00:00Z';

function freshStore() {
  return createEditorStore({
    projectId: 'p1', name: 'Test',
    data: createDefaultProject(),
    brandKitId: null, workspaceSlug: 'test-ws', serverUpdatedAt: NOW,
  });
}

function makeHero(id: string): HeroBlock {
  return { type: 'hero', id, imageSrc: '', imageAlt: '', title: 'H', subtitle: '', ctaText: 'Go' };
}
function makeArticle(id: string): ArticleBlock {
  return { type: 'article', id, imageSrc: '', imageAlt: '', title: 'A', body: 'b', ctaText: 'Go', imagePosition: 'top' };
}
function makeCTABanner(id: string): CTABannerBlock {
  return { type: 'cta-banner', id, title: 'C', subtitle: '', ctaText: 'Go', align: 'center' };
}

describe('heterogeneous middle slice', () => {
  it('addBlock accepts a hero block before the footer', () => {
    const store = freshStore();
    store.getState().addBlock(makeHero('hero-1'));
    const blocks = store.getState().data.blocks;
    expect(blocks[blocks.length - 2].type).toBe('hero');
    expect(blocks[blocks.length - 1].type).toBe('footer');
  });

  it('addBlock accepts an article block', () => {
    const store = freshStore();
    store.getState().addBlock(makeArticle('art-1'));
    expect(store.getState().data.blocks.some((b) => b.id === 'art-1')).toBe(true);
  });

  it('addBlock accepts a cta-banner block', () => {
    const store = freshStore();
    store.getState().addBlock(makeCTABanner('cta-1'));
    expect(store.getState().data.blocks.some((b) => b.id === 'cta-1')).toBe(true);
  });

  it('reorderBlocks accepts a heterogeneous middle', () => {
    const store = freshStore();
    store.getState().addBlock(makeHero('hero-1'));
    store.getState().addBlock(makeArticle('art-1'));
    const blocks = store.getState().data.blocks;
    const header = findHeader(blocks);
    const footer = findFooter(blocks);
    const middle = blocks.slice(1, -1);
    const reordered = [...middle].reverse();
    store.getState().reorderBlocks([header, ...reordered, footer]);
    const after = store.getState().data.blocks;
    expect(after[0].type).toBe('header');
    expect(after[after.length - 1].type).toBe('footer');
    expect(after.slice(1, -1).map((b) => b.id)).toEqual(reordered.map((b) => b.id));
  });

  it('reorderBlocks rejects a header in the middle', () => {
    const store = freshStore();
    const blocks = store.getState().data.blocks;
    const header = findHeader(blocks);
    const footer = findFooter(blocks);
    const before = store.getState().data.blocks;
    store.getState().reorderBlocks([header, header, footer]);
    expect(store.getState().data.blocks).toBe(before);
  });

  it('duplicateBlock works on a hero block', () => {
    const store = freshStore();
    store.getState().addBlock(makeHero('hero-1'));
    store.getState().duplicateBlock('hero-1');
    const heroes = store.getState().data.blocks.filter((b) => b.type === 'hero');
    expect(heroes.length).toBe(2);
    expect(heroes[0].id).toBe('hero-1');
    expect(heroes[1].id).not.toBe('hero-1');
  });

  it('duplicateBlock refuses to duplicate the header', () => {
    const store = freshStore();
    const headerId = findHeader(store.getState().data.blocks).id;
    const before = store.getState().data.blocks;
    store.getState().duplicateBlock(headerId);
    expect(store.getState().data.blocks).toBe(before);
  });

  it('duplicateBlock still deep-copies product-section bullets', () => {
    const store = freshStore();
    const psId = productSections(store.getState().data.blocks)[0].id;
    store.getState().duplicateBlock(psId);
    const copies = store.getState().data.blocks.filter((b) => b.type === 'product-section');
    const src = copies[0];
    const copy = copies[1];
    if (src.type !== 'product-section' || copy.type !== 'product-section') throw new Error('type narrow');
    expect(copy.bullets).not.toBe(src.bullets);
    expect(copy.bullets).toEqual(src.bullets);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/store.heterogeneous.test.ts`
Expected: most tests FAIL because `addBlock(makeHero(...))` triggers the Phase 1 invariant rejection (middle must be `product-section`), and `duplicateBlock` short-circuits for non-`product-section` types.

- [ ] **Step 3: Replace `validateInvariant` in `src/lib/editor/store.ts`**

Find (around line 78):

```ts
function validateInvariant(blocks: Block[]): boolean {
  if (blocks.length < 2) return false;
  if (blocks[0].type !== 'header') return false;
  if (blocks[blocks.length - 1].type !== 'footer') return false;
  for (let i = 1; i < blocks.length - 1; i++) {
    if (blocks[i].type !== 'product-section') return false;
  }
  if (blocks.filter((b) => b.type === 'header').length !== 1) return false;
  if (blocks.filter((b) => b.type === 'footer').length !== 1) return false;
  return true;
}
```

Replace the middle loop:

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

- [ ] **Step 4: Generalize `duplicateBlock`**

Find (around line 160):

```ts
duplicateBlock: (id) => set((state) => {
  const idx = state.data.blocks.findIndex((b) => b.id === id);
  if (idx < 0) return state;
  const src = state.data.blocks[idx];
  if (src.type !== 'product-section') return state;
  const copy: ProductSectionBlock = { ...src, id: uuid(), bullets: src.bullets.slice() };
  const blocks = state.data.blocks.slice();
  blocks.splice(idx + 1, 0, copy);
  if (!validateInvariant(blocks)) return state;
  return { data: { ...state.data, blocks } };
}),
```

Replace with:

```ts
duplicateBlock: (id) => set((state) => {
  const idx = state.data.blocks.findIndex((b) => b.id === id);
  if (idx < 0) return state;
  const src = state.data.blocks[idx];
  if (isLocked(src)) return state;
  const copy: Block = src.type === 'product-section'
    ? { ...src, id: uuid(), bullets: src.bullets.slice() }
    : { ...src, id: uuid() };
  const blocks = state.data.blocks.slice();
  blocks.splice(idx + 1, 0, copy);
  if (!validateInvariant(blocks)) return state;
  return { data: { ...state.data, blocks } };
}),
```

Then remove the now-unused `ProductSectionBlock` import token if it isn't used elsewhere in the file (it is — keep the import). Verify with: `grep "ProductSectionBlock" src/lib/editor/store.ts`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/store.heterogeneous.test.ts tests/unit/store.test.ts`
Expected: ALL PASS — old Phase 1 store tests still green (they never relied on the middle being rejected), new heterogeneous tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/editor/store.ts tests/unit/store.heterogeneous.test.ts
git commit -m "feat(store): allow heterogeneous middle blocks and generic duplicateBlock"
```

---

## Task 3: Add block factories + `BLOCK_METADATA` registry

**Files:**
- Modify: `src/lib/editor/blocks.ts`
- Create: `tests/unit/blocks.metadata.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/unit/blocks.metadata.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  makeHeroBlock,
  makeArticleBlock,
  makeCTABannerBlock,
  BLOCK_METADATA,
  insertableBlockTypes,
} from '@/lib/editor/blocks';

describe('Phase 2 block factories', () => {
  it('makeHeroBlock returns a hero with non-empty defaults and a fresh id', () => {
    const a = makeHeroBlock();
    const b = makeHeroBlock();
    expect(a.type).toBe('hero');
    expect(a.id).not.toBe(b.id);
    expect(a.title.length).toBeGreaterThan(0);
    expect(a.ctaText.length).toBeGreaterThan(0);
  });

  it('makeArticleBlock defaults imagePosition to top', () => {
    const a = makeArticleBlock();
    expect(a.type).toBe('article');
    expect(a.imagePosition).toBe('top');
  });

  it('makeCTABannerBlock defaults align to center', () => {
    const c = makeCTABannerBlock();
    expect(c.type).toBe('cta-banner');
    expect(c.align).toBe('center');
  });

  it('factories accept overrides', () => {
    expect(makeHeroBlock({ title: 'Custom' }).title).toBe('Custom');
    expect(makeArticleBlock({ imagePosition: 'left' }).imagePosition).toBe('left');
    expect(makeCTABannerBlock({ align: 'left' }).align).toBe('left');
  });
});

describe('BLOCK_METADATA registry', () => {
  it('contains every Block variant', () => {
    const expected = ['header', 'footer', 'product-section', 'hero', 'article', 'cta-banner'];
    for (const k of expected) {
      expect(BLOCK_METADATA).toHaveProperty(k);
    }
  });

  it('factory().type matches the registry key for every entry', () => {
    for (const [key, meta] of Object.entries(BLOCK_METADATA)) {
      expect(meta.factory().type).toBe(key);
    }
  });

  it('header and footer are not insertable', () => {
    expect(BLOCK_METADATA.header.insertable).toBe(false);
    expect(BLOCK_METADATA.footer.insertable).toBe(false);
  });

  it('insertableBlockTypes returns four entries: product-section, hero, article, cta-banner', () => {
    const insertable = insertableBlockTypes().map((e) => e.type).sort();
    expect(insertable).toEqual(['article', 'cta-banner', 'hero', 'product-section']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/blocks.metadata.test.ts`
Expected: FAIL — `makeHeroBlock`, `makeArticleBlock`, `makeCTABannerBlock`, `BLOCK_METADATA`, `insertableBlockTypes` not exported.

- [ ] **Step 3: Extend `src/lib/editor/blocks.ts`**

Append after the existing exports:

```ts
import type { ArticleBlock, CTABannerBlock, HeroBlock } from './types';
import type { LucideIcon } from 'lucide-react';
import { FileText, Image as ImageIcon, LayoutList, Megaphone } from 'lucide-react';

export function makeHeroBlock(
  overrides: Partial<Omit<HeroBlock, 'type' | 'id'>> = {},
): HeroBlock {
  return {
    type: 'hero',
    id: uuid(),
    imageSrc: '',
    imageAlt: '',
    title: 'Big headline',
    subtitle: 'Supporting subtitle',
    ctaText: 'Learn more',
    ...overrides,
  };
}

export function makeArticleBlock(
  overrides: Partial<Omit<ArticleBlock, 'type' | 'id'>> = {},
): ArticleBlock {
  return {
    type: 'article',
    id: uuid(),
    imageSrc: '',
    imageAlt: '',
    title: 'Article title',
    body: 'Article body. Two or three short sentences work well here.',
    ctaText: 'Read more',
    imagePosition: 'top',
    ...overrides,
  };
}

export function makeCTABannerBlock(
  overrides: Partial<Omit<CTABannerBlock, 'type' | 'id'>> = {},
): CTABannerBlock {
  return {
    type: 'cta-banner',
    id: uuid(),
    title: 'Ready to get started?',
    subtitle: '',
    ctaText: 'Get in touch',
    align: 'center',
    ...overrides,
  };
}

export interface BlockMetadata {
  label: string;
  icon: LucideIcon;
  factory: () => Block;
  insertable: boolean;
}

export const BLOCK_METADATA: Record<Block['type'], BlockMetadata> = {
  header:            { label: 'Header',          icon: LayoutList, factory: makeHeaderBlock,         insertable: false },
  footer:            { label: 'Footer',          icon: LayoutList, factory: makeFooterBlock,         insertable: false },
  'product-section': { label: 'Product section', icon: LayoutList, factory: makeProductSectionBlock, insertable: true  },
  hero:              { label: 'Hero',            icon: ImageIcon,  factory: makeHeroBlock,           insertable: true  },
  article:           { label: 'Article',         icon: FileText,   factory: makeArticleBlock,        insertable: true  },
  'cta-banner':      { label: 'CTA banner',      icon: Megaphone,  factory: makeCTABannerBlock,      insertable: true  },
};

export function insertableBlockTypes(): Array<{ type: Block['type']; metadata: BlockMetadata }> {
  return (Object.entries(BLOCK_METADATA) as Array<[Block['type'], BlockMetadata]>)
    .filter(([, m]) => m.insertable)
    .map(([type, metadata]) => ({ type, metadata }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/blocks.metadata.test.ts`
Expected: PASS — all four describe blocks green.

Also run `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/editor/blocks.ts tests/unit/blocks.metadata.test.ts
git commit -m "feat(blocks): add Phase 2 block factories and BLOCK_METADATA registry"
```

---

## Task 4: Rename `SectionToolbar` → `BlockToolbar`

**Files:**
- Create: `src/components/editor/canvas/BlockToolbar.tsx`
- Delete: `src/components/editor/canvas/SectionToolbar.tsx`
- Modify: `src/components/editor/blocks/ProductSectionView.tsx`
- Modify: `tests/unit/SectionToolbar.test.tsx` → rename and update import

- [ ] **Step 1: Create `src/components/editor/canvas/BlockToolbar.tsx`**

Create the file with the renamed export (interface name updated, prop name kept `sectionId` only if it matches Phase 1; rename props for clarity):

```tsx
'use client';
import { Copy, GripVertical, X } from 'lucide-react';
import { useEditorStore } from '@/lib/editor/StoreProvider';
import { confirmDialog } from '@/lib/utils/confirm';
import { useEditorMode } from '../EditorModeProvider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface BlockToolbarProps {
  blockId: string;
  blockLabel: string;
  dragAttributes: Record<string, unknown>;
  dragListeners: Record<string, unknown> | undefined;
}

export function BlockToolbar({ blockId, blockLabel, dragAttributes, dragListeners }: BlockToolbarProps) {
  const { mode } = useEditorMode();
  const store = useEditorStore();
  if (mode === 'preview') return null;

  async function onDelete() {
    const ok = await confirmDialog({
      title: 'Delete block?',
      message: `This will remove "${blockLabel || 'Untitled'}" from the email.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    store.getState().removeBlock(blockId);
  }

  return (
    <div className="block-toolbar absolute top-2 right-2 z-10 inline-flex items-center gap-1 rounded-full border border-ed-rule-strong bg-ed-panel-2 p-1 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Drag to reorder block"
            className="inline-flex h-7 w-7 cursor-grab items-center justify-center rounded-md text-ed-ink-2 transition-colors hover:bg-ed-panel-3 hover:text-ed-ink active:cursor-grabbing"
            {...dragAttributes}
            {...(dragListeners ?? {})}
          >
            <GripVertical size={14} />
          </button>
        </TooltipTrigger>
        <TooltipContent>Drag to reorder block</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Duplicate block"
            onClick={() => store.getState().duplicateBlock(blockId)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ed-ink-2 transition-colors hover:bg-ed-panel-3 hover:text-ed-ink"
          >
            <Copy size={14} />
          </button>
        </TooltipTrigger>
        <TooltipContent>Duplicate block</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Delete block"
            onClick={onDelete}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ed-ink-2 transition-colors hover:bg-ed-panel-3 hover:text-ed-danger"
          >
            <X size={14} />
          </button>
        </TooltipTrigger>
        <TooltipContent>Delete block</TooltipContent>
      </Tooltip>
    </div>
  );
}
```

Note: switched from `removeSection`/`duplicateSection` to the block-generic `removeBlock`/`duplicateBlock` (Phase 1 already exposes both).

- [ ] **Step 2: Delete `src/components/editor/canvas/SectionToolbar.tsx`**

```bash
git rm src/components/editor/canvas/SectionToolbar.tsx
```

- [ ] **Step 3: Update `src/components/editor/blocks/ProductSectionView.tsx`**

Find line 7:
```ts
import { SectionToolbar } from '../canvas/SectionToolbar';
```
Replace with:
```ts
import { BlockToolbar } from '../canvas/BlockToolbar';
```

Find line 130–135:
```tsx
<SectionToolbar
  sectionId={block.id}
  sectionTitle={block.title ?? ''}
  dragAttributes={attributes as unknown as Record<string, unknown>}
  dragListeners={listeners as unknown as Record<string, unknown> | undefined}
/>
```
Replace with:
```tsx
<BlockToolbar
  blockId={block.id}
  blockLabel={block.title ?? ''}
  dragAttributes={attributes as unknown as Record<string, unknown>}
  dragListeners={listeners as unknown as Record<string, unknown> | undefined}
/>
```

- [ ] **Step 4: Update the test file**

```bash
git mv tests/unit/SectionToolbar.test.tsx tests/unit/BlockToolbar.test.tsx
```

Open `tests/unit/BlockToolbar.test.tsx`, replace `SectionToolbar` with `BlockToolbar`, `sectionId` with `blockId`, `sectionTitle` with `blockLabel`, and the import path `from '../canvas/SectionToolbar'` (or `@/components/editor/canvas/SectionToolbar`) with `BlockToolbar`. Update any references to `removeSection`/`duplicateSection` to `removeBlock`/`duplicateBlock` in the test's mocked store.

Read the file first; do a one-for-one substitution.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/BlockToolbar.test.tsx`
Expected: PASS.

Then full check: `npx tsc --noEmit && npx vitest run`. Expected: green.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(canvas): rename SectionToolbar to BlockToolbar"
```

---

## Task 5: Add `@radix-ui/react-dropdown-menu` dep + shadcn `dropdown-menu` primitive

**Files:**
- Modify: `package.json`
- Create: `src/components/ui/dropdown-menu.tsx`

- [ ] **Step 1: Install the dep**

```bash
npm install @radix-ui/react-dropdown-menu
```

Expected: `package.json` and `package-lock.json` updated.

- [ ] **Step 2: Create `src/components/ui/dropdown-menu.tsx`**

```tsx
'use client';

import * as React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';

import { cn } from '@/lib/utils/cn';

function DropdownMenu(props: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuTrigger(props: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

function DropdownMenuContent({
  className,
  sideOffset = 6,
  align = 'start',
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        align={align}
        className={cn(
          'z-50 min-w-[180px] overflow-hidden rounded-md border border-ed-rule-strong bg-ed-panel-2 p-1 text-sm text-ed-ink shadow-[0_18px_40px_-12px_rgba(0,0,0,0.45)]',
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

function DropdownMenuItem({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item>) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      className={cn(
        'flex cursor-default select-none items-center gap-2 rounded px-2.5 py-1.5 text-sm outline-none transition-colors data-[highlighted]:bg-ed-panel-3 data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem };
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/components/ui/dropdown-menu.tsx
git commit -m "feat(ui): add shadcn-style DropdownMenu primitive"
```

---

## Task 6: HeroBlockView component

**Files:**
- Create: `src/components/editor/blocks/HeroBlockView.tsx`

- [ ] **Step 1: Create `src/components/editor/blocks/HeroBlockView.tsx`**

```tsx
'use client';
import { motion } from 'motion/react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { HeroBlock, GlobalStyles } from '@/lib/editor/types';
import { useEditorStore } from '@/lib/editor/StoreProvider';
import { useEditorMode } from '../EditorModeProvider';
import { useSectionSelection } from '../SectionSelectionProvider';
import { BlockToolbar } from '../canvas/BlockToolbar';
import { SectionInsertBar } from '../canvas/SectionInsertBar';
import { EditableText } from '../editable/EditableText';
import { EditableImage } from '../editable/EditableImage';
import { EditableLink } from '../editable/EditableLink';

interface Props {
  block: HeroBlock;
  global: GlobalStyles;
  index: number;
  total: number;
}

export function HeroBlockView({ block, global: g, index, total: _total }: Props) {
  const store = useEditorStore();
  const update = (patch: Partial<Omit<HeroBlock, 'type' | 'id'>>) =>
    store.getState().updateBlock(block.id, patch);
  const { mode } = useEditorMode();
  const selection = useSectionSelection();
  const blockNav = mode === 'edit' ? (e: React.MouseEvent) => e.preventDefault() : undefined;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });

  const titleSize = block.titleFontSize ?? Math.max(g.headingFontSize, 28);
  const subtitleSize = block.subtitleFontSize ?? g.baseFontSize;
  const bg = block.backgroundColor ?? g.backgroundColor;
  const fg = block.textColor ?? g.textColor;
  const buttonColor = block.buttonColor ?? g.buttonColor;

  const selected = selection.isSelected(block.id);
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    background: bg,
    maxWidth: 710,
    margin: '0 auto',
    position: 'relative',
  };

  function onMouseDown(e: React.MouseEvent) {
    if (!(e.metaKey || e.ctrlKey || e.shiftKey)) return;
    e.preventDefault();
    selection.toggle(block.id, e.shiftKey ? 'range' : 'single');
  }

  return (
    <motion.div key={block.id} layout transition={{ duration: 0.18, ease: 'easeOut' }}>
      <SectionInsertBar atIndex={index} />
      <motion.div
        ref={setNodeRef}
        layout
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: isDragging ? 0.5 : 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        style={style}
        className={`hero-wrap ${selected ? 'selected' : ''}`}
        data-selected={selected || undefined}
        onMouseDown={onMouseDown}
      >
        <BlockToolbar
          blockId={block.id}
          blockLabel={block.title ?? 'Hero'}
          dragAttributes={attributes as unknown as Record<string, unknown>}
          dragListeners={listeners as unknown as Record<string, unknown> | undefined}
        />
        <div style={{ padding: '40px 24px', textAlign: 'center' }}>
          <EditableImage
            value={block.imageSrc}
            onChange={(v) => update({ imageSrc: v })}
            alt={block.imageAlt}
            placeholderLabel="Hero image - click to add"
            imgStyle={{ maxWidth: '100%', height: 'auto', marginBottom: 16 }}
            altLabel="Hero image alt"
            onAltChange={(v) => update({ imageAlt: v })}
          />
          <h1 style={{ fontSize: titleSize, color: fg, fontWeight: 700, margin: '0 0 12px' }}>
            <EditableText
              value={block.title}
              onChange={(v) => update({ title: v })}
              singleLine
              placeholder="Click to add a hero title"
              ariaLabel="Hero title"
            />
          </h1>
          <p style={{ fontSize: subtitleSize, color: fg, margin: '0 0 24px' }}>
            <EditableText
              value={block.subtitle}
              onChange={(v) => update({ subtitle: v })}
              singleLine
              placeholder="Click to add a subtitle"
              ariaLabel="Hero subtitle"
            />
          </p>
          <a
            href={block.ctaUrl ?? g.contactUrl}
            target="_blank"
            rel="noreferrer"
            onClick={blockNav}
            style={{
              display: 'inline-block', background: buttonColor, color: g.buttonTextColor,
              padding: '14px 28px', borderRadius: 4, fontWeight: 600, textDecoration: 'none',
            }}
          >
            <span className="inline-link-wrap inline-flex items-center gap-1">
              <EditableText
                value={block.ctaText}
                onChange={(v) => update({ ctaText: v })}
                singleLine
                placeholder="CTA"
                ariaLabel="Hero CTA text"
                style={{ color: g.buttonTextColor }}
              />
              <EditableLink
                value={block.ctaUrl ?? ''}
                onChange={(v) => update({ ctaUrl: v || undefined })}
                ariaLabel="Edit hero CTA URL"
              />
            </span>
          </a>
        </div>
      </motion.div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: PASS. (No rendering test yet — covered by the integration tests in Task 12.)

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/blocks/HeroBlockView.tsx
git commit -m "feat(canvas): add HeroBlockView component"
```

---

## Task 7: ArticleView component

**Files:**
- Create: `src/components/editor/blocks/ArticleView.tsx`

- [ ] **Step 1: Create `src/components/editor/blocks/ArticleView.tsx`**

```tsx
'use client';
import { motion } from 'motion/react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ArticleBlock, GlobalStyles } from '@/lib/editor/types';
import { useEditorStore } from '@/lib/editor/StoreProvider';
import { useEditorMode } from '../EditorModeProvider';
import { useSectionSelection } from '../SectionSelectionProvider';
import { BlockToolbar } from '../canvas/BlockToolbar';
import { SectionInsertBar } from '../canvas/SectionInsertBar';
import { EditableText } from '../editable/EditableText';
import { EditableImage } from '../editable/EditableImage';
import { EditableLink } from '../editable/EditableLink';

interface Props {
  block: ArticleBlock;
  global: GlobalStyles;
  index: number;
  total: number;
}

export function ArticleView({ block, global: g, index, total: _total }: Props) {
  const store = useEditorStore();
  const update = (patch: Partial<Omit<ArticleBlock, 'type' | 'id'>>) =>
    store.getState().updateBlock(block.id, patch);
  const { mode } = useEditorMode();
  const selection = useSectionSelection();
  const blockNav = mode === 'edit' ? (e: React.MouseEvent) => e.preventDefault() : undefined;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });

  const titleSize = block.titleFontSize ?? g.headingFontSize;
  const bodySize = block.bodyFontSize ?? g.baseFontSize;
  const bg = block.backgroundColor ?? g.backgroundColor;
  const fg = block.textColor ?? g.textColor;

  const selected = selection.isSelected(block.id);
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    background: bg,
    maxWidth: 710,
    margin: '0 auto',
    position: 'relative',
  };

  function onMouseDown(e: React.MouseEvent) {
    if (!(e.metaKey || e.ctrlKey || e.shiftKey)) return;
    e.preventDefault();
    selection.toggle(block.id, e.shiftKey ? 'range' : 'single');
  }

  const ImageEl = (
    <EditableImage
      value={block.imageSrc}
      onChange={(v) => update({ imageSrc: v })}
      alt={block.imageAlt}
      placeholderLabel="Article image"
      imgStyle={{ maxWidth: '100%', height: 'auto' }}
      altLabel="Article image alt"
      onAltChange={(v) => update({ imageAlt: v })}
    />
  );

  const TextEl = (
    <>
      <h2 style={{ fontSize: titleSize, color: fg, fontWeight: 700, margin: '0 0 8px' }}>
        <EditableText
          value={block.title}
          onChange={(v) => update({ title: v })}
          singleLine
          placeholder="Click to add a title"
          ariaLabel="Article title"
        />
      </h2>
      <p style={{ fontSize: bodySize, color: fg, whiteSpace: 'pre-wrap', margin: '0 0 16px' }}>
        <EditableText
          value={block.body}
          onChange={(v) => update({ body: v })}
          placeholder="Click to add article body"
          ariaLabel="Article body"
        />
      </p>
      {(block.ctaText || block.ctaUrl) && (
        <a
          href={block.ctaUrl ?? g.contactUrl}
          target="_blank"
          rel="noreferrer"
          onClick={blockNav}
          style={{ color: g.buttonColor, fontWeight: 600, textDecoration: 'none' }}
        >
          <span className="inline-link-wrap inline-flex items-center gap-1">
            <EditableText
              value={block.ctaText}
              onChange={(v) => update({ ctaText: v })}
              singleLine
              placeholder="Read more"
              ariaLabel="Article CTA text"
            />
            <EditableLink
              value={block.ctaUrl ?? ''}
              onChange={(v) => update({ ctaUrl: v || undefined })}
              ariaLabel="Edit article CTA URL"
            />
          </span>
        </a>
      )}
    </>
  );

  let body: React.ReactNode;
  if (block.imagePosition === 'top') {
    body = (
      <div style={{ padding: 24 }}>
        <div style={{ marginBottom: 16 }}>{ImageEl}</div>
        {TextEl}
      </div>
    );
  } else if (block.imagePosition === 'left') {
    body = (
      <div style={{ display: 'flex', gap: 16, padding: 24 }}>
        <div style={{ flex: '0 0 40%' }}>{ImageEl}</div>
        <div style={{ flex: 1 }}>{TextEl}</div>
      </div>
    );
  } else {
    body = (
      <div style={{ display: 'flex', gap: 16, padding: 24, flexDirection: 'row-reverse' }}>
        <div style={{ flex: '0 0 40%' }}>{ImageEl}</div>
        <div style={{ flex: 1 }}>{TextEl}</div>
      </div>
    );
  }

  return (
    <motion.div key={block.id} layout transition={{ duration: 0.18, ease: 'easeOut' }}>
      <SectionInsertBar atIndex={index} />
      <motion.div
        ref={setNodeRef}
        layout
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: isDragging ? 0.5 : 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        style={style}
        className={`article-wrap ${selected ? 'selected' : ''}`}
        data-selected={selected || undefined}
        onMouseDown={onMouseDown}
      >
        <BlockToolbar
          blockId={block.id}
          blockLabel={block.title ?? 'Article'}
          dragAttributes={attributes as unknown as Record<string, unknown>}
          dragListeners={listeners as unknown as Record<string, unknown> | undefined}
        />
        {body}
      </motion.div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/blocks/ArticleView.tsx
git commit -m "feat(canvas): add ArticleView component with top/left/right image positions"
```

---

## Task 8: CTABannerView component

**Files:**
- Create: `src/components/editor/blocks/CTABannerView.tsx`

- [ ] **Step 1: Create `src/components/editor/blocks/CTABannerView.tsx`**

```tsx
'use client';
import { motion } from 'motion/react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CTABannerBlock, GlobalStyles } from '@/lib/editor/types';
import { useEditorStore } from '@/lib/editor/StoreProvider';
import { useEditorMode } from '../EditorModeProvider';
import { useSectionSelection } from '../SectionSelectionProvider';
import { BlockToolbar } from '../canvas/BlockToolbar';
import { SectionInsertBar } from '../canvas/SectionInsertBar';
import { EditableText } from '../editable/EditableText';
import { EditableLink } from '../editable/EditableLink';

interface Props {
  block: CTABannerBlock;
  global: GlobalStyles;
  index: number;
  total: number;
}

export function CTABannerView({ block, global: g, index, total: _total }: Props) {
  const store = useEditorStore();
  const update = (patch: Partial<Omit<CTABannerBlock, 'type' | 'id'>>) =>
    store.getState().updateBlock(block.id, patch);
  const { mode } = useEditorMode();
  const selection = useSectionSelection();
  const blockNav = mode === 'edit' ? (e: React.MouseEvent) => e.preventDefault() : undefined;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });

  const titleSize = block.titleFontSize ?? g.headingFontSize;
  const bg = block.backgroundColor ?? g.backgroundColor;
  const fg = block.textColor ?? g.textColor;
  const buttonColor = block.buttonColor ?? g.buttonColor;

  const selected = selection.isSelected(block.id);
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    background: bg,
    maxWidth: 710,
    margin: '0 auto',
    position: 'relative',
  };

  function onMouseDown(e: React.MouseEvent) {
    if (!(e.metaKey || e.ctrlKey || e.shiftKey)) return;
    e.preventDefault();
    selection.toggle(block.id, e.shiftKey ? 'range' : 'single');
  }

  const align = block.align;

  return (
    <motion.div key={block.id} layout transition={{ duration: 0.18, ease: 'easeOut' }}>
      <SectionInsertBar atIndex={index} />
      <motion.div
        ref={setNodeRef}
        layout
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: isDragging ? 0.5 : 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        style={style}
        className={`cta-banner-wrap ${selected ? 'selected' : ''}`}
        data-selected={selected || undefined}
        onMouseDown={onMouseDown}
      >
        <BlockToolbar
          blockId={block.id}
          blockLabel={block.title ?? 'CTA banner'}
          dragAttributes={attributes as unknown as Record<string, unknown>}
          dragListeners={listeners as unknown as Record<string, unknown> | undefined}
        />
        <div style={{ padding: '32px 24px', textAlign: align }}>
          <h2 style={{ fontSize: titleSize, color: fg, fontWeight: 700, margin: '0 0 8px' }}>
            <EditableText
              value={block.title}
              onChange={(v) => update({ title: v })}
              singleLine
              placeholder="CTA banner title"
              ariaLabel="CTA banner title"
            />
          </h2>
          <p style={{ color: fg, margin: '0 0 16px' }}>
            <EditableText
              value={block.subtitle}
              onChange={(v) => update({ subtitle: v })}
              singleLine
              placeholder="Optional subtitle"
              ariaLabel="CTA banner subtitle"
            />
          </p>
          <a
            href={block.ctaUrl ?? g.contactUrl}
            target="_blank"
            rel="noreferrer"
            onClick={blockNav}
            style={{
              display: 'inline-block', background: buttonColor, color: g.buttonTextColor,
              padding: '12px 24px', borderRadius: 4, fontWeight: 600, textDecoration: 'none',
            }}
          >
            <span className="inline-link-wrap inline-flex items-center gap-1">
              <EditableText
                value={block.ctaText}
                onChange={(v) => update({ ctaText: v })}
                singleLine
                placeholder="CTA text"
                ariaLabel="CTA banner CTA text"
                style={{ color: g.buttonTextColor }}
              />
              <EditableLink
                value={block.ctaUrl ?? ''}
                onChange={(v) => update({ ctaUrl: v || undefined })}
                ariaLabel="Edit CTA banner URL"
              />
            </span>
          </a>
        </div>
      </motion.div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/blocks/CTABannerView.tsx
git commit -m "feat(canvas): add CTABannerView component"
```

---

## Task 9: Wire new view components into `PreviewBody` + heterogeneous drag

**Files:**
- Modify: `src/components/editor/PreviewBody.tsx`

- [ ] **Step 1: Replace the file**

Open `src/components/editor/PreviewBody.tsx`. Replace its full body with:

```tsx
'use client';
import { useEffect } from 'react';
import { useEditor, useEditorStore } from '@/lib/editor/StoreProvider';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDragSensors } from './canvas/useDragSensors';
import { SectionInsertBar } from './canvas/SectionInsertBar';
import { useSectionSelection } from './SectionSelectionProvider';
import { SelectionActionBar } from './canvas/SelectionActionBar';
import { HeaderBlockView } from './blocks/HeaderBlockView';
import { ProductSectionView } from './blocks/ProductSectionView';
import { HeroBlockView } from './blocks/HeroBlockView';
import { ArticleView } from './blocks/ArticleView';
import { CTABannerView } from './blocks/CTABannerView';
import { FooterBlockView } from './blocks/FooterBlockView';
import { findHeader, findFooter } from '@/lib/editor/blocks';

export function PreviewBody() {
  const data = useEditor((s) => s.data);
  const store = useEditorStore();
  const sensors = useDragSensors();
  const reorderBlocks = store.getState().reorderBlocks;
  const selection = useSectionSelection();

  // Middle slice = everything between header and footer; heterogeneous drag operates on this.
  const middleBlocks = data.blocks.slice(1, -1);

  function onCanvasMouseDown(e: React.MouseEvent) {
    if (e.target === e.currentTarget) selection.clear();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && selection.selected.size > 0) selection.clear();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selection]);

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = middleBlocks.findIndex((b) => b.id === active.id);
    const newIndex = middleBlocks.findIndex((b) => b.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(middleBlocks, oldIndex, newIndex);
    const header = findHeader(data.blocks);
    const footer = findFooter(data.blocks);
    reorderBlocks([header, ...reordered, footer]);
  }

  return (
    <div
      className="preview-canvas"
      onMouseDown={onCanvasMouseDown}
      style={{ background: data.global.backgroundColor, padding: 0, minHeight: '100%', fontFamily: data.global.fontFamily }}
    >
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={middleBlocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          {data.blocks.map((block) => {
            switch (block.type) {
              case 'header':
                return <HeaderBlockView key={block.id} block={block} global={data.global} />;
              case 'product-section': {
                const idx = middleBlocks.findIndex((b) => b.id === block.id);
                return (
                  <ProductSectionView
                    key={block.id}
                    block={block}
                    global={data.global}
                    index={idx}
                    total={middleBlocks.length}
                  />
                );
              }
              case 'hero': {
                const idx = middleBlocks.findIndex((b) => b.id === block.id);
                return (
                  <HeroBlockView
                    key={block.id}
                    block={block}
                    global={data.global}
                    index={idx}
                    total={middleBlocks.length}
                  />
                );
              }
              case 'article': {
                const idx = middleBlocks.findIndex((b) => b.id === block.id);
                return (
                  <ArticleView
                    key={block.id}
                    block={block}
                    global={data.global}
                    index={idx}
                    total={middleBlocks.length}
                  />
                );
              }
              case 'cta-banner': {
                const idx = middleBlocks.findIndex((b) => b.id === block.id);
                return (
                  <CTABannerView
                    key={block.id}
                    block={block}
                    global={data.global}
                    index={idx}
                    total={middleBlocks.length}
                  />
                );
              }
              case 'footer':
                return <FooterBlockView key={block.id} block={block} global={data.global} />;
            }
          })}
          {middleBlocks.length === 0 && <SectionInsertBar atIndex={0} />}
          {middleBlocks.length > 0 && <SectionInsertBar atIndex={middleBlocks.length} />}
        </SortableContext>
      </DndContext>
      <SelectionActionBar />
    </div>
  );
}
```

Note: the `index` passed to `ProductSectionView` is now the **middle-slice index**, not the product-section-only index. `ProductSectionView` uses `index` for `reverse = index % 2 === 1`. This is acceptable: zebra-striping by middle position is still meaningful, and it preserves the existing snapshot for Blank/GlobalTT (since those templates' middle slice is product-sections only). The export snapshot tests will catch any byte-level drift.

- [ ] **Step 2: Verify type-check and existing tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS — including `renderEmail.snapshot.test.ts` (the renderer hasn't changed, only the canvas).

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/PreviewBody.tsx
git commit -m "feat(canvas): heterogeneous block switch and drag-reorder in PreviewBody"
```

---

## Task 10: HeroPanel sidebar component

**Files:**
- Create: `src/components/editor/panels/HeroPanel.tsx`

- [ ] **Step 1: Create `src/components/editor/panels/HeroPanel.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { ChevronDown, ChevronRight, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { useEditorStore } from '@/lib/editor/StoreProvider';
import { useCanEdit } from '@/lib/editor/RoleProvider';
import type { HeroBlock } from '@/lib/editor/types';
import { Input } from '@/components/ui/Input';
import { NumberInput } from '@/components/ui/NumberInput';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { Field } from '@/components/ui/Field';
import { ImageInput } from '../ImageInput';
import { confirmDialog } from '@/lib/utils/confirm';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils/cn';

interface Props { block: HeroBlock; index: number; total: number; }

export function HeroPanel({ block, index, total }: Props) {
  const [open, setOpen] = useState(false);
  const [overrides, setOverrides] = useState(false);
  const store = useEditorStore();
  const canEdit = useCanEdit();
  const set = (patch: Partial<Omit<HeroBlock, 'type' | 'id'>>) =>
    store.getState().updateBlock(block.id, patch);

  return (
    <div className={cn(
      'rounded-md border bg-ed-panel-2 overflow-hidden shadow-[inset_0_1px_0_rgba(237,231,220,0.04)]',
      open ? 'border-brand/40' : 'border-ed-rule',
    )}>
      <div className="flex items-center justify-between px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center gap-2 text-left text-[12px] font-semibold uppercase tracking-[0.14em] text-ed-ink-2 transition-colors hover:text-ed-ink"
        >
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <span className="truncate">Hero · {block.title || '(untitled)'}</span>
        </button>
        {canEdit && (
          <div className="flex items-center gap-1 text-ed-ink-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <button aria-label="Move block up" disabled={index === 0} onClick={() => store.getState().moveBlock(block.id, 'up')} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ed-ink-3 transition-colors hover:bg-ed-panel-3 hover:text-ed-ink disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ed-ink-3"><ArrowUp size={12} /></button>
              </TooltipTrigger>
              <TooltipContent>Move block up</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button aria-label="Move block down" disabled={index === total - 1} onClick={() => store.getState().moveBlock(block.id, 'down')} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ed-ink-3 transition-colors hover:bg-ed-panel-3 hover:text-ed-ink disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ed-ink-3"><ArrowDown size={12} /></button>
              </TooltipTrigger>
              <TooltipContent>Move block down</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button aria-label="Remove block" onClick={async () => {
                  const ok = await confirmDialog({
                    title: 'Remove block?',
                    message: `"${block.title || 'Hero'}" will be removed.`,
                    confirmLabel: 'Remove',
                    danger: true,
                  });
                  if (ok) store.getState().removeBlock(block.id);
                }} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ed-ink-3 transition-colors hover:bg-ed-panel-3 hover:text-ed-danger"><Trash2 size={12} /></button>
              </TooltipTrigger>
              <TooltipContent>Remove block</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
      {open && (
        <div className="border-t border-ed-rule">
          <fieldset disabled={!canEdit} className="space-y-3 p-3 min-w-0 disabled:opacity-70">
            <Field label="Image"><ImageInput value={block.imageSrc} onChange={(v) => set({ imageSrc: v })} /></Field>
            <Field label="Image alt"><Input value={block.imageAlt} onChange={(e) => set({ imageAlt: e.target.value })} /></Field>
            <Field label="Title"><Input value={block.title} onChange={(e) => set({ title: e.target.value })} /></Field>
            <Field label="Subtitle"><Input value={block.subtitle} onChange={(e) => set({ subtitle: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="CTA text"><Input value={block.ctaText} onChange={(e) => set({ ctaText: e.target.value })} /></Field>
              <Field label="CTA URL (override)"><Input value={block.ctaUrl ?? ''} onChange={(e) => set({ ctaUrl: e.target.value || undefined })} /></Field>
            </div>
          </fieldset>
          <div className="px-3 pb-3">
            <button type="button" onClick={() => setOverrides(o => !o)} className="text-xs text-ed-ink-4 hover:text-ed-ink w-full text-left pt-1 border-t border-ed-rule">
              Hero style overrides {overrides ? 'v' : '>'}
            </button>
            {overrides && (
              <fieldset disabled={!canEdit} className="grid grid-cols-2 gap-2 pt-1 min-w-0 disabled:opacity-70">
                <Field label="Title size px"><NumberInput value={block.titleFontSize ?? 0} onChange={(v) => set({ titleFontSize: v || undefined })} min={0} max={72} /></Field>
                <Field label="Subtitle size px"><NumberInput value={block.subtitleFontSize ?? 0} onChange={(v) => set({ subtitleFontSize: v || undefined })} min={0} max={32} /></Field>
                <Field label="Background"><ColorPicker value={block.backgroundColor ?? ''} onChange={(v) => set({ backgroundColor: v || undefined })} /></Field>
                <Field label="Text color"><ColorPicker value={block.textColor ?? ''} onChange={(v) => set({ textColor: v || undefined })} /></Field>
                <Field label="Button color"><ColorPicker value={block.buttonColor ?? ''} onChange={(v) => set({ buttonColor: v || undefined })} /></Field>
              </fieldset>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/panels/HeroPanel.tsx
git commit -m "feat(panels): add HeroPanel sidebar editor"
```

---

## Task 11: ArticlePanel sidebar component

**Files:**
- Create: `src/components/editor/panels/ArticlePanel.tsx`

- [ ] **Step 1: Create `src/components/editor/panels/ArticlePanel.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { ChevronDown, ChevronRight, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { useEditorStore } from '@/lib/editor/StoreProvider';
import { useCanEdit } from '@/lib/editor/RoleProvider';
import type { ArticleBlock } from '@/lib/editor/types';
import { Input } from '@/components/ui/Input';
import { NumberInput } from '@/components/ui/NumberInput';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { Textarea } from '@/components/ui/Textarea';
import { Field } from '@/components/ui/Field';
import { ImageInput } from '../ImageInput';
import { confirmDialog } from '@/lib/utils/confirm';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils/cn';

interface Props { block: ArticleBlock; index: number; total: number; }

const POSITIONS: Array<ArticleBlock['imagePosition']> = ['top', 'left', 'right'];

export function ArticlePanel({ block, index, total }: Props) {
  const [open, setOpen] = useState(false);
  const [overrides, setOverrides] = useState(false);
  const store = useEditorStore();
  const canEdit = useCanEdit();
  const set = (patch: Partial<Omit<ArticleBlock, 'type' | 'id'>>) =>
    store.getState().updateBlock(block.id, patch);

  return (
    <div className={cn(
      'rounded-md border bg-ed-panel-2 overflow-hidden shadow-[inset_0_1px_0_rgba(237,231,220,0.04)]',
      open ? 'border-brand/40' : 'border-ed-rule',
    )}>
      <div className="flex items-center justify-between px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center gap-2 text-left text-[12px] font-semibold uppercase tracking-[0.14em] text-ed-ink-2 transition-colors hover:text-ed-ink"
        >
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <span className="truncate">Article · {block.title || '(untitled)'}</span>
        </button>
        {canEdit && (
          <div className="flex items-center gap-1 text-ed-ink-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <button aria-label="Move block up" disabled={index === 0} onClick={() => store.getState().moveBlock(block.id, 'up')} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ed-ink-3 transition-colors hover:bg-ed-panel-3 hover:text-ed-ink disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ed-ink-3"><ArrowUp size={12} /></button>
              </TooltipTrigger>
              <TooltipContent>Move block up</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button aria-label="Move block down" disabled={index === total - 1} onClick={() => store.getState().moveBlock(block.id, 'down')} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ed-ink-3 transition-colors hover:bg-ed-panel-3 hover:text-ed-ink disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ed-ink-3"><ArrowDown size={12} /></button>
              </TooltipTrigger>
              <TooltipContent>Move block down</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button aria-label="Remove block" onClick={async () => {
                  const ok = await confirmDialog({
                    title: 'Remove block?',
                    message: `"${block.title || 'Article'}" will be removed.`,
                    confirmLabel: 'Remove',
                    danger: true,
                  });
                  if (ok) store.getState().removeBlock(block.id);
                }} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ed-ink-3 transition-colors hover:bg-ed-panel-3 hover:text-ed-danger"><Trash2 size={12} /></button>
              </TooltipTrigger>
              <TooltipContent>Remove block</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
      {open && (
        <div className="border-t border-ed-rule">
          <fieldset disabled={!canEdit} className="space-y-3 p-3 min-w-0 disabled:opacity-70">
            <Field label="Image"><ImageInput value={block.imageSrc} onChange={(v) => set({ imageSrc: v })} /></Field>
            <Field label="Image alt"><Input value={block.imageAlt} onChange={(e) => set({ imageAlt: e.target.value })} /></Field>
            <Field label="Image position">
              <div className="grid grid-cols-3 gap-1">
                {POSITIONS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => set({ imagePosition: p })}
                    className={cn(
                      'rounded-md border px-2 py-1 text-xs capitalize transition-colors',
                      block.imagePosition === p
                        ? 'border-brand text-ed-ink bg-ed-panel-3'
                        : 'border-ed-rule text-ed-ink-2 hover:border-brand',
                    )}
                  >{p}</button>
                ))}
              </div>
            </Field>
            <Field label="Title"><Input value={block.title} onChange={(e) => set({ title: e.target.value })} /></Field>
            <Field label="Body"><Textarea rows={5} value={block.body} onChange={(e) => set({ body: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="CTA text"><Input value={block.ctaText} onChange={(e) => set({ ctaText: e.target.value })} /></Field>
              <Field label="CTA URL (override)"><Input value={block.ctaUrl ?? ''} onChange={(e) => set({ ctaUrl: e.target.value || undefined })} /></Field>
            </div>
          </fieldset>
          <div className="px-3 pb-3">
            <button type="button" onClick={() => setOverrides(o => !o)} className="text-xs text-ed-ink-4 hover:text-ed-ink w-full text-left pt-1 border-t border-ed-rule">
              Article style overrides {overrides ? 'v' : '>'}
            </button>
            {overrides && (
              <fieldset disabled={!canEdit} className="grid grid-cols-2 gap-2 pt-1 min-w-0 disabled:opacity-70">
                <Field label="Title size px"><NumberInput value={block.titleFontSize ?? 0} onChange={(v) => set({ titleFontSize: v || undefined })} min={0} max={48} /></Field>
                <Field label="Body size px"><NumberInput value={block.bodyFontSize ?? 0} onChange={(v) => set({ bodyFontSize: v || undefined })} min={0} max={28} /></Field>
                <Field label="Background"><ColorPicker value={block.backgroundColor ?? ''} onChange={(v) => set({ backgroundColor: v || undefined })} /></Field>
                <Field label="Text color"><ColorPicker value={block.textColor ?? ''} onChange={(v) => set({ textColor: v || undefined })} /></Field>
              </fieldset>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/panels/ArticlePanel.tsx
git commit -m "feat(panels): add ArticlePanel sidebar editor"
```

---

## Task 12: CTABannerPanel sidebar component

**Files:**
- Create: `src/components/editor/panels/CTABannerPanel.tsx`

- [ ] **Step 1: Create `src/components/editor/panels/CTABannerPanel.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { ChevronDown, ChevronRight, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { useEditorStore } from '@/lib/editor/StoreProvider';
import { useCanEdit } from '@/lib/editor/RoleProvider';
import type { CTABannerBlock } from '@/lib/editor/types';
import { Input } from '@/components/ui/Input';
import { NumberInput } from '@/components/ui/NumberInput';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { Field } from '@/components/ui/Field';
import { confirmDialog } from '@/lib/utils/confirm';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils/cn';

interface Props { block: CTABannerBlock; index: number; total: number; }

const ALIGNS: Array<CTABannerBlock['align']> = ['left', 'center'];

export function CTABannerPanel({ block, index, total }: Props) {
  const [open, setOpen] = useState(false);
  const [overrides, setOverrides] = useState(false);
  const store = useEditorStore();
  const canEdit = useCanEdit();
  const set = (patch: Partial<Omit<CTABannerBlock, 'type' | 'id'>>) =>
    store.getState().updateBlock(block.id, patch);

  return (
    <div className={cn(
      'rounded-md border bg-ed-panel-2 overflow-hidden shadow-[inset_0_1px_0_rgba(237,231,220,0.04)]',
      open ? 'border-brand/40' : 'border-ed-rule',
    )}>
      <div className="flex items-center justify-between px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center gap-2 text-left text-[12px] font-semibold uppercase tracking-[0.14em] text-ed-ink-2 transition-colors hover:text-ed-ink"
        >
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <span className="truncate">CTA banner · {block.title || '(untitled)'}</span>
        </button>
        {canEdit && (
          <div className="flex items-center gap-1 text-ed-ink-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <button aria-label="Move block up" disabled={index === 0} onClick={() => store.getState().moveBlock(block.id, 'up')} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ed-ink-3 transition-colors hover:bg-ed-panel-3 hover:text-ed-ink disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ed-ink-3"><ArrowUp size={12} /></button>
              </TooltipTrigger>
              <TooltipContent>Move block up</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button aria-label="Move block down" disabled={index === total - 1} onClick={() => store.getState().moveBlock(block.id, 'down')} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ed-ink-3 transition-colors hover:bg-ed-panel-3 hover:text-ed-ink disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ed-ink-3"><ArrowDown size={12} /></button>
              </TooltipTrigger>
              <TooltipContent>Move block down</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button aria-label="Remove block" onClick={async () => {
                  const ok = await confirmDialog({
                    title: 'Remove block?',
                    message: `"${block.title || 'CTA banner'}" will be removed.`,
                    confirmLabel: 'Remove',
                    danger: true,
                  });
                  if (ok) store.getState().removeBlock(block.id);
                }} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ed-ink-3 transition-colors hover:bg-ed-panel-3 hover:text-ed-danger"><Trash2 size={12} /></button>
              </TooltipTrigger>
              <TooltipContent>Remove block</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
      {open && (
        <div className="border-t border-ed-rule">
          <fieldset disabled={!canEdit} className="space-y-3 p-3 min-w-0 disabled:opacity-70">
            <Field label="Title"><Input value={block.title} onChange={(e) => set({ title: e.target.value })} /></Field>
            <Field label="Subtitle"><Input value={block.subtitle} onChange={(e) => set({ subtitle: e.target.value })} /></Field>
            <Field label="Alignment">
              <div className="grid grid-cols-2 gap-1">
                {ALIGNS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => set({ align: a })}
                    className={cn(
                      'rounded-md border px-2 py-1 text-xs capitalize transition-colors',
                      block.align === a
                        ? 'border-brand text-ed-ink bg-ed-panel-3'
                        : 'border-ed-rule text-ed-ink-2 hover:border-brand',
                    )}
                  >{a}</button>
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="CTA text"><Input value={block.ctaText} onChange={(e) => set({ ctaText: e.target.value })} /></Field>
              <Field label="CTA URL (override)"><Input value={block.ctaUrl ?? ''} onChange={(e) => set({ ctaUrl: e.target.value || undefined })} /></Field>
            </div>
          </fieldset>
          <div className="px-3 pb-3">
            <button type="button" onClick={() => setOverrides(o => !o)} className="text-xs text-ed-ink-4 hover:text-ed-ink w-full text-left pt-1 border-t border-ed-rule">
              Banner style overrides {overrides ? 'v' : '>'}
            </button>
            {overrides && (
              <fieldset disabled={!canEdit} className="grid grid-cols-2 gap-2 pt-1 min-w-0 disabled:opacity-70">
                <Field label="Title size px"><NumberInput value={block.titleFontSize ?? 0} onChange={(v) => set({ titleFontSize: v || undefined })} min={0} max={48} /></Field>
                <Field label="Background"><ColorPicker value={block.backgroundColor ?? ''} onChange={(v) => set({ backgroundColor: v || undefined })} /></Field>
                <Field label="Text color"><ColorPicker value={block.textColor ?? ''} onChange={(v) => set({ textColor: v || undefined })} /></Field>
                <Field label="Button color"><ColorPicker value={block.buttonColor ?? ''} onChange={(v) => set({ buttonColor: v || undefined })} /></Field>
              </fieldset>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/panels/CTABannerPanel.tsx
git commit -m "feat(panels): add CTABannerPanel sidebar editor"
```

---

## Task 13: AddBlockMenu + sidebar integration (LeftPanel)

**Files:**
- Create: `src/components/editor/canvas/AddBlockMenu.tsx`
- Modify: `src/components/editor/LeftPanel.tsx`

- [ ] **Step 1: Create `src/components/editor/canvas/AddBlockMenu.tsx`**

```tsx
'use client';
import { Plus } from 'lucide-react';
import { useEditorStore } from '@/lib/editor/StoreProvider';
import { useCanEdit } from '@/lib/editor/RoleProvider';
import { insertableBlockTypes } from '@/lib/editor/blocks';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

export function AddBlockMenu() {
  const store = useEditorStore();
  const canEdit = useCanEdit();
  if (!canEdit) return null;
  const entries = insertableBlockTypes();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="block w-full rounded-md border border-dashed border-ed-rule-strong px-3 py-2 text-sm text-ed-ink-2 transition-colors hover:border-brand hover:text-ed-ink"
        >
          <span className="inline-flex items-center gap-1">
            <Plus size={12} /> Add block
            <span aria-hidden className="text-ed-ink-3">▾</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {entries.map(({ type, metadata }) => {
          const Icon = metadata.icon;
          return (
            <DropdownMenuItem
              key={type}
              onSelect={() => store.getState().addBlock(metadata.factory())}
            >
              <Icon size={14} className="text-ed-ink-2" />
              <span>{metadata.label}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 2: Update `src/components/editor/LeftPanel.tsx`**

Replace the file with:

```tsx
'use client';
import { AnimatePresence, motion } from 'motion/react';
import { GlobalStylesPanel } from './panels/GlobalStylesPanel';
import { HeaderPanel } from './panels/HeaderPanel';
import { FooterPanel } from './panels/FooterPanel';
import { ProductSectionPanel } from './panels/ProductSectionPanel';
import { HeroPanel } from './panels/HeroPanel';
import { ArticlePanel } from './panels/ArticlePanel';
import { CTABannerPanel } from './panels/CTABannerPanel';
import { AddBlockMenu } from './canvas/AddBlockMenu';
import { useEditor } from '@/lib/editor/StoreProvider';
import { fadeUp } from '@/lib/motion';

export function LeftPanel() {
  const blocks = useEditor((s) => s.data.blocks);
  const middleBlocks = blocks.slice(1, -1);
  const middleTotal = middleBlocks.length;

  return (
    <aside className="w-[320px] shrink-0 overflow-y-auto border-r border-ed-rule bg-ed-panel p-3 space-y-2">
      <GlobalStylesPanel />
      <AnimatePresence initial={false}>
        {blocks.map((block) => {
          const middleIndex = middleBlocks.findIndex((b) => b.id === block.id);
          return (
            <motion.div
              key={block.id}
              layout
              variants={fadeUp}
              initial="hidden"
              animate="show"
              exit="exit"
            >
              {block.type === 'header' && <HeaderPanel block={block} />}
              {block.type === 'product-section' && (
                <ProductSectionPanel block={block} index={middleIndex} total={middleTotal} />
              )}
              {block.type === 'hero' && (
                <HeroPanel block={block} index={middleIndex} total={middleTotal} />
              )}
              {block.type === 'article' && (
                <ArticlePanel block={block} index={middleIndex} total={middleTotal} />
              )}
              {block.type === 'cta-banner' && (
                <CTABannerPanel block={block} index={middleIndex} total={middleTotal} />
              )}
              {block.type === 'footer' && <FooterPanel block={block} />}
            </motion.div>
          );
        })}
      </AnimatePresence>
      <AddBlockMenu />
    </aside>
  );
}
```

Note 1: the `Products · N` subheader is fully removed (per spec).
Note 2: `ProductSectionPanel` previously received its index/total via the count of product-sections; now it gets the **middle-slice** index/total. This is consistent with `PreviewBody` and how the toolbar's move-up/down buttons interpret position. The button disabled state still correctly reflects "first / last in middle".

- [ ] **Step 3: Verify type-check and tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS. (Existing tests that asserted `+ Add Product Section` label will be replaced in the next task or already gone; if any test fails because of the renamed/removed button text, that is intentional — update the test in this commit to match.)

If any existing test in `tests/unit/` references the literal `"+ Add Product Section"`, update it to assert the new `Add block` button is present.

Run again until green.

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/canvas/AddBlockMenu.tsx src/components/editor/LeftPanel.tsx tests/unit
git commit -m "feat(sidebar): heterogeneous block panels and + Add block menu"
```

---

## Task 14: HTML export — dispatch + new render functions

**Files:**
- Modify: `src/lib/export/renderEmail.ts`

- [ ] **Step 1: Add failing test for hero rendering**

Append to `tests/unit/export.test.ts` (within the bottom of the file, after the existing describes):

```ts
describe('renderEmail (Phase 2 block types)', () => {
  function projectWithMiddle(middle: import('@/lib/editor/types').Block[]) {
    const base = createDefaultProject();
    const header = base.blocks[0];
    const footer = base.blocks[base.blocks.length - 1];
    return { ...base, blocks: [header, ...middle, footer] };
  }

  it('renders a hero block with title, subtitle, image, and CTA', () => {
    const hero: import('@/lib/editor/types').HeroBlock = {
      type: 'hero', id: 'h', imageSrc: 'https://example.com/h.png', imageAlt: 'pic',
      title: 'Big news', subtitle: 'Some sub', ctaText: 'Learn more', ctaUrl: 'https://example.com/x',
    };
    const html = renderEmail(projectWithMiddle([hero]));
    expect(html).toContain('Big news');
    expect(html).toContain('Some sub');
    expect(html).toContain('https://example.com/h.png');
    expect(html).toContain('https://example.com/x');
    expect(html).toContain('Learn more');
  });

  it('renders an article block with imagePosition=top', () => {
    const a: import('@/lib/editor/types').ArticleBlock = {
      type: 'article', id: 'a', imageSrc: 'https://example.com/a.png', imageAlt: '',
      title: 'Article title', body: 'Line 1\nLine 2', ctaText: 'Read', imagePosition: 'top',
    };
    const html = renderEmail(projectWithMiddle([a]));
    expect(html).toContain('Article title');
    expect(html).toContain('Line 1');
    expect(html).toContain('Line 2');
  });

  it('renders an article block with imagePosition=left as a two-column nested table', () => {
    const a: import('@/lib/editor/types').ArticleBlock = {
      type: 'article', id: 'a', imageSrc: 'https://example.com/a.png', imageAlt: '',
      title: 'Side by side', body: 'b', ctaText: 'Read', imagePosition: 'left',
    };
    const html = renderEmail(projectWithMiddle([a]));
    expect(html).toContain('Side by side');
    // Two-column nesting: at least two td cells inside the article row
    expect(html.split('class="article-col"').length - 1).toBeGreaterThanOrEqual(2);
  });

  it('renders a cta-banner block', () => {
    const c: import('@/lib/editor/types').CTABannerBlock = {
      type: 'cta-banner', id: 'c', title: 'Ready?', subtitle: 'Sub', ctaText: 'Go', align: 'center',
    };
    const html = renderEmail(projectWithMiddle([c]));
    expect(html).toContain('Ready?');
    expect(html).toContain('Sub');
    expect(html).toContain('text-align: center');
  });

  it('escapes XSS in hero title', () => {
    const hero: import('@/lib/editor/types').HeroBlock = {
      type: 'hero', id: 'h', imageSrc: '', imageAlt: '',
      title: '<script>x()</script>', subtitle: '', ctaText: 'Go',
    };
    const html = renderEmail(projectWithMiddle([hero]));
    expect(html).not.toContain('<script>x()</script>');
    expect(html).toContain('&lt;script&gt;x()&lt;/script&gt;');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/export.test.ts -t "Phase 2 block types"`
Expected: FAIL — the renderer doesn't yet know about `hero`, `article`, `cta-banner`.

- [ ] **Step 3: Update `src/lib/export/renderEmail.ts`**

Replace the imports block at the top of the file:

```ts
import type {
  ArticleBlock, Block, CTABannerBlock, Footer, Header, HeroBlock,
  ProductSection, ProjectData, SocialPlatform,
} from '@/lib/editor/types';
import { findHeader, findFooter } from '@/lib/editor/blocks';
import { attrEscape, htmlEscape, urlSafe } from './escape';
```

(removed unused `productSections`.)

Add these three new render functions immediately before `function renderBody(...)`:

```ts
function renderHero(block: HeroBlock, data: ProjectData): string {
  const bg = block.backgroundColor ?? data.global.backgroundColor;
  const fg = block.textColor ?? data.global.textColor;
  const buttonColor = block.buttonColor ?? data.global.buttonColor;
  const buttonTextColor = data.global.buttonTextColor;
  const titleSize = block.titleFontSize ?? Math.max(data.global.headingFontSize, 28);
  const subtitleSize = block.subtitleFontSize ?? data.global.baseFontSize;
  const ctaUrl = urlSafe(block.ctaUrl ?? data.global.contactUrl);
  const imageHtml = block.imageSrc
    ? `<img src="${attrEscape(urlSafe(block.imageSrc))}" alt="${attrEscape(block.imageAlt)}" style="display: block; max-width: 100%; height: auto; border: 0; margin: 0 auto 16px;">`
    : '';
  const subtitleHtml = block.subtitle
    ? `<p style="font-size: ${subtitleSize}px; color: ${attrEscape(fg)}; margin: 0 0 24px;">${htmlEscape(block.subtitle)}</p>`
    : '';
  return `<table role="presentation" class="row row-hero" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: ${attrEscape(bg)};">
<tr><td>
${MSO_OPEN}
<table role="presentation" class="row-content" width="710" border="0" cellpadding="0" cellspacing="0" align="center">
<tr><td align="center" style="padding: 40px 24px; color: ${attrEscape(fg)};">
${imageHtml}
<h1 style="font-size: ${titleSize}px; font-weight: 700; margin: 0 0 12px; color: ${attrEscape(fg)};">${htmlEscape(block.title)}</h1>
${subtitleHtml}
<a href="${attrEscape(ctaUrl)}" target="_blank" style="display: inline-block; padding: 14px 28px; background-color: ${attrEscape(buttonColor)}; color: ${attrEscape(buttonTextColor)}; text-decoration: none; font-weight: 600; border-radius: 4px;">${htmlEscape(block.ctaText)}</a>
</td></tr>
</table>
${MSO_CLOSE}
</td></tr>
</table>`;
}

function renderArticle(block: ArticleBlock, data: ProjectData): string {
  const bg = block.backgroundColor ?? data.global.backgroundColor;
  const fg = block.textColor ?? data.global.textColor;
  const titleSize = block.titleFontSize ?? data.global.headingFontSize;
  const bodySize = block.bodyFontSize ?? data.global.baseFontSize;
  const ctaUrl = urlSafe(block.ctaUrl ?? data.global.contactUrl);

  const imgHtml = block.imageSrc
    ? `<img src="${attrEscape(urlSafe(block.imageSrc))}" alt="${attrEscape(block.imageAlt)}" style="display: block; max-width: 100%; height: auto; border: 0;">`
    : '';
  const titleHtml = `<h2 style="margin: 0 0 8px; font-size: ${titleSize}px; color: ${attrEscape(fg)};">${htmlEscape(block.title)}</h2>`;
  const bodyHtml = `<p style="margin: 0 0 16px; font-size: ${bodySize}px; color: ${attrEscape(fg)}; white-space: pre-wrap;">${htmlEscape(block.body)}</p>`;
  const ctaHtml = block.ctaText
    ? `<a href="${attrEscape(ctaUrl)}" target="_blank" style="color: ${attrEscape(data.global.buttonColor)}; font-weight: 600; text-decoration: none;">${htmlEscape(block.ctaText)}</a>`
    : '';
  const textCell = `<td class="article-col article-text" valign="top" style="padding: 16px;">${titleHtml}${bodyHtml}${ctaHtml}</td>`;
  const imageCell = `<td class="article-col article-image" width="40%" valign="top" style="padding: 16px;">${imgHtml}</td>`;

  let inner: string;
  if (block.imagePosition === 'top') {
    inner = `<tr><td class="article-col article-image" valign="top" style="padding: 24px 24px 8px;">${imgHtml}</td></tr>
<tr>${textCell}</tr>`;
  } else if (block.imagePosition === 'left') {
    inner = `<tr>${imageCell}${textCell}</tr>`;
  } else {
    inner = `<tr>${textCell}${imageCell}</tr>`;
  }

  return `<table role="presentation" class="row row-article" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: ${attrEscape(bg)};">
<tr><td>
${MSO_OPEN}
<table role="presentation" class="row-content stack" width="710" border="0" cellpadding="0" cellspacing="0" align="center">
${inner}
</table>
${MSO_CLOSE}
</td></tr>
</table>`;
}

function renderCTABanner(block: CTABannerBlock, data: ProjectData): string {
  const bg = block.backgroundColor ?? data.global.backgroundColor;
  const fg = block.textColor ?? data.global.textColor;
  const buttonColor = block.buttonColor ?? data.global.buttonColor;
  const buttonTextColor = data.global.buttonTextColor;
  const titleSize = block.titleFontSize ?? data.global.headingFontSize;
  const ctaUrl = urlSafe(block.ctaUrl ?? data.global.contactUrl);

  const titleHtml = block.title
    ? `<h2 style="margin: 0 0 8px; font-size: ${titleSize}px; color: ${attrEscape(fg)};">${htmlEscape(block.title)}</h2>`
    : '';
  const subtitleHtml = block.subtitle
    ? `<p style="margin: 0 0 16px; color: ${attrEscape(fg)};">${htmlEscape(block.subtitle)}</p>`
    : '';

  return `<table role="presentation" class="row row-cta-banner" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: ${attrEscape(bg)};">
<tr><td>
${MSO_OPEN}
<table role="presentation" class="row-content" width="710" border="0" cellpadding="0" cellspacing="0" align="center">
<tr><td style="padding: 32px 24px; text-align: ${block.align};">
${titleHtml}
${subtitleHtml}
<a href="${attrEscape(ctaUrl)}" target="_blank" style="display: inline-block; padding: 12px 24px; background-color: ${attrEscape(buttonColor)}; color: ${attrEscape(buttonTextColor)}; text-decoration: none; font-weight: 600;">${htmlEscape(block.ctaText)}</a>
</td></tr>
</table>
${MSO_CLOSE}
</td></tr>
</table>`;
}
```

Then replace the existing `renderBody` with a dispatching version:

```ts
function renderBody(data: ProjectData): string {
  const bg = data.global.backgroundColor;
  const fontFamily = data.global.fontFamily;
  const fontSize = data.global.baseFontSize;
  const header = findHeader(data.blocks);
  const footer = findFooter(data.blocks);

  let middleIndex = -1;
  const middleHtml = data.blocks
    .map((block) => {
      switch (block.type) {
        case 'header':
        case 'footer':
          return '';
        case 'product-section': {
          middleIndex += 1;
          return renderSection(block, middleIndex, data);
        }
        case 'hero':
          middleIndex += 1;
          return renderHero(block, data);
        case 'article':
          middleIndex += 1;
          return renderArticle(block, data);
        case 'cta-banner':
          middleIndex += 1;
          return renderCTABanner(block, data);
      }
    })
    .filter(Boolean)
    .join('\n');

  return `<body style="margin: 0; padding: 0; background-color: ${attrEscape(bg)}; font-family: ${attrEscape(fontFamily)}; font-size: ${fontSize}px;">
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: ${attrEscape(bg)};">
<tr><td align="center">
${renderHeader(header, data.global.contactUrl)}
${middleHtml}
${renderFooter(footer, data)}
</td></tr>
</table>
</body>`;
}
```

Note: `middleIndex` is the **block index in the middle slice** (used by `renderSection` for `reverse = idx % 2`). For Blank and GlobalTT the middle is product-sections only, so behavior is identical to Phase 1 and the snapshot tests pass byte-equal. Verified below.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/export.test.ts`
Expected: ALL PASS — the new Phase 2 tests pass and the existing GlobalTT/Blank assertions still pass.

Run snapshot parity: `npx vitest run src/lib/export/renderEmail.snapshot.test.ts`
Expected: PASS — Blank and GlobalTT byte-equal.

- [ ] **Step 5: Commit**

```bash
git add src/lib/export/renderEmail.ts tests/unit/export.test.ts
git commit -m "feat(export): render hero, article, and cta-banner blocks"
```

---

## Task 15: Translate field walker — new namespace `blocks.${i}.*`

**Files:**
- Modify: `src/lib/translate/fields.ts`
- Modify: `tests/unit/translate.fields.test.ts`

- [ ] **Step 1: Write failing test**

Append to `tests/unit/translate.fields.test.ts`:

```ts
describe('translate fields (Phase 2 block types)', () => {
  function withMiddle(middle: import('@/lib/editor/types').Block[]): import('@/lib/editor/types').ProjectData {
    const base = createDefaultProject();
    const header = base.blocks[0];
    const footer = base.blocks[base.blocks.length - 1];
    return { ...base, blocks: [header, ...middle, footer] };
  }

  it('extracts hero, article, and cta-banner strings under blocks.${i}.* namespace', () => {
    const hero: import('@/lib/editor/types').HeroBlock = {
      type: 'hero', id: 'h', imageSrc: '', imageAlt: 'alt-h', title: 'HeroT', subtitle: 'HeroS', ctaText: 'HeroC',
    };
    const article: import('@/lib/editor/types').ArticleBlock = {
      type: 'article', id: 'a', imageSrc: '', imageAlt: 'alt-a', title: 'ArtT', body: 'ArtB', ctaText: 'ArtC', imagePosition: 'top',
    };
    const cta: import('@/lib/editor/types').CTABannerBlock = {
      type: 'cta-banner', id: 'c', title: 'CTAt', subtitle: 'CTAs', ctaText: 'CTAc', align: 'center',
    };
    const out = extractTranslatable(withMiddle([hero, article, cta]));
    // Header is at index 0, so hero is at 1, article at 2, cta at 3.
    expect(out['blocks.1.hero.title']).toBe('HeroT');
    expect(out['blocks.1.hero.subtitle']).toBe('HeroS');
    expect(out['blocks.1.hero.imageAlt']).toBe('alt-h');
    expect(out['blocks.1.hero.ctaText']).toBe('HeroC');
    expect(out['blocks.2.article.title']).toBe('ArtT');
    expect(out['blocks.2.article.body']).toBe('ArtB');
    expect(out['blocks.2.article.imageAlt']).toBe('alt-a');
    expect(out['blocks.2.article.ctaText']).toBe('ArtC');
    expect(out['blocks.3.ctaBanner.title']).toBe('CTAt');
    expect(out['blocks.3.ctaBanner.subtitle']).toBe('CTAs');
    expect(out['blocks.3.ctaBanner.ctaText']).toBe('CTAc');
  });

  it('applies translations back to the right blocks', () => {
    const hero: import('@/lib/editor/types').HeroBlock = {
      type: 'hero', id: 'h', imageSrc: '', imageAlt: 'orig', title: 'Orig', subtitle: 'Origs', ctaText: 'Origc',
    };
    const data = withMiddle([hero]);
    const translated = applyTranslations(data, {
      'blocks.1.hero.title': 'Translated',
      'blocks.1.hero.subtitle': 'Translateds',
      'blocks.1.hero.imageAlt': 'Translatedalt',
      'blocks.1.hero.ctaText': 'Translatedc',
    });
    const h = translated.blocks[1] as import('@/lib/editor/types').HeroBlock;
    expect(h.title).toBe('Translated');
    expect(h.subtitle).toBe('Translateds');
    expect(h.imageAlt).toBe('Translatedalt');
    expect(h.ctaText).toBe('Translatedc');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/translate.fields.test.ts`
Expected: FAIL — `blocks.*` keys are not produced or consumed.

- [ ] **Step 3: Replace `src/lib/translate/fields.ts`**

```ts
import type {
  ArticleBlock, Block, CTABannerBlock, HeroBlock, ProjectData,
} from '@/lib/editor/types';
import { findHeader, findFooter, productSections } from '@/lib/editor/blocks';

type StringMap = Record<string, string>;

function add(out: StringMap, key: string, value: unknown): void {
  if (typeof value === 'string' && value.length > 0) {
    out[key] = value;
  }
}

function extractHero(out: StringMap, i: number, b: HeroBlock): void {
  add(out, `blocks.${i}.hero.title`, b.title);
  add(out, `blocks.${i}.hero.subtitle`, b.subtitle);
  add(out, `blocks.${i}.hero.imageAlt`, b.imageAlt);
  add(out, `blocks.${i}.hero.ctaText`, b.ctaText);
}

function extractArticle(out: StringMap, i: number, b: ArticleBlock): void {
  add(out, `blocks.${i}.article.title`, b.title);
  add(out, `blocks.${i}.article.body`, b.body);
  add(out, `blocks.${i}.article.imageAlt`, b.imageAlt);
  add(out, `blocks.${i}.article.ctaText`, b.ctaText);
}

function extractCTABanner(out: StringMap, i: number, b: CTABannerBlock): void {
  add(out, `blocks.${i}.ctaBanner.title`, b.title);
  add(out, `blocks.${i}.ctaBanner.subtitle`, b.subtitle);
  add(out, `blocks.${i}.ctaBanner.ctaText`, b.ctaText);
}

export function extractTranslatable(data: ProjectData): StringMap {
  const out: StringMap = {};
  const header = findHeader(data.blocks);
  const footer = findFooter(data.blocks);
  const sections = productSections(data.blocks);

  // Existing header.* / sections.* / footer.* keys (unchanged).
  add(out, 'header.title', header.title);
  add(out, 'header.sectionHeading', header.sectionHeading);
  add(out, 'header.logoAlt', header.logoAlt);
  add(out, 'header.bannerAlt', header.bannerAlt);

  sections.forEach((s, i) => {
    add(out, `sections.${i}.title`, s.title);
    add(out, `sections.${i}.imageAlt`, s.imageAlt);
    add(out, `sections.${i}.ctaText`, s.ctaText);
    s.bullets.forEach((b, j) => add(out, `sections.${i}.bullets.${j}`, b));
  });

  add(out, 'footer.bannerAlt', footer.bannerAlt);
  add(out, 'footer.companyName', footer.companyName);
  add(out, 'footer.address', footer.address);
  footer.websites.forEach((w, i) => add(out, `footer.websites.${i}.label`, w.label));

  // New blocks.${i}.* namespace for Phase 2 block types (full-blocks-array index).
  data.blocks.forEach((block, i) => {
    if (block.type === 'hero') extractHero(out, i, block);
    else if (block.type === 'article') extractArticle(out, i, block);
    else if (block.type === 'cta-banner') extractCTABanner(out, i, block);
  });

  return out;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function isUsableString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function applyHero(b: HeroBlock, i: number, t: StringMap): void {
  const title = t[`blocks.${i}.hero.title`]; if (isUsableString(title)) b.title = title;
  const sub = t[`blocks.${i}.hero.subtitle`]; if (isUsableString(sub)) b.subtitle = sub;
  const alt = t[`blocks.${i}.hero.imageAlt`]; if (isUsableString(alt)) b.imageAlt = alt;
  const cta = t[`blocks.${i}.hero.ctaText`]; if (isUsableString(cta)) b.ctaText = cta;
}

function applyArticle(b: ArticleBlock, i: number, t: StringMap): void {
  const title = t[`blocks.${i}.article.title`]; if (isUsableString(title)) b.title = title;
  const body = t[`blocks.${i}.article.body`]; if (isUsableString(body)) b.body = body;
  const alt = t[`blocks.${i}.article.imageAlt`]; if (isUsableString(alt)) b.imageAlt = alt;
  const cta = t[`blocks.${i}.article.ctaText`]; if (isUsableString(cta)) b.ctaText = cta;
}

function applyCTABanner(b: CTABannerBlock, i: number, t: StringMap): void {
  const title = t[`blocks.${i}.ctaBanner.title`]; if (isUsableString(title)) b.title = title;
  const sub = t[`blocks.${i}.ctaBanner.subtitle`]; if (isUsableString(sub)) b.subtitle = sub;
  const cta = t[`blocks.${i}.ctaBanner.ctaText`]; if (isUsableString(cta)) b.ctaText = cta;
}

export function applyTranslations(data: ProjectData, translations: StringMap): ProjectData {
  const out: ProjectData = deepClone(data);
  const header = findHeader(out.blocks);
  const footer = findFooter(out.blocks);
  const sections = productSections(out.blocks);

  // Existing header.* / sections.* / footer.* (unchanged).
  if (isUsableString(translations['header.title'])) header.title = translations['header.title'];
  if (isUsableString(translations['header.sectionHeading'])) header.sectionHeading = translations['header.sectionHeading'];
  if (isUsableString(translations['header.logoAlt'])) header.logoAlt = translations['header.logoAlt'];
  if (isUsableString(translations['header.bannerAlt'])) header.bannerAlt = translations['header.bannerAlt'];

  sections.forEach((s, i) => {
    const t = translations[`sections.${i}.title`]; if (isUsableString(t)) s.title = t;
    const ia = translations[`sections.${i}.imageAlt`]; if (isUsableString(ia)) s.imageAlt = ia;
    const ct = translations[`sections.${i}.ctaText`]; if (isUsableString(ct)) s.ctaText = ct;
    s.bullets.forEach((_, j) => {
      const b = translations[`sections.${i}.bullets.${j}`];
      if (isUsableString(b)) s.bullets[j] = b;
    });
  });

  if (isUsableString(translations['footer.bannerAlt'])) footer.bannerAlt = translations['footer.bannerAlt'];
  if (isUsableString(translations['footer.companyName'])) footer.companyName = translations['footer.companyName'];
  if (isUsableString(translations['footer.address'])) footer.address = translations['footer.address'];
  footer.websites.forEach((w, i) => {
    const lab = translations[`footer.websites.${i}.label`]; if (isUsableString(lab)) w.label = lab;
  });

  // New blocks.${i}.* namespace.
  out.blocks.forEach((block: Block, i) => {
    if (block.type === 'hero') applyHero(block, i, translations);
    else if (block.type === 'article') applyArticle(block, i, translations);
    else if (block.type === 'cta-banner') applyCTABanner(block, i, translations);
  });

  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/translate.fields.test.ts`
Expected: PASS for both old and new translate tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/translate/fields.ts tests/unit/translate.fields.test.ts
git commit -m "feat(translate): support blocks.\${i}.* namespace for Phase 2 block types"
```

---

## Task 16: Template factories — Newsletter, Announcement, Event Invite

**Files:**
- Create: `src/lib/editor/templates/newsletter.ts`
- Create: `src/lib/editor/templates/announcement.ts`
- Create: `src/lib/editor/templates/eventInvite.ts`
- Modify: `src/lib/editor/templates.ts`
- Create: `tests/unit/templates.phase2.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/unit/templates.phase2.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  createNewsletterTemplate,
  createAnnouncementTemplate,
  createEventInviteTemplate,
  TEMPLATES,
} from '@/lib/editor/templates';

describe('Phase 2 templates', () => {
  it('newsletter has header, hero, three articles (top), cta-banner, footer', () => {
    const p = createNewsletterTemplate();
    const types = p.blocks.map((b) => b.type);
    expect(types[0]).toBe('header');
    expect(types[types.length - 1]).toBe('footer');
    expect(types.filter((t) => t === 'hero').length).toBe(1);
    expect(types.filter((t) => t === 'article').length).toBe(3);
    expect(types.filter((t) => t === 'cta-banner').length).toBe(1);
    const articles = p.blocks.filter((b) => b.type === 'article');
    for (const a of articles) {
      if (a.type !== 'article') throw new Error('type narrow');
      expect(a.imagePosition).toBe('top');
    }
  });

  it('announcement has header, hero, one article (left), cta-banner, footer', () => {
    const p = createAnnouncementTemplate();
    const types = p.blocks.map((b) => b.type);
    expect(types).toEqual(['header', 'hero', 'article', 'cta-banner', 'footer']);
    const art = p.blocks.find((b) => b.type === 'article');
    if (!art || art.type !== 'article') throw new Error('missing article');
    expect(art.imagePosition).toBe('left');
  });

  it('event-invite has header, hero, one article (left), three product-sections, cta-banner, footer', () => {
    const p = createEventInviteTemplate();
    const types = p.blocks.map((b) => b.type);
    expect(types).toEqual([
      'header', 'hero', 'article',
      'product-section', 'product-section', 'product-section',
      'cta-banner', 'footer',
    ]);
  });

  it('TEMPLATES registers five entries with groups', () => {
    expect(TEMPLATES.length).toBe(5);
    const ids = TEMPLATES.map((t) => t.id).sort();
    expect(ids).toEqual(['announcement', 'blank', 'event-invite', 'globaltt', 'newsletter']);
    for (const t of TEMPLATES) {
      expect(['Quick start', 'Layouts']).toContain(t.group);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/templates.phase2.test.ts`
Expected: FAIL — none of the three factories exist; `TemplateDefinition` has no `group`.

- [ ] **Step 3: Create `src/lib/editor/templates/newsletter.ts`**

```ts
import type { ProjectData } from '../types';
import { SCHEMA_VERSION } from '../types';
import {
  makeHeaderBlock, makeFooterBlock, makeHeroBlock, makeArticleBlock, makeCTABannerBlock,
} from '../blocks';

export function createNewsletterTemplate(): ProjectData {
  return {
    schemaVersion: SCHEMA_VERSION,
    global: {
      backgroundColor: '#ffffff',
      fontFamily: 'Arial, Helvetica Neue, Helvetica, sans-serif',
      baseFontSize: 16,
      headingFontSize: 25,
      textColor: '#1c1c1c',
      buttonColor: '#f1592a',
      buttonTextColor: '#ffffff',
      accentColor: '#f1592a',
      footerBackgroundColor: '#000000',
      footerTextColor: '#fafafa',
      contactUrl: '',
    },
    blocks: [
      makeHeaderBlock({ title: 'Monthly update', sectionHeading: 'What we shipped this month' }),
      makeHeroBlock({
        title: 'This month at our company',
        subtitle: 'A short note from the team — the highlights, in one place.',
        ctaText: 'See the full update',
      }),
      makeArticleBlock({
        title: 'Story one',
        body: 'A short paragraph or two about the first story. Keep it under five lines.',
        ctaText: 'Read more',
        imagePosition: 'top',
      }),
      makeArticleBlock({
        title: 'Story two',
        body: 'Another short paragraph. Newsletter readers skim — short beats long.',
        ctaText: 'Read more',
        imagePosition: 'top',
      }),
      makeArticleBlock({
        title: 'Story three',
        body: 'Wrap up with a third item that nudges readers toward the next step.',
        ctaText: 'Read more',
        imagePosition: 'top',
      }),
      makeCTABannerBlock({
        title: 'Want more?',
        subtitle: 'Get future editions straight to your inbox.',
        ctaText: 'Subscribe →',
        align: 'center',
      }),
      makeFooterBlock(),
    ],
  };
}
```

- [ ] **Step 4: Create `src/lib/editor/templates/announcement.ts`**

```ts
import type { ProjectData } from '../types';
import { SCHEMA_VERSION } from '../types';
import {
  makeHeaderBlock, makeFooterBlock, makeHeroBlock, makeArticleBlock, makeCTABannerBlock,
} from '../blocks';

export function createAnnouncementTemplate(): ProjectData {
  return {
    schemaVersion: SCHEMA_VERSION,
    global: {
      backgroundColor: '#ffffff',
      fontFamily: 'Arial, Helvetica Neue, Helvetica, sans-serif',
      baseFontSize: 16,
      headingFontSize: 25,
      textColor: '#1c1c1c',
      buttonColor: '#f1592a',
      buttonTextColor: '#ffffff',
      accentColor: '#f1592a',
      footerBackgroundColor: '#000000',
      footerTextColor: '#fafafa',
      contactUrl: '',
    },
    blocks: [
      makeHeaderBlock({ title: 'Big news', sectionHeading: '' }),
      makeHeroBlock({
        title: "We're launching something new",
        subtitle: 'A short, punchy sentence about why this matters.',
        ctaText: 'Get the details',
      }),
      makeArticleBlock({
        title: 'Why this matters',
        body: 'A few sentences of supporting context. Lead with the customer benefit; explain the mechanism second.',
        ctaText: 'Read the post',
        imagePosition: 'left',
      }),
      makeCTABannerBlock({
        title: 'Ready to try it?',
        subtitle: '',
        ctaText: 'Get started',
        align: 'center',
      }),
      makeFooterBlock(),
    ],
  };
}
```

- [ ] **Step 5: Create `src/lib/editor/templates/eventInvite.ts`**

```ts
import type { ProjectData } from '../types';
import { SCHEMA_VERSION } from '../types';
import {
  makeHeaderBlock, makeFooterBlock,
  makeHeroBlock, makeArticleBlock, makeCTABannerBlock, makeProductSectionBlock,
} from '../blocks';

export function createEventInviteTemplate(): ProjectData {
  return {
    schemaVersion: SCHEMA_VERSION,
    global: {
      backgroundColor: '#ffffff',
      fontFamily: 'Arial, Helvetica Neue, Helvetica, sans-serif',
      baseFontSize: 16,
      headingFontSize: 25,
      textColor: '#1c1c1c',
      buttonColor: '#f1592a',
      buttonTextColor: '#ffffff',
      accentColor: '#f1592a',
      footerBackgroundColor: '#000000',
      footerTextColor: '#fafafa',
      contactUrl: '',
    },
    blocks: [
      makeHeaderBlock({ title: "You're invited", sectionHeading: '' }),
      makeHeroBlock({
        title: 'Our annual event',
        subtitle: 'Date · Location · Format',
        ctaText: 'RSVP',
      }),
      makeArticleBlock({
        title: 'What to expect',
        body: 'A short description of the day. Cover format, audience, and what attendees will leave with.',
        ctaText: 'View agenda',
        imagePosition: 'left',
      }),
      makeProductSectionBlock({
        title: 'Session one',
        bullets: ['Speaker name', 'Topic summary', 'Time'],
        ctaText: 'Add to calendar',
      }),
      makeProductSectionBlock({
        title: 'Session two',
        bullets: ['Speaker name', 'Topic summary', 'Time'],
        ctaText: 'Add to calendar',
      }),
      makeProductSectionBlock({
        title: 'Session three',
        bullets: ['Speaker name', 'Topic summary', 'Time'],
        ctaText: 'Add to calendar',
      }),
      makeCTABannerBlock({
        title: 'See you there?',
        subtitle: 'Reserve your spot — seats are limited.',
        ctaText: 'Reserve your spot →',
        align: 'center',
      }),
      makeFooterBlock(),
    ],
  };
}
```

- [ ] **Step 6: Update `src/lib/editor/templates.ts`**

Replace the file with:

```ts
import type { ProjectData } from './types';
import { SCHEMA_VERSION } from './types';
import { makeHeaderBlock, makeFooterBlock, makeProductSectionBlock } from './blocks';
import { createDefaultProject } from './defaultProject';
import { createNewsletterTemplate } from './templates/newsletter';
import { createAnnouncementTemplate } from './templates/announcement';
import { createEventInviteTemplate } from './templates/eventInvite';

export interface TemplateDefinition {
  id: string;
  label: string;
  description: string;
  factory: () => ProjectData;
  group: 'Quick start' | 'Layouts';
}

const BLANK_SECTION_COUNT = 8;

export function createBlankProject(): ProjectData {
  return {
    schemaVersion: SCHEMA_VERSION,
    global: {
      backgroundColor: '#d0d0d0',
      fontFamily: 'Arial, Helvetica Neue, Helvetica, sans-serif',
      baseFontSize: 16,
      headingFontSize: 25,
      textColor: '#000000',
      buttonColor: '#f1592a',
      buttonTextColor: '#ffffff',
      accentColor: '#f1592a',
      footerBackgroundColor: '#000000',
      footerTextColor: '#fafafa',
      contactUrl: '',
    },
    blocks: [
      makeHeaderBlock(),
      ...Array.from({ length: BLANK_SECTION_COUNT }, () =>
        makeProductSectionBlock({
          title: '',
          bullets: ['', '', '', '', ''],
          ctaText: 'Contact Us',
        }),
      ),
      makeFooterBlock(),
    ],
  };
}

export { createNewsletterTemplate, createAnnouncementTemplate, createEventInviteTemplate };

export const TEMPLATES: TemplateDefinition[] = [
  { id: 'blank',        label: 'Blank',        description: 'Same layout, empty fields. Fill in your own logo, sections, and footer.', factory: createBlankProject,         group: 'Quick start' },
  { id: 'globaltt',     label: 'GlobalTT',     description: "Pre-filled with GlobalTT's default copy and product sections.",          factory: createDefaultProject,       group: 'Quick start' },
  { id: 'newsletter',   label: 'Newsletter',   description: 'Hero + articles + CTA. Recurring digest format.',                          factory: createNewsletterTemplate,   group: 'Layouts'     },
  { id: 'announcement', label: 'Announcement', description: 'Hero + supporting article + CTA. Single big message.',                     factory: createAnnouncementTemplate, group: 'Layouts'     },
  { id: 'event-invite', label: 'Event invite', description: 'Hero, agenda, speakers/sessions, RSVP CTA.',                               factory: createEventInviteTemplate,  group: 'Layouts'     },
];

export function getTemplate(id: string | undefined | null): TemplateDefinition {
  if (!id) return TEMPLATES[0];
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run tests/unit/templates.phase2.test.ts`
Expected: PASS.

Also run full suite: `npx tsc --noEmit && npx vitest run`. Expected: green.

- [ ] **Step 8: Commit**

```bash
git add src/lib/editor/templates.ts src/lib/editor/templates tests/unit/templates.phase2.test.ts
git commit -m "feat(templates): add Newsletter, Announcement, Event Invite layouts"
```

---

## Task 17: NewProjectDialog — grouped template cards

**Files:**
- Modify: `src/components/dashboard/NewProjectDialog.tsx`

- [ ] **Step 1: Replace the grid section in `src/components/dashboard/NewProjectDialog.tsx`**

Find (around lines 92–112):

```tsx
<div className="grid grid-cols-2 gap-3 mb-6">
  {TEMPLATES.map((t) => {
    const active = selected === t.id;
    return (
      <button
        key={t.id}
        type="button"
        onClick={() => setSelected(t.id)}
        className={cn(
          'text-left rounded-lg p-4 border transition',
          active
            ? 'border-brand bg-bg-sunken'
            : 'border-rule bg-bg-sunken hover:border-brand',
        )}
      >
        <div className="font-semibold text-ink">{t.label}</div>
        <div className="text-xs text-ink-3 mt-1">{t.description}</div>
      </button>
    );
  })}
</div>
```

Replace with:

```tsx
{(['Quick start', 'Layouts'] as const).map((group) => {
  const entries = TEMPLATES.filter((t) => t.group === group);
  if (entries.length === 0) return null;
  return (
    <section key={group} className="mb-5">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.05em] text-ink-3">{group}</div>
      <div className="grid grid-cols-2 gap-3">
        {entries.map((t) => {
          const active = selected === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelected(t.id)}
              className={cn(
                'text-left rounded-lg p-4 border transition',
                active
                  ? 'border-brand bg-bg-sunken'
                  : 'border-rule bg-bg-sunken hover:border-brand',
              )}
            >
              <div className="font-semibold text-ink">{t.label}</div>
              <div className="text-xs text-ink-3 mt-1">{t.description}</div>
            </button>
          );
        })}
      </div>
    </section>
  );
})}
```

(Remove the trailing `mb-6` div that wrapped the original `.grid grid-cols-2`; the per-group sections handle spacing.)

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/NewProjectDialog.tsx
git commit -m "feat(dashboard): group templates by Quick start / Layouts in NewProjectDialog"
```

---

## Task 18: Render baselines for new templates + snapshot tests

**Files:**
- Modify: `scripts/capture-render-baseline.ts`
- Modify: `src/lib/export/renderEmail.snapshot.test.ts`
- Create: `src/lib/export/__fixtures__/baseline-newsletter.html`
- Create: `src/lib/export/__fixtures__/baseline-announcement.html`
- Create: `src/lib/export/__fixtures__/baseline-event-invite.html`

- [ ] **Step 1: Update `scripts/capture-render-baseline.ts`**

Replace with:

```ts
import { writeFileSync, mkdirSync } from 'node:fs';
import { renderEmail } from '../src/lib/export/renderEmail';
import { createDefaultProject } from '../src/lib/editor/defaultProject';
import {
  createBlankProject,
  createNewsletterTemplate,
  createAnnouncementTemplate,
  createEventInviteTemplate,
} from '../src/lib/editor/templates';

mkdirSync('src/lib/export/__fixtures__', { recursive: true });
writeFileSync('src/lib/export/__fixtures__/baseline-globaltt.html',     renderEmail(createDefaultProject()));
writeFileSync('src/lib/export/__fixtures__/baseline-blank.html',        renderEmail(createBlankProject()));
writeFileSync('src/lib/export/__fixtures__/baseline-newsletter.html',   renderEmail(createNewsletterTemplate()));
writeFileSync('src/lib/export/__fixtures__/baseline-announcement.html', renderEmail(createAnnouncementTemplate()));
writeFileSync('src/lib/export/__fixtures__/baseline-event-invite.html', renderEmail(createEventInviteTemplate()));
console.log('Wrote baselines');
```

- [ ] **Step 2: Generate the three new baselines (and re-confirm the two existing ones)**

```bash
npx tsx scripts/capture-render-baseline.ts
```

Expected output:
```
Wrote baselines
```

Then check `git status` — confirm:
- `src/lib/export/__fixtures__/baseline-newsletter.html` (new)
- `src/lib/export/__fixtures__/baseline-announcement.html` (new)
- `src/lib/export/__fixtures__/baseline-event-invite.html` (new)
- `src/lib/export/__fixtures__/baseline-globaltt.html` — **must be unchanged** (or git diff is empty)
- `src/lib/export/__fixtures__/baseline-blank.html` — **must be unchanged**

If `baseline-globaltt.html` or `baseline-blank.html` shows any diff, the renderer or template logic accidentally changed for Phase 1 templates. Stop and investigate before proceeding.

- [ ] **Step 3: Update `src/lib/export/renderEmail.snapshot.test.ts`**

Replace with:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderEmail } from './renderEmail';
import { createDefaultProject } from '../editor/defaultProject';
import {
  createBlankProject,
  createNewsletterTemplate,
  createAnnouncementTemplate,
  createEventInviteTemplate,
} from '../editor/templates';

describe('renderEmail snapshot parity', () => {
  it('GlobalTT template renders byte-equal to baseline', () => {
    const baseline = readFileSync('src/lib/export/__fixtures__/baseline-globaltt.html', 'utf8');
    expect(renderEmail(createDefaultProject())).toBe(baseline);
  });

  it('Blank template renders byte-equal to baseline', () => {
    const baseline = readFileSync('src/lib/export/__fixtures__/baseline-blank.html', 'utf8');
    expect(renderEmail(createBlankProject())).toBe(baseline);
  });

  it('Newsletter template renders byte-equal to baseline', () => {
    const baseline = readFileSync('src/lib/export/__fixtures__/baseline-newsletter.html', 'utf8');
    expect(renderEmail(createNewsletterTemplate())).toBe(baseline);
  });

  it('Announcement template renders byte-equal to baseline', () => {
    const baseline = readFileSync('src/lib/export/__fixtures__/baseline-announcement.html', 'utf8');
    expect(renderEmail(createAnnouncementTemplate())).toBe(baseline);
  });

  it('Event Invite template renders byte-equal to baseline', () => {
    const baseline = readFileSync('src/lib/export/__fixtures__/baseline-event-invite.html', 'utf8');
    expect(renderEmail(createEventInviteTemplate())).toBe(baseline);
  });
});
```

- [ ] **Step 4: Run snapshot tests**

Run: `npx vitest run src/lib/export/renderEmail.snapshot.test.ts`
Expected: ALL FIVE PASS.

- [ ] **Step 5: Run the full test suite + type-check + lint**

```bash
npx tsc --noEmit && npm run lint && npx vitest run
```

Expected: ALL GREEN.

- [ ] **Step 6: Commit**

```bash
git add scripts/capture-render-baseline.ts src/lib/export/renderEmail.snapshot.test.ts src/lib/export/__fixtures__
git commit -m "test(export): snapshot baselines for Newsletter, Announcement, Event Invite"
```

---

## Final smoke check (post-task-18, before merge)

After all 18 tasks land:

- [ ] **Run all checks one more time**

```bash
npx tsc --noEmit && npm run lint && npx vitest run
```

Expected: ALL GREEN.

- [ ] **Start the dev server and manual-smoke**

```bash
npm run dev
```

Walk the smoke checklist from the spec (`docs/superpowers/specs/2026-05-21-multilayout-templates-design.md`, "Manual smoke (Phase 2)" section):

1. Open `/w/<slug>` → "+ New Project" → confirm the two subheadings ("Quick start" / "Layouts") with 2 cards and 3 cards respectively.
2. Open each of the three new templates → confirm canvas renders the expected block structure.
3. Click "+ Add block ▾" in the sidebar → confirm four entries (Product section, Hero, Article, CTA banner) and that each inserts a block before the footer.
4. Drag a Hero past an Article past a ProductSection in any project — confirm order persists, save indicator pulses, reload preserves order.
5. Toolbar duplicate / move-up / move-down / delete works on each new block type.
6. Click "Download HTML" on a project containing each new block type → open the file in a browser → renders without console errors.
7. Translate a Newsletter project to French (or any non-English language) → new sibling project has translated copy on every Hero, Article, and CTA Banner string.

If any of the above fails, file an issue and fix before merging.

---

## Self-review summary (filled in after writing — see "Self-Review" section of writing-plans skill)

(Filled in during plan write-up.)
