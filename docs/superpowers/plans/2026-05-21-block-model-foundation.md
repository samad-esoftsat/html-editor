# Block Model Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `ProjectData` from `{ header, sections[], footer }` into `{ blocks: Block[] }` with discriminated-union Block types. Zero user-visible change. Foundation for Phase 2 multi-layout templates.

**Architecture:** A `Block` discriminated union (`HeaderBlock | ProductSectionBlock | FooterBlock`) replaces today's named-field shape. A pure `migrate(v1)` upgrades legacy documents lazily on read. Editor canvas, sidebar, store, export renderer, and server-side string-extraction become block-walkers that dispatch on `block.type` via exhaustive `switch`. Phase 1 enforces the invariant `[header, ...productSections, footer]` so behavior is identical to today.

**Tech Stack:** Next.js 15 (App Router), TypeScript strict, Zustand + zundo, motion/react, Supabase (JSONB storage), Vitest, Playwright (E2E).

**Spec reference:** `docs/superpowers/specs/2026-05-21-block-model-foundation-design.md`

---

## File Structure

**New files:**
- `src/lib/editor/migrate.ts` — `migrate(raw): ProjectData` and inverse `downgradeV2ToV1` utility.
- `src/lib/editor/migrate.test.ts` — fixtures + unit tests for migration.
- `src/lib/editor/blocks.ts` — block factory helpers (`makeHeaderBlock`, `makeProductSectionBlock`, `makeFooterBlock`) and finders (`findHeader`, `findFooter`).
- `src/lib/editor/store.blocks.test.ts` — invariant guard tests for the store.
- `src/components/editor/blocks/HeaderBlockView.tsx` — extracted from `PreviewBody.tsx`.
- `src/components/editor/blocks/ProductSectionView.tsx` — extracted from `PreviewBody.tsx`.
- `src/components/editor/blocks/FooterBlockView.tsx` — extracted from `PreviewBody.tsx`.
- `src/lib/export/renderEmail.snapshot.test.ts` — pre/post byte-equal HTML output check.

**Modified files:**
- `src/lib/editor/types.ts` — v2 schema; `SCHEMA_VERSION = 2`.
- `src/lib/editor/defaultProject.ts` — return v2 directly.
- `src/lib/editor/templates.ts` — `createBlankProject` returns v2 directly.
- `src/lib/editor/store.ts` — block-generic core actions, invariant guards, wrappers.
- `src/components/editor/PreviewBody.tsx` — thin block-walker.
- `src/components/editor/LeftPanel.tsx` — block-walker sidebar.
- `src/components/editor/panels/HeaderPanel.tsx` — accept `block` prop.
- `src/components/editor/panels/FooterPanel.tsx` — accept `block` prop.
- `src/components/editor/panels/ProductSectionPanel.tsx` — accept `block` prop (already takes a `section` prop).
- `src/components/editor/EditorShell.tsx` — references `data.sections` for count; migrate to `blocks.filter`.
- `src/components/editor/canvas/SelectionActionBar.tsx` — `data.sections` → block filter.
- `src/components/dashboard/ImportButton.tsx` — `parsed.data.header/sections/footer` → block lookups.
- `src/lib/export/renderEmail.ts` — block-walker.
- `src/lib/translate/fields.ts` — walk blocks instead of named fields.
- `src/lib/import/parseHtml.ts` — return v2 directly.
- `src/app/w/[slug]/p/[id]/page.tsx` — call `migrate()` on `project.data`.
- `src/app/api/projects/[id]/export/route.ts` — call `migrate()` before `renderEmail`.
- `src/app/api/projects/[id]/translate/route.ts` — call `migrate()` on `src.data`.

**Out of scope (per spec):** new block types, new templates, drag/reorder of heterogeneous blocks, PDF pagination bug.

---

## Task 1: Define v2 schema and freeze v1 types for migration

**Files:**
- Modify: `src/lib/editor/types.ts`

This task changes types in place. **Typecheck will be red across the codebase after this commit until subsequent tasks fix call sites.** That is expected and acceptable for this single-PR refactor — each subsequent task removes type errors in a logical layer.

- [ ] **Step 1: Read the current `types.ts` to keep all named exports stable**

Current exports we must preserve by name (call sites import them): `SCHEMA_VERSION`, `ProjectData`, `GlobalStyles`, `Header`, `ProductSection`, `Footer`, `WebsiteLink`, `SocialLink`, `SocialPlatform`.

The v2 changes:
- `SCHEMA_VERSION` becomes `2`.
- `ProjectData` replaces `header/sections/footer` with `blocks`.
- `Header`, `ProductSection`, `Footer` keep their field shape but extend a `BlockBase` and gain `type`/`id`/`locked`. They become `HeaderBlock`, `ProductSectionBlock`, `FooterBlock`.
- We keep `Header`/`ProductSection`/`Footer` as **type aliases** pointing at the new block types so call sites that import them still compile (their structural fields are unchanged plus a few new optional ones). Phase 2 will delete the aliases.

- [ ] **Step 2: Rewrite `src/lib/editor/types.ts`**

```ts
export const SCHEMA_VERSION = 2;

export interface ProjectData {
  schemaVersion: 2;
  global: GlobalStyles;
  blocks: Block[];
}

export interface GlobalStyles {
  backgroundColor: string;
  fontFamily: string;
  baseFontSize: number;
  headingFontSize: number;
  textColor: string;
  buttonColor: string;
  buttonTextColor: string;
  accentColor: string;
  footerBackgroundColor: string;
  footerTextColor: string;
  contactUrl: string;
}

export interface BlockBase {
  id: string;
  locked?: boolean;
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
  imageSrc: string;
  imageAlt: string;
  ctaText: string;
  ctaUrl?: string;
  titleFontSize?: number;
  bulletFontSize?: number;
  textColor?: string;
  buttonColor?: string;
  backgroundColor?: string;
}

export interface FooterBlock extends BlockBase {
  type: 'footer';
  bannerSrc: string; bannerAlt: string;
  companyName: string; address: string; phone: string; phoneTel: string;
  email: string;
  websites: WebsiteLink[];
  socials: SocialLink[];
  backgroundColor?: string;
  textColor?: string;
}

export type Block = HeaderBlock | ProductSectionBlock | FooterBlock;

// Legacy aliases — preserved to minimize Phase 1 call-site churn. Phase 2 deletes these.
export type Header = HeaderBlock;
export type ProductSection = ProductSectionBlock;
export type Footer = FooterBlock;

export interface WebsiteLink {
  label: string;
  url: string;
}

export type SocialPlatform = 'facebook' | 'linkedin' | 'twitter' | 'youtube' | 'instagram';

export interface SocialLink {
  platform: SocialPlatform;
  url: string;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/editor/types.ts
git commit -m "refactor(editor): introduce Block discriminated union schema (v2)"
```

Typecheck will be broken at this point — that's resolved by Tasks 2-11.

---

## Task 2: Build the migrate() function with tests

