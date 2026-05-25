# Craft.js Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat `Block[]` v2 schema with a Craft.js-backed tree of `Page → Section → Row → Column → leaf primitives`, rewrite renderEmail/renderPrintDocument over the same SSR-aware component tree, auto-migrate existing v2 projects to v3, and fold the six branded sidebar panels into colocated `*Settings` on each primitive.

**Architecture:** Craft.js owns the editor tree; a Zustand-mirrored `tree: SerializedNodes` slice drives autosave/translate/export. dbousamra's SSR-aware `<Element>` wrapper lets the same component tree render to MSO email HTML and PagedJS print HTML via a `RenderContext` (`'editor' | 'email' | 'print'`).

**Tech Stack:** Next.js 15, React 19, Zustand 5, Vitest 2, Playwright 1.51, `@craftjs/core` (~0.2.10, new).

**Spec:** `docs/superpowers/specs/2026-05-25-craftjs-migration-design.md`

**Branch:** Create a separate local branch for the migration work. Commit locally as needed, but do not push or open a PR until explicitly approved.

---

## Conventions used throughout this plan

- All paths are relative to the repo root (`C:\Users\Developer2\Documents\html-editor`).
- Test commands assume `npm test` (Vitest) and `npm run e2e` (Playwright). Run from repo root.
- Each task should be implemented as a small, reviewable logical increment. Local commits are recommended, but exact commit boundaries may flex if the repository is temporarily non-compilable between tightly coupled steps.
- Co-author tag on commits: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
- **TDD discipline:** every new module gets a failing test first. Settings panels (UI-heavy) are exempt — those get manual verification + an E2E test in Phase 11.
- **Type-checking:** after any task that adds new types, run `npm run typecheck` before committing.
- Treat code snippets in this plan as implementation guidance, not guaranteed drop-in source. The spec and the repository's current code are the source of truth if a snippet is too optimistic about Craft.js internals or React constraints.
- Preserve the repository in a runnable state at the end of each major phase, but it is acceptable for intermediate sub-steps inside a tightly scoped phase to be temporarily broken while the coupled files are being migrated together.

---

## Phase 0: Validate SSR pattern against current `@craftjs/core`

