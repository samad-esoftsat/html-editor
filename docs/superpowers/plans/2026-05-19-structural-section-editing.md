# Structural Section Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add in-canvas section operations — add, duplicate, delete, drag-reorder — with affordances that hide cleanly in Preview mode.

**Architecture:** Three new/extended Zustand store actions (`addSection(atIndex?)`, `duplicateSection`, `reorderSections`). Two new canvas components (`SectionToolbar`, `SectionInsertBar`). `PreviewBody` wraps the sections map in `@dnd-kit` `DndContext`/`SortableContext` and interleaves insert bars between sections.

**Tech Stack:** Next.js 15, React 19, TypeScript, Zustand+temporal, Tailwind v4, `@dnd-kit/core`, `@dnd-kit/sortable`, Vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-05-19-structural-section-editing-design.md`

---

### Task 1: Store actions — addSection(atIndex), duplicateSection, reorderSections

**Files:**
- Modify: `src/lib/editor/store.ts`
- Modify: `tests/unit/store.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `tests/unit/store.test.ts`:

```ts
describe('addSection with atIndex', () => {
  it('inserts at the given index', () => {
    const store = makeStore();
    const startCount = store.getState().data.sections.length;
    const firstId = store.getState().data.sections[0]?.id;
    store.getState().addSection(0);
    const after = store.getState().data.sections;
    expect(after.length).toBe(startCount + 1);
    expect(after[1]?.id).toBe(firstId);
  });

  it('appends when no index is given', () => {
    const store = makeStore();
    const startCount = store.getState().data.sections.length;
    store.getState().addSection();
    expect(store.getState().data.sections.length).toBe(startCount + 1);
  });
});

describe('duplicateSection', () => {
  it('inserts a copy with a fresh id right after the source', () => {
    const store = makeStore();
    const src = store.getState().data.sections[0];
    store.getState().duplicateSection(src.id);
    const after = store.getState().data.sections;
    expect(after.length).toBe(2);
    expect(after[0].id).toBe(src.id);
    expect(after[1].id).not.toBe(src.id);
    expect(after[1].title).toBe(src.title);
    expect(after[1].bullets).toEqual(src.bullets);
    expect(after[1].bullets).not.toBe(src.bullets); // deep copy
  });

  it('is a no-op for unknown id', () => {
    const store = makeStore();
    const before = store.getState().data.sections;
    store.getState().duplicateSection('nonexistent-id');
    expect(store.getState().data.sections).toBe(before);
  });
});

describe('reorderSections', () => {
  it('replaces the sections array with the provided value', () => {
    const store = makeStore();
    store.getState().addSection();
    const [a, b] = store.getState().data.sections;
    store.getState().reorderSections([b, a]);
    const next = store.getState().data.sections;
    expect(next[0].id).toBe(b.id);
    expect(next[1].id).toBe(a.id);
  });
});
```

If `makeStore()` doesn't exist in the file, look at how the existing tests build a store and reuse that pattern.

- [ ] **Step 2: Run tests to verify they fail**

`npm test -- --run store`
Expected: new tests fail (methods missing).

- [ ] **Step 3: Update the EditorStore interface**

In `src/lib/editor/store.ts`, change the interface line:

```ts
addSection(): void;
```

to:

```ts
addSection(atIndex?: number): void;
```

And add two new method signatures next to it:

```ts
duplicateSection(id: string): void;
reorderSections(next: ProductSection[]): void;
```

- [ ] **Step 4: Implement the new behavior**

Replace the existing `addSection` setter with:

```ts
addSection: (atIndex) => set((state) => {
  const fresh = blankSection();
  const sections = state.data.sections.slice();
  if (typeof atIndex === 'number' && atIndex >= 0 && atIndex <= sections.length) {
    sections.splice(atIndex, 0, fresh);
  } else {
    sections.push(fresh);
  }
  return { data: { ...state.data, sections } };
}),
```

Add the two new setters near `moveSection`:

```ts
duplicateSection: (id) => set((state) => {
  const idx = state.data.sections.findIndex((s) => s.id === id);
  if (idx < 0) return state;
  const src = state.data.sections[idx];
  const copy: ProductSection = {
    ...src,
    id: uuid(),
    bullets: src.bullets.slice(),
  };
  const sections = state.data.sections.slice();
  sections.splice(idx + 1, 0, copy);
  return { data: { ...state.data, sections } };
}),
reorderSections: (next) => set((state) => ({
  data: { ...state.data, sections: next },
})),
```

- [ ] **Step 5: Run typecheck + full tests**

`npm run typecheck && npm test -- --run`
Expected: green.

- [ ] **Step 6: Commit**

```
git add src/lib/editor/store.ts tests/unit/store.test.ts
git commit -m "feat(store): addSection(atIndex), duplicateSection, reorderSections"
```

---

### Task 2: Install @dnd-kit dependencies

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Install packages**

```bash
npm install @dnd-kit/core @dnd-kit/sortable
```

- [ ] **Step 2: Verify install + typecheck**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```
git add package.json package-lock.json
git commit -m "build: add @dnd-kit/core and @dnd-kit/sortable"
```

---

### Task 3: SectionInsertBar component

**Files:**
- Create: `src/components/editor/canvas/SectionInsertBar.tsx`
- Create: `tests/unit/SectionInsertBar.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// tests/unit/SectionInsertBar.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { SectionInsertBar } from '@/components/editor/canvas/SectionInsertBar';
import { EditorModeProvider, useEditorMode } from '@/components/editor/EditorModeProvider';

const mockAddSection = vi.fn();
vi.mock('@/lib/editor/StoreProvider', () => ({
  useEditorStore: () => ({
    getState: () => ({ addSection: mockAddSection }),
  }),
}));

function ForcePreview() {
  const { setMode } = useEditorMode();
  React.useEffect(() => { setMode('preview'); }, [setMode]);
  return null;
}

describe('SectionInsertBar', () => {
  beforeEach(() => { mockAddSection.mockClear(); });

  it('renders an Add section button', () => {
    render(<EditorModeProvider><SectionInsertBar atIndex={0} /></EditorModeProvider>);
    expect(screen.getByLabelText('Add section')).toBeTruthy();
  });

  it('calls addSection with the given index when clicked', () => {
    render(<EditorModeProvider><SectionInsertBar atIndex={2} /></EditorModeProvider>);
    fireEvent.click(screen.getByLabelText('Add section'));
    expect(mockAddSection).toHaveBeenCalledWith(2);
  });

  it('renders nothing in preview mode', () => {
    const { container } = render(
      <EditorModeProvider>
        <ForcePreview />
        <SectionInsertBar atIndex={0} />
      </EditorModeProvider>
    );
    expect(container.querySelector('button[aria-label="Add section"]')).toBeNull();
  });
});
```

If `beforeEach` isn't already imported in the file, add `beforeEach` to the vitest imports.

- [ ] **Step 2: Verify test fails**

`npm test -- --run SectionInsertBar`
Expected: module not found.

- [ ] **Step 3: Implement SectionInsertBar**

```tsx
// src/components/editor/canvas/SectionInsertBar.tsx
'use client';
import { Plus } from 'lucide-react';
import { useEditorStore } from '@/lib/editor/StoreProvider';
import { useEditorMode } from '../EditorModeProvider';

export interface SectionInsertBarProps {
  atIndex: number;
}

export function SectionInsertBar({ atIndex }: SectionInsertBarProps) {
  const { mode } = useEditorMode();
  const store = useEditorStore();
  if (mode === 'preview') return null;
  return (
    <div className="section-insert-bar relative h-3 my-1">
      <div className="absolute inset-0 flex items-center justify-center">
        <button
          type="button"
          aria-label="Add section"
          onClick={() => store.getState().addSection(atIndex)}
          className="section-insert-btn inline-flex items-center gap-1 rounded-full border border-border-strong bg-panel-2 px-3 py-1 text-xs text-fg hover:border-brand hover:text-brand"
        >
          <Plus size={12} /> Add section
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add CSS to hide the button at rest, show on hover**

Append to `src/app/globals.css`:

```css
.section-insert-bar .section-insert-btn {
  opacity: 0;
  transition: opacity 100ms;
}
.section-insert-bar:hover .section-insert-btn,
.section-insert-btn:focus-visible {
  opacity: 1;
}
```

- [ ] **Step 5: Run tests + typecheck**

`npm run typecheck && npm test -- --run SectionInsertBar`
Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```
git add src/components/editor/canvas/SectionInsertBar.tsx tests/unit/SectionInsertBar.test.tsx src/app/globals.css
git commit -m "feat(editor): SectionInsertBar with hover + button"
```

---

### Task 4: SectionToolbar component

**Files:**
- Create: `src/components/editor/canvas/SectionToolbar.tsx`
- Create: `tests/unit/SectionToolbar.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// tests/unit/SectionToolbar.test.tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { SectionToolbar } from '@/components/editor/canvas/SectionToolbar';
import { EditorModeProvider, useEditorMode } from '@/components/editor/EditorModeProvider';