**Files:**
- Create: `src/lib/editor/migrate.ts`
- Create: `src/lib/editor/migrate.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/editor/migrate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { migrate } from './migrate';

const V1_FIXTURE = {
  schemaVersion: 1 as const,
  global: {
    backgroundColor: '#d0d0d0',
    fontFamily: 'Arial',
    baseFontSize: 16,
    headingFontSize: 25,
    textColor: '#000',
    buttonColor: '#f00',
    buttonTextColor: '#fff',
    accentColor: '#f00',
    footerBackgroundColor: '#000',
    footerTextColor: '#fff',
    contactUrl: '',
  },
  header: {
    logoSrc: 'logo.png', logoAlt: 'L', logoWidth: 200,
    title: 'T', titleFontSize: 18,
    bannerSrc: 'b.png', bannerAlt: 'B',
    sectionHeading: 'SH', sectionHeadingFontSize: 25,
  },
  sections: [
    { id: 's1', title: 'Sec 1', bullets: ['a'], imageSrc: '', imageAlt: '', ctaText: 'CTA' },
    { id: 's2', title: 'Sec 2', bullets: ['b'], imageSrc: '', imageAlt: '', ctaText: 'CTA' },
  ],
  footer: {
    bannerSrc: '', bannerAlt: '',
    companyName: 'Co', address: 'Addr', phone: '+1', phoneTel: '+1',
    email: 'e@co', websites: [], socials: [],
  },
};

describe('migrate', () => {
  it('migrates v1 to v2 with header/sections/footer wrapped as blocks', () => {
    const v2 = migrate(V1_FIXTURE);
    expect(v2.schemaVersion).toBe(2);
    expect(v2.global).toEqual(V1_FIXTURE.global);
    expect(v2.blocks).toHaveLength(4);
    expect(v2.blocks[0].type).toBe('header');
    expect(v2.blocks[0].locked).toBe(true);
    expect(v2.blocks[1].type).toBe('product-section');
    expect(v2.blocks[2].type).toBe('product-section');
    expect(v2.blocks[3].type).toBe('footer');
    expect(v2.blocks[3].locked).toBe(true);
  });

  it('preserves existing section ids in v1 → v2', () => {
    const v2 = migrate(V1_FIXTURE);
    const sectionBlocks = v2.blocks.filter((b) => b.type === 'product-section');
    expect(sectionBlocks.map((b) => b.id)).toEqual(['s1', 's2']);
  });

  it('returns v2 input unchanged (identity)', () => {
    const v2Input = migrate(V1_FIXTURE);
    const again = migrate(v2Input);
    expect(again).toBe(v2Input);
  });

  it('treats missing schemaVersion as v1', () => {
    const { schemaVersion: _, ...withoutVersion } = V1_FIXTURE;
    const v2 = migrate(withoutVersion);
    expect(v2.schemaVersion).toBe(2);
    expect(v2.blocks).toHaveLength(4);
  });

  it('throws on unknown schemaVersion', () => {
    expect(() => migrate({ schemaVersion: 99 })).toThrow(/Unsupported schemaVersion/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/editor/migrate.test.ts`
Expected: FAIL — module `./migrate` not found.

- [ ] **Step 3: Implement `migrate.ts`**

Create `src/lib/editor/migrate.ts`:

```ts
import { v4 as uuid } from 'uuid';
import type {
  ProjectData,
  Block,
  HeaderBlock,
  ProductSectionBlock,
  FooterBlock,
  GlobalStyles,
  WebsiteLink,
  SocialLink,
} from './types';

interface V1Header {
  logoSrc: string; logoAlt: string; logoWidth: number;
  title: string; titleFontSize: number;
  bannerSrc: string; bannerAlt: string;
  sectionHeading: string; sectionHeadingFontSize: number;
}

interface V1Section {
  id: string;
  title: string;
  bullets: string[];
  imageSrc: string; imageAlt: string;
  ctaText: string; ctaUrl?: string;
  titleFontSize?: number; bulletFontSize?: number;
  textColor?: string; buttonColor?: string; backgroundColor?: string;
}

interface V1Footer {
  bannerSrc: string; bannerAlt: string;
  companyName: string; address: string; phone: string; phoneTel: string;
  email: string;
  websites: WebsiteLink[];
  socials: SocialLink[];
  backgroundColor?: string; textColor?: string;
}

interface V1ProjectData {
  schemaVersion?: 1;
  global: GlobalStyles;
  header: V1Header;
  sections: V1Section[];
  footer: V1Footer;
}

export function migrate(raw: unknown): ProjectData {
  if (raw == null || typeof raw !== 'object') {
    throw new Error('migrate: input must be an object');
  }
  const v = (raw as { schemaVersion?: number }).schemaVersion;
  if (v === 2) return raw as ProjectData;
  if (v === 1 || v === undefined) return v1ToV2(raw as V1ProjectData);
  throw new Error(`Unsupported schemaVersion: ${v}`);
}

function v1ToV2(v1: V1ProjectData): ProjectData {
  const headerBlock: HeaderBlock = {
    type: 'header',
    id: uuid(),
    locked: true,
    ...v1.header,
  };
  const sectionBlocks: ProductSectionBlock[] = v1.sections.map((s) => ({
    type: 'product-section',
    ...s,
  }));
  const footerBlock: FooterBlock = {
    type: 'footer',
    id: uuid(),
    locked: true,
    ...v1.footer,
  };
  return {
    schemaVersion: 2,
    global: v1.global,
    blocks: [headerBlock, ...sectionBlocks, footerBlock],
  };
}

export function downgradeV2ToV1(v2: ProjectData): V1ProjectData {
  const header = v2.blocks.find((b): b is HeaderBlock => b.type === 'header');
  const footer = v2.blocks.find((b): b is FooterBlock => b.type === 'footer');
  const sections = v2.blocks.filter((b): b is ProductSectionBlock => b.type === 'product-section');
  if (!header || !footer) throw new Error('downgradeV2ToV1: missing header or footer block');
  const { type: _ht, id: _hi, locked: _hl, ...headerFields } = header;
  const { type: _ft, id: _fi, locked: _fl, ...footerFields } = footer;
  return {
    schemaVersion: 1,
    global: v2.global,
    header: headerFields,
    sections: sections.map(({ type: _t, locked: _l, ...rest }) => rest),
    footer: footerFields,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/editor/migrate.test.ts`
Expected: PASS — 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/editor/migrate.ts src/lib/editor/migrate.test.ts
git commit -m "feat(editor): add v1→v2 migrate() with tests"
```

---

## Task 3: Add block factory helpers

**Files:**
- Create: `src/lib/editor/blocks.ts`

- [ ] **Step 1: Write `src/lib/editor/blocks.ts`**

```ts
import { v4 as uuid } from 'uuid';
import type {
  Block,
  HeaderBlock,
  ProductSectionBlock,
  FooterBlock,
  ProjectData,
} from './types';

export function makeProductSectionBlock(
  overrides: Partial<Omit<ProductSectionBlock, 'type' | 'id'>> = {},
): ProductSectionBlock {
  return {
    type: 'product-section',
    id: uuid(),
    title: 'New Product',
    bullets: ['Feature one', 'Feature two'],
    imageSrc: '',
    imageAlt: '',
    ctaText: 'Contact Us',
    ...overrides,
  };
}

export function makeHeaderBlock(
  overrides: Partial<Omit<HeaderBlock, 'type' | 'id'>> = {},
): HeaderBlock {
  return {
    type: 'header',
    id: uuid(),
    locked: true,
    logoSrc: '', logoAlt: '', logoWidth: 390,
    title: '', titleFontSize: 18,
    bannerSrc: '', bannerAlt: '',
    sectionHeading: '', sectionHeadingFontSize: 25,
    ...overrides,
  };
}

export function makeFooterBlock(
  overrides: Partial<Omit<FooterBlock, 'type' | 'id'>> = {},
): FooterBlock {
  return {
    type: 'footer',
    id: uuid(),
    locked: true,
    bannerSrc: '', bannerAlt: '',
    companyName: '', address: '', phone: '', phoneTel: '',
    email: '', websites: [], socials: [],
    ...overrides,
  };
}

export function findHeader(blocks: Block[]): HeaderBlock {
  const b = blocks.find((x): x is HeaderBlock => x.type === 'header');
  if (!b) throw new Error('findHeader: no header block in project');
  return b;
}