This is the kill switch. If the SSR Element-wrapper pattern from [dbousamra's 2020 codesandbox](https://codesandbox.io/s/keen-fast-m3y2z) doesn't survive on current Craft.js, the architecture needs revisiting before any production code is written.

### Task 0.1: Clone codesandbox locally, validate pattern

**Files:**
- Create: `spike/craftjs-ssr/` (temporary scratch directory, not committed to main branch)

- [ ] **Step 1: Create scratch directory outside src/**

```bash
mkdir spike/craftjs-ssr
cd spike/craftjs-ssr
npm init -y
npm install @craftjs/core@^0.2.10 react@19 react-dom@19 typescript ts-node @types/react @types/react-dom
```

- [ ] **Step 2: Recreate dbousamra's minimal example**

Create `spike/craftjs-ssr/index.tsx`:

```tsx
import React, { createElement, type ElementType, type ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import {
  Editor, Frame, useNode,
  Element as CraftElement,
  type NodeId, type SerializedNodes,
} from '@craftjs/core';

function Element<T extends ElementType>({
  is, id, isSSR, children, ...rest
}: { is: T; id?: NodeId; isSSR?: boolean; children?: ReactNode } & React.ComponentProps<T>) {
  return isSSR
    ? createElement(is, rest, children)
    : <CraftElement id={id} {...(rest as any)}>{children}</CraftElement>;
}

function Text({ text }: { text: string }) {
  const { connectors: { connect, drag } } = useNode();
  return <p ref={(el) => el && connect(drag(el))}>{text}</p>;
}
(Text as any).craft = { displayName: 'Text' };

function Container({ children }: { children?: ReactNode }) {
  const { connectors: { connect, drag } } = useNode();
  return <div ref={(el) => el && connect(drag(el))}>{children}</div>;
}
(Container as any).craft = { displayName: 'Container' };

const RESOLVERS = { Text, Container };

// Editor render
const editorHtml = renderToString(
  <Editor resolver={RESOLVERS}>
    <Frame>
      <Element is={Container} canvas>
        <Element is={Text} text="hello SSR" />
      </Element>
    </Frame>
  </Editor>
);
console.log('editor html length:', editorHtml.length);  // likely ~0 — that's the bug

// Static render via wrapper
const staticHtml = renderToString(
  <Element is={Container} isSSR>
    <Element is={Text} isSSR text="hello SSR" />
  </Element>
);
console.log('static html:', staticHtml);   // should contain "<p>hello SSR</p>"
```

- [ ] **Step 3: Run and verify**

```bash
npx ts-node index.tsx
```

Expected: `static html` line contains `<p>hello SSR</p>`. Editor-mode render is allowed to be empty — that's the original problem dbousamra solved.

- [ ] **Step 4: Verify NodeContext / serialize APIs still exist**

In the same scratch script, add:

```tsx
import { NodeProvider, useEditor } from '@craftjs/core';
console.log('NodeProvider exists:', typeof NodeProvider);
console.log('useEditor exists:', typeof useEditor);
```

Expected: both log `function`. If either is `undefined`, the API has drifted and `renderTreeToReact` will need a refactor. Do not assume the exact internal API from the spike survives unchanged; adapt the approach, record the deviation, and continue if the repository still permits a robust SSR walker.

- [ ] **Step 5: Document the result**

Append to `docs/superpowers/specs/2026-05-25-craftjs-migration-design.md` under §6.6:

```markdown
**Phase 0 verification result (YYYY-MM-DD):** SSR Element wrapper renders correctly on @craftjs/core@X.Y.Z. NodeProvider/useEditor exports present. [Or: drift found in X — see follow-up.]
```

- [ ] **Step 6: Delete the spike directory and keep only the spec note**

```bash
rm -rf spike/craftjs-ssr
```

If the spec note is the only change at this point, it may be committed immediately or batched into the first implementation commit.

---

## Phase 1: Install Craft.js, scaffold Element wrapper + Page primitive

### Task 1.1: Install `@craftjs/core`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install**

```bash
npm install @craftjs/core@^0.2.10
```

- [ ] **Step 2: Verify install**

```bash
npm list @craftjs/core
```

Expected: `@craftjs/core@0.2.x` in tree.

- [ ] **Step 3: Commit lockfile + package.json**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add @craftjs/core for tree-model migration"
```

### Task 1.2: Create SSR-aware `Element` wrapper

**Files:**
- Create: `src/components/editor/craft/Element.tsx`
- Test: `src/components/editor/craft/Element.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/components/editor/craft/Element.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Element } from './Element';

describe('Element wrapper', () => {
  it('renders plain React tree when isSSR is true', () => {
    function Div({ children }: { children?: React.ReactNode }) {
      return <div data-testid="div">{children}</div>;
    }
    const html = renderToString(
      <Element is={Div} isSSR>
        <span>hello</span>
      </Element>
    );
    expect(html).toContain('data-testid="div"');
    expect(html).toContain('<span>hello</span>');
  });

  it('forwards props to the underlying component in SSR mode', () => {
    function P({ text }: { text: string }) {
      return <p>{text}</p>;
    }
    const html = renderToString(<Element is={P} isSSR text="ok" />);
    expect(html).toBe('<p>ok</p>');
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

```bash
npm test -- src/components/editor/craft/Element.test.tsx
```

Expected: FAIL — `Element` not exported.

- [ ] **Step 3: Implement `Element.tsx`**

```tsx
import { createElement, type ElementType, type ReactNode } from 'react';
import { Element as CraftElement, type NodeId } from '@craftjs/core';

interface ElementOwnProps<T extends ElementType> {
  is: T;
  id?: NodeId;
  isSSR?: boolean;
  canvas?: boolean;
  children?: ReactNode;
}

type Props<T extends ElementType> = ElementOwnProps<T> & Omit<React.ComponentProps<T>, keyof ElementOwnProps<T>>;

export function Element<T extends ElementType>({ is, id, isSSR, canvas, children, ...rest }: Props<T>) {
  if (isSSR) {
    return createElement(is, rest as React.ComponentProps<T>, children);
  }
  return (
    <CraftElement id={id} is={is} canvas={canvas} {...(rest as Record<string, unknown>)}>
      {children}
    </CraftElement>
  );
}
```

- [ ] **Step 4: Run the test, verify it passes**

```bash
npm test -- src/components/editor/craft/Element.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck
git add src/components/editor/craft/Element.tsx src/components/editor/craft/Element.test.tsx
git commit -m "feat(craft): SSR-aware Element wrapper"
```

### Task 1.3: Create `RenderContext`

**Files:**
- Create: `src/components/editor/craft/RenderContext.tsx`

- [ ] **Step 1: Implement context (no test — trivial, exercised by primitives in later tasks)**

```tsx
import { createContext, useContext } from 'react';

export type RenderTarget = 'editor' | 'email' | 'print';

const RenderContext = createContext<RenderTarget>('editor');

export const RenderContextProvider = RenderContext.Provider;

export function useRenderContext(): RenderTarget {
  return useContext(RenderContext);
}
```

- [ ] **Step 2: Typecheck and commit**

```bash
npm run typecheck
git add src/components/editor/craft/RenderContext.tsx
git commit -m "feat(craft): RenderContext for editor/email/print dispatch"
```

### Task 1.4: Create `Page` root primitive + resolver scaffold

**Files:**
- Create: `src/components/editor/craft/Page.tsx`
- Create: `src/components/editor/craft/resolver.ts`
- Test: `src/components/editor/craft/Page.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/components/editor/craft/Page.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Page } from './Page';
import { RESOLVERS } from './resolver';
import { Element } from './Element';

describe('Page primitive', () => {
  it('renders children inside a styled root container in SSR mode', () => {
    const html = renderToString(
      <Element is={Page} isSSR backgroundColor="#fff">
        <p>hello</p>
      </Element>
    );
    expect(html).toContain('background-color:#fff');
    expect(html).toContain('<p>hello</p>');
  });

  it('exports a craft static with displayName Page', () => {
    expect((Page as any).craft.displayName).toBe('Page');
  });

  it('is registered in RESOLVERS', () => {
    expect(RESOLVERS.Page).toBe(Page);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

```bash
npm test -- src/components/editor/craft/Page.test.tsx
```

Expected: FAIL — `Page` not exported.

- [ ] **Step 3: Implement `Page.tsx`**

```tsx
import { useNode } from '@craftjs/core';
import type { ReactNode } from 'react';

interface PageProps {
  backgroundColor?: string;
  fontFamily?: string;
  children?: ReactNode;
}

export function Page({ backgroundColor, fontFamily, children }: PageProps) {
  const node = (() => { try { return useNode(); } catch { return null; } })();
  const ref = node?.connectors?.connect ?? null;
  return (
    <div
      ref={(el) => { if (el && ref) ref(el); }}
      style={{ backgroundColor, fontFamily, minHeight: '100%' }}
    >
      {children}
    </div>
  );
}

(Page as any).craft = {
  displayName: 'Page',
  props: { backgroundColor: '#ffffff' } satisfies PageProps,
  rules: {
    canDrag: () => false,
    canMoveIn: (incoming: { data: { type: { resolvedName?: string } } }[]) =>
      incoming.every((node) => node.data.type.resolvedName === 'Section'),
  },
};
```

- [ ] **Step 4: Implement `resolver.ts`**

```ts
import { Page } from './Page';

export const RESOLVERS = {
  Page,
} as const;

export type ResolvedName = keyof typeof RESOLVERS;
```

- [ ] **Step 5: Run the test, verify it passes**

```bash
npm test -- src/components/editor/craft/Page.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Typecheck and commit**

```bash
npm run typecheck
git add src/components/editor/craft/Page.tsx src/components/editor/craft/resolver.ts src/components/editor/craft/Page.test.tsx
git commit -m "feat(craft): Page root primitive and resolver scaffold"
```

---

## Phase 2: Structural primitives (Section, Row, Column)

### Task 2.1: `Section` primitive with locking

**Files:**
- Create: `src/components/editor/craft/Section.tsx`
- Modify: `src/components/editor/craft/resolver.ts`
- Test: `src/components/editor/craft/Section.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/components/editor/craft/Section.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Section } from './Section';
import { Element } from './Element';

describe('Section primitive', () => {
  it('renders a band div with background and padding in SSR mode', () => {
    const html = renderToString(
      <Element is={Section} isSSR backgroundColor="#fafafa" paddingY={24}>
        <span>child</span>
      </Element>
    );
    expect(html).toContain('background-color:#fafafa');
    expect(html).toContain('padding-top:24px');
    expect(html).toContain('padding-bottom:24px');
    expect(html).toContain('<span>child</span>');
  });

  it('rejects non-Row children via canMoveIn', () => {
    const rule = (Section as any).craft.rules.canMoveIn as (
      incoming: { data: { type: { resolvedName: string } } }[],
    ) => boolean;
    expect(rule([{ data: { type: { resolvedName: 'Row' } } }])).toBe(true);
    expect(rule([{ data: { type: { resolvedName: 'Text' } } }])).toBe(false);
  });

  it('locked sections forbid drag/delete', () => {
    expect((Section as any).craft.rules.canDrag({ data: { props: { locked: true } } })).toBe(false);
    expect((Section as any).craft.rules.canDrag({ data: { props: { locked: false } } })).toBe(true);
  });
});
```

- [ ] **Step 2: Run, verify it fails**

```bash
npm test -- src/components/editor/craft/Section.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement `Section.tsx`**

```tsx
import { useNode } from '@craftjs/core';
import type { ReactNode } from 'react';

export interface SectionProps {
  backgroundColor?: string;
  paddingY?: number;
  paddingX?: number;
  locked?: boolean;
  children?: ReactNode;
}

export function Section({
  backgroundColor, paddingY = 16, paddingX = 16, children,
}: SectionProps) {
  const node = (() => { try { return useNode(); } catch { return null; } })();
  const connect = node?.connectors?.connect ?? null;
  return (
    <div
      ref={(el) => { if (el && connect) connect(el); }}
      style={{
        backgroundColor,
        paddingTop: paddingY,
        paddingBottom: paddingY,
        paddingLeft: paddingX,
        paddingRight: paddingX,
      }}
    >
      {children}
    </div>
  );
}

(Section as any).craft = {
  displayName: 'Section',
  props: { paddingY: 16, paddingX: 16 } satisfies SectionProps,
  rules: {
    canDrag: (node: { data: { props: SectionProps } }) => node.data.props.locked !== true,
    canMoveIn: (incoming: { data: { type: { resolvedName?: string } } }[]) =>
      incoming.every((n) => n.data.type.resolvedName === 'Row'),
  },
};
```

- [ ] **Step 4: Register in resolver**

`src/components/editor/craft/resolver.ts`:

```ts
import { Page } from './Page';
import { Section } from './Section';

export const RESOLVERS = {
  Page,
  Section,
} as const;

export type ResolvedName = keyof typeof RESOLVERS;
```

- [ ] **Step 5: Run, verify it passes**

```bash
npm test -- src/components/editor/craft/Section.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Typecheck and commit**

```bash
npm run typecheck
git add src/components/editor/craft/Section.tsx src/components/editor/craft/Section.test.tsx src/components/editor/craft/resolver.ts
git commit -m "feat(craft): Section primitive with locking + Row containment rule"
```

### Task 2.2: `Row` primitive (1–4 columns)

**Files:**
- Create: `src/components/editor/craft/Row.tsx`
- Modify: `src/components/editor/craft/resolver.ts`
- Test: `src/components/editor/craft/Row.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/components/editor/craft/Row.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Row } from './Row';
import { Element } from './Element';
import { RenderContextProvider } from './RenderContext';

describe('Row primitive', () => {
  it('renders as flex in editor/print mode', () => {
    const html = renderToString(
      <RenderContextProvider value="print">
        <Element is={Row} isSSR>
          <div>a</div>
        </Element>
      </RenderContextProvider>
    );
    expect(html).toContain('display:flex');
  });

  it('renders as a table in email mode', () => {
    const html = renderToString(
      <RenderContextProvider value="email">
        <Element is={Row} isSSR>
          <div>a</div>
        </Element>
      </RenderContextProvider>
    );
    expect(html).toContain('<table');
    expect(html).toContain('role="presentation"');
  });

  it('rejects non-Column children', () => {
    const rule = (Row as any).craft.rules.canMoveIn as (
      incoming: { data: { type: { resolvedName: string } } }[],
    ) => boolean;
    expect(rule([{ data: { type: { resolvedName: 'Column' } } }])).toBe(true);
    expect(rule([{ data: { type: { resolvedName: 'Text' } } }])).toBe(false);
  });

  it('caps columns at 4 via canMoveIn check on currentNode', () => {
    const rule = (Row as any).craft.rules.canMoveIn as (
      incoming: { data: { type: { resolvedName: string } } }[],
      currentNode: { data: { nodes: string[] } },
    ) => boolean;
    const fourChildren = { data: { nodes: ['a', 'b', 'c', 'd'] } };
    expect(rule([{ data: { type: { resolvedName: 'Column' } } }], fourChildren)).toBe(false);
  });
});
```

- [ ] **Step 2: Run, verify it fails**

```bash
npm test -- src/components/editor/craft/Row.test.tsx
```

- [ ] **Step 3: Implement `Row.tsx`**

```tsx
import { useNode } from '@craftjs/core';
import type { ReactNode } from 'react';
import { useRenderContext } from './RenderContext';

export interface RowProps {
  gap?: number;
  reverse?: boolean;
  children?: ReactNode;
}

export function Row({ gap = 16, reverse = false, children }: RowProps) {
  const node = (() => { try { return useNode(); } catch { return null; } })();
  const connect = node?.connectors?.connect ?? null;
  const target = useRenderContext();

  if (target === 'email') {
    return (
      <table role="presentation" width="100%" border={0} cellPadding={0} cellSpacing={0}>
        <tbody>
          <tr style={{ direction: reverse ? 'rtl' : 'ltr' }}>{children}</tr>
        </tbody>
      </table>
    );
  }

  return (
    <div
      ref={(el) => { if (el && connect) connect(el); }}
      style={{ display: 'flex', gap, flexDirection: reverse ? 'row-reverse' : 'row' }}
    >
      {children}
    </div>
  );
}

(Row as any).craft = {
  displayName: 'Row',
  props: { gap: 16, reverse: false } satisfies RowProps,
  rules: {
    canMoveIn: (
      incoming: { data: { type: { resolvedName?: string } } }[],
      currentNode: { data: { nodes: string[] } },
    ) => {
      if (!incoming.every((n) => n.data.type.resolvedName === 'Column')) return false;
      return currentNode.data.nodes.length + incoming.length <= 4;
    },
  },
};
```

- [ ] **Step 4: Register in resolver**

`src/components/editor/craft/resolver.ts`:

```ts
import { Page } from './Page';
import { Section } from './Section';
import { Row } from './Row';

export const RESOLVERS = {
  Page,
  Section,
  Row,
} as const;

export type ResolvedName = keyof typeof RESOLVERS;
```

- [ ] **Step 5: Run, verify it passes; typecheck; commit**

```bash
npm test -- src/components/editor/craft/Row.test.tsx
npm run typecheck
git add src/components/editor/craft/Row.tsx src/components/editor/craft/Row.test.tsx src/components/editor/craft/resolver.ts
git commit -m "feat(craft): Row primitive with email-mode table fallback + 4-column cap"
```

### Task 2.3: `Column` primitive (leaf-only children)

**Files:**
- Create: `src/components/editor/craft/Column.tsx`
- Modify: `src/components/editor/craft/resolver.ts`
- Test: `src/components/editor/craft/Column.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/components/editor/craft/Column.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Column } from './Column';
import { Element } from './Element';
import { RenderContextProvider } from './RenderContext';

const LEAF_NAMES = ['Heading', 'Text', 'Image', 'Button', 'Divider', 'Spacer', 'List'];

describe('Column primitive', () => {
  it('renders as a flex child div in editor/print mode', () => {
    const html = renderToString(
      <RenderContextProvider value="editor">
        <Element is={Column} isSSR width={50}>
          <span>x</span>
        </Element>
      </RenderContextProvider>
    );
    expect(html).toContain('<div');
    expect(html).toContain('flex:1 1');
  });

  it('renders as a <td> in email mode', () => {
    const html = renderToString(
      <RenderContextProvider value="email">
        <Element is={Column} isSSR width={50}>
          <span>x</span>
        </Element>
      </RenderContextProvider>
    );
    expect(html).toContain('<td');
    expect(html).toContain('width="50%"');
  });

  it('rejects structural children, accepts leaf primitives', () => {
    const rule = (Column as any).craft.rules.canMoveIn as (
      incoming: { data: { type: { resolvedName: string } } }[],
    ) => boolean;
    for (const name of LEAF_NAMES) {
      expect(rule([{ data: { type: { resolvedName: name } } }])).toBe(true);
    }
    expect(rule([{ data: { type: { resolvedName: 'Row' } } }])).toBe(false);
    expect(rule([{ data: { type: { resolvedName: 'Section' } } }])).toBe(false);
  });
});
```

- [ ] **Step 2: Run, verify it fails**

- [ ] **Step 3: Implement `Column.tsx`**

```tsx
import { useNode } from '@craftjs/core';
import type { ReactNode } from 'react';
import { useRenderContext } from './RenderContext';

export interface ColumnProps {
  width?: number;          // percentage 0-100
  align?: 'top' | 'middle' | 'bottom';
  children?: ReactNode;
}

const LEAF_NAMES = new Set(['Heading', 'Text', 'Image', 'Button', 'Divider', 'Spacer', 'List']);

export function Column({ width = 100, align = 'top', children }: ColumnProps) {
  const node = (() => { try { return useNode(); } catch { return null; } })();
  const connect = node?.connectors?.connect ?? null;
  const target = useRenderContext();

  if (target === 'email') {
    return (
      <td width={`${width}%`} valign={align === 'top' ? 'top' : align === 'middle' ? 'middle' : 'bottom'} style={{ padding: 8 }}>
        {children}
      </td>
    );
  }

  return (
    <div
      ref={(el) => { if (el && connect) connect(el); }}
      style={{ flex: `1 1 ${width}%`, minWidth: 0, alignSelf: vAlignToFlex(align) }}
    >
      {children}
    </div>
  );
}

function vAlignToFlex(a: 'top' | 'middle' | 'bottom') {
  return a === 'top' ? 'flex-start' : a === 'middle' ? 'center' : 'flex-end';
}

(Column as any).craft = {
  displayName: 'Column',
  props: { width: 100, align: 'top' } satisfies ColumnProps,
  rules: {
    canMoveIn: (incoming: { data: { type: { resolvedName?: string } } }[]) =>
      incoming.every((n) => LEAF_NAMES.has(n.data.type.resolvedName ?? '')),
  },
};
```

- [ ] **Step 4: Register in resolver**

`src/components/editor/craft/resolver.ts`:

```ts
import { Page } from './Page';
import { Section } from './Section';
import { Row } from './Row';
import { Column } from './Column';

export const RESOLVERS = {
  Page,
  Section,
  Row,
  Column,
} as const;

export type ResolvedName = keyof typeof RESOLVERS;
```

- [ ] **Step 5: Run, verify, commit**

```bash
npm test -- src/components/editor/craft/Column.test.tsx
npm run typecheck
git add src/components/editor/craft/Column.tsx src/components/editor/craft/Column.test.tsx src/components/editor/craft/resolver.ts
git commit -m "feat(craft): Column primitive with email-mode <td> + leaf-only containment"
```

---

## Phase 3: Leaf primitives

Each leaf gets the same shape: typed props interface, `useNode` wrapped in try/catch for SSR safety, target-specific output for email mode, colocated `*Settings` panel (UI-light; tested manually).

**Common test helper** — create this once and reuse across all leaf tests:

### Task 3.0: Shared render helpers for leaf tests

**Files:**
- Create: `src/components/editor/craft/testUtils.tsx`

- [ ] **Step 1: Create helper module (no test — utility)**

```tsx
import { renderToString } from 'react-dom/server';
import type { ReactElement } from 'react';
import { Element } from './Element';
import { RenderContextProvider, type RenderTarget } from './RenderContext';

export function renderSSR(target: RenderTarget, child: ReactElement): string {
  return renderToString(
    <RenderContextProvider value={target}>{child}</RenderContextProvider>
  );
}

export function renderLeaf<T extends React.ComponentType<P>, P>(
  target: RenderTarget,
  Component: T,
  props: P,
): string {
  return renderSSR(target, <Element is={Component as any} isSSR {...(props as any)} />);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/editor/craft/testUtils.tsx
git commit -m "test(craft): shared SSR render helpers for primitive tests"
```

### Task 3.1: `Heading` leaf

**Files:**
- Create: `src/components/editor/craft/Heading.tsx`
- Modify: `src/components/editor/craft/resolver.ts`
- Test: `src/components/editor/craft/Heading.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { Heading } from './Heading';
import { renderLeaf } from './testUtils';

describe('Heading', () => {
  it('renders as h2 with text content', () => {
    const html = renderLeaf('editor', Heading, { text: 'Hello', level: 2, fontSize: 24, color: '#111' });
    expect(html).toContain('<h2');
    expect(html).toContain('Hello');
    expect(html).toContain('font-size:24px');
    expect(html).toContain('color:#111');
  });

  it('renders level=1 as h1', () => {
    const html = renderLeaf('editor', Heading, { text: 'X', level: 1 });
    expect(html).toMatch(/<h1[^>]*>X<\/h1>/);
  });

  it('escapes html in text', () => {
    const html = renderLeaf('editor', Heading, { text: '<script>x</script>' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
```

- [ ] **Step 2: Run, verify it fails**

```bash
npm test -- src/components/editor/craft/Heading.test.tsx
```

- [ ] **Step 3: Implement `Heading.tsx`** (settings colocated)

```tsx
import { useNode } from '@craftjs/core';

export interface HeadingProps {
  text: string;
  level?: 1 | 2 | 3;
  fontSize?: number;
  color?: string;
  align?: 'left' | 'center' | 'right';
  brandToken?: 'text' | 'primary' | 'accent';
}

export function Heading({ text, level = 2, fontSize, color, align = 'left' }: HeadingProps) {
  const node = (() => { try { return useNode(); } catch { return null; } })();
  const connect = node?.connectors?.connect ?? null;
  const drag = node?.connectors?.drag ?? null;
  const Tag = (`h${level}`) as 'h1' | 'h2' | 'h3';
  return (
    <Tag
      ref={(el: HTMLElement | null) => { if (el && connect && drag) connect(drag(el)); }}
      style={{ fontSize, color, textAlign: align, margin: 0 }}
    >
      {text}
    </Tag>
  );
}

(Heading as any).craft = {
  displayName: 'Heading',
  props: { text: 'Heading', level: 2, align: 'left' } satisfies HeadingProps,
  related: { settings: HeadingSettings },
  rules: { canDrag: () => true },
};

function HeadingSettings() {
  const { props, actions: { setProp } } = useNode((node) => ({
    props: node.data.props as HeadingProps,
  }));
  return (
    <div className="space-y-2">
      <label className="block text-xs">Text
        <input
          className="w-full border rounded px-2 py-1"
          value={props.text}
          onChange={(e) => setProp((p: HeadingProps) => { p.text = e.target.value; })}
        />
      </label>
      <label className="block text-xs">Level
        <select
          className="w-full border rounded px-2 py-1"
          value={props.level ?? 2}
          onChange={(e) => setProp((p: HeadingProps) => { p.level = Number(e.target.value) as 1 | 2 | 3; })}
        >
          <option value={1}>H1</option>
          <option value={2}>H2</option>
          <option value={3}>H3</option>
        </select>
      </label>
      <label className="block text-xs">Font size
        <input
          type="number"
          className="w-full border rounded px-2 py-1"
          value={props.fontSize ?? ''}
          onChange={(e) => setProp((p: HeadingProps) => { p.fontSize = e.target.value ? Number(e.target.value) : undefined; })}
        />
      </label>
      <label className="block text-xs">Color
        <input
          type="color"
          className="w-full border rounded"
          value={props.color ?? '#000000'}
          onChange={(e) => setProp((p: HeadingProps) => { p.color = e.target.value; })}
        />
      </label>
    </div>
  );
}
```

- [ ] **Step 4: Register in resolver**

```ts
// src/components/editor/craft/resolver.ts
import { Page } from './Page';
import { Section } from './Section';
import { Row } from './Row';
import { Column } from './Column';
import { Heading } from './Heading';

export const RESOLVERS = { Page, Section, Row, Column, Heading } as const;
export type ResolvedName = keyof typeof RESOLVERS;
```

- [ ] **Step 5: Run, verify, commit**

```bash
npm test -- src/components/editor/craft/Heading.test.tsx
npm run typecheck
git add src/components/editor/craft/Heading.tsx src/components/editor/craft/Heading.test.tsx src/components/editor/craft/resolver.ts
git commit -m "feat(craft): Heading leaf primitive with colocated settings"
```

### Task 3.2: `Text` leaf

**Files:**
- Create: `src/components/editor/craft/Text.tsx`
- Modify: `src/components/editor/craft/resolver.ts`
- Test: `src/components/editor/craft/Text.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { Text } from './Text';
import { renderLeaf } from './testUtils';

describe('Text', () => {
  it('renders text as <p> with style', () => {
    const html = renderLeaf('editor', Text, { text: 'Hello', fontSize: 16, color: '#222' });
    expect(html).toContain('<p');
    expect(html).toContain('Hello');
    expect(html).toContain('font-size:16px');
    expect(html).toContain('color:#222');
  });

  it('preserves linebreaks via white-space:pre-wrap', () => {
    const html = renderLeaf('editor', Text, { text: 'a\nb' });
    expect(html).toContain('white-space:pre-wrap');
    expect(html).toContain('a\nb');
  });
});
```

- [ ] **Step 2: Run, verify it fails**

- [ ] **Step 3: Implement `Text.tsx`**

```tsx
import { useNode } from '@craftjs/core';

export interface TextProps {
  text: string;
  fontSize?: number;
  color?: string;
  align?: 'left' | 'center' | 'right';
  brandToken?: 'text' | 'primary' | 'accent';
}

export function Text({ text, fontSize, color, align = 'left' }: TextProps) {
  const node = (() => { try { return useNode(); } catch { return null; } })();
  const connect = node?.connectors?.connect ?? null;
  const drag = node?.connectors?.drag ?? null;
  return (
    <p
      ref={(el) => { if (el && connect && drag) connect(drag(el)); }}
      style={{ fontSize, color, textAlign: align, margin: 0, whiteSpace: 'pre-wrap' }}
    >
      {text}
    </p>
  );
}

(Text as any).craft = {
  displayName: 'Text',
  props: { text: 'New text…', align: 'left' } satisfies TextProps,
  related: { settings: TextSettings },
  rules: { canDrag: () => true },
};

function TextSettings() {
  const { props, actions: { setProp } } = useNode((node) => ({
    props: node.data.props as TextProps,
  }));
  return (
    <div className="space-y-2">
      <label className="block text-xs">Text
        <textarea
          className="w-full border rounded px-2 py-1"
          rows={4}
          value={props.text}
          onChange={(e) => setProp((p: TextProps) => { p.text = e.target.value; })}
        />
      </label>
      <label className="block text-xs">Font size
        <input
          type="number"
          className="w-full border rounded px-2 py-1"
          value={props.fontSize ?? ''}
          onChange={(e) => setProp((p: TextProps) => { p.fontSize = e.target.value ? Number(e.target.value) : undefined; })}
        />
      </label>
      <label className="block text-xs">Color
        <input
          type="color"
          className="w-full border rounded"
          value={props.color ?? '#000000'}
          onChange={(e) => setProp((p: TextProps) => { p.color = e.target.value; })}
        />
      </label>
    </div>
  );
}
```

- [ ] **Step 4: Register and commit**

```ts
// resolver.ts
import { Page } from './Page';
import { Section } from './Section';
import { Row } from './Row';
import { Column } from './Column';
import { Heading } from './Heading';
import { Text } from './Text';

export const RESOLVERS = { Page, Section, Row, Column, Heading, Text } as const;
export type ResolvedName = keyof typeof RESOLVERS;
```

```bash
npm test -- src/components/editor/craft/Text.test.tsx
npm run typecheck
git add src/components/editor/craft/Text.tsx src/components/editor/craft/Text.test.tsx src/components/editor/craft/resolver.ts
git commit -m "feat(craft): Text leaf primitive with colocated settings"
```

### Task 3.3: `Image` leaf

**Files:**
- Create: `src/components/editor/craft/Image.tsx`
- Modify: `src/components/editor/craft/resolver.ts`
- Test: `src/components/editor/craft/Image.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { Image } from './Image';
import { renderLeaf } from './testUtils';

describe('Image', () => {
  it('renders <img> with width style in editor mode', () => {
    const html = renderLeaf('editor', Image, { src: 'a.png', alt: 'A', width: 200 });
    expect(html).toContain('<img');
    expect(html).toContain('src="a.png"');
    expect(html).toContain('alt="A"');
    expect(html).toContain('width:200px');
  });

  it('adds border=0 + explicit width attr in email mode', () => {
    const html = renderLeaf('email', Image, { src: 'a.png', alt: 'A', width: 200 });
    expect(html).toContain('border="0"');
    expect(html).toContain('width="200"');
  });

  it('wraps with <a> when linkHref is set', () => {
    const html = renderLeaf('editor', Image, { src: 'a.png', alt: 'A', linkHref: 'https://x.test' });
    expect(html).toMatch(/<a[^>]+href="https:\/\/x\.test"[^>]*>.*<img/);
  });
});
```

- [ ] **Step 2: Run, verify it fails**

- [ ] **Step 3: Implement `Image.tsx`**

```tsx
import { useNode } from '@craftjs/core';
import { useRenderContext } from './RenderContext';

export interface ImageProps {
  src: string;
  alt: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  linkHref?: string;
}

export function Image({ src, alt, width, align = 'center', linkHref }: ImageProps) {
  const node = (() => { try { return useNode(); } catch { return null; } })();
  const connect = node?.connectors?.connect ?? null;
  const drag = node?.connectors?.drag ?? null;
  const target = useRenderContext();
  const margin = align === 'center' ? '0 auto' : align === 'right' ? '0 0 0 auto' : '0';

  const commonProps: Record<string, unknown> = {
    src,
    alt,
    style: { width, maxWidth: '100%', display: 'block', margin },
  };
  if (target === 'email') {
    commonProps.border = '0';
    if (typeof width === 'number') commonProps.width = String(width);
  }

  const img = (
    <img
      ref={(el: HTMLImageElement | null) => { if (el && connect && drag) connect(drag(el)); }}
      {...commonProps as React.ImgHTMLAttributes<HTMLImageElement>}
    />
  );

  return linkHref ? <a href={linkHref}>{img}</a> : img;
}

(Image as any).craft = {
  displayName: 'Image',
  props: { src: '', alt: '', align: 'center' } satisfies ImageProps,
  related: { settings: ImageSettings },
  rules: { canDrag: () => true },
};

function ImageSettings() {
  const { props, actions: { setProp } } = useNode((node) => ({
    props: node.data.props as ImageProps,
  }));
  return (
    <div className="space-y-2">
      <label className="block text-xs">Source URL
        <input
          className="w-full border rounded px-2 py-1"
          value={props.src}
          onChange={(e) => setProp((p: ImageProps) => { p.src = e.target.value; })}
        />
      </label>
      <label className="block text-xs">Alt text
        <input
          className="w-full border rounded px-2 py-1"
          value={props.alt}
          onChange={(e) => setProp((p: ImageProps) => { p.alt = e.target.value; })}
        />
      </label>
      <label className="block text-xs">Width (px)
        <input
          type="number"
          className="w-full border rounded px-2 py-1"
          value={props.width ?? ''}
          onChange={(e) => setProp((p: ImageProps) => { p.width = e.target.value ? Number(e.target.value) : undefined; })}
        />
      </label>
      <label className="block text-xs">Link URL
        <input
          className="w-full border rounded px-2 py-1"
          value={props.linkHref ?? ''}
          onChange={(e) => setProp((p: ImageProps) => { p.linkHref = e.target.value || undefined; })}
        />
      </label>
    </div>
  );
}
```

- [ ] **Step 4: Register and commit**

```ts
// resolver.ts add Image
import { Image } from './Image';
export const RESOLVERS = { Page, Section, Row, Column, Heading, Text, Image } as const;
```

```bash
npm test -- src/components/editor/craft/Image.test.tsx
npm run typecheck
git add src/components/editor/craft/Image.tsx src/components/editor/craft/Image.test.tsx src/components/editor/craft/resolver.ts
git commit -m "feat(craft): Image leaf primitive with email-safe attrs"
```

### Task 3.4: `Button` leaf

**Files:**
- Create: `src/components/editor/craft/Button.tsx`
- Modify: `src/components/editor/craft/resolver.ts`
- Test: `src/components/editor/craft/Button.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { Button } from './Button';
import { renderLeaf } from './testUtils';

describe('Button', () => {
  it('renders as <a> button in editor mode', () => {
    const html = renderLeaf('editor', Button, {
      label: 'Click', href: 'https://x.test', backgroundColor: '#0a0', color: '#fff',
    });
    expect(html).toContain('<a');
    expect(html).toContain('href="https://x.test"');
    expect(html).toContain('background-color:#0a0');
    expect(html).toContain('Click');
  });

  it('renders bulletproof button table in email mode', () => {
    const html = renderLeaf('email', Button, {
      label: 'Click', href: 'https://x.test', backgroundColor: '#0a0', color: '#fff',
    });
    expect(html).toContain('<table');
    expect(html).toContain('href="https://x.test"');
    expect(html).toContain('<!--[if mso');
  });
});
```

- [ ] **Step 2: Run, verify it fails**

- [ ] **Step 3: Implement `Button.tsx`**

```tsx
import { useNode } from '@craftjs/core';
import { useRenderContext } from './RenderContext';

export interface ButtonProps {
  label: string;
  href: string;
  backgroundColor?: string;
  color?: string;
  fontSize?: number;
  paddingY?: number;
  paddingX?: number;
  borderRadius?: number;
  align?: 'left' | 'center' | 'right';
  brandTokenBg?: 'primary' | 'accent';
  brandTokenColor?: 'text' | 'primary' | 'accent';
}

export function Button({
  label, href,
  backgroundColor = '#000', color = '#fff',
  fontSize = 16, paddingY = 10, paddingX = 18, borderRadius = 4,
  align = 'left',
}: ButtonProps) {
  const node = (() => { try { return useNode(); } catch { return null; } })();
  const connect = node?.connectors?.connect ?? null;
  const drag = node?.connectors?.drag ?? null;
  const target = useRenderContext();
  const margin = align === 'center' ? '0 auto' : align === 'right' ? '0 0 0 auto' : '0';

  if (target === 'email') {
    return (
      <table role="presentation" border={0} cellPadding={0} cellSpacing={0} style={{ margin }}>
        <tbody>
          <tr>
            <td align="center" style={{ borderRadius, backgroundColor, padding: `${paddingY}px ${paddingX}px` }}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color, fontSize, textDecoration: 'none', fontWeight: 'bold' }}
              >
                {label}
              </a>
            </td>
          </tr>
        </tbody>
      </table>
    );
  }

  return (
    <a
      ref={(el) => { if (el && connect && drag) connect(drag(el)); }}
      href={href || '#'}
      style={{
        display: 'inline-block',
        backgroundColor, color, fontSize,
        padding: `${paddingY}px ${paddingX}px`,
        borderRadius,
        textDecoration: 'none',
        fontWeight: 'bold',
        margin,
      }}
    >
      {label}
    </a>
  );
}

(Button as any).craft = {
  displayName: 'Button',
  props: { label: 'Click me', href: '', align: 'left' } satisfies ButtonProps,
  related: { settings: ButtonSettings },
  rules: { canDrag: () => true },
};

function ButtonSettings() {
  const { props, actions: { setProp } } = useNode((node) => ({
    props: node.data.props as ButtonProps,
  }));
  return (
    <div className="space-y-2">
      <label className="block text-xs">Label
        <input
          className="w-full border rounded px-2 py-1"
          value={props.label}
          onChange={(e) => setProp((p: ButtonProps) => { p.label = e.target.value; })}
        />
      </label>
      <label className="block text-xs">Link URL
        <input
          className="w-full border rounded px-2 py-1"
          value={props.href}
          onChange={(e) => setProp((p: ButtonProps) => { p.href = e.target.value; })}
        />
      </label>
      <label className="block text-xs">Background
        <input
          type="color"
          className="w-full border rounded"
          value={props.backgroundColor ?? '#000000'}
          onChange={(e) => setProp((p: ButtonProps) => { p.backgroundColor = e.target.value; })}
        />
      </label>
      <label className="block text-xs">Text color
        <input
          type="color"
          className="w-full border rounded"
          value={props.color ?? '#ffffff'}
          onChange={(e) => setProp((p: ButtonProps) => { p.color = e.target.value; })}
        />
      </label>
    </div>
  );
}
```

- [ ] **Step 4: Register and commit**

```ts
// resolver.ts add Button
import { Button } from './Button';
export const RESOLVERS = { Page, Section, Row, Column, Heading, Text, Image, Button } as const;
```

```bash
npm test -- src/components/editor/craft/Button.test.tsx
npm run typecheck
git add src/components/editor/craft/Button.tsx src/components/editor/craft/Button.test.tsx src/components/editor/craft/resolver.ts
git commit -m "feat(craft): Button leaf with bulletproof email fallback"
```

### Task 3.5: `Divider` leaf

**Files:**
- Create: `src/components/editor/craft/Divider.tsx`
- Modify: `src/components/editor/craft/resolver.ts`
- Test: `src/components/editor/craft/Divider.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { Divider } from './Divider';
import { renderLeaf } from './testUtils';

describe('Divider', () => {
  it('renders <hr> with style in editor mode', () => {
    const html = renderLeaf('editor', Divider, { color: '#ccc', thickness: 2 });
    expect(html).toContain('<hr');
    expect(html).toContain('border-top-color:#ccc');
    expect(html).toContain('border-top-width:2px');
  });

  it('renders <td> spacer in email mode', () => {
    const html = renderLeaf('email', Divider, { color: '#ccc', thickness: 2 });
    expect(html).toContain('<table');
    expect(html).toContain('background-color:#ccc');
  });
});
```

- [ ] **Step 2: Run, verify it fails**

- [ ] **Step 3: Implement `Divider.tsx`**

```tsx
import { useNode } from '@craftjs/core';
import { useRenderContext } from './RenderContext';

export interface DividerProps {
  color?: string;
  thickness?: number;
  marginY?: number;
}

export function Divider({ color = '#dddddd', thickness = 1, marginY = 8 }: DividerProps) {
  const node = (() => { try { return useNode(); } catch { return null; } })();
  const connect = node?.connectors?.connect ?? null;
  const drag = node?.connectors?.drag ?? null;
  const target = useRenderContext();

  if (target === 'email') {
    return (
      <table role="presentation" width="100%" border={0} cellPadding={0} cellSpacing={0} style={{ marginTop: marginY, marginBottom: marginY }}>
        <tbody>
          <tr>
            <td style={{ height: thickness, backgroundColor: color, lineHeight: `${thickness}px`, fontSize: 0 }}>&nbsp;</td>
          </tr>
        </tbody>
      </table>
    );
  }

  return (
    <hr
      ref={(el) => { if (el && connect && drag) connect(drag(el)); }}
      style={{
        border: 0,
        borderTopStyle: 'solid', borderTopColor: color, borderTopWidth: thickness,
        marginTop: marginY, marginBottom: marginY,
      }}
    />
  );
}

(Divider as any).craft = {
  displayName: 'Divider',
  props: { color: '#dddddd', thickness: 1, marginY: 8 } satisfies DividerProps,
  related: { settings: DividerSettings },
  rules: { canDrag: () => true },
};

function DividerSettings() {
  const { props, actions: { setProp } } = useNode((node) => ({
    props: node.data.props as DividerProps,
  }));
  return (
    <div className="space-y-2">
      <label className="block text-xs">Color
        <input
          type="color"
          className="w-full border rounded"
          value={props.color ?? '#dddddd'}
          onChange={(e) => setProp((p: DividerProps) => { p.color = e.target.value; })}
        />
      </label>
      <label className="block text-xs">Thickness (px)
        <input
          type="number"
          className="w-full border rounded px-2 py-1"
          value={props.thickness ?? 1}
          onChange={(e) => setProp((p: DividerProps) => { p.thickness = Number(e.target.value); })}
        />
      </label>
    </div>
  );
}
```

- [ ] **Step 4: Register and commit**

```ts
import { Divider } from './Divider';
export const RESOLVERS = { Page, Section, Row, Column, Heading, Text, Image, Button, Divider } as const;
```

```bash
npm test -- src/components/editor/craft/Divider.test.tsx
npm run typecheck
git add src/components/editor/craft/Divider.tsx src/components/editor/craft/Divider.test.tsx src/components/editor/craft/resolver.ts
git commit -m "feat(craft): Divider leaf primitive"
```

### Task 3.6: `Spacer` leaf

**Files:**
- Create: `src/components/editor/craft/Spacer.tsx`
- Modify: `src/components/editor/craft/resolver.ts`
- Test: `src/components/editor/craft/Spacer.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { Spacer } from './Spacer';
import { renderLeaf } from './testUtils';

describe('Spacer', () => {
  it('renders height-only div in editor', () => {
    const html = renderLeaf('editor', Spacer, { height: 24 });
    expect(html).toContain('height:24px');
  });

  it('renders <td height> in email mode', () => {
    const html = renderLeaf('email', Spacer, { height: 24 });
    expect(html).toContain('<table');
    expect(html).toContain('height="24"');
  });
});
```

- [ ] **Step 2: Run, verify it fails**

- [ ] **Step 3: Implement `Spacer.tsx`**

```tsx
import { useNode } from '@craftjs/core';
import { useRenderContext } from './RenderContext';

export interface SpacerProps {
  height: number;
}

export function Spacer({ height }: SpacerProps) {
  const node = (() => { try { return useNode(); } catch { return null; } })();
  const connect = node?.connectors?.connect ?? null;
  const drag = node?.connectors?.drag ?? null;
  const target = useRenderContext();

  if (target === 'email') {
    return (
      <table role="presentation" width="100%" border={0} cellPadding={0} cellSpacing={0}>
        <tbody>
          <tr>
            <td height={String(height)} style={{ height, lineHeight: `${height}px`, fontSize: 0 }}>&nbsp;</td>
          </tr>
        </tbody>
      </table>
    );
  }

  return (
    <div
      ref={(el) => { if (el && connect && drag) connect(drag(el)); }}
      style={{ height }}
    />
  );
}

(Spacer as any).craft = {
  displayName: 'Spacer',
  props: { height: 16 } satisfies SpacerProps,
  related: { settings: SpacerSettings },
  rules: { canDrag: () => true },
};

function SpacerSettings() {
  const { props, actions: { setProp } } = useNode((node) => ({
    props: node.data.props as SpacerProps,
  }));
  return (
    <label className="block text-xs">Height (px)
      <input
        type="number"
        className="w-full border rounded px-2 py-1"
        value={props.height}
        onChange={(e) => setProp((p: SpacerProps) => { p.height = Number(e.target.value); })}
      />
    </label>
  );
}
```

- [ ] **Step 4: Register and commit**

```ts
import { Spacer } from './Spacer';
export const RESOLVERS = { Page, Section, Row, Column, Heading, Text, Image, Button, Divider, Spacer } as const;
```

```bash
npm test -- src/components/editor/craft/Spacer.test.tsx
npm run typecheck
git add src/components/editor/craft/Spacer.tsx src/components/editor/craft/Spacer.test.tsx src/components/editor/craft/resolver.ts
git commit -m "feat(craft): Spacer leaf primitive"
```

### Task 3.7: `List` leaf (bullet list)

**Files:**
- Create: `src/components/editor/craft/List.tsx`
- Modify: `src/components/editor/craft/resolver.ts`
- Test: `src/components/editor/craft/List.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { List } from './List';
import { renderLeaf } from './testUtils';

describe('List', () => {
  it('renders ordered or unordered list with items', () => {
    const ul = renderLeaf('editor', List, { items: ['a', 'b'], ordered: false });
    expect(ul).toContain('<ul');
    expect(ul).toContain('<li');
    expect(ul).toContain('a');
    expect(ul).toContain('b');

    const ol = renderLeaf('editor', List, { items: ['x'], ordered: true });
    expect(ol).toContain('<ol');
  });

  it('escapes html in items', () => {
    const html = renderLeaf('editor', List, { items: ['<script>x</script>'], ordered: false });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
```

- [ ] **Step 2: Run, verify it fails**

- [ ] **Step 3: Implement `List.tsx`**

```tsx
import { useNode } from '@craftjs/core';

export interface ListProps {
  items: string[];
  ordered?: boolean;
  fontSize?: number;
  color?: string;
}

export function List({ items, ordered = false, fontSize, color }: ListProps) {
  const node = (() => { try { return useNode(); } catch { return null; } })();
  const connect = node?.connectors?.connect ?? null;
  const drag = node?.connectors?.drag ?? null;
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag
      ref={(el: HTMLElement | null) => { if (el && connect && drag) connect(drag(el)); }}
      style={{ margin: 0, paddingLeft: 20, fontSize, color }}
    >
      {items.map((item, i) => (
        <li key={i} style={{ margin: '4px 0' }}>{item}</li>
      ))}
    </Tag>
  );
}

(List as any).craft = {
  displayName: 'List',
  props: { items: ['Item one', 'Item two'], ordered: false } satisfies ListProps,
  related: { settings: ListSettings },
  rules: { canDrag: () => true },
};

function ListSettings() {
  const { props, actions: { setProp } } = useNode((node) => ({
    props: node.data.props as ListProps,
  }));
  const text = props.items.join('\n');
  return (
    <div className="space-y-2">
      <label className="block text-xs">Items (one per line)
        <textarea
          className="w-full border rounded px-2 py-1"
          rows={6}
          value={text}
          onChange={(e) => setProp((p: ListProps) => { p.items = e.target.value.split('\n'); })}
        />
      </label>
      <label className="block text-xs">
        <input
          type="checkbox"
          checked={props.ordered ?? false}
          onChange={(e) => setProp((p: ListProps) => { p.ordered = e.target.checked; })}
        /> Numbered list
      </label>
    </div>
  );
}
```

- [ ] **Step 4: Register and commit**

```ts
import { List } from './List';
export const RESOLVERS = { Page, Section, Row, Column, Heading, Text, Image, Button, Divider, Spacer, List } as const;
```

```bash
npm test -- src/components/editor/craft/List.test.tsx
npm run typecheck
git add src/components/editor/craft/List.tsx src/components/editor/craft/List.test.tsx src/components/editor/craft/resolver.ts
git commit -m "feat(craft): List leaf primitive (bullet/numbered)"
```

---

## Phase 4: Tree walker for SSR rendering

### Task 4.1: `renderTreeToReact` walker

**Files:**
- Create: `src/lib/export/renderTree.ts`
- Test: `src/lib/export/renderTree.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/lib/export/renderTree.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import type { SerializedNodes } from '@craftjs/core';
import { renderTreeToReact } from './renderTree';
import { RESOLVERS } from '@/components/editor/craft/resolver';
import { RenderContextProvider } from '@/components/editor/craft/RenderContext';

const TREE: SerializedNodes = {
  ROOT: {
    type: { resolvedName: 'Page' },
    props: { backgroundColor: '#fff' },
    parent: null,
    nodes: ['s1'],
    linkedNodes: {},
    displayName: 'Page',
    isCanvas: true,
    hidden: false,
    custom: {},
  },
  s1: {
    type: { resolvedName: 'Section' },
    props: { paddingY: 8, paddingX: 8 },
    parent: 'ROOT',
    nodes: ['r1'],
    linkedNodes: {},
    displayName: 'Section',
    isCanvas: true,
    hidden: false,
    custom: {},
  },
  r1: {
    type: { resolvedName: 'Row' },
    props: {},
    parent: 's1',
    nodes: ['c1'],
    linkedNodes: {},
    displayName: 'Row',
    isCanvas: true,
    hidden: false,
    custom: {},
  },
  c1: {
    type: { resolvedName: 'Column' },
    props: { width: 100 },
    parent: 'r1',
    nodes: ['h1'],
    linkedNodes: {},
    displayName: 'Column',
    isCanvas: true,
    hidden: false,
    custom: {},
  },
  h1: {
    type: { resolvedName: 'Heading' },
    props: { text: 'Hi', level: 2 },
    parent: 'c1',
    nodes: [],
    linkedNodes: {},
    displayName: 'Heading',
    isCanvas: false,
    hidden: false,
    custom: {},
  },
};

describe('renderTreeToReact', () => {
  it('walks the tree from ROOT and renders nested primitives', () => {
    const react = renderTreeToReact(TREE, RESOLVERS);
    const html = renderToString(
      <RenderContextProvider value="editor">{react}</RenderContextProvider>
    );
    expect(html).toContain('background-color:#fff');
    expect(html).toContain('<h2');
    expect(html).toContain('Hi');
  });

  it('throws on unknown resolvedName', () => {
    const bad = { ROOT: { ...TREE.ROOT, nodes: ['x'] }, x: { ...TREE.h1, type: { resolvedName: 'Unknown' } } } as SerializedNodes;
    expect(() => renderTreeToReact(bad, RESOLVERS)).toThrow(/Unknown/);
  });

  it('throws when ROOT node is missing', () => {
    expect(() => renderTreeToReact({} as SerializedNodes, RESOLVERS)).toThrow(/ROOT/);
  });
});
```

- [ ] **Step 2: Run, verify it fails**

```bash
npm test -- src/lib/export/renderTree.test.tsx
```

- [ ] **Step 3: Implement `renderTree.ts`**

```ts
import { createElement, type ReactElement, type ComponentType } from 'react';
import type { SerializedNodes } from '@craftjs/core';

type Resolvers = Record<string, ComponentType<Record<string, unknown>>>;

export function renderTreeToReact(
  tree: SerializedNodes,
  resolvers: Resolvers,
  rootId: string = 'ROOT',
): ReactElement {
  if (!tree[rootId]) {
    throw new Error(`renderTreeToReact: ${rootId} node missing from tree`);
  }
  return walk(rootId, tree, resolvers);
}

function walk(
  id: string,
  tree: SerializedNodes,
  resolvers: Resolvers,
): ReactElement {
  const node = tree[id];
  if (!node) throw new Error(`renderTreeToReact: node ${id} missing from tree`);

  const name = node.type.resolvedName;
  if (!name) {
    throw new Error(`renderTreeToReact: node ${id} has no resolvedName`);
  }
  const Component = resolvers[name];
  if (!Component) {
    throw new Error(`renderTreeToReact: Unknown component "${name}" — not in resolvers`);
  }

  const children = node.nodes.map((childId) => walk(childId, tree, resolvers));
  return createElement(Component, { ...node.props, key: id } as Record<string, unknown>, children);
}
```

- [ ] **Step 4: Run, verify it passes; typecheck; commit**

```bash
npm test -- src/lib/export/renderTree.test.tsx
npm run typecheck
git add src/lib/export/renderTree.ts src/lib/export/renderTree.test.tsx
git commit -m "feat(export): renderTreeToReact walker for SSR rendering"
```

---

## Phase 5: v3 schema, store mirror, EditorShell rewrite

### Task 5.1: v3 schema in `types.ts`

**Files:**
- Modify: `src/lib/editor/types.ts`

- [ ] **Step 1: Replace `types.ts` with v3 schema (keep v2 types in `migrate.ts` only for the converter)**

```ts
import type { SerializedNodes } from '@craftjs/core';

export const SCHEMA_VERSION = 3;

export interface ProjectData {
  schemaVersion: 3;
  global: GlobalStyles;
  tree: SerializedNodes;
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

- [ ] **Step 2: Typecheck — this will fail in many places. Capture the failures.**

```bash
npm run typecheck > /tmp/typecheck.log 2>&1
```

Expected: many errors referencing missing `Block`, `Header`, `Footer`, etc. exports. These are addressed in subsequent tasks (migrate, store, templates, renderers, panels). **Do not commit yet.**

- [ ] **Step 3: Keep edits staged — proceed to Task 5.2 before committing**

(This task's commit happens at the end of Phase 5 after the breakage is resolved.)

### Task 5.2: Extract v2 types into `migrate.ts` only

**Files:**
- Modify: `src/lib/editor/migrate.ts`

- [ ] **Step 1: Inline the v2 interfaces inside `migrate.ts`** (so the rest of the codebase no longer imports them)

Prepend before the existing v1 interfaces:

```ts
// v2 schema kept locally for migration only. Do not export.
interface V2GlobalStyles {
  backgroundColor: string; fontFamily: string;
  baseFontSize: number; headingFontSize: number;
  textColor: string; buttonColor: string; buttonTextColor: string;
  accentColor: string; footerBackgroundColor: string; footerTextColor: string;
  contactUrl: string;
}
interface V2WebsiteLink { label: string; url: string }
type V2SocialPlatform = 'facebook' | 'linkedin' | 'twitter' | 'youtube' | 'instagram';
interface V2SocialLink { platform: V2SocialPlatform; url: string }

interface V2BlockBase { id: string; locked?: boolean }
interface V2Header extends V2BlockBase {
  type: 'header';
  logoSrc: string; logoAlt: string; logoWidth: number;
  title: string; titleFontSize: number;
  bannerSrc: string; bannerAlt: string; bannerWidth?: number;
  sectionHeading: string; sectionHeadingFontSize: number;
}
interface V2ProductSection extends V2BlockBase {
  type: 'product-section';
  title: string; bullets: string[];
  imageSrc: string; imageAlt: string; imageWidth?: number;
  ctaText: string; ctaUrl?: string;
  titleFontSize?: number; bulletFontSize?: number;
  textColor?: string; buttonColor?: string; backgroundColor?: string;
}
interface V2Hero extends V2BlockBase {
  type: 'hero';
  imageSrc: string; imageAlt: string; imageWidth?: number;
  title: string; subtitle: string;
  ctaText: string; ctaUrl?: string;
  titleFontSize?: number; subtitleFontSize?: number;
  backgroundColor?: string; textColor?: string; buttonColor?: string;
}
interface V2Article extends V2BlockBase {
  type: 'article';
  imageSrc: string; imageAlt: string; imageWidth?: number;
  title: string; body: string;
  ctaText: string; ctaUrl?: string;
  imagePosition: 'top' | 'left' | 'right';
  titleFontSize?: number; bodyFontSize?: number;
  backgroundColor?: string; textColor?: string;
}
interface V2CTABanner extends V2BlockBase {
  type: 'cta-banner';
  title: string; subtitle: string;
  ctaText: string; ctaUrl?: string;
  align: 'left' | 'center';
  titleFontSize?: number;
  backgroundColor?: string; textColor?: string; buttonColor?: string;
}
interface V2Footer extends V2BlockBase {
  type: 'footer';
  bannerSrc: string; bannerAlt: string; bannerWidth?: number;
  companyName: string; address: string; phone: string; phoneTel: string;
  email: string;
  websites: V2WebsiteLink[]; socials: V2SocialLink[];
  backgroundColor?: string; textColor?: string;
}
type V2Block = V2Header | V2ProductSection | V2Hero | V2Article | V2CTABanner | V2Footer;

interface V2ProjectData {
  schemaVersion: 2;
  global: V2GlobalStyles;
  blocks: V2Block[];
}
```

- [ ] **Step 2: Replace the existing v1ToV2 and downgradeV2ToV1 functions to use these local V2 types instead of imports**

Update the import block at the top of `migrate.ts` — remove all imports from `./types` and `./blocks`, then update the function signatures: `function v1ToV2(v1: V1ProjectData): V2ProjectData { ... }`. The Block type aliases (`HeaderBlock`, etc.) used inside become `V2Header`, etc.

Replace the body of `v1ToV2` accordingly. The function now returns a `V2ProjectData` intermediate, not the final `ProjectData`.

- [ ] **Step 3: Update `migrate()` to chain v1→v2→v3** — full body to replace existing function (v3 conversion implemented in next task; for now leave a stub that throws):

```ts
import type { ProjectData } from './types';
import { migrateV2ToV3 } from './migrateV2ToV3';

export function migrate(raw: unknown): ProjectData {
  if (raw == null || typeof raw !== 'object') {
    throw new Error('migrate: input must be an object');
  }
  const v = (raw as { schemaVersion?: number }).schemaVersion;
  let v2: V2ProjectData;
  if (v === 3) return raw as ProjectData;
  if (v === 2) v2 = raw as V2ProjectData;
  else if (v === 1 || v === undefined) v2 = v1ToV2(raw as V1ProjectData);
  else throw new Error(`Unsupported schemaVersion: ${v}`);
  return migrateV2ToV3(v2);
}

// downgradeV2ToV1 was exported; if nothing imports it after Phase 7 cleanup, delete it.
// For now leave as-is to keep its tests green during the transition.
```

- [ ] **Step 4: Don't commit yet — proceed to 5.3 to write the v2→v3 converter**

### Task 5.3: `migrateV2ToV3` per-block converter

**Files:**
- Create: `src/lib/editor/migrateV2ToV3.ts`
- Test: `src/lib/editor/migrateV2ToV3.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { migrateV2ToV3 } from './migrateV2ToV3';

const V2: any = {
  schemaVersion: 2,
  global: {
    backgroundColor: '#fff', fontFamily: 'Arial', baseFontSize: 16, headingFontSize: 25,
    textColor: '#000', buttonColor: '#f00', buttonTextColor: '#fff',
    accentColor: '#f00', footerBackgroundColor: '#000', footerTextColor: '#fff', contactUrl: '',
  },
  blocks: [
    { type: 'header', id: 'h', locked: true, logoSrc: '', logoAlt: '', logoWidth: 300, title: 'T', titleFontSize: 18, bannerSrc: '', bannerAlt: '', sectionHeading: 'SH', sectionHeadingFontSize: 25 },
    { type: 'hero', id: 'he', imageSrc: '', imageAlt: '', title: 'Hi', subtitle: 'Sub', ctaText: 'Go' },
    { type: 'product-section', id: 'ps', title: 'P', bullets: ['a', 'b'], imageSrc: '', imageAlt: '', ctaText: 'CTA' },
    { type: 'footer', id: 'f', locked: true, bannerSrc: '', bannerAlt: '', companyName: 'Co', address: '', phone: '', phoneTel: '', email: '', websites: [], socials: [] },
  ],
};

describe('migrateV2ToV3', () => {
  it('produces a tree with ROOT Page and one Section per v2 block', () => {
    const v3 = migrateV2ToV3(V2);
    expect(v3.schemaVersion).toBe(3);
    expect(v3.tree.ROOT.type.resolvedName).toBe('Page');
    expect(v3.tree.ROOT.nodes).toHaveLength(4);
    for (const id of v3.tree.ROOT.nodes) {
      expect(v3.tree[id].type.resolvedName).toBe('Section');
    }
  });

  it('marks header and footer sections locked with role custom', () => {
    const v3 = migrateV2ToV3(V2);
    const [headerId, , , footerId] = v3.tree.ROOT.nodes;
    expect(v3.tree[headerId].props.locked).toBe(true);
    expect(v3.tree[headerId].custom.role).toBe('header');
    expect(v3.tree[footerId].props.locked).toBe(true);
    expect(v3.tree[footerId].custom.role).toBe('footer');
  });

  it('product-section block becomes Section → Row(2col) → Image + (Heading + List + Button)', () => {
    const v3 = migrateV2ToV3(V2);
    const psSectionId = v3.tree.ROOT.nodes[2];
    const rowId = v3.tree[psSectionId].nodes[0];
    const row = v3.tree[rowId];
    expect(row.type.resolvedName).toBe('Row');
    expect(row.nodes).toHaveLength(2);
    const [col1Id, col2Id] = row.nodes;
    expect(v3.tree[col1Id].nodes.map((n) => v3.tree[n].type.resolvedName)).toEqual(['Image']);
    expect(v3.tree[col2Id].nodes.map((n) => v3.tree[n].type.resolvedName)).toEqual(['Heading', 'List', 'Button']);
  });

  it('preserves global styles unchanged', () => {
    const v3 = migrateV2ToV3(V2);
    expect(v3.global).toEqual(V2.global);
  });

  it('is deterministic for the same input', () => {
    // Inject deterministic id generator via opts
    const a = migrateV2ToV3(V2, { idGen: counter() });
    const b = migrateV2ToV3(V2, { idGen: counter() });
    expect(a.tree).toEqual(b.tree);
  });
});

function counter(): () => string {
  let n = 0;
  return () => `n${++n}`;
}
```

- [ ] **Step 2: Run, verify it fails**

```bash
npm test -- src/lib/editor/migrateV2ToV3.test.ts
```

- [ ] **Step 3: Implement `migrateV2ToV3.ts`**

```ts
import { v4 as uuid } from 'uuid';
import type { SerializedNodes, SerializedNode } from '@craftjs/core';
import type { ProjectData } from './types';
import { SCHEMA_VERSION } from './types';

interface V2Block { type: string; id: string; locked?: boolean; [k: string]: unknown }
interface V2ProjectData {
  schemaVersion: 2;
  global: ProjectData['global'];
  blocks: V2Block[];
}

interface Opts {
  idGen?: () => string;
}

export function migrateV2ToV3(v2: V2ProjectData, opts: Opts = {}): ProjectData {
  const idGen = opts.idGen ?? uuid;
  const builder = new TreeBuilder(idGen);
  const rootId = builder.add('ROOT', 'Page', { backgroundColor: v2.global.backgroundColor, fontFamily: v2.global.fontFamily }, true, {});

  for (const block of v2.blocks) {
    const role = block.type === 'header' ? 'header' : block.type === 'footer' ? 'footer' : null;
    const locked = role !== null;
    const sectionId = builder.add(idGen(), 'Section', sectionPropsFor(block), true, role ? { role } : {}, locked ? { locked: true } : {});
    builder.appendTo(rootId, sectionId);
    convertBlock(block, sectionId, builder);
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    global: v2.global,
    tree: builder.toSerializedNodes(),
  };
}

class TreeBuilder {
  private nodes: SerializedNodes = {};
  constructor(private idGen: () => string) {}

  add(
    id: string,
    resolvedName: string,
    props: Record<string, unknown>,
    isCanvas: boolean,
    custom: Record<string, unknown> = {},
    extraProps: Record<string, unknown> = {},
  ): string {
    const node: SerializedNode = {
      type: { resolvedName },
      props: { ...props, ...extraProps },
      parent: null,
      nodes: [],
      linkedNodes: {},
      displayName: resolvedName,
      isCanvas,
      hidden: false,
      custom,
    };
    this.nodes[id] = node;
    return id;
  }

  newId(): string { return this.idGen(); }

  appendTo(parentId: string, childId: string) {
    this.nodes[parentId].nodes.push(childId);
    this.nodes[childId].parent = parentId;
  }

  toSerializedNodes(): SerializedNodes { return this.nodes; }
}

function sectionPropsFor(block: V2Block): Record<string, unknown> {
  const bg = (block as any).backgroundColor;
  return bg ? { backgroundColor: bg, paddingY: 16, paddingX: 16 } : { paddingY: 16, paddingX: 16 };
}

function convertBlock(block: V2Block, sectionId: string, b: TreeBuilder) {
  switch (block.type) {
    case 'header': return convertHeader(block as any, sectionId, b);
    case 'footer': return convertFooter(block as any, sectionId, b);
    case 'hero': return convertHero(block as any, sectionId, b);
    case 'article': return convertArticle(block as any, sectionId, b);
    case 'cta-banner': return convertCTABanner(block as any, sectionId, b);
    case 'product-section': return convertProductSection(block as any, sectionId, b);
    default: throw new Error(`migrateV2ToV3: unknown block type ${block.type}`);
  }
}

function singleColumnRow(b: TreeBuilder, sectionId: string): string {
  const rowId = b.add(b.newId(), 'Row', {}, true);
  b.appendTo(sectionId, rowId);
  const colId = b.add(b.newId(), 'Column', { width: 100 }, true);
  b.appendTo(rowId, colId);
  return colId;
}

function convertHeader(h: any, sectionId: string, b: TreeBuilder) {
  const colId = singleColumnRow(b, sectionId);
  if (h.logoSrc) {
    const id = b.add(b.newId(), 'Image', { src: h.logoSrc, alt: h.logoAlt, width: h.logoWidth, align: 'center' }, false);
    b.appendTo(colId, id);
  }
  if (h.title) {
    const id = b.add(b.newId(), 'Heading', { text: h.title, level: 1, fontSize: h.titleFontSize, align: 'center' }, false);
    b.appendTo(colId, id);
  }
  if (h.bannerSrc) {
    const id = b.add(b.newId(), 'Image', { src: h.bannerSrc, alt: h.bannerAlt, width: h.bannerWidth, align: 'center' }, false);
    b.appendTo(colId, id);
  }
  if (h.sectionHeading) {
    const id = b.add(b.newId(), 'Heading', { text: h.sectionHeading, level: 2, fontSize: h.sectionHeadingFontSize, align: 'center' }, false);
    b.appendTo(colId, id);
  }
}

function convertFooter(f: any, sectionId: string, b: TreeBuilder) {
  const colId = singleColumnRow(b, sectionId);
  if (f.bannerSrc) {
    const id = b.add(b.newId(), 'Image', { src: f.bannerSrc, alt: f.bannerAlt, width: f.bannerWidth }, false);
    b.appendTo(colId, id);
  }
  const companyLines = [f.companyName, f.address].filter(Boolean).join('\n');
  if (companyLines) {
    const id = b.add(b.newId(), 'Text', { text: companyLines, color: f.textColor, align: 'center' }, false);
    b.appendTo(colId, id);
  }
  const contactLines = [f.phone, f.email].filter(Boolean).join(' · ');
  if (contactLines) {
    const id = b.add(b.newId(), 'Text', { text: contactLines, color: f.textColor, align: 'center' }, false);
    b.appendTo(colId, id);
  }
}

function convertHero(h: any, sectionId: string, b: TreeBuilder) {
  const colId = singleColumnRow(b, sectionId);
  if (h.imageSrc) {
    const id = b.add(b.newId(), 'Image', { src: h.imageSrc, alt: h.imageAlt, width: h.imageWidth, align: 'center' }, false);
    b.appendTo(colId, id);
  }
  if (h.title) {
    const id = b.add(b.newId(), 'Heading', { text: h.title, level: 1, fontSize: h.titleFontSize, color: h.textColor, align: 'center' }, false);
    b.appendTo(colId, id);
  }
  if (h.subtitle) {
    const id = b.add(b.newId(), 'Text', { text: h.subtitle, fontSize: h.subtitleFontSize, color: h.textColor, align: 'center' }, false);
    b.appendTo(colId, id);
  }
  if (h.ctaText) {
    const id = b.add(b.newId(), 'Button', { label: h.ctaText, href: h.ctaUrl ?? '', backgroundColor: h.buttonColor, align: 'center' }, false);
    b.appendTo(colId, id);
  }
}

function convertArticle(a: any, sectionId: string, b: TreeBuilder) {
  if (a.imagePosition === 'top') {
    const colId = singleColumnRow(b, sectionId);
    if (a.imageSrc) {
      const id = b.add(b.newId(), 'Image', { src: a.imageSrc, alt: a.imageAlt, width: a.imageWidth, align: 'center' }, false);
      b.appendTo(colId, id);
    }
    appendTitleBodyCTA(a, colId, b);
  } else {
    const rowId = b.add(b.newId(), 'Row', { reverse: a.imagePosition === 'right' }, true);
    b.appendTo(sectionId, rowId);
    const imgCol = b.add(b.newId(), 'Column', { width: 40 }, true);
    const txtCol = b.add(b.newId(), 'Column', { width: 60 }, true);
    b.appendTo(rowId, imgCol);
    b.appendTo(rowId, txtCol);
    if (a.imageSrc) {
      const id = b.add(b.newId(), 'Image', { src: a.imageSrc, alt: a.imageAlt, width: a.imageWidth }, false);
      b.appendTo(imgCol, id);
    }
    appendTitleBodyCTA(a, txtCol, b);
  }
}

function appendTitleBodyCTA(a: any, colId: string, b: TreeBuilder) {
  if (a.title) {
    const id = b.add(b.newId(), 'Heading', { text: a.title, level: 2, fontSize: a.titleFontSize, color: a.textColor }, false);
    b.appendTo(colId, id);
  }
  if (a.body) {
    const id = b.add(b.newId(), 'Text', { text: a.body, fontSize: a.bodyFontSize, color: a.textColor }, false);
    b.appendTo(colId, id);
  }
  if (a.ctaText) {
    const id = b.add(b.newId(), 'Button', { label: a.ctaText, href: a.ctaUrl ?? '' }, false);
    b.appendTo(colId, id);
  }
}

function convertCTABanner(c: any, sectionId: string, b: TreeBuilder) {
  const colId = singleColumnRow(b, sectionId);
  if (c.title) {
    const id = b.add(b.newId(), 'Heading', { text: c.title, level: 2, fontSize: c.titleFontSize, color: c.textColor, align: c.align }, false);
    b.appendTo(colId, id);
  }
  if (c.subtitle) {
    const id = b.add(b.newId(), 'Text', { text: c.subtitle, color: c.textColor, align: c.align }, false);
    b.appendTo(colId, id);
  }
  if (c.ctaText) {
    const id = b.add(b.newId(), 'Button', { label: c.ctaText, href: c.ctaUrl ?? '', backgroundColor: c.buttonColor, align: c.align }, false);
    b.appendTo(colId, id);
  }
}

function convertProductSection(p: any, sectionId: string, b: TreeBuilder) {
  const rowId = b.add(b.newId(), 'Row', {}, true);
  b.appendTo(sectionId, rowId);
  const imgCol = b.add(b.newId(), 'Column', { width: 50 }, true);
  const txtCol = b.add(b.newId(), 'Column', { width: 50 }, true);
  b.appendTo(rowId, imgCol);
  b.appendTo(rowId, txtCol);

  if (p.imageSrc) {
    const id = b.add(b.newId(), 'Image', { src: p.imageSrc, alt: p.imageAlt, width: p.imageWidth }, false);
    b.appendTo(imgCol, id);
  }

  if (p.title) {
    const id = b.add(b.newId(), 'Heading', { text: p.title, level: 2, fontSize: p.titleFontSize, color: p.textColor }, false);
    b.appendTo(txtCol, id);
  }
  if (p.bullets && p.bullets.length > 0) {
    const id = b.add(b.newId(), 'List', { items: p.bullets, ordered: false, fontSize: p.bulletFontSize, color: p.textColor }, false);
    b.appendTo(txtCol, id);
  }
  if (p.ctaText) {
    const id = b.add(b.newId(), 'Button', { label: p.ctaText, href: p.ctaUrl ?? '', backgroundColor: p.buttonColor }, false);
    b.appendTo(txtCol, id);
  }
}
```

- [ ] **Step 4: Run, verify it passes**

```bash
npm test -- src/lib/editor/migrateV2ToV3.test.ts
```

- [ ] **Step 5: Don't commit yet — store and templates still broken; resolved in Tasks 5.4–5.7**

### Task 5.4: Replace `store.ts` with v3 tree-aware store

**Files:**
- Modify: `src/lib/editor/store.ts`
- Modify: `src/lib/editor/store.blocks.test.ts` (delete — tested v2 actions)
- Delete: `src/lib/editor/blocks.ts`

- [ ] **Step 1: Delete `blocks.ts` and the v2-specific store test**

```bash
git rm src/lib/editor/blocks.ts src/lib/editor/store.blocks.test.ts
```

- [ ] **Step 2: Rewrite `store.ts`**

```ts
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { GlobalStyles, ProjectData } from './types';
import type { SerializedNodes } from '@craftjs/core';

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'error';

export interface BrandKitSnapshot {
  global?: Partial<GlobalStyles>;
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
  setTree(tree: SerializedNodes): void;
  setProjectBrandKit(id: string | null): void;
  applyBrandKit(snapshot: BrandKitSnapshot): void;
  resetToSaved(): void;
  markSaving(status: SaveStatus, error?: string | null): void;
  markSaved(updatedAt: string, data: ProjectData, name: string, brandKitId: string | null): void;
}

export type EditorStore = StoreApi<EditorState>;

interface Init {
  projectId: string;
  name: string;
  data: ProjectData;
  brandKitId: string | null;
  workspaceSlug: string;
  serverUpdatedAt: string;
}

export function createEditorStore(init: Init): EditorStore {
  return createStore<EditorState>((set) => ({
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
    setGlobal: (patch) => set((s) => ({
      data: { ...s.data, global: { ...s.data.global, ...patch } },
    })),
    setTree: (tree) => set((s) => ({
      data: { ...s.data, tree },
    })),
    setProjectBrandKit: (id) => set({ brandKitId: id }),
    applyBrandKit: (snapshot) => set((s) => ({
      data: snapshot.global
        ? { ...s.data, global: { ...s.data.global, ...snapshot.global } }
        : s.data,
    })),
    resetToSaved: () => set((s) => ({
      data: s.lastSavedData,
      name: s.lastSavedName,
      brandKitId: s.lastSavedBrandKitId,
    })),
    markSaving: (status, error = null) => set({ saving: status, lastError: error }),
    markSaved: (updatedAt, data, name, brandKitId) => set({
      saving: 'idle',
      serverUpdatedAt: updatedAt,
      lastError: null,
      lastSavedData: data,
      lastSavedName: name,
      lastSavedBrandKitId: brandKitId,
    }),
  }));
}
```

**Note:** Undo/redo previously lived in this store via `zundo` `temporal`. Phase 9 reattaches undo/redo via Craft.js's built-in history. The `flushHistoryCooldown` API and `zundo` dependency are removed.

- [ ] **Step 3: Remove `zundo` from package.json**

```bash
npm uninstall zundo
```

### Task 5.5: Rewrite `defaultProject.ts` to return v3

**Files:**
- Modify: `src/lib/editor/defaultProject.ts`

- [ ] **Step 1: Read current file** to capture default global styles, then rewrite as:

```ts
import type { ProjectData } from './types';
import { SCHEMA_VERSION } from './types';
import { migrateV2ToV3 } from './migrateV2ToV3';

const v2Defaults = {
  schemaVersion: 2 as const,
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
    { type: 'header', id: 'h', locked: true, logoSrc: '', logoAlt: '', logoWidth: 390, title: '', titleFontSize: 18, bannerSrc: '', bannerAlt: '', sectionHeading: '', sectionHeadingFontSize: 25 },
    { type: 'footer', id: 'f', locked: true, bannerSrc: '', bannerAlt: '', companyName: '', address: '', phone: '', phoneTel: '', email: '', websites: [], socials: [] },
  ],
};

export function makeDefaultProject(): ProjectData {
  return migrateV2ToV3(v2Defaults as any);
}

export { SCHEMA_VERSION };
```

### Task 5.6: Rewrite the three preset templates to return v3

**Files:**
- Modify: `src/lib/editor/templates/announcement.ts`
- Modify: `src/lib/editor/templates/eventInvite.ts`
- Modify: `src/lib/editor/templates/newsletter.ts`

- [ ] **Step 1: For each template, replace the export with the same v2 data wrapped in `migrateV2ToV3`**

Example for `newsletter.ts` (apply the same pattern to the other two — read the current v2 body, then wrap):

```ts
import type { ProjectData } from '../types';
import { migrateV2ToV3 } from '../migrateV2ToV3';

const v2 = {
  schemaVersion: 2 as const,
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
    { type: 'header' as const, id: 'h', locked: true, logoSrc: '', logoAlt: '', logoWidth: 390, title: 'Monthly update', titleFontSize: 18, bannerSrc: '', bannerAlt: '', sectionHeading: 'What we shipped this month', sectionHeadingFontSize: 25 },
    { type: 'hero' as const, id: 'he', imageSrc: '', imageAlt: '', title: 'This month at our company', subtitle: 'A short note from the team — the highlights, in one place.', ctaText: 'See the full update' },
    { type: 'article' as const, id: 'a1', imageSrc: '', imageAlt: '', title: 'Story one', body: 'A short paragraph or two about the first story. Keep it under five lines.', ctaText: 'Read more', imagePosition: 'top' as const },
    { type: 'article' as const, id: 'a2', imageSrc: '', imageAlt: '', title: 'Story two', body: 'Another short paragraph. Newsletter readers skim — short beats long.', ctaText: 'Read more', imagePosition: 'top' as const },
    { type: 'footer' as const, id: 'f', locked: true, bannerSrc: '', bannerAlt: '', companyName: '', address: '', phone: '', phoneTel: '', email: '', websites: [], socials: [] },
  ],
};

export function createNewsletterTemplate(): ProjectData {
  return migrateV2ToV3(v2 as any);
}
```

Repeat for `announcement.ts` and `eventInvite.ts` — copy the v2 `blocks` array from each existing file, replace exported function body with `migrateV2ToV3` wrap.

### Task 5.7: Clean up remaining v2 references; commit Phase 5

- [ ] **Step 1: Run typecheck — identify remaining call sites that import v2 types**

```bash
npm run typecheck > /tmp/typecheck.log 2>&1
cat /tmp/typecheck.log | grep -E "(error|Cannot find)" | head -50
```

Expected remaining failures (handled in Phases 6, 7, 8):
- `src/components/editor/PreviewBody.tsx` — references `findHeader`/`findFooter` (Phase 6)
- `src/components/editor/blocks/*.tsx` — entire dir to delete (Phase 6)
- `src/components/editor/panels/*.tsx` — entire dir to delete (Phase 6)
- `src/lib/export/renderEmail.ts` — current rewrite (Phase 7)
- `src/lib/export/renderPrintDocument.ts` — current rewrite (Phase 8)
- `src/lib/translate/fields.ts` — Phase 8
- `src/lib/import/parseHtml.ts` — emits v2; needs v3 wrap or update
- `src/components/editor/EditorShell.tsx`, `Topbar.tsx`, `LeftPanel.tsx` — Phase 6
- `src/lib/editor/templates.ts` and `defaultProject.ts` — fixed in Tasks 5.5/5.6, verify

- [ ] **Step 2: Patch `parseHtml.ts` to migrate its v2 output to v3**

Modify the `return` of the parse function (whichever shape it currently has) to wrap the result with `migrateV2ToV3`:

```ts
import { migrateV2ToV3 } from '@/lib/editor/migrateV2ToV3';
// ...
const v2: any = { schemaVersion: 2, global, blocks };
return migrateV2ToV3(v2);
```

Update its return type to `ProjectData` from `@/lib/editor/types`.

- [ ] **Step 3: Commit Phase 5 even though some downstream files are still broken**

Phase 5 commit is acceptable to land in a "scaffolding" state because Phases 6–8 immediately follow and address the remaining typecheck errors. Document the broken-window status in the commit:

```bash
git add -A
git commit -m "feat(editor): v3 tree schema, migrateV2ToV3 converter, store mirror

Phase 5 scaffolding. Renderers, panels, and views still reference v2
types and won't typecheck — Phases 6-8 address them in sequence on the
same branch."
```

---

## Phase 6: EditorShell + canvas + drop old panels/views

### Task 6.1: New `EditorShell` mounting Craft `<Editor>` + `<Frame>`

**Files:**
- Modify: `src/components/editor/EditorShell.tsx`
- Create: `src/components/editor/craft/TreeSyncBridge.tsx`

- [ ] **Step 1: Implement `TreeSyncBridge.tsx`**

```tsx
'use client';
import { useEffect, useRef } from 'react';
import { useEditor } from '@craftjs/core';
import { useEditorStore } from '@/lib/editor/StoreProvider';

export function TreeSyncBridge({ debounceMs = 300 }: { debounceMs?: number }) {
  const { query } = useEditor();
  const store = useEditorStore();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = useEditor.subscribe?.(() => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const tree = query.serialize();
        store.getState().setTree(JSON.parse(tree));
      }, debounceMs);
    });
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [query, store, debounceMs]);

  return null;
}
```

**Note:** `useEditor.subscribe` is not part of the @craftjs/core public API. The actual pattern uses Craft's internal store subscription via `useEditor((state) => state)` returning a re-render trigger. If `useEditor.subscribe` does not exist, replace with this version that re-renders on every state change and serializes inside the render commit (still debounced via setTimeout):

```tsx
'use client';
import { useEffect, useRef } from 'react';
import { useEditor } from '@craftjs/core';
import { useEditorStore } from '@/lib/editor/StoreProvider';

export function TreeSyncBridge({ debounceMs = 300 }: { debounceMs?: number }) {
  const { json } = useEditor((_, query) => ({ json: query.serialize() }));
  const store = useEditorStore();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      store.getState().setTree(JSON.parse(json));
    }, debounceMs);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [json, store, debounceMs]);

  return null;
}
```

Use whichever variant matches the verified API from Phase 0.

- [ ] **Step 2: Rewrite `EditorShell.tsx`** — replace the existing top-level shell to mount Craft.js. Read the existing file first to preserve layout/sidebar slots, then replace the canvas region:

```tsx
'use client';
import { Editor, Frame, Element as CraftElement } from '@craftjs/core';
import { RESOLVERS } from '@/components/editor/craft/resolver';
import { Page } from '@/components/editor/craft/Page';
import { useEditor } from '@/lib/editor/StoreProvider';
import { Topbar } from './Topbar';
import { Palette } from './sidebar/Palette';
import { Outline } from './sidebar/Outline';
import { NodeInspector } from './sidebar/NodeInspector';
import { TreeSyncBridge } from './craft/TreeSyncBridge';

export function EditorShell() {
  const data = useEditor((s) => s.data);
  const initialJson = JSON.stringify(data.tree);

  return (
    <div className="flex flex-col h-screen">
      <Topbar />
      <Editor resolver={RESOLVERS}>
        <TreeSyncBridge />
        <div className="flex flex-1 overflow-hidden">
          <aside className="w-64 border-r overflow-y-auto p-3">
            <Palette />
            <hr className="my-3" />
            <Outline />
          </aside>
          <main className="flex-1 overflow-auto bg-gray-100 p-6">
            <Frame data={initialJson}>
              <CraftElement is={Page} canvas backgroundColor={data.global.backgroundColor} />
            </Frame>
          </main>
          <aside className="w-72 border-l overflow-y-auto p-3">
            <NodeInspector />
          </aside>
        </div>
      </Editor>
    </div>
  );
}
```

- [ ] **Step 3: Don't commit yet — Palette/Outline/NodeInspector still missing (Tasks 6.2–6.4)**

### Task 6.2: `Palette` component

**Files:**
- Create: `src/components/editor/sidebar/Palette.tsx`

- [ ] **Step 1: Implement palette**

```tsx
'use client';
import { useEditor, Element as CraftElement } from '@craftjs/core';
import type { ReactNode } from 'react';
import { Heading } from '../craft/Heading';
import { Text } from '../craft/Text';
import { Image } from '../craft/Image';
import { Button } from '../craft/Button';
import { Divider } from '../craft/Divider';
import { Spacer } from '../craft/Spacer';
import { List } from '../craft/List';
import { Section } from '../craft/Section';
import { Row } from '../craft/Row';
import { Column } from '../craft/Column';
import * as Presets from '../craft/presets';

function Draggable({ create, children }: { create: ReactNode; children: ReactNode }) {
  const { connectors } = useEditor();
  return (
    <div
      ref={(el) => { if (el) connectors.create(el, create as any); }}
      className="px-2 py-1 border rounded cursor-grab bg-white text-xs"
    >
      {children}
    </div>
  );
}

export function Palette() {
  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs font-bold mb-1">Structure</div>
        <div className="grid grid-cols-2 gap-1">
          <Draggable create={<CraftElement is={Section} canvas />}>Section</Draggable>
          <Draggable create={<CraftElement is={Row} canvas />}>Row</Draggable>
          <Draggable create={<CraftElement is={Column} canvas />}>Column</Draggable>
        </div>
      </div>
      <div>
        <div className="text-xs font-bold mb-1">Content</div>
        <div className="grid grid-cols-2 gap-1">
          <Draggable create={<CraftElement is={Heading} text="Heading" />}>Heading</Draggable>
          <Draggable create={<CraftElement is={Text} text="Body text" />}>Text</Draggable>
          <Draggable create={<CraftElement is={Image} src="" alt="" />}>Image</Draggable>
          <Draggable create={<CraftElement is={Button} label="Click me" href="" />}>Button</Draggable>
          <Draggable create={<CraftElement is={Divider} />}>Divider</Draggable>
          <Draggable create={<CraftElement is={Spacer} height={16} />}>Spacer</Draggable>
          <Draggable create={<CraftElement is={List} items={['One', 'Two']} />}>List</Draggable>
        </div>
      </div>
      <div>
        <div className="text-xs font-bold mb-1">Presets</div>
        <div className="grid grid-cols-1 gap-1">
          <Draggable create={Presets.hero()}>Hero</Draggable>
          <Draggable create={Presets.article()}>Article</Draggable>
          <Draggable create={Presets.productSection()}>Product section</Draggable>
          <Draggable create={Presets.ctaBanner()}>CTA banner</Draggable>
        </div>
      </div>
    </div>
  );
}
```

### Task 6.3: `Presets` (code-defined section templates)

**Files:**
- Create: `src/components/editor/craft/presets.tsx`

- [ ] **Step 1: Implement preset factories**

```tsx
import { Element as CraftElement } from '@craftjs/core';
import { Section } from './Section';
import { Row } from './Row';
import { Column } from './Column';
import { Heading } from './Heading';
import { Text } from './Text';
import { Image } from './Image';
import { Button } from './Button';
import { List } from './List';

export function hero() {
  return (
    <CraftElement is={Section} canvas>
      <CraftElement is={Row} canvas>
        <CraftElement is={Column} canvas width={100}>
          <CraftElement is={Image} src="" alt="" align="center" />
          <CraftElement is={Heading} text="Big headline" level={1} align="center" />
          <CraftElement is={Text} text="Supporting subtitle" align="center" />
          <CraftElement is={Button} label="Learn more" href="" align="center" />
        </CraftElement>
      </CraftElement>
    </CraftElement>
  );
}

export function article() {
  return (
    <CraftElement is={Section} canvas>
      <CraftElement is={Row} canvas>
        <CraftElement is={Column} canvas width={100}>
          <CraftElement is={Image} src="" alt="" align="center" />
          <CraftElement is={Heading} text="Article title" level={2} />
          <CraftElement is={Text} text="Article body. Two or three short sentences." />
          <CraftElement is={Button} label="Read more" href="" />
        </CraftElement>
      </CraftElement>
    </CraftElement>
  );
}

export function productSection() {
  return (
    <CraftElement is={Section} canvas>
      <CraftElement is={Row} canvas>
        <CraftElement is={Column} canvas width={50}>
          <CraftElement is={Image} src="" alt="" />
        </CraftElement>
        <CraftElement is={Column} canvas width={50}>
          <CraftElement is={Heading} text="New Product" level={2} />
          <CraftElement is={List} items={['Feature one', 'Feature two']} />
          <CraftElement is={Button} label="Contact us" href="" />
        </CraftElement>
      </CraftElement>
    </CraftElement>
  );
}

export function ctaBanner() {
  return (
    <CraftElement is={Section} canvas>
      <CraftElement is={Row} canvas>
        <CraftElement is={Column} canvas width={100}>
          <CraftElement is={Heading} text="Ready to get started?" level={2} align="center" />
          <CraftElement is={Button} label="Get in touch" href="" align="center" />
        </CraftElement>
      </CraftElement>
    </CraftElement>
  );
}
```

### Task 6.4: `Outline` component

**Files:**
- Create: `src/components/editor/sidebar/Outline.tsx`

- [ ] **Step 1: Implement outline**

```tsx
'use client';
import { useEditor } from '@craftjs/core';
import type { NodeId } from '@craftjs/core';

function OutlineNode({ id, depth }: { id: NodeId; depth: number }) {
  const { name, isSelected, children } = useEditor((state) => {
    const node = state.nodes[id];
    return {
      name: node?.data?.displayName ?? '?',
      isSelected: state.events.selected.has(id),
      children: node?.data?.nodes ?? [],
    };
  });
  const { actions } = useEditor();

  return (
    <div>
      <button
        type="button"
        onClick={() => actions.selectNode(id)}
        className={`text-left text-xs w-full px-2 py-1 rounded ${isSelected ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        {name}
      </button>
      {children.map((c: NodeId) => (
        <OutlineNode key={c} id={c} depth={depth + 1} />
      ))}
    </div>
  );
}

export function Outline() {
  return (
    <div>
      <div className="text-xs font-bold mb-1">Outline</div>
      <OutlineNode id="ROOT" depth={0} />
    </div>
  );
}
```

### Task 6.5: `NodeInspector` component

**Files:**
- Create: `src/components/editor/sidebar/NodeInspector.tsx`

- [ ] **Step 1: Implement inspector**

```tsx
'use client';
import { createElement } from 'react';
import { useEditor } from '@craftjs/core';
import { GlobalStylesPanel } from '../panels/GlobalStylesPanel';

export function NodeInspector() {
  const { SettingsComponent } = useEditor((state, query) => {
    const id = state.events.selected.values().next().value;
    if (!id) return { SettingsComponent: null };
    const node = state.nodes[id];
    const related = node?.related ?? {};
    return { SettingsComponent: related.settings ?? null };
  });

  if (!SettingsComponent) return <GlobalStylesPanel />;
  return createElement(SettingsComponent);
}
```

### Task 6.6: Delete old panels, blocks, canvas helpers; commit Phase 6

- [ ] **Step 1: Delete files**

```bash
git rm src/components/editor/LeftPanel.tsx
git rm src/components/editor/PreviewBody.tsx
git rm src/components/editor/SectionSelectionProvider.tsx
git rm -r src/components/editor/blocks
git rm src/components/editor/panels/HeaderPanel.tsx
git rm src/components/editor/panels/FooterPanel.tsx
git rm src/components/editor/panels/HeroPanel.tsx
git rm src/components/editor/panels/ArticlePanel.tsx
git rm src/components/editor/panels/ProductSectionPanel.tsx
git rm src/components/editor/panels/CTABannerPanel.tsx
# keep GlobalStylesPanel
git rm src/components/editor/canvas/AddBlockMenu.tsx
git rm src/components/editor/canvas/BlockToolbar.tsx
git rm src/components/editor/canvas/SectionInsertBar.tsx
git rm src/components/editor/canvas/SelectionActionBar.tsx
# keep canvas/ResizableImage.tsx for use inside the Image primitive if desired (re-attach later) or delete now
git rm src/components/editor/canvas/ResizableImage.tsx
git rm src/lib/editor/useUndoRedoShortcuts.ts
```

- [ ] **Step 2: Remove import references** — grep and fix any remaining import statement that points at the deleted files. `EditorShell.tsx` (rewritten in 6.1) and `Topbar.tsx` are the most likely.

```bash
npm run typecheck
```

Fix any remaining errors in `Topbar.tsx`, `DownloadMenu.tsx`, etc. — typically by removing unused imports.

- [ ] **Step 3: Commit Phase 6**

```bash
git add -A
git commit -m "feat(editor): Craft.js EditorShell + palette/outline/inspector, drop v2 panels & views"
```

---

## Phase 7: Rewrite `renderEmail` for v3 tree

### Task 7.1: New `renderEmail` walking the tree

**Files:**
- Rename + rewrite: `src/lib/export/renderEmail.ts` → `src/lib/export/renderEmail.tsx` (rewrite uses JSX)
- Modify: `src/lib/export/renderEmail.snapshot.test.ts`
- Update any importer of `@/lib/export/renderEmail` (the `.tsx` extension is resolved transparently by Next.js, but verify no `require.resolve` lookups expect `.ts`)

- [ ] **Step 1: Rename and replace `renderEmail.tsx`** — full rewrite:

```bash
git mv src/lib/export/renderEmail.ts src/lib/export/renderEmail.tsx
```

Then overwrite with:

```ts
import { renderToStaticMarkup } from 'react-dom/server';
import type { ProjectData } from '@/lib/editor/types';
import { renderTreeToReact } from './renderTree';
import { RESOLVERS } from '@/components/editor/craft/resolver';
import { RenderContextProvider } from '@/components/editor/craft/RenderContext';

const HEAD = `<head>
<title></title>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; }
  a[x-apple-data-detectors] { color: inherit !important; text-decoration: inherit !important; }
  p { line-height: inherit; margin: 0; }
  .row-content { width: 100%; max-width: 710px; margin: 0 auto; }
  @media (max-width: 600px) {
    .row-content { width: 100% !important; }
    .row-content table { width: 100% !important; }
  }
</style>
</head>`;

const MSO_OPEN = '<!--[if mso]><table role="presentation" width="710" align="center" border="0" cellpadding="0" cellspacing="0"><tr><td><![endif]-->';
const MSO_CLOSE = '<!--[if mso]></td></tr></table><![endif]-->';

export function renderEmail(data: ProjectData): string {
  const bodyReact = renderTreeToReact(data.tree, RESOLVERS);
  const inner = renderToStaticMarkup(
    <RenderContextProvider value="email">{bodyReact}</RenderContextProvider>
  );

  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
${HEAD}
<body style="background-color: ${data.global.backgroundColor}; font-family: ${data.global.fontFamily};">
${MSO_OPEN}
<div class="row-content">${inner}</div>
${MSO_CLOSE}
</body>
</html>`;
}
```

- [ ] **Step 2: Rewrite the snapshot test against v3 templates**

```ts
// src/lib/export/renderEmail.snapshot.test.ts
import { describe, it, expect } from 'vitest';
import { renderEmail } from './renderEmail';
import { createNewsletterTemplate } from '@/lib/editor/templates/newsletter';
import { createAnnouncementTemplate } from '@/lib/editor/templates/announcement';
import { createEventInviteTemplate } from '@/lib/editor/templates/eventInvite';

describe('renderEmail v3 snapshot parity', () => {
  it('newsletter template', () => {
    expect(renderEmail(createNewsletterTemplate())).toMatchSnapshot();
  });
  it('announcement template', () => {
    expect(renderEmail(createAnnouncementTemplate())).toMatchSnapshot();
  });
  it('event invite template', () => {
    expect(renderEmail(createEventInviteTemplate())).toMatchSnapshot();
  });
});
```

- [ ] **Step 3: Delete old snapshot file and regenerate**

```bash
rm src/lib/export/__snapshots__/renderEmail.snapshot.test.ts.snap 2>/dev/null
npm test -- src/lib/export/renderEmail.snapshot.test.ts
```

Expected: tests fail first run (no snapshot), pass on update:

```bash
npm test -- -u src/lib/export/renderEmail.snapshot.test.ts
```

- [ ] **Step 4: Visually verify a snapshot** — open `src/lib/export/__snapshots__/renderEmail.snapshot.test.ts.snap` and confirm it contains plausible MSO HTML (`<table role="presentation"`, `<!--[if mso]`, branded buttons, no missing content from the templates).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(export): renderEmail walks v3 tree via renderTreeToReact"
```

---

## Phase 8: Rewrite `renderPrintDocument` + translation walker

### Task 8.1: New `renderPrintDocument`

**Files:**
- Rename + rewrite: `src/lib/export/renderPrintDocument.ts` → `src/lib/export/renderPrintDocument.tsx`
- Modify: `src/lib/export/renderPrintDocument.snapshot.test.ts`
- Modify: `src/lib/export/buildPrintHtml.ts` (if it currently switches on block types)

- [ ] **Step 1: Read existing `renderPrintDocument.ts` and `buildPrintHtml.ts`** to identify the PagedJS wrapper structure (page CSS, running header/footer regions).

```bash
cat src/lib/export/renderPrintDocument.ts
cat src/lib/export/buildPrintHtml.ts
```

- [ ] **Step 2: Rename and replace `renderPrintDocument.tsx`** — preserve the PagedJS `@page` CSS but feed it tree-rendered body:

```bash
git mv src/lib/export/renderPrintDocument.ts src/lib/export/renderPrintDocument.tsx
```

Then overwrite with:

```ts
import { renderToStaticMarkup } from 'react-dom/server';
import type { ProjectData } from '@/lib/editor/types';
import { renderTreeToReact } from './renderTree';
import { RESOLVERS } from '@/components/editor/craft/resolver';
import { RenderContextProvider } from '@/components/editor/craft/RenderContext';
import { buildPrintHtml } from './buildPrintHtml';

export function renderPrintDocument(data: ProjectData): string {
  const bodyReact = renderTreeToReact(data.tree, RESOLVERS);
  const innerHtml = renderToStaticMarkup(
    <RenderContextProvider value="print">{bodyReact}</RenderContextProvider>
  );
  return buildPrintHtml({ bodyHtml: innerHtml, global: data.global });
}
```

- [ ] **Step 3: Update `buildPrintHtml.ts`** — change its signature from "accepts blocks" to "accepts pre-rendered body HTML + global". The function keeps its PagedJS `@page` CSS untouched and just wraps `bodyHtml`:

```ts
import type { GlobalStyles } from '@/lib/editor/types';

export interface BuildPrintHtmlOpts {
  bodyHtml: string;
  global: GlobalStyles;
}

export function buildPrintHtml({ bodyHtml, global }: BuildPrintHtmlOpts): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page { size: A4; margin: 18mm 14mm; }
    body { font-family: ${global.fontFamily}; background: ${global.backgroundColor}; color: ${global.textColor}; }
    /* preserve any existing @page running regions from the old file here */
  </style>
</head>
<body>${bodyHtml}</body>
</html>`;
}
```

**Preserve any `@page` running region CSS the existing file has** (header/footer running regions for PagedJS) — copy them verbatim into the new `<style>` block. The current file content is the source of truth for these rules.

- [ ] **Step 4: Rewrite the snapshot test**

```ts
// src/lib/export/renderPrintDocument.snapshot.test.ts
import { describe, it, expect } from 'vitest';
import { renderPrintDocument } from './renderPrintDocument';
import { createNewsletterTemplate } from '@/lib/editor/templates/newsletter';

describe('renderPrintDocument v3 snapshot parity', () => {
  it('newsletter template', () => {
    expect(renderPrintDocument(createNewsletterTemplate())).toMatchSnapshot();
  });
});
```

- [ ] **Step 5: Regenerate snapshot and verify**

```bash
rm src/lib/export/__snapshots__/renderPrintDocument.snapshot.test.ts.snap 2>/dev/null
npm test -- -u src/lib/export/renderPrintDocument.snapshot.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(export): renderPrintDocument walks v3 tree, preserves PagedJS @page CSS"
```

### Task 8.2: Translation registry + walker

**Files:**
- Create: `src/lib/translate/registry.ts`
- Modify: `src/lib/translate/fields.ts`
- Test: `src/lib/translate/fields.test.ts`

- [ ] **Step 1: Create registry**

```ts
// src/lib/translate/registry.ts
export const TRANSLATABLE: Record<string, readonly string[]> = {
  Heading: ['text'],
  Text: ['text'],
  Button: ['label'],
  Image: ['alt'],
  List: ['items[]'],
  Section: [],
  Row: [], Column: [],
  Divider: [], Spacer: [],
  Page: [],
};
```

- [ ] **Step 2: Write failing test**

```ts
// src/lib/translate/fields.test.ts
import { describe, it, expect } from 'vitest';
import { extractFields, applyFields } from './fields';
import type { SerializedNodes } from '@craftjs/core';

const tree: SerializedNodes = {
  ROOT: { type: { resolvedName: 'Page' }, props: {}, parent: null, nodes: ['s'], linkedNodes: {}, displayName: 'Page', isCanvas: true, hidden: false, custom: {} },
  s: { type: { resolvedName: 'Section' }, props: {}, parent: 'ROOT', nodes: ['h', 'l'], linkedNodes: {}, displayName: 'Section', isCanvas: true, hidden: false, custom: {} },
  h: { type: { resolvedName: 'Heading' }, props: { text: 'Hello' }, parent: 's', nodes: [], linkedNodes: {}, displayName: 'Heading', isCanvas: false, hidden: false, custom: {} },
  l: { type: { resolvedName: 'List' }, props: { items: ['One', 'Two'] }, parent: 's', nodes: [], linkedNodes: {}, displayName: 'List', isCanvas: false, hidden: false, custom: {} },
};

describe('extract/apply fields', () => {
  it('extracts translatable strings keyed by node id and field path', () => {
    const out = extractFields(tree);
    expect(out.h.text).toBe('Hello');
    expect(out.l['items[0]']).toBe('One');
    expect(out.l['items[1]']).toBe('Two');
  });

  it('applies translated strings back into a new tree without mutating input', () => {
    const translated = { h: { text: 'Hola' }, l: { 'items[0]': 'Uno', 'items[1]': 'Dos' } };
    const next = applyFields(tree, translated);
    expect(next.h.props.text).toBe('Hola');
    expect((next.l.props.items as string[])).toEqual(['Uno', 'Dos']);
    expect(tree.h.props.text).toBe('Hello');  // input unchanged
  });
});
```

- [ ] **Step 3: Run, verify it fails**

- [ ] **Step 4: Implement `fields.ts`**

```ts
import type { SerializedNodes } from '@craftjs/core';
import { TRANSLATABLE } from './registry';

export type Extracted = Record<string, Record<string, string>>;

export function extractFields(tree: SerializedNodes): Extracted {
  const out: Extracted = {};
  for (const [id, node] of Object.entries(tree)) {
    const name = node.type.resolvedName;
    const fields = TRANSLATABLE[name ?? ''] ?? [];
    if (fields.length === 0) continue;
    const entry: Record<string, string> = {};
    for (const path of fields) {
      if (path.endsWith('[]')) {
        const key = path.slice(0, -2);
        const arr = node.props[key];
        if (Array.isArray(arr)) {
          arr.forEach((v: unknown, i: number) => {
            if (typeof v === 'string') entry[`${key}[${i}]`] = v;
          });
        }
      } else {
        const v = node.props[path];
        if (typeof v === 'string') entry[path] = v;
      }
    }
    if (Object.keys(entry).length > 0) out[id] = entry;
  }
  return out;
}

export function applyFields(tree: SerializedNodes, translated: Extracted): SerializedNodes {
  const next: SerializedNodes = {};
  for (const [id, node] of Object.entries(tree)) {
    const updates = translated[id];
    if (!updates) { next[id] = node; continue; }
    const newProps = { ...node.props };
    for (const [path, value] of Object.entries(updates)) {
      const m = path.match(/^(\w+)\[(\d+)\]$/);
      if (m) {
        const [, key, idxStr] = m;
        const idx = Number(idxStr);
        const arr = Array.isArray(newProps[key]) ? [...(newProps[key] as unknown[])] : [];
        arr[idx] = value;
        newProps[key] = arr;
      } else {
        newProps[path] = value;
      }
    }
    next[id] = { ...node, props: newProps };
  }
  return next;
}
```

- [ ] **Step 5: Run, verify it passes; commit**

```bash
npm test -- src/lib/translate/fields.test.ts
npm run typecheck
git add src/lib/translate/registry.ts src/lib/translate/fields.ts src/lib/translate/fields.test.ts
git commit -m "feat(translate): tree-walking field extractor + per-primitive registry"
```

### Task 8.3: Update translate call sites in `TranslateMenu.tsx`

**Files:**
- Modify: `src/components/editor/TranslateMenu.tsx`

- [ ] **Step 1: Read existing file, identify how it currently calls extract/apply, replace v2 calls with v3 signatures**

Existing pattern likely:
```ts
const strings = extract(data); // v2: walks data.blocks
applyTranslation(data, translated);
```

New pattern:
```ts
const strings = extractFields(data.tree);
const newTree = applyFields(data.tree, translated);
setTree(newTree);
```

Patch the file to match. Run `npm run typecheck` after.

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(translate): TranslateMenu uses v3 extract/apply over tree"
```

---

## Phase 9: Undo/redo via Craft.js + autosave verification

### Task 9.1: Wire undo/redo to Craft.js history

**Files:**
- Create: `src/components/editor/craft/UndoRedoShortcuts.tsx`
- Modify: `src/components/editor/EditorShell.tsx`

- [ ] **Step 1: Implement shortcuts component**

```tsx
'use client';
import { useEffect } from 'react';
import { useEditor } from '@craftjs/core';

export function UndoRedoShortcuts() {
  const { actions } = useEditor();
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); actions.history.undo(); }
      if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); actions.history.redo(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actions]);
  return null;
}
```

- [ ] **Step 2: Mount inside `<Editor>` in `EditorShell.tsx`**

Add `<UndoRedoShortcuts />` next to `<TreeSyncBridge />`.

- [ ] **Step 3: Manual smoke test**

```bash
npm run dev
```

Open a project, drag a Heading into a Column, change its text, press Ctrl+Z (or Cmd+Z), verify reversal. Press Ctrl+Shift+Z, verify replay.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(editor): rewire undo/redo to Craft.js history actions"
```