const mockDuplicate = vi.fn();
const mockRemove = vi.fn();
vi.mock('@/lib/editor/StoreProvider', () => ({
  useEditorStore: () => ({
    getState: () => ({ duplicateSection: mockDuplicate, removeSection: mockRemove }),
  }),
}));

const mockConfirm = vi.fn();
vi.mock('@/lib/utils/confirm', () => ({
  confirmDialog: (...args: unknown[]) => mockConfirm(...args),
}));

function ForcePreview() {
  const { setMode } = useEditorMode();
  React.useEffect(() => { setMode('preview'); }, [setMode]);
  return null;
}

describe('SectionToolbar', () => {
  beforeEach(() => {
    mockDuplicate.mockClear();
    mockRemove.mockClear();
    mockConfirm.mockReset();
  });

  it('renders drag, duplicate, and delete buttons', () => {
    render(
      <EditorModeProvider>
        <SectionToolbar sectionId="abc" sectionTitle="Title" dragAttributes={{}} dragListeners={{}} />
      </EditorModeProvider>
    );
    expect(screen.getByLabelText('Drag to reorder section')).toBeTruthy();
    expect(screen.getByLabelText('Duplicate section')).toBeTruthy();
    expect(screen.getByLabelText('Delete section')).toBeTruthy();
  });

  it('clicking duplicate calls duplicateSection with the section id', () => {
    render(
      <EditorModeProvider>
        <SectionToolbar sectionId="abc" sectionTitle="Title" dragAttributes={{}} dragListeners={{}} />
      </EditorModeProvider>
    );
    fireEvent.click(screen.getByLabelText('Duplicate section'));
    expect(mockDuplicate).toHaveBeenCalledWith('abc');
  });

  it('clicking delete confirms and then removes when confirmed', async () => {
    mockConfirm.mockResolvedValue(true);
    render(
      <EditorModeProvider>
        <SectionToolbar sectionId="abc" sectionTitle="Title" dragAttributes={{}} dragListeners={{}} />
      </EditorModeProvider>
    );
    fireEvent.click(screen.getByLabelText('Delete section'));
    await waitFor(() => expect(mockRemove).toHaveBeenCalledWith('abc'));
  });

  it('clicking delete does NOT remove when cancelled', async () => {
    mockConfirm.mockResolvedValue(false);
    render(
      <EditorModeProvider>
        <SectionToolbar sectionId="abc" sectionTitle="Title" dragAttributes={{}} dragListeners={{}} />
      </EditorModeProvider>
    );
    fireEvent.click(screen.getByLabelText('Delete section'));
    await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('renders nothing in preview mode', () => {
    const { container } = render(
      <EditorModeProvider>
        <ForcePreview />
        <SectionToolbar sectionId="abc" sectionTitle="Title" dragAttributes={{}} dragListeners={{}} />
      </EditorModeProvider>
    );
    expect(container.querySelector('button[aria-label="Duplicate section"]')).toBeNull();
  });
});
```

- [ ] **Step 2: Verify test fails**

`npm test -- --run SectionToolbar`
Expected: module not found.

- [ ] **Step 3: Implement SectionToolbar**

```tsx
// src/components/editor/canvas/SectionToolbar.tsx
'use client';
import { Copy, GripVertical, X } from 'lucide-react';
import { useEditorStore } from '@/lib/editor/StoreProvider';
import { confirmDialog } from '@/lib/utils/confirm';
import { useEditorMode } from '../EditorModeProvider';

export interface SectionToolbarProps {
  sectionId: string;
  sectionTitle: string;
  dragAttributes: Record<string, unknown>;
  dragListeners: Record<string, unknown> | undefined;
}

export function SectionToolbar({ sectionId, sectionTitle, dragAttributes, dragListeners }: SectionToolbarProps) {
  const { mode } = useEditorMode();
  const store = useEditorStore();
  if (mode === 'preview') return null;

  async function onDelete() {
    const ok = await confirmDialog({
      title: 'Delete section?',
      message: `This will remove the section "${sectionTitle || 'Untitled'}" from the email.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    store.getState().removeSection(sectionId);
  }

  return (
    <div className="section-toolbar absolute top-2 right-2 z-10 inline-flex items-center gap-1 rounded-md border border-border-strong bg-panel-2 p-1 shadow-sm">
      <button
        type="button"
        aria-label="Drag to reorder section"
        className="cursor-grab rounded p-1 text-muted hover:text-brand hover:bg-panel active:cursor-grabbing"
        {...dragAttributes}
        {...(dragListeners ?? {})}
      >
        <GripVertical size={14} />
      </button>
      <button
        type="button"
        aria-label="Duplicate section"
        onClick={() => store.getState().duplicateSection(sectionId)}
        className="rounded p-1 text-muted hover:text-brand hover:bg-panel"
      >
        <Copy size={14} />
      </button>
      <button
        type="button"
        aria-label="Delete section"
        onClick={onDelete}
        className="rounded p-1 text-muted hover:text-danger hover:bg-panel"
      >
        <X size={14} />
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Add hover-visibility CSS for the toolbar**

Append to `src/app/globals.css`:

```css
.section-wrap .section-toolbar {
  opacity: 0;
  transition: opacity 100ms;
}
.section-wrap:hover .section-toolbar,
.section-wrap:focus-within .section-toolbar {
  opacity: 1;
}
```

- [ ] **Step 5: Run tests + typecheck**

`npm run typecheck && npm test -- --run SectionToolbar`
Expected: 5 tests pass.

- [ ] **Step 6: Commit**

```
git add src/components/editor/canvas/SectionToolbar.tsx tests/unit/SectionToolbar.test.tsx src/app/globals.css
git commit -m "feat(editor): SectionToolbar with drag, duplicate, delete"
```

---

### Task 5: Wire DnD + toolbar + insert bars into PreviewBody

**Files:**
- Modify: `src/components/editor/PreviewBody.tsx`

- [ ] **Step 1: Add imports**

```tsx
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SectionToolbar } from './canvas/SectionToolbar';
import { SectionInsertBar } from './canvas/SectionInsertBar';
import type { ProductSection } from '@/lib/editor/types';
```

(Verify the `ProductSection` import path — grep if needed.)

- [ ] **Step 2: Extract section rendering into a SortableSection child**

At the bottom of `PreviewBody.tsx`, add a new component that owns the existing section render. The current section render lives inside the `data.sections.map((s, idx) => { ... return (<div key={s.id} ...>) })`. Move that returned JSX into:

```tsx
interface SortableSectionProps {
  s: ProductSection;
  idx: number;
  data: ReturnType<typeof useEditor>['data'] extends infer T ? T : never;  // OR: pull the precise type
  g: typeof data.global;
  setSection: ReturnType<typeof useEditorStore>['getState']['setSection'];
  blockNav: ((e: React.MouseEvent) => void) | undefined;
}
```

Easier approach: keep the section closure but split the wrapper. Add this inline component:

```tsx
function SortableSection({ s, children }: { s: { id: string; backgroundColor?: string }; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: s.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: s.backgroundColor,
    maxWidth: 710,
    margin: '0 auto',
    whiteSpace: 'nowrap',
    position: 'relative',
  };
  return (
    <div ref={setNodeRef} style={style} className="section-wrap">
      <SectionToolbar
        sectionId={s.id}
        sectionTitle={(s as { title?: string }).title ?? ''}
        dragAttributes={attributes}
        dragListeners={listeners}
      />
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Replace the existing section render**

Replace the existing block:

```tsx
return (
  <div key={s.id} style={{ background: bg, maxWidth: 710, margin: '0 auto', whiteSpace: 'nowrap' }}>
    {reverse ? <>{TextCol}{ImageCol}</> : <>{ImageCol}{TextCol}</>}
  </div>
);
```

with a `SortableSection` wrapper:

```tsx
return (
  <SortableSection key={s.id} s={s}>
    {reverse ? <>{TextCol}{ImageCol}</> : <>{ImageCol}{TextCol}</>}
  </SortableSection>
);
```

(Remove the `style={{ background: bg, ... }}` — `SortableSection` already applies `background: s.backgroundColor`.)

- [ ] **Step 4: Wrap the sections map in DndContext + SortableContext, interleave insert bars**

Inside `PreviewBody`, before the JSX return, build sensors:

```tsx
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
);
const reorderSections = store.getState().reorderSections;
function onDragEnd(e: DragEndEvent) {
  const { active, over } = e;
  if (!over || active.id === over.id) return;
  const oldIndex = data.sections.findIndex((s) => s.id === active.id);
  const newIndex = data.sections.findIndex((s) => s.id === over.id);
  if (oldIndex < 0 || newIndex < 0) return;
  reorderSections(arrayMove(data.sections, oldIndex, newIndex));
}
```

Wrap the existing `{data.sections.map(...)}` in:

```tsx
<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
  <SortableContext items={data.sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
    {data.sections.length === 0 && <SectionInsertBar atIndex={0} />}
    {data.sections.map((s, idx) => (
      <Fragment key={s.id}>
        <SectionInsertBar atIndex={idx} />
        {/* existing section render — but as SortableSection */}
      </Fragment>
    ))}
    {data.sections.length > 0 && <SectionInsertBar atIndex={data.sections.length} />}
  </SortableContext>
</DndContext>
```

Import `Fragment` from `'react'`.

The inner section JSX stays the same but uses `SortableSection` as the wrapper (per Step 3). The `key` moves from the inner wrapper to the outer `<Fragment>`; you can drop the `key={s.id}` on `SortableSection` since the Fragment already has it.

- [ ] **Step 5: Add CSS rule so section-wrap also gets the .preview-canvas reset**

The new `<div class="section-wrap">` wrapping each section receives the same default styling as before because the inline `style` still has `background`, `maxWidth`, etc. Verify the existing `.preview-canvas` CSS rules still cover the inner content. No new CSS needed unless the dragging visual breaks something — verify in the smoke test.

- [ ] **Step 6: Run typecheck + tests**

`npm run typecheck && npm test -- --run`
Expected: green. 215+ tests.

- [ ] **Step 7: Commit**

```
git add src/components/editor/PreviewBody.tsx
git commit -m "feat(editor): DnD section reordering with toolbar and insert bars"
```

---

### Task 6: Manual verification

- [ ] Run `npm run dev`, open an email project, verify:
  - Hover a section: the floating toolbar fades in at the top-right with grip / duplicate / delete buttons.
  - Click duplicate → identical section appears immediately below.
  - Click delete → confirmation dialog opens → confirm → section disappears; `Cmd+Z` brings it back.
  - Hover the gap above any section: the `+ Add section` button appears.
  - Click `+` → a fresh blank section appears at that exact index.
  - Drag a section's grip → drop on another section's position → reorder commits; sidebar list reflects the new order.
  - Keyboard: Tab to a grip, Space to pick up, ArrowDown, Space to drop.
  - Delete every section → header and footer remain with a single `+ Add section` row between them.
  - Switch to Preview mode → all toolbars and `+` bars disappear; canvas is clean.
  - Sidebar add/move/remove section controls still work.
  - Export (HTML / PDF) still produces the same email output.

- [ ] Report issues; re-dispatch the relevant task to fix.