export function findFooter(blocks: Block[]): FooterBlock {
  const b = blocks.find((x): x is FooterBlock => x.type === 'footer');
  if (!b) throw new Error('findFooter: no footer block in project');
  return b;
}

export function findBlock(blocks: Block[], id: string): Block | undefined {
  return blocks.find((b) => b.id === id);
}

export function productSections(blocks: Block[]): ProductSectionBlock[] {
  return blocks.filter((b): b is ProductSectionBlock => b.type === 'product-section');
}

export function productSectionCount(data: ProjectData): number {
  return productSections(data.blocks).length;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/editor/blocks.ts
git commit -m "feat(editor): add block factory helpers and finders"
```

---

## Task 4: Update templates to return v2 directly

**Files:**
- Modify: `src/lib/editor/defaultProject.ts`
- Modify: `src/lib/editor/templates.ts`

- [ ] **Step 1: Rewrite `defaultProject.ts`**

```ts
import type { ProjectData, ProductSectionBlock } from './types';
import { SCHEMA_VERSION } from './types';
import { makeHeaderBlock, makeFooterBlock, makeProductSectionBlock } from './blocks';

const CONTACT_URL = 'https://www.globaltt.com/en/quickContact-GlobalTT.html';

const SECTION_BLUEPRINTS: Array<Omit<ProductSectionBlock, 'type' | 'id'>> = [
  // ... unchanged section data — paste the existing 8 blueprints verbatim from current defaultProject.ts ...
];

export function createDefaultProject(): ProjectData {
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
      contactUrl: CONTACT_URL,
    },
    blocks: [
      makeHeaderBlock({
        logoSrc: 'https://36af7d465b.imgdist.com/pub/bfra/wpnsx7uw/j2q/4ah/ptb/logo%20%282%29.png',
        logoAlt: 'GlobalTT Logo',
        logoWidth: 390,
        title: 'Critical communication - Satellite - RadioLink - TwoWay Radio overIP',
        titleFontSize: 18,
        bannerSrc: 'https://ipseos.eu/wp-content/uploads/2024/05/Untitled-11x-1-e1718357911485.png',
        bannerAlt: 'Coverage Map',
        sectionHeading: 'Satellite High Throughput Connectivity',
        sectionHeadingFontSize: 25,
      }),
      ...SECTION_BLUEPRINTS.map((s) => makeProductSectionBlock(s)),
      makeFooterBlock({
        bannerSrc: 'https://ipseos.eu/wp-content/uploads/2024/05/TELEPORT-8-Copy.png',
        bannerAlt: 'Teleport',
        companyName: 'GlobalTT Satellite Teleport',
        address: 'Scientifique Parc Einstein,\nLouvain-la-Neuve, Belgium',
        phone: '+32 (0)10 39 50 70',
        phoneTel: '+3210395070',
        email: 'info@globaltt.com',
        websites: [
          { label: 'www.globaltt.com', url: 'https://www.globaltt.com' },
          { label: 'www.Ipseos.eu', url: 'https://www.ipseos.eu' },
        ],
        socials: [
          { platform: 'facebook', url: 'https://www.facebook.com/pages/GlobalTT-Broadband-High-Speed-Internet-Satellite/182799832710' },
          { platform: 'linkedin', url: 'https://www.linkedin.com/company/globaltt?trk=top_nav_home' },
        ],
      }),
    ],
  };
}
```

When copying `SECTION_BLUEPRINTS` from the current file, paste the existing array verbatim — its element shape (`title`, `bullets`, `imageSrc`, etc.) matches `Omit<ProductSectionBlock, 'type' | 'id'>` exactly because of the legacy type aliases. No content changes.

- [ ] **Step 2: Rewrite `templates.ts`**

```ts
import type { ProjectData } from './types';
import { SCHEMA_VERSION } from './types';
import { makeHeaderBlock, makeFooterBlock, makeProductSectionBlock } from './blocks';
import { createDefaultProject } from './defaultProject';