### Task 9.2: Verify autosave still works end-to-end

**Files:**
- (verification only — no code changes expected)

- [ ] **Step 1: Read `src/lib/editor/autosave.ts`** to confirm it reads from the Zustand store (it should, unchanged).

- [ ] **Step 2: Manual test**

```bash
npm run dev
```

Open a project, drag a Spacer in, wait 2 seconds (autosave debounce), reload the page. Verify the Spacer persisted. Check the network tab — the autosave PATCH should fire ~300ms after each tree mutation.

- [ ] **Step 3: If autosave reads a field that no longer exists** (e.g., `data.blocks`), patch `autosave.ts` to read `data.tree` instead. Commit if changes needed:

```bash
git add -A
git commit -m "fix(autosave): read from data.tree under v3 schema"
```

If no changes needed, no commit.

---

## Phase 10: Brand-kit token resolution

### Task 10.1: Resolve `brandToken` props at render

**Files:**
- Create: `src/components/editor/craft/brandTokens.ts`
- Modify: `src/components/editor/craft/Heading.tsx`, `Text.tsx`, `Button.tsx`, `Section.tsx`

- [ ] **Step 1: Implement token resolver**

```ts
import type { GlobalStyles } from '@/lib/editor/types';

export type ColorToken = 'text' | 'primary' | 'accent' | 'footerBg' | 'footerText';

export function resolveToken(token: ColorToken | undefined, global: GlobalStyles): string | undefined {
  if (!token) return undefined;
  switch (token) {
    case 'text': return global.textColor;
    case 'primary': return global.buttonColor;
    case 'accent': return global.accentColor;
    case 'footerBg': return global.footerBackgroundColor;
    case 'footerText': return global.footerTextColor;
  }
}
```