export interface TemplateDefinition {
  id: string;
  label: string;
  description: string;
  factory: () => ProjectData;
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

export const TEMPLATES: TemplateDefinition[] = [
  {
    id: 'blank',
    label: 'Blank',
    description: 'Same layout, empty fields. Fill in your own logo, sections, and footer.',
    factory: createBlankProject,
  },
  {
    id: 'globaltt',
    label: 'GlobalTT',
    description: "Pre-filled with GlobalTT's default copy and product sections.",
    factory: createDefaultProject,
  },
];

export function getTemplate(id: string | undefined | null): TemplateDefinition {
  if (!id) return TEMPLATES[0];
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}
```

- [ ] **Step 3: Verify templates compile**

Run: `npx tsc --noEmit src/lib/editor/defaultProject.ts src/lib/editor/templates.ts 2>&1 | head -20`
Expected: no errors specific to these two files. (Other files may still be broken — that's fine.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/editor/defaultProject.ts src/lib/editor/templates.ts
git commit -m "refactor(editor): templates return v2 ProjectData with blocks"
```

---

## Task 5: Refactor store to be block-aware, with TDD on invariants

**Files:**
- Modify: `src/lib/editor/store.ts`
- Create: `src/lib/editor/store.blocks.test.ts`

- [ ] **Step 1: Write the failing invariant tests**

Create `src/lib/editor/store.blocks.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createEditorStore } from './store';
import { createBlankProject } from './templates';
import { findHeader, findFooter, productSections } from './blocks';

function makeStore() {
  return createEditorStore({
    projectId: 'p1',
    name: 'Test',
    data: createBlankProject(),
    brandKitId: null,
    workspaceSlug: 'ws',
    serverUpdatedAt: new Date().toISOString(),
  });
}

describe('store: block invariants', () => {
  it('removeBlock refuses to remove a locked header', () => {
    const store = makeStore();
    const header = findHeader(store.getState().data.blocks);
    store.getState().removeBlock(header.id);
    expect(findHeader(store.getState().data.blocks).id).toBe(header.id);
  });

  it('removeBlock refuses to remove a locked footer', () => {
    const store = makeStore();
    const footer = findFooter(store.getState().data.blocks);
    store.getState().removeBlock(footer.id);
    expect(findFooter(store.getState().data.blocks).id).toBe(footer.id);
  });

  it('removeBlock removes a product-section block', () => {
    const store = makeStore();
    const sections = productSections(store.getState().data.blocks);
    const target = sections[0];
    store.getState().removeBlock(target.id);
    expect(productSections(store.getState().data.blocks).find((s) => s.id === target.id)).toBeUndefined();
  });

  it('reorderBlocks refuses an arrangement where the footer is not last', () => {
    const store = makeStore();
    const initial = store.getState().data.blocks;
    const reversed = [...initial].reverse();
    store.getState().reorderBlocks(reversed);
    expect(store.getState().data.blocks).toEqual(initial);
  });

  it('moveBlock refuses to move header down or footer up', () => {
    const store = makeStore();
    const header = findHeader(store.getState().data.blocks);
    const footer = findFooter(store.getState().data.blocks);
    store.getState().moveBlock(header.id, 'down');
    store.getState().moveBlock(footer.id, 'up');
    expect(store.getState().data.blocks[0].id).toBe(header.id);
    const last = store.getState().data.blocks.length - 1;
    expect(store.getState().data.blocks[last].id).toBe(footer.id);
  });

  it('addBlock inserts a product-section before the footer when no index is given', () => {
    const store = makeStore();
    const before = productSections(store.getState().data.blocks).length;
    store.getState().addSection();
    const after = productSections(store.getState().data.blocks).length;
    expect(after).toBe(before + 1);
    const blocks = store.getState().data.blocks;
    expect(blocks[blocks.length - 1].type).toBe('footer');
  });

  it('legacy setHeader patches the header block', () => {
    const store = makeStore();
    store.getState().setHeader({ title: 'New title' });
    expect(findHeader(store.getState().data.blocks).title).toBe('New title');
  });

  it('legacy setFooter patches the footer block', () => {
    const store = makeStore();
    store.getState().setFooter({ companyName: 'New Co' });
    expect(findFooter(store.getState().data.blocks).companyName).toBe('New Co');
  });

  it('legacy setSection patches a product-section block', () => {
    const store = makeStore();
    const target = productSections(store.getState().data.blocks)[0];
    store.getState().setSection(target.id, { title: 'Patched' });
    const updated = productSections(store.getState().data.blocks).find((s) => s.id === target.id);
    expect(updated?.title).toBe('Patched');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/editor/store.blocks.test.ts`
Expected: FAIL — store has no `removeBlock`, `reorderBlocks`, `moveBlock` methods yet.

- [ ] **Step 3: Rewrite `store.ts` with block-generic actions and legacy wrappers**

Replace the entire body of `src/lib/editor/store.ts` with this. The Init/EditorState/typing scaffolding around lines 1-80 stays the same; only the action implementations and the action interface change. The state shape `data: ProjectData` is unchanged — only the inner shape of `data` changed.

Key changes (illustrated against the current `createEditorStore` body):

```ts
import { createStore, type StoreApi } from 'zustand/vanilla';
import { temporal, type TemporalState } from 'zundo';
import { v4 as uuid } from 'uuid';
import type {
  Block,
  Footer,
  GlobalStyles,
  Header,
  ProductSection,
  ProductSectionBlock,
  ProjectData,
} from './types';
import { makeProductSectionBlock, findHeader, findFooter } from './blocks';

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'error';

export interface BrandKitSnapshot {
  global?: Partial<GlobalStyles>;
  footer?: Partial<Footer>;
}

export interface EditorState {
  projectId: string;
  name: string;
  data: ProjectData;
  brandKitId: string | null;
  workspaceSlug: string;
  serverUpdatedAt: string;
  saving: SaveStatus;
  lastError: string | null;
  lastSavedData: ProjectData;
  lastSavedName: string;
  lastSavedBrandKitId: string | null;

  setName(name: string): void;
  setGlobal(patch: Partial<GlobalStyles>): void;

  // Block-generic core
  updateBlock(id: string, patch: Partial<Block>): void;
  addBlock(block: Block, atIndex?: number): void;
  removeBlock(id: string): void;
  moveBlock(id: string, dir: 'up' | 'down'): void;
  duplicateBlock(id: string): void;
  reorderBlocks(next: Block[]): void;

  // Legacy wrappers (Phase 2 removes these)
  setHeader(patch: Partial<Header>): void;
  setFooter(patch: Partial<Footer>): void;
  addSection(atIndex?: number): void;
  removeSection(id: string): void;
  moveSection(id: string, dir: 'up' | 'down'): void;
  duplicateSection(id: string): void;
  reorderSections(next: ProductSection[]): void;
  setSection(id: string, patch: Partial<ProductSection>): void;

  setProjectBrandKit(id: string | null): void;
  applyBrandKit(snapshot: BrandKitSnapshot): void;
  resetToSaved(): void;

  markSaving(status: SaveStatus, error?: string | null): void;
  markSaved(updatedAt: string, data: ProjectData, name: string, brandKitId: string | null): void;
}

// ... TrackedState / EditorStoreApi / EditorStore unchanged ...

function isLocked(b: Block): boolean {
  return b.locked === true;
}

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

export function createEditorStore(init: Init): EditorStore {
  // ... cooldown setup unchanged ...

  const store = createStore<EditorState>()(
    temporal(
      (set, get) => ({
        projectId: init.projectId,
        name: init.name,
        data: init.data,
        brandKitId: init.brandKitId,
        workspaceSlug: init.workspaceSlug,
        serverUpdatedAt: init.serverUpdatedAt,
        saving: 'idle',
        lastError: null,
        lastSavedData: init.data,
        lastSavedName: init.name,
        lastSavedBrandKitId: init.brandKitId,

        setName: (name) => set({ name }),

        setGlobal: (patch) => set((state) => ({
          data: { ...state.data, global: { ...state.data.global, ...patch } },
        })),

        // --- block-generic core ---
        updateBlock: (id, patch) => set((state) => ({
          data: {
            ...state.data,
            blocks: state.data.blocks.map((b) =>
              b.id === id ? ({ ...b, ...patch } as Block) : b,
            ),
          },
        })),

        addBlock: (block, atIndex) => set((state) => {
          const blocks = state.data.blocks.slice();
          // Default insertion: before the footer (last index)
          const insertAt = typeof atIndex === 'number'
            ? Math.max(1, Math.min(atIndex, blocks.length - 1))
            : blocks.length - 1;
          blocks.splice(insertAt, 0, block);
          if (!validateInvariant(blocks)) return state;
          return { data: { ...state.data, blocks } };
        }),

        removeBlock: (id) => set((state) => {
          const target = state.data.blocks.find((b) => b.id === id);
          if (!target || isLocked(target)) return state;
          const blocks = state.data.blocks.filter((b) => b.id !== id);
          if (!validateInvariant(blocks)) return state;
          return { data: { ...state.data, blocks } };
        }),

        moveBlock: (id, dir) => set((state) => {
          const arr = state.data.blocks;
          const idx = arr.findIndex((b) => b.id === id);
          if (idx === -1) return state;
          const swap = dir === 'up' ? idx - 1 : idx + 1;
          if (swap < 0 || swap >= arr.length) return state;
          if (isLocked(arr[idx]) || isLocked(arr[swap])) return state;
          const next = arr.slice();
          [next[idx], next[swap]] = [next[swap], next[idx]];
          if (!validateInvariant(next)) return state;
          return { data: { ...state.data, blocks: next } };
        }),

        duplicateBlock: (id) => set((state) => {
          const idx = state.data.blocks.findIndex((b) => b.id === id);
          if (idx < 0) return state;
          const src = state.data.blocks[idx];
          if (src.type !== 'product-section') return state; // only product-sections duplicable in Phase 1
          const copy: ProductSectionBlock = {
            ...src,
            id: uuid(),
            bullets: src.bullets.slice(),
          };
          const blocks = state.data.blocks.slice();
          blocks.splice(idx + 1, 0, copy);
          return { data: { ...state.data, blocks } };
        }),

        reorderBlocks: (next) => set((state) => {
          if (!validateInvariant(next)) return state;
          return { data: { ...state.data, blocks: next } };
        }),

        // --- legacy wrappers ---
        setHeader: (patch) => {
          const id = findHeader(get().data.blocks).id;
          get().updateBlock(id, patch);
        },
        setFooter: (patch) => {
          const id = findFooter(get().data.blocks).id;
          get().updateBlock(id, patch);
        },
        addSection: (atIndex) => {
          // Compute insertion index. Legacy `atIndex` was section-relative.
          // Translate to block-relative: header is at 0, so block index = atIndex + 1.
          const blockIndex = typeof atIndex === 'number' ? atIndex + 1 : undefined;
          get().addBlock(makeProductSectionBlock(), blockIndex);
        },
        removeSection: (id) => get().removeBlock(id),
        moveSection: (id, dir) => get().moveBlock(id, dir),
        duplicateSection: (id) => get().duplicateBlock(id),
        reorderSections: (next) => {
          const blocks = get().data.blocks;
          const header = findHeader(blocks);
          const footer = findFooter(blocks);
          // `next` may carry the legacy ProductSection type — it is structurally a ProductSectionBlock.
          get().reorderBlocks([header, ...(next as ProductSectionBlock[]), footer]);
        },
        setSection: (id, patch) => get().updateBlock(id, patch),

        setProjectBrandKit: (id) => {
          flushHistoryCooldown();
          set({ brandKitId: id });
        },

        applyBrandKit: (snapshot) => set((state) => {
          const nextGlobal = snapshot.global
            ? { ...state.data.global, ...snapshot.global }
            : state.data.global;
          if (!snapshot.footer) {
            return { data: { ...state.data, global: nextGlobal } };
          }
          const footerId = findFooter(state.data.blocks).id;
          const blocks = state.data.blocks.map((b) =>
            b.id === footerId ? ({ ...b, ...snapshot.footer } as Block) : b,
          );
          return { data: { ...state.data, global: nextGlobal, blocks } };
        }),

        resetToSaved: () => set((state) => ({
          data: state.lastSavedData,
          name: state.lastSavedName,
          brandKitId: state.lastSavedBrandKitId,
        })),

        markSaving: (status, error = null) => set({ saving: status, lastError: error }),
        markSaved: /* unchanged */ ((updatedAt, data, name, brandKitId) =>
          set({ saving: 'idle', lastError: null, serverUpdatedAt: updatedAt, lastSavedData: data, lastSavedName: name, lastSavedBrandKitId: brandKitId })),
      }),
      /* temporal options unchanged */
      { /* ... */ },
    ),
  );

  // ... rest of createEditorStore unchanged ...
  return /* same return value as before */ store as unknown as EditorStore;
}
```

When editing the actual file, preserve the existing temporal options, `flushHistoryCooldown` setup, and the `EditorStore` extension — those bits are mechanical and not redrawn here.

Delete the old `blankSection()` helper near the top of the file — it's superseded by `makeProductSectionBlock`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/editor/store.blocks.test.ts`
Expected: PASS — all 9 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/editor/store.ts src/lib/editor/store.blocks.test.ts
git commit -m "refactor(editor): block-aware store with invariant guards + legacy wrappers"
```

---

## Task 6: Extract block view components from PreviewBody

**Files:**
- Create: `src/components/editor/blocks/HeaderBlockView.tsx`
- Create: `src/components/editor/blocks/ProductSectionView.tsx`
- Create: `src/components/editor/blocks/FooterBlockView.tsx`

The existing `PreviewBody.tsx` mixes header, sections, and footer JSX inline. Each block's JSX moves into its own component, receiving a `block` prop. **No visual or behavioral change.**

- [ ] **Step 1: Create `HeaderBlockView.tsx`**

Lift the header JSX from `PreviewBody.tsx` (currently around lines 62-104 in the visible portion) into a new component:

```tsx
'use client';
import type { HeaderBlock, GlobalStyles } from '@/lib/editor/types';
import { useEditorStore } from '@/lib/editor/StoreProvider';
import { useEditorMode } from '../EditorModeProvider';
import { EditableText } from '../editable/EditableText';
import { EditableImage } from '../editable/EditableImage';

interface Props {
  block: HeaderBlock;
  global: GlobalStyles;
}

export function HeaderBlockView({ block, global }: Props) {
  const store = useEditorStore();
  const setHeader = store.getState().setHeader;
  const { mode } = useEditorMode();
  const blockNav = mode === 'edit' ? (e: React.MouseEvent) => e.preventDefault() : undefined;

  // Paste the existing JSX that renders header in PreviewBody verbatim,
  // replacing `data.header.X` with `block.X` and `g` with `global`.
  // Keep all class names, styles, and EditableText/EditableImage props identical.
  return (
    <>
      {/* paste header JSX here, substituting data.header.X → block.X and g → global */}
    </>
  );
}
```

Use `git show HEAD:src/components/editor/PreviewBody.tsx` if needed to copy the original markup. The substitutions are mechanical (`data.header.X` → `block.X`, `g` → `global`). All event handlers continue to call `setHeader({ patch })` which now routes through the legacy wrapper.

- [ ] **Step 2: Create `ProductSectionView.tsx`**

Lift the per-section JSX (currently the function that returns JSX inside `data.sections.map(...)` around lines 113-188) into a new component:

```tsx
'use client';
import type { ProductSectionBlock, GlobalStyles } from '@/lib/editor/types';
import { useEditorStore } from '@/lib/editor/StoreProvider';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SectionToolbar } from '../canvas/SectionToolbar';
import { useSectionSelection } from '../SectionSelectionProvider';
import { useEditorMode } from '../EditorModeProvider';
import { EditableText } from '../editable/EditableText';
import { EditableBulletList } from '../editable/EditableBulletList';
import { EditableImage } from '../editable/EditableImage';

interface Props {
  block: ProductSectionBlock;
  global: GlobalStyles;
  index: number;
  total: number;
}

export function ProductSectionView({ block, global, index, total }: Props) {
  // Paste the existing per-section JSX from PreviewBody, substituting:
  //   - the section parameter (e.g., `s`) → `block`
  //   - `g` → `global`
  //   - `data.sections.length` → `total`
  // Keep the useSortable hook, dnd-kit attributes/listeners, SectionToolbar, etc. identical.
  return null; // replace with the lifted JSX
}
```

- [ ] **Step 3: Create `FooterBlockView.tsx`**

Lift the footer JSX (currently lines 193-end of the footer block in `PreviewBody.tsx`) into a new component:

```tsx
'use client';
import type { FooterBlock, GlobalStyles, SocialPlatform } from '@/lib/editor/types';
import { useEditorStore } from '@/lib/editor/StoreProvider';
import { useEditorMode } from '../EditorModeProvider';
import { Facebook, Linkedin, Twitter, Youtube, Instagram } from 'lucide-react';
import { EditableText } from '../editable/EditableText';
import { EditableImage } from '../editable/EditableImage';
import { EditableLink } from '../editable/EditableLink';

const ICONS: Record<SocialPlatform, React.ComponentType<{ size?: number; color?: string }>> = {
  facebook: Facebook, linkedin: Linkedin, twitter: Twitter, youtube: Youtube, instagram: Instagram,
};

interface Props {
  block: FooterBlock;
  global: GlobalStyles;
}

export function FooterBlockView({ block, global }: Props) {
  const store = useEditorStore();
  const setFooter = store.getState().setFooter;
  const { mode } = useEditorMode();
  const blockNav = mode === 'edit' ? (e: React.MouseEvent) => e.preventDefault() : undefined;

  // Paste footer JSX from PreviewBody, substituting:
  //   - `data.footer.X` → `block.X`
  //   - `g` → `global`
  return null; // replace with the lifted JSX
}
```

- [ ] **Step 4: Commit (compile is still red — PreviewBody not yet rewired)**

```bash
git add src/components/editor/blocks/
git commit -m "refactor(editor): extract block view components from PreviewBody"
```

---

## Task 7: Convert PreviewBody to a block-walker

**Files:**
- Modify: `src/components/editor/PreviewBody.tsx`

- [ ] **Step 1: Rewrite `PreviewBody.tsx`**

The new file is short — the heavy JSX has moved into the three view components.

```tsx
'use client';
import { useEffect } from 'react';
import { useEditor, useEditorStore } from '@/lib/editor/StoreProvider';
import { useEditorMode } from './EditorModeProvider';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDragSensors } from './canvas/useDragSensors';
import { SectionInsertBar } from './canvas/SectionInsertBar';
import { useSectionSelection } from './SectionSelectionProvider';
import { SelectionActionBar } from './canvas/SelectionActionBar';
import { HeaderBlockView } from './blocks/HeaderBlockView';
import { ProductSectionView } from './blocks/ProductSectionView';
import { FooterBlockView } from './blocks/FooterBlockView';
import { productSections } from '@/lib/editor/blocks';