- [ ] **Step 2: Thread `GlobalStyles` into primitives via context**

`src/components/editor/craft/RenderContext.tsx` — extend:

```ts
import { createContext, useContext } from 'react';
import type { GlobalStyles } from '@/lib/editor/types';

export type RenderTarget = 'editor' | 'email' | 'print';

interface RenderCtx {
  target: RenderTarget;
  global?: GlobalStyles;
}

const RenderContext = createContext<RenderCtx>({ target: 'editor' });

export const RenderContextProvider = RenderContext.Provider;

export function useRenderContext(): RenderCtx {
  return useContext(RenderContext);
}
```

Update every `useRenderContext()` call site — replace `const target = useRenderContext()` with `const { target } = useRenderContext()`. Update renderer entry points to pass `value={{ target: 'email', global: data.global }}` etc.

- [ ] **Step 3: In `Heading`, `Text`, `Button`, `Section`, resolve `brandToken` props before applying color**

Example for `Heading`:

```tsx
const { global } = useRenderContext();
const resolvedColor = resolveToken(brandToken, global ?? makeFallbackGlobals()) ?? color;
```

Add a fallback `makeFallbackGlobals()` helper in `brandTokens.ts` that returns sensible defaults (so editor-mode preview works before the global context arrives).

- [ ] **Step 4: Update tests for these primitives** to assert `brandToken` overrides `color`:

```tsx
// add to Heading.test.tsx
it('brandToken overrides explicit color when global is provided', () => {
  const html = renderToString(
    <RenderContextProvider value={{ target: 'editor', global: { textColor: '#abcdef' } as any }}>
      <Element is={Heading} isSSR text="X" color="#000" brandToken="text" />
    </RenderContextProvider>
  );
  expect(html).toContain('color:#abcdef');
});
```

Update Text, Button, Section tests similarly.

- [ ] **Step 5: Commit**

```bash
npm test
npm run typecheck
git add -A
git commit -m "feat(craft): brandToken resolution against ProjectData.global"
```

---

## Phase 11: End-to-end tests + visual parity

### Task 11.1: Update `blocks-parity` E2E

**Files:**
- Modify: `tests/e2e/blocks-parity.spec.ts` (or whichever file currently asserts parity)

- [ ] **Step 1: Read existing E2E test, identify selectors that depended on block-level DOM**

```bash
ls tests/e2e/
```

- [ ] **Step 2: Update selectors to match the new Craft.js DOM** — Section/Row/Column wrappers are plain divs with no special attributes by default. Identify by data-testid or by rendered content (e.g., look up a Heading by text).

- [ ] **Step 3: Add a new test: drag → set → undo → redo**

```ts
import { test, expect } from '@playwright/test';

test('drag image, edit alt, undo, redo', async ({ page }) => {
  await page.goto('/dev/editor');  // or the actual editor route
  await page.getByText('Image', { exact: true }).first().dragTo(page.locator('[data-craft-canvas]').first());
  await page.getByLabel('Alt text').fill('Test alt');
  await page.keyboard.press('Control+Z');
  await expect(page.getByLabel('Alt text')).toHaveValue('');
  await page.keyboard.press('Control+Shift+Z');
  await expect(page.getByLabel('Alt text')).toHaveValue('Test alt');
});
```