export function PreviewBody() {
  const data = useEditor((s) => s.data);
  const store = useEditorStore();
  useEditorMode(); // preserve hook ordering if other code relies on subscribing here
  const sensors = useDragSensors();
  const reorderBlocks = store.getState().reorderBlocks;
  const selection = useSectionSelection();

  const sections = productSections(data.blocks);

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
    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reorderedSections = arrayMove(sections, oldIndex, newIndex);
    const header = data.blocks.find((b) => b.type === 'header')!;
    const footer = data.blocks.find((b) => b.type === 'footer')!;
    reorderBlocks([header, ...reorderedSections, footer]);
  }

  return (
    <div onMouseDown={onCanvasMouseDown}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {data.blocks.map((block, idx) => {
            switch (block.type) {
              case 'header':
                return <HeaderBlockView key={block.id} block={block} global={data.global} />;
              case 'product-section': {
                const sectionIndex = sections.findIndex((s) => s.id === block.id);
                return (
                  <ProductSectionView
                    key={block.id}
                    block={block}
                    global={data.global}
                    index={sectionIndex}
                    total={sections.length}
                  />
                );
              }
              case 'footer':
                return <FooterBlockView key={block.id} block={block} global={data.global} />;
            }
          })}
          {sections.length === 0 && <SectionInsertBar atIndex={0} />}
        </SortableContext>
      </DndContext>
      <SelectionActionBar />
    </div>
  );
}
```

If the original `PreviewBody` had wrapping divs (background, font-family inheritance, etc.), preserve them around the outermost `<div>` in this rewrite. Use `git show HEAD~7:src/components/editor/PreviewBody.tsx` (adjust depth) to compare against pre-refactor markup.

- [ ] **Step 2: Sanity-check the editor renders by running the dev server**

Run: `npm run dev` (in a separate terminal — the agent does not wait)
Manual check: open a project and confirm the canvas renders without console errors. Header, sections, footer all visible and look unchanged. Reorder a section via drag — should work.

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/PreviewBody.tsx
git commit -m "refactor(editor): PreviewBody walks data.blocks via switch on block.type"
```

---

## Task 8: Update sidebar panels to accept block prop

**Files:**
- Modify: `src/components/editor/panels/HeaderPanel.tsx`
- Modify: `src/components/editor/panels/FooterPanel.tsx`
- Modify: `src/components/editor/panels/ProductSectionPanel.tsx`

The panels currently pull their data from the store via `useEditor((s) => s.data.header)` etc. We change them to receive `block` as a prop (a more functional/composable pattern).

- [ ] **Step 1: Update `HeaderPanel.tsx`**

Find the line `const h = useEditor((s) => s.data.header);` and replace the component's signature + body to take a `block: HeaderBlock` prop:

```tsx
import type { HeaderBlock } from '@/lib/editor/types';

interface Props {
  block: HeaderBlock;
}

export function HeaderPanel({ block }: Props) {
  // wherever the original used `h`, use `block`
  // the rest of the component (event handlers calling setHeader, JSX, etc.) is unchanged
}
```

- [ ] **Step 2: Update `FooterPanel.tsx`** the same way

Replace `const f = useEditor((s) => s.data.footer);` with a `block: FooterBlock` prop. Use `block` wherever `f` was used.

- [ ] **Step 3: Update `ProductSectionPanel.tsx`**