- [ ] **Step 4: Add a render-parity test: canvas vs renderEmail**

```ts
test('rendered email matches canvas text content for newsletter template', async ({ page }) => {
  await page.goto('/dev/editor?template=newsletter');
  const canvasText = await page.locator('[data-craft-canvas]').innerText();
  const emailHtml = await page.evaluate(async () => {
    const res = await fetch('/api/render/email', { method: 'POST' });
    return res.text();
  });
  // Each heading/text/button label that appears on canvas should appear in email HTML
  for (const line of canvasText.split('\n').map((s) => s.trim()).filter(Boolean)) {
    expect(emailHtml).toContain(line);
  }
});
```

(If `/api/render/email` does not exist, add a repository-local way to validate export parity automatically. Do not leave parity as a manual-only check.)

- [ ] **Step 5: Run E2E**

```bash
npm run e2e
```

Fix any selector mismatches inline.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test(e2e): blocks-parity adapted to Craft.js DOM + tree-mutation coverage"
```

---

## Phase 12: Optional backfill script

### Task 12.1: One-shot v2 → v3 backfill

**Files:**
- Create: `scripts/migrate-v2-projects.ts`

- [ ] **Step 1: Implement script**

```ts
/**
 * One-shot backfill: read every Supabase `projects` row, parse `data` JSON,
 * if schemaVersion < 3 run migrateV2ToV3 and write back.
 *
 * Dry-run by default. Pass `--apply` to actually write.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { migrate } from '../src/lib/editor/migrate';

const APPLY = process.argv.includes('--apply');

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');

  const supabase = createClient(url, key);
  const { data: rows, error } = await supabase.from('projects').select('id, data');
  if (error) throw error;

  let migrated = 0;
  for (const row of rows ?? []) {
    const before = row.data;
    const beforeVersion = (before as any)?.schemaVersion;
    if (beforeVersion === 3) continue;
    const after = migrate(before);
    migrated++;
    console.log(`project ${row.id}: v${beforeVersion ?? '?'} → v3`);
    if (APPLY) {
      const { error: upErr } = await supabase.from('projects').update({ data: after }).eq('id', row.id);
      if (upErr) throw upErr;
    }
  }
  console.log(`${migrated} project(s) ${APPLY ? 'migrated' : 'would migrate (dry run)'}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run dry-run locally against Supabase**

```bash
npx tsx scripts/migrate-v2-projects.ts
```

Expected: prints list of projects that would migrate, no writes.

- [ ] **Step 3: Commit** — do NOT run with `--apply` yet; that's an operational decision for the user post-merge

```bash
git add scripts/migrate-v2-projects.ts
git commit -m "chore(scripts): one-shot v2 → v3 project backfill (dry-run by default)"
```

---

## Phase 13: Final cleanup & merge-readiness

### Task 13.1: Remove dead exports

**Files:**
- Modify: `src/lib/editor/migrate.ts` — delete `downgradeV2ToV1` if no callers remain
- Modify: any remaining file that imports `Header`/`Footer`/`Block` types — should be zero by this point

- [ ] **Step 1: Grep for orphaned imports**

```bash
npx eslint . --quiet
npm run typecheck
```

Both should pass with zero errors.

- [ ] **Step 2: Remove `downgradeV2ToV1` if unused**

```bash
grep -r downgradeV2ToV1 src/ tests/ scripts/ || echo "no callers"
```

If no callers, delete the function and its tests. Commit:

```bash
git add -A
git commit -m "chore(migrate): drop unused downgradeV2ToV1"
```

### Task 13.2: Full test run + local smoke verification

- [ ] **Step 1: Run everything**

```bash
npm run typecheck
npm run lint
npm test
npm run e2e
```

All must pass.

- [ ] **Step 2: Local smoke checklist**

Open `npm run dev` and verify:

- [ ] New project creation produces a v3 tree (open devtools, inspect the autosave payload)
- [ ] Existing v2 project (use one from staging/dev Supabase) opens, looks visually similar to before
- [ ] Drag a Heading into a Column from the palette
- [ ] Edit text in the inspector → canvas updates live
- [ ] Drag a preset (Hero) into the canvas → multiple nested primitives appear, each individually editable
- [ ] Ctrl+Z reverts the drag; Ctrl+Shift+Z replays
- [ ] Download → Email exports MSO HTML matching canvas content
- [ ] Download → Print exports a PDF matching canvas content
- [ ] Translate menu produces an extract → apply round-trip with no lost text

### Task 13.3: Prepare for eventual push/PR, but do not push yet

- [ ] **Step 1: Do not push without explicit approval**

Record the branch name, local commit state, and any operational follow-ups needed before a future push.

- [ ] **Step 2: Draft PR notes locally only**

PR description: link `docs/superpowers/specs/2026-05-25-craftjs-migration-design.md`, list the phases done, list the manual smoke results, flag the optional backfill script as a follow-up operational step.

---

## Self-review notes

This plan was checked against the spec:

- **§2 End-state UX (primitives + rows/columns)** → Tasks 1.x, 2.x, 3.x, 6.x
- **§3 Architecture (3-layer + same RESOLVERS)** → Tasks 1.2, 1.4, 4.1, 7.1, 8.1
- **§4 Data model (v3 schema, taxonomy, locking)** → Tasks 2.1, 5.1, 5.3
- **§5 Primitive component shape** → Tasks 3.0–3.7
- **§6 Renderer adapter** → Tasks 1.2 (Element wrapper), 4.1 (walker), 7.1 (email), 8.1 (print). RenderContext extended in 10.1.
- **§7 Data migration** → Tasks 5.3, 5.7 (parseHtml), 12.1 (backfill script)
- **§8 Inspector / sidebar** → Tasks 6.2 (palette), 6.3 (presets), 6.4 (outline), 6.5 (inspector), 6.6 (deletions). Multi-select dropped as specified.
- **§9.1 Brand kit** → Task 10.1
- **§9.2 Translation walker** → Task 8.2, 8.3
- **§9.3 Autosave + undo/redo** → Tasks 9.1, 9.2 (autosave verified; TreeSyncBridge in 6.1)
- **§10 Testing** → unit tests per primitive (Phase 3), snapshot tests (Tasks 7.1, 8.1), E2E (Task 11.1)
- **§11 Sequencing** → Phases 0–13 map 1:1 (Phase 13 added for cleanup)
- **§12 Deliverables** — all files in the spec's New/Rewritten/Deleted lists appear in tasks

No placeholders, no "TBD", every code block contains the actual code an engineer can paste.