This panel already takes a `section: ProductSection` prop (per `LeftPanel.tsx`'s use). Rename the prop to `block: ProductSectionBlock` for consistency. Update internal references from `section.X` to `block.X`. Because of the legacy type alias `ProductSection = ProductSectionBlock`, the call site in `LeftPanel.tsx` will still type-check after this rename — but we'll also update the call site in the next task.

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/panels/
git commit -m "refactor(editor): sidebar panels accept block prop instead of store-derived data"
```

---

## Task 9: Convert LeftPanel to a block-walker

**Files:**
- Modify: `src/components/editor/LeftPanel.tsx`

- [ ] **Step 1: Rewrite `LeftPanel.tsx`**

```tsx
'use client';
import { AnimatePresence, motion } from 'motion/react';
import { GlobalStylesPanel } from './panels/GlobalStylesPanel';
import { HeaderPanel } from './panels/HeaderPanel';
import { FooterPanel } from './panels/FooterPanel';
import { ProductSectionPanel } from './panels/ProductSectionPanel';
import { useEditor, useEditorStore } from '@/lib/editor/StoreProvider';
import { useCanEdit } from '@/lib/editor/RoleProvider';
import { fadeUp } from '@/lib/motion';
import { productSections } from '@/lib/editor/blocks';

export function LeftPanel() {
  const blocks = useEditor((s) => s.data.blocks);
  const store = useEditorStore();
  const canEdit = useCanEdit();
  const sectionCount = productSections(blocks).length;

  let sectionIndex = -1;

  return (
    <aside className="w-[320px] shrink-0 overflow-y-auto border-r border-ed-rule bg-ed-panel p-3 space-y-2">
      <GlobalStylesPanel />
      <AnimatePresence initial={false}>
        {blocks.map((block) => {
          if (block.type === 'product-section') sectionIndex++;
          const idx = sectionIndex;
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
                <ProductSectionPanel block={block} index={idx} total={sectionCount} />
              )}
              {block.type === 'footer' && <FooterPanel block={block} />}
              {block.type === 'header' && (
                <div className="px-1 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-ed-ink-3">
                  Products{' '}
                  <span className="font-mono text-ed-ink-3">· {sectionCount}</span>
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
      {canEdit && (
        <button
          type="button"
          onClick={() => store.getState().addSection()}
          className="block w-full rounded-md border border-dashed border-ed-rule-strong px-3 py-2 text-sm text-ed-ink-2 transition-colors hover:border-brand hover:text-ed-ink"
        >
          + Add Product Section
        </button>
      )}
    </aside>
  );
}
```

The "Products · N" label appears immediately after the header panel — matches the original visual order.

- [ ] **Step 2: Manual check that sidebar renders**

`npm run dev` and confirm sidebar shows: Global Styles → Header panel → "Products · N" header → product section panels → Footer panel → "+ Add Product Section" button. Identical to before.

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/LeftPanel.tsx
git commit -m "refactor(editor): LeftPanel walks blocks; panels receive block prop"
```

---

## Task 10: Fix remaining call sites that touched data.sections / data.header / data.footer

**Files:**
- Modify: `src/components/editor/EditorShell.tsx`
- Modify: `src/components/editor/canvas/SelectionActionBar.tsx`
- Modify: `src/components/dashboard/ImportButton.tsx`

- [ ] **Step 1: Update `EditorShell.tsx`**

Find `const sections = useEditor((s) => s.data.sections);` (around line 33) and replace with:

```ts
import { productSections } from '@/lib/editor/blocks';
// ...
const sectionCount = useEditor((s) => productSections(s.data.blocks).length);
```

Then update any downstream uses of `sections` to `sectionCount`. If the original code uses `sections` for more than counting, read the file and replace usages appropriately.

- [ ] **Step 2: Update `SelectionActionBar.tsx`**

Find `const stateIds = store.getState().data.sections.map((s) => s.id);` (line 16) and replace with:

```ts
import { productSections } from '@/lib/editor/blocks';
// ...
const stateIds = productSections(store.getState().data.blocks).map((b) => b.id);
```

- [ ] **Step 3: Update `ImportButton.tsx`**

The import dialog renders a summary of what the parser found, currently reaching into `parsed.data.header/sections/footer`. Once `parseHtml` returns v2 (Task 12), this code needs to look at blocks. Update lines 86-109:

```tsx
import { findHeader, findFooter, productSections } from '@/lib/editor/blocks';
// ...
const header = findHeader(parsed.data.blocks);
const footer = findFooter(parsed.data.blocks);
const sections = productSections(parsed.data.blocks);
// ...
<Found ok={!!header.logoSrc} label="Logo image" />
<Found ok={!!header.bannerSrc} label="Banner image" />
<Found ok={!!header.title} label="Header title" />
<Found ok={sections.length > 0} label={`${sections.length} product sections`} />
<Found ok={!!footer.email} label="Footer details" />
// ...
<Found ok={!!parsed.data.global.backgroundColor} label={`Background colour ${parsed.data.global.backgroundColor}`} />
<Found ok={!!parsed.data.global.buttonColor} label={`Button colour ${parsed.data.global.buttonColor}`} />
// ...
<Button onClick={confirm} disabled={stage === 'creating' || sections.length === 0}>
```

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/EditorShell.tsx src/components/editor/canvas/SelectionActionBar.tsx src/components/dashboard/ImportButton.tsx
git commit -m "refactor(editor): remaining call sites use block helpers"
```

---

## Task 11: Convert renderEmail.ts to a block-walker, with snapshot test

**Files:**
- Modify: `src/lib/export/renderEmail.ts`
- Create: `src/lib/export/renderEmail.snapshot.test.ts`

- [ ] **Step 1: Capture pre-refactor snapshot from the current build**

Before changing `renderEmail.ts`, run a one-off capture script in a Node REPL or as a throwaway test to write a baseline file. Easier: `git stash` the renderEmail changes if they exist, run the function against `createDefaultProject()` and `createBlankProject()`, save outputs to:
- `src/lib/export/__fixtures__/baseline-globaltt.html`
- `src/lib/export/__fixtures__/baseline-blank.html`

Pragmatic capture script (`scripts/capture-render-baseline.ts`):

```ts
import { writeFileSync, mkdirSync } from 'node:fs';
import { renderEmail } from '../src/lib/export/renderEmail';
import { createDefaultProject } from '../src/lib/editor/defaultProject';
import { createBlankProject } from '../src/lib/editor/templates';

mkdirSync('src/lib/export/__fixtures__', { recursive: true });
writeFileSync('src/lib/export/__fixtures__/baseline-globaltt.html', renderEmail(createDefaultProject()));
writeFileSync('src/lib/export/__fixtures__/baseline-blank.html', renderEmail(createBlankProject()));
```

Run with: `npx tsx scripts/capture-render-baseline.ts`

Important: this script must be run **before** any renderEmail edits (and after Task 4 lands so templates return v2). If the capture has drifted by the time you reach this task, redo it on the pre-renderEmail-edit state by temporarily checking out the renderEmail.ts file from before Task 11.

- [ ] **Step 2: Write the snapshot test**

Create `src/lib/export/renderEmail.snapshot.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderEmail } from './renderEmail';
import { createDefaultProject } from '../editor/defaultProject';
import { createBlankProject } from '../editor/templates';

describe('renderEmail snapshot parity', () => {
  it('GlobalTT template renders byte-equal to pre-refactor baseline', () => {
    const baseline = readFileSync('src/lib/export/__fixtures__/baseline-globaltt.html', 'utf8');
    expect(renderEmail(createDefaultProject())).toBe(baseline);
  });

  it('Blank template renders byte-equal to pre-refactor baseline', () => {
    const baseline = readFileSync('src/lib/export/__fixtures__/baseline-blank.html', 'utf8');
    expect(renderEmail(createBlankProject())).toBe(baseline);
  });
});
```

- [ ] **Step 3: Rewrite the `renderBody` function in `renderEmail.ts`**

Current `renderBody` (around line 149) walks `data.header`, `data.sections`, `data.footer`. Replace with a block-walker that produces identical output ordering:

```ts
import { findHeader, findFooter, productSections } from '@/lib/editor/blocks';
// ... existing imports and helpers unchanged ...

function renderBody(data: ProjectData): string {
  const bg = data.global.backgroundColor;
  const fontFamily = data.global.fontFamily;
  const fontSize = data.global.baseFontSize;
  const header = findHeader(data.blocks);
  const footer = findFooter(data.blocks);
  const sections = productSections(data.blocks);
  const sectionsHtml = sections.map((s, i) => renderSection(s, i, data)).join('\n');
  return `<body style="margin: 0; padding: 0; background-color: ${attrEscape(bg)}; font-family: ${attrEscape(fontFamily)}; font-size: ${fontSize}px;">
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: ${attrEscape(bg)};">
<tr><td align="center">
${renderHeader(header, data.global.contactUrl)}
${sectionsHtml}
${renderFooter(footer, data)}
</td></tr>
</table>
</body>`;
}
```

`renderHeader(header, ...)`, `renderFooter(footer, ...)`, and `renderSection(s, i, data)` already accept the right shapes (because the type aliases preserved their structural shape). No signature change required.

- [ ] **Step 4: Run the snapshot test**

Run: `npx vitest run src/lib/export/renderEmail.snapshot.test.ts`
Expected: PASS — both templates render byte-equal to baseline.

If it fails: diff the output against baseline (use `node -e 'console.log(...)'` or a quick diff script). Adjust until equal. Common causes of drift: newline differences, attribute ordering inside `renderHeader`/`renderFooter` that depended on object iteration order — these should be stable because `findHeader` returns the same object structurally.

- [ ] **Step 5: Commit**

```bash
git add src/lib/export/renderEmail.ts src/lib/export/renderEmail.snapshot.test.ts src/lib/export/__fixtures__/ scripts/capture-render-baseline.ts
git commit -m "refactor(export): renderEmail walks blocks; snapshot parity asserted"
```

---

## Task 12: Update parseHtml to return v2 directly

**Files:**
- Modify: `src/lib/import/parseHtml.ts`

`parseHtml` currently constructs a v1 `ProjectData` with named fields. Update it to construct v2.

- [ ] **Step 1: Read `parseHtml.ts` and identify the initial data object construction**

The parser likely starts with something like:
```ts
const data: ProjectData = {
  schemaVersion: 1,
  global: { ... },
  header: { logoSrc: '', /* ... */ },
  sections: [],
  footer: { /* ... */ },
};
```
and then populates it field-by-field as it walks the HTML.

- [ ] **Step 2: Restructure the function to build a v1 shape internally, then return `migrate(v1)`**

This is the lowest-risk change — keep all the parsing logic that writes into `data.header.logoSrc` etc. unchanged, and only change the initial scaffold + the final return:

```ts
import { migrate } from '@/lib/editor/migrate';
// ...
export function parseHtml(html: string): { data: ProjectData; warnings: Warning[] } {
  // Internal v1 scaffold (use a local type or `any` cast scoped to this function).
  const v1: any = {
    schemaVersion: 1,
    global: { /* unchanged defaults */ },
    header: { /* unchanged defaults */ },
    sections: [] as any[],
    footer: { /* unchanged defaults */ },
  };

  // ... all existing parse-and-populate code unchanged ...
  // (the existing code writes into v1.header.X, v1.sections.push(...), v1.footer.X)

  return { data: migrate(v1), warnings };
}
```

Rename the local variable from `data` to `v1` and replace the existing return statement with `return { data: migrate(v1), warnings };`. The substitution is mechanical — sed-style across the function body.

- [ ] **Step 3: Run import E2E test**

Run: `npx playwright test tests/e2e/import-export.spec.ts`
Expected: PASS — import flow still produces a valid project.

- [ ] **Step 4: Commit**

```bash
git add src/lib/import/parseHtml.ts
git commit -m "refactor(import): parseHtml returns v2 via migrate()"
```

---

## Task 13: Update translate/fields.ts to walk blocks

**Files:**
- Modify: `src/lib/translate/fields.ts`

- [ ] **Step 1: Rewrite `fields.ts`**

```ts
import type { ProjectData } from '@/lib/editor/types';
import { findHeader, findFooter, productSections } from '@/lib/editor/blocks';

type StringMap = Record<string, string>;

function add(out: StringMap, key: string, value: unknown): void {
  if (typeof value === 'string' && value.length > 0) {
    out[key] = value;
  }
}

export function extractTranslatable(data: ProjectData): StringMap {
  const out: StringMap = {};
  const header = findHeader(data.blocks);
  const footer = findFooter(data.blocks);
  const sections = productSections(data.blocks);

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

  return out;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function isUsableString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function applyTranslations(data: ProjectData, translations: StringMap): ProjectData {
  const out: ProjectData = deepClone(data);
  const header = findHeader(out.blocks);
  const footer = findFooter(out.blocks);
  const sections = productSections(out.blocks);

  if (isUsableString(translations['header.title'])) header.title = translations['header.title'];
  if (isUsableString(translations['header.sectionHeading'])) header.sectionHeading = translations['header.sectionHeading'];
  if (isUsableString(translations['header.logoAlt'])) header.logoAlt = translations['header.logoAlt'];
  if (isUsableString(translations['header.bannerAlt'])) header.bannerAlt = translations['header.bannerAlt'];

  sections.forEach((s, i) => {
    const t = translations[`sections.${i}.title`];
    if (isUsableString(t)) s.title = t;
    const ia = translations[`sections.${i}.imageAlt`];
    if (isUsableString(ia)) s.imageAlt = ia;
    const ct = translations[`sections.${i}.ctaText`];
    if (isUsableString(ct)) s.ctaText = ct;
    s.bullets.forEach((_, j) => {
      const b = translations[`sections.${i}.bullets.${j}`];
      if (isUsableString(b)) s.bullets[j] = b;
    });
  });

  if (isUsableString(translations['footer.bannerAlt'])) footer.bannerAlt = translations['footer.bannerAlt'];
  if (isUsableString(translations['footer.companyName'])) footer.companyName = translations['footer.companyName'];
  if (isUsableString(translations['footer.address'])) footer.address = translations['footer.address'];
  footer.websites.forEach((w, i) => {
    const lab = translations[`footer.websites.${i}.label`];
    if (isUsableString(lab)) w.label = lab;
  });

  return out;
}
```

Note: `findHeader`/`findFooter` on the cloned `out.blocks` return the cloned block instances, so mutating their fields mutates `out` directly. The original code used the same pattern with `out.header`.

The rewritten block above assigns `footer.address = translations['footer.address']`, which matches the original file's behavior. Verify against the existing `applyTranslations` in `fields.ts` before committing to ensure no behavior drift.

- [ ] **Step 2: Commit**

```bash
git add src/lib/translate/fields.ts
git commit -m "refactor(translate): extract/apply walk blocks via findHeader/Footer"
```

---

## Task 14: Wire migrate() into server-side and editor entry points

**Files:**
- Modify: `src/app/w/[slug]/p/[id]/page.tsx`
- Modify: `src/app/api/projects/[id]/export/route.ts`
- Modify: `src/app/api/projects/[id]/translate/route.ts`

- [ ] **Step 1: Update editor page loader**

In `src/app/w/[slug]/p/[id]/page.tsx`, line 32 currently does `data={project.data as ProjectData}`. Replace with:

```ts
import { migrate } from '@/lib/editor/migrate';
// ...
data={migrate(project.data)}
```

- [ ] **Step 2: Update export route**

In `src/app/api/projects/[id]/export/route.ts`, line 29 currently does `let html = renderEmail(data.data as ProjectData);`. Replace with:

```ts
import { migrate } from '@/lib/editor/migrate';
// ...
let html = renderEmail(migrate(data.data));
```

- [ ] **Step 3: Update translate route**

In `src/app/api/projects/[id]/translate/route.ts`, line 71 currently does `const sourceData = src.data as ProjectData;`. Replace with:

```ts
import { migrate } from '@/lib/editor/migrate';
// ...
const sourceData = migrate(src.data);
```

The duplicate route (`/api/projects/[id]/duplicate/route.ts`) does not parse `data` — it just re-inserts the JSONB. No change needed there. Old v1 documents that get duplicated remain v1 in the DB until opened in the editor; that's fine because the editor calls `migrate()` on load.

- [ ] **Step 4: Commit**

```bash
git add src/app/w/[slug]/p/[id]/page.tsx src/app/api/projects/[id]/export/route.ts src/app/api/projects/[id]/translate/route.ts
git commit -m "feat(editor): migrate() v1→v2 on editor load, export, and translate"
```

---

## Task 15: Final verification — typecheck, lint, tests, manual smoke

**Files:** none new; verifies state of the branch.

- [ ] **Step 1: Run typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors.

If any errors remain, they're typically untouched call sites that still reach into `data.sections`/`data.header`/`data.footer`. Find them with:

Run: `git grep -n "data\.sections\|data\.header\|data\.footer" -- src/`
Expected: no matches (other than possibly in commented-out code or migration scripts).

Fix any remaining call sites — apply the same patterns as Task 10 (use `findHeader`/`findFooter`/`productSections`).

- [ ] **Step 2: Run linter**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 3: Run unit tests**

Run: `npx vitest run`
Expected: all green, including `migrate.test.ts`, `store.blocks.test.ts`, `renderEmail.snapshot.test.ts`.

- [ ] **Step 4: Run E2E tests**

Run: `npx playwright test`
Expected: all green. The existing specs (`editor.spec.ts`, `dashboard.spec.ts`, `asset-picker.spec.ts`, `import-export.spec.ts`) must pass without modification.

- [ ] **Step 5: Manual smoke test**

Run: `npm run dev`
Open a project. Verify:
- Canvas renders header, sections, footer correctly.
- "+ New Project" → Blank template loads.
- "+ New Project" → GlobalTT template loads with all 8 sections.
- Sidebar shows GlobalStyles → HeaderPanel → "Products · N" → ProductSectionPanels → FooterPanel.
- Drag-reorder a section: works.
- Add a section via "+ Add Product Section": inserts before footer; count increments.
- Duplicate a section via toolbar: works.
- Delete a section via toolbar: works.
- Save autosaves successfully (verify "Saved" indicator in topbar).
- Export HTML downloads a working email.
- Brand-kit application updates footer colors.

Open a project that existed in the DB before this branch (an old v1 project). Verify it loads identically.

- [ ] **Step 6: Final commit if any fixups were needed**

If Step 1-5 surfaced issues, commit the fixes:

```bash
git add -A
git commit -m "fix(editor): final block-model parity fixes"
```

- [ ] **Step 7: Push the branch**

```bash
git push -u origin feat/block-model-foundation
```

Phase 1 done. Phase 2 (new block types + new templates) starts as its own brainstorm.

---

## Self-Review notes

- **Spec coverage:** every spec section has a corresponding task. Schema → T1; migrate → T2; block helpers → T3 (added beyond spec for clean factories); templates → T4; store → T5; canvas (block views + PreviewBody) → T6/T7; sidebar panels + LeftPanel → T8/T9; remaining call sites + import dialog → T10/T12; export → T11; translate → T13; server wiring → T14; parity verification → T15.
- **PDF export:** explicitly out of scope (per spec). The renderEmail change applies to HTML export only; PDF generation path is not touched.
- **Type consistency check:** `Block`, `HeaderBlock`, `ProductSectionBlock`, `FooterBlock`, `findHeader`, `findFooter`, `productSections`, `makeHeaderBlock`, `makeProductSectionBlock`, `makeFooterBlock`, `migrate` are referenced consistently across tasks 2-14.
- **Frequent commits:** 14 commits (one per task) plus optional Task 15 fixup.
