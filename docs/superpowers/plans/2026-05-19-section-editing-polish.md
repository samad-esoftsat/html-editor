# Section Editing Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bullet drag-reorder, multi-select sections with a floating action bar, FLIP-style motion on non-drag operations, and touch-friendly drag activation.

**Architecture:** Shared `useDragSensors()` adds MouseSensor + TouchSensor + KeyboardSensor. `EditableBulletList` becomes its own DnD context. New `SectionSelectionProvider` context plus a `SelectionActionBar` floating component. `SortableSection` gains `motion.div layout`; the sections list gains `AnimatePresence`.

**Tech Stack:** Next.js 15, React 19, TypeScript, Zustand, Tailwind v4, `@dnd-kit/core`, `@dnd-kit/sortable`, `motion/react`, Vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-05-19-section-editing-polish-design.md`

---

### Task 1: Shared useDragSensors hook + touch sensor

**Files:**
- Create: `src/components/editor/canvas/useDragSensors.ts`
- Modify: `src/components/editor/PreviewBody.tsx`

- [ ] **Step 1: Implement the hook**

```ts
// src/components/editor/canvas/useDragSensors.ts
'use client';
import { KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

export function useDragSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}
```

- [ ] **Step 2: Replace the inline sensor block in PreviewBody**

In `src/components/editor/PreviewBody.tsx`, replace the existing:

```tsx
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
);
```

with:

```tsx
const sensors = useDragSensors();
```

Update the import block: remove `PointerSensor`, `KeyboardSensor`, `useSensor`, `useSensors`, `sortableKeyboardCoordinates` from the `@dnd-kit/core` and `@dnd-kit/sortable` imports (they migrate into the hook). Add `import { useDragSensors } from './canvas/useDragSensors';`.

- [ ] **Step 3: Run typecheck + tests**

`npm run typecheck && npm test -- --run` — green.

- [ ] **Step 4: Commit**

```
git add src/components/editor/canvas/useDragSensors.ts src/components/editor/PreviewBody.tsx
git commit -m "feat(editor): shared useDragSensors hook with touch + keyboard sensors"
```

---

### Task 2: Bullet drag-and-drop

**Files:**
- Modify: `src/components/editor/editable/EditableBulletList.tsx`
- Modify: `tests/unit/EditableBulletList.test.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add failing test**

Append to `tests/unit/EditableBulletList.test.tsx`:

```tsx
describe('EditableBulletList drag-to-reorder', () => {
  it('renders a drag handle button per bullet in edit mode', () => {
    const onChange = vi.fn();
    render(
      <EditorModeProvider>
        <EditableBulletList bullets={['a', 'b', 'c']} onChange={onChange} ariaLabel="Test" />
      </EditorModeProvider>
    );
    const handles = screen.getAllByLabelText(/drag to reorder bullet/i);
    expect(handles.length).toBe(3);
  });

  it('does not render drag handles in preview mode', () => {
    function ForcePreview() {
      const { setMode } = useEditorMode();
      React.useEffect(() => { setMode('preview'); }, [setMode]);
      return null;
    }
    render(
      <EditorModeProvider>
        <ForcePreview />
        <EditableBulletList bullets={['a', 'b']} onChange={() => {}} ariaLabel="Test" />
      </EditorModeProvider>
    );
    expect(screen.queryAllByLabelText(/drag to reorder bullet/i).length).toBe(0);
  });
});
```

If `useEditorMode` / `React` aren't already imported in the file, add them.

- [ ] **Step 2: Verify the test fails**

`npm test -- --run EditableBulletList` — expect 2 failures (handles not rendered).

- [ ] **Step 3: Implement bullet DnD**

In `src/components/editor/editable/EditableBulletList.tsx`:

Add imports at the top:

```tsx
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { useDragSensors } from '../canvas/useDragSensors';
```

In the edit-mode render branch, derive a stable id per bullet:

```tsx
const ids = items.map((_, i) => `${ariaLabel}::${i}`);
```

And introduce a sub-component (defined at the bottom of the same file) for each `<li>`:

```tsx
function SortableBulletItem({
  id,
  index,
  bullet,
  ariaLabel,
  itemStyle,
  liClassName,
  onKeyDown,
  onChangeText,
}: {
  id: string;
  index: number;
  bullet: string;
  ariaLabel: string;
  itemStyle?: React.CSSProperties;
  liClassName?: string;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>, index: number) => void;
  onChangeText: (index: number, next: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    ...itemStyle,
  };
  return (
    <li
      ref={setNodeRef}
      role="listitem"
      className={`bullet-row ${liClassName ?? ''}`}
      style={style}
      onKeyDown={(e) => onKeyDown(e, index)}
    >
      <button
        type="button"
        aria-label="Drag to reorder bullet"
        className="bullet-grip inline-flex items-center justify-center cursor-grab active:cursor-grabbing text-muted hover:text-brand p-1 min-w-[28px] min-h-[28px] align-middle"
        {...attributes}
        {...(listeners as Record<string, unknown> | undefined ?? {})}
      >
        <GripVertical size={14} />
      </button>
      <EditableText
        value={bullet}
        onChange={(v) => onChangeText(index, v)}
        ariaLabel={`${ariaLabel} item ${index + 1}`}
        placeholder=""
        singleLine={false}
      />
    </li>
  );
}
```

Replace the existing `items.map((b, i) => (<li>...</li>))` block inside the edit-mode `<ul>` with:

```tsx
<DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragEnd={onBulletDragEnd}
>
  <SortableContext items={ids} strategy={verticalListSortingStrategy}>
    {items.map((b, i) => (
      <SortableBulletItem
        key={ids[i]}
        id={ids[i]}
        index={i}
        bullet={b}
        ariaLabel={ariaLabel}
        itemStyle={itemStyle}
        liClassName={liClassName}
        onKeyDown={onKeyDown}
        onChangeText={commitIndex}
      />
    ))}
  </SortableContext>
</DndContext>
```

Add the sensors + drag handler in the component body:

```tsx
const sensors = useDragSensors();

function onBulletDragEnd(e: DragEndEvent) {
  const { active, over } = e;
  if (!over || active.id === over.id) return;
  const oldIndex = ids.indexOf(String(active.id));
  const newIndex = ids.indexOf(String(over.id));
  if (oldIndex < 0 || newIndex < 0) return;
  onChange(arrayMove(items, oldIndex, newIndex));
}
```

The preview-mode render keeps producing the plain `<ul><li>` tree — no grips, no DnD.

- [ ] **Step 4: Add CSS for grip hover-visibility**

Append to `src/app/globals.css`:

```css
.bullet-row .bullet-grip {
  opacity: 0;
  transition: opacity 100ms;
}
.bullet-row:hover .bullet-grip,
.bullet-grip:focus-visible {
  opacity: 1;
}
```

- [ ] **Step 5: Run tests + typecheck**

`npm run typecheck && npm test -- --run` — all green. Bullet test files should pass the 2 new tests.

- [ ] **Step 6: Commit**

```
git add src/components/editor/editable/EditableBulletList.tsx tests/unit/EditableBulletList.test.tsx src/app/globals.css
git commit -m "feat(editor): drag-and-drop reordering for bullets"
```

---

### Task 3: SectionSelectionProvider

**Files:**
- Create: `src/components/editor/SectionSelectionProvider.tsx`
- Create: `tests/unit/SectionSelectionProvider.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// tests/unit/SectionSelectionProvider.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  SectionSelectionProvider,
  useSectionSelection,
} from '@/components/editor/SectionSelectionProvider';

function Probe({ sectionIds }: { sectionIds: string[] }) {
  const { selected, isSelected, toggle, clear } = useSectionSelection();
  return (
    <div>
      <span data-testid="size">{selected.size}</span>
      <span data-testid="set">{Array.from(selected).join(',')}</span>
      {sectionIds.map((id) => (
        <button key={id} onClick={(e) => toggle(id, e.shiftKey ? 'range' : 'single')}>
          {id}:{isSelected(id) ? '1' : '0'}
        </button>
      ))}
      <button onClick={clear}>clear</button>
    </div>
  );
}

describe('SectionSelectionProvider', () => {
  it('defaults to empty', () => {
    render(
      <SectionSelectionProvider sectionIds={['a', 'b']}>
        <Probe sectionIds={['a', 'b']} />
      </SectionSelectionProvider>
    );
    expect(screen.getByTestId('size').textContent).toBe('0');
  });

  it('single toggle adds and removes ids', () => {
    render(
      <SectionSelectionProvider sectionIds={['a', 'b', 'c']}>
        <Probe sectionIds={['a', 'b', 'c']} />
      </SectionSelectionProvider>
    );
    fireEvent.click(screen.getByText(/^a:/));
    expect(screen.getByTestId('size').textContent).toBe('1');
    fireEvent.click(screen.getByText(/^a:/));
    expect(screen.getByTestId('size').textContent).toBe('0');
  });

  it('range toggle selects inclusive range from anchor', () => {
    render(
      <SectionSelectionProvider sectionIds={['a', 'b', 'c', 'd']}>
        <Probe sectionIds={['a', 'b', 'c', 'd']} />
      </SectionSelectionProvider>
    );
    fireEvent.click(screen.getByText(/^a:/));
    fireEvent.click(screen.getByText(/^c:/), { shiftKey: true });
    const ids = screen.getByTestId('set').textContent ?? '';
    expect(ids.split(',').sort()).toEqual(['a', 'b', 'c']);
  });

  it('clear empties the set', () => {
    render(
      <SectionSelectionProvider sectionIds={['a', 'b']}>
        <Probe sectionIds={['a', 'b']} />
      </SectionSelectionProvider>
    );
    fireEvent.click(screen.getByText(/^a:/));
    fireEvent.click(screen.getByText('clear'));
    expect(screen.getByTestId('size').textContent).toBe('0');
  });

  it('prunes ids that disappear from sectionIds', () => {
    const { rerender } = render(
      <SectionSelectionProvider sectionIds={['a', 'b', 'c']}>
        <Probe sectionIds={['a', 'b', 'c']} />
      </SectionSelectionProvider>
    );
    fireEvent.click(screen.getByText(/^a:/));
    fireEvent.click(screen.getByText(/^b:/));
    rerender(
      <SectionSelectionProvider sectionIds={['b', 'c']}>
        <Probe sectionIds={['b', 'c']} />
      </SectionSelectionProvider>
    );
    const ids = screen.getByTestId('set').textContent ?? '';
    expect(ids).toBe('b');
  });
});
```

- [ ] **Step 2: Verify test fails**

`npm test -- --run SectionSelectionProvider` — module not found.

- [ ] **Step 3: Implement the provider**

```tsx
// src/components/editor/SectionSelectionProvider.tsx
'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type SelectionModifier = 'single' | 'range';

interface SectionSelectionContextValue {
  selected: Set<string>;
  anchorId: string | null;
  toggle(id: string, modifier: SelectionModifier): void;
  clear(): void;
  isSelected(id: string): boolean;
}

const Ctx = createContext<SectionSelectionContextValue | null>(null);

interface ProviderProps {
  sectionIds: string[];           // ordered list from the current store
  children: ReactNode;
}

export function SectionSelectionProvider({ sectionIds, children }: ProviderProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const sectionIdsRef = useRef(sectionIds);
  sectionIdsRef.current = sectionIds;

  // Prune ids that no longer exist.
  useEffect(() => {
    setSelected((prev) => {
      const next = new Set<string>();
      for (const id of prev) if (sectionIds.includes(id)) next.add(id);
      return next.size === prev.size ? prev : next;
    });
    if (anchorId && !sectionIds.includes(anchorId)) setAnchorId(null);
  }, [sectionIds, anchorId]);

  const toggle = useCallback((id: string, modifier: SelectionModifier) => {
    if (modifier === 'single' || !anchorId) {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      setAnchorId(id);
      return;
    }
    const ids = sectionIdsRef.current;
    const a = ids.indexOf(anchorId);
    const b = ids.indexOf(id);
    if (a < 0 || b < 0) return;
    const [lo, hi] = a <= b ? [a, b] : [b, a];
    const range = ids.slice(lo, hi + 1);
    setSelected(new Set(range));
  }, [anchorId]);

  const clear = useCallback(() => {
    setSelected(new Set());
    setAnchorId(null);
  }, []);

  const isSelected = useCallback((id: string) => selected.has(id), [selected]);

  const value = useMemo(
    () => ({ selected, anchorId, toggle, clear, isSelected }),
    [selected, anchorId, toggle, clear, isSelected],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSectionSelection(): SectionSelectionContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSectionSelection must be used inside SectionSelectionProvider');
  return v;
}
```

- [ ] **Step 4: Run typecheck + tests**

`npm run typecheck && npm test -- --run SectionSelectionProvider` — 5 tests pass.

- [ ] **Step 5: Commit**

```
git add src/components/editor/SectionSelectionProvider.tsx tests/unit/SectionSelectionProvider.test.tsx
git commit -m "feat(editor): SectionSelectionProvider context with range + prune"
```

---

### Task 4: SelectionActionBar component

**Files:**
- Create: `src/components/editor/canvas/SelectionActionBar.tsx`
- Create: `tests/unit/SelectionActionBar.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// tests/unit/SelectionActionBar.test.tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { SelectionActionBar } from '@/components/editor/canvas/SelectionActionBar';
import {
  SectionSelectionProvider,
  useSectionSelection,
} from '@/components/editor/SectionSelectionProvider';
import { EditorModeProvider, useEditorMode } from '@/components/editor/EditorModeProvider';

const mockDuplicate = vi.fn();
const mockRemove = vi.fn();
const mockMove = vi.fn();
vi.mock('@/lib/editor/StoreProvider', () => ({
  useEditorStore: () => ({
    getState: () => ({
      duplicateSection: mockDuplicate,
      removeSection: mockRemove,
      moveSection: mockMove,
    }),
  }),
}));

const mockConfirm = vi.fn();
vi.mock('@/lib/utils/confirm', () => ({
  confirmDialog: (...args: unknown[]) => mockConfirm(...args),
}));

function Seed({ ids }: { ids: string[] }) {
  const { toggle } = useSectionSelection();
  React.useEffect(() => {
    for (const id of ids) toggle(id, 'single');
  }, [ids, toggle]);
  return null;
}

function ForcePreview() {
  const { setMode } = useEditorMode();
  React.useEffect(() => { setMode('preview'); }, [setMode]);
  return null;
}

function Wrap({ ids, sectionIds = ['a', 'b', 'c'] }: { ids: string[]; sectionIds?: string[] }) {
  return (
    <EditorModeProvider>
      <SectionSelectionProvider sectionIds={sectionIds}>
        <Seed ids={ids} />
        <SelectionActionBar />
      </SectionSelectionProvider>
    </EditorModeProvider>
  );
}

describe('SelectionActionBar', () => {
  beforeEach(() => {
    mockDuplicate.mockClear();
    mockRemove.mockClear();
    mockMove.mockClear();
    mockConfirm.mockReset();
  });

  it('renders nothing when selection is empty', () => {
    const { container } = render(<Wrap ids={[]} />);
    expect(container.querySelector('[data-selection-bar]')).toBeNull();
  });

  it('renders the count and action buttons when 1+ selected', () => {
    render(<Wrap ids={['a', 'b']} />);
    expect(screen.getByText(/2 selected/i)).toBeTruthy();
    expect(screen.getByLabelText(/duplicate selected/i)).toBeTruthy();
    expect(screen.getByLabelText(/delete selected/i)).toBeTruthy();
    expect(screen.getByLabelText(/move selected sections up/i)).toBeTruthy();
    expect(screen.getByLabelText(/move selected sections down/i)).toBeTruthy();
    expect(screen.getByLabelText(/clear selection/i)).toBeTruthy();
  });

  it('Duplicate calls duplicateSection for each selected id', () => {
    render(<Wrap ids={['a', 'b']} />);
    fireEvent.click(screen.getByLabelText(/duplicate selected/i));
    expect(mockDuplicate).toHaveBeenCalledTimes(2);
    expect(mockDuplicate).toHaveBeenCalledWith('a');
    expect(mockDuplicate).toHaveBeenCalledWith('b');
  });

  it('Delete confirms then removes each id on confirm', async () => {
    mockConfirm.mockResolvedValue(true);
    render(<Wrap ids={['a', 'b']} />);
    fireEvent.click(screen.getByLabelText(/delete selected/i));
    await waitFor(() => expect(mockRemove).toHaveBeenCalledTimes(2));
    expect(mockRemove).toHaveBeenCalledWith('a');
    expect(mockRemove).toHaveBeenCalledWith('b');
  });

  it('Delete does NOT remove when cancelled', async () => {
    mockConfirm.mockResolvedValue(false);
    render(<Wrap ids={['a']} />);
    fireEvent.click(screen.getByLabelText(/delete selected/i));
    await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('Move up calls moveSection in document order', () => {
    render(<Wrap ids={['a', 'b']} />);
    fireEvent.click(screen.getByLabelText(/move selected sections up/i));
    expect(mockMove.mock.calls).toEqual([['a', 'up'], ['b', 'up']]);
  });

  it('Move down calls moveSection in reverse document order', () => {
    render(<Wrap ids={['a', 'b']} />);
    fireEvent.click(screen.getByLabelText(/move selected sections down/i));
    expect(mockMove.mock.calls).toEqual([['b', 'down'], ['a', 'down']]);
  });

  it('renders nothing in preview mode even with selection', () => {
    const { container } = render(
      <EditorModeProvider>
        <ForcePreview />
        <SectionSelectionProvider sectionIds={['a']}>
          <Seed ids={['a']} />
          <SelectionActionBar />
        </SectionSelectionProvider>
      </EditorModeProvider>
    );
    expect(container.querySelector('[data-selection-bar]')).toBeNull();
  });
});
```

- [ ] **Step 2: Verify test fails**

`npm test -- --run SelectionActionBar` — module not found.

- [ ] **Step 3: Implement the action bar**

```tsx
// src/components/editor/canvas/SelectionActionBar.tsx
'use client';
import { ArrowDown, ArrowUp, Copy, X } from 'lucide-react';
import { useEditorStore } from '@/lib/editor/StoreProvider';
import { confirmDialog } from '@/lib/utils/confirm';
import { useEditorMode } from '../EditorModeProvider';
import { useSectionSelection } from '../SectionSelectionProvider';

export function SelectionActionBar() {
  const { mode } = useEditorMode();
  const { selected, clear } = useSectionSelection();
  const store = useEditorStore();
  if (mode === 'preview') return null;
  if (selected.size === 0) return null;

  const ids = Array.from(selected);  // already in insertion order; we re-sort below by store order
  const stateIds = store.getState().data.sections.map((s) => s.id);
  const ordered = stateIds.filter((id) => selected.has(id));

  function onDuplicate() {
    const { duplicateSection } = store.getState();
    for (const id of ordered) duplicateSection(id);
  }

  async function onDelete() {
    const ok = await confirmDialog({
      title: ordered.length === 1 ? 'Delete section?' : `Delete ${ordered.length} sections?`,
      message:
        ordered.length === 1
          ? 'This will remove the section from the email.'
          : `This will remove ${ordered.length} sections from the email.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    const { removeSection } = store.getState();
    for (const id of ordered) removeSection(id);
    clear();
  }

  function onMoveUp() {
    const { moveSection } = store.getState();
    for (const id of ordered) moveSection(id, 'up');
  }

  function onMoveDown() {
    const { moveSection } = store.getState();
    for (const id of ordered.slice().reverse()) moveSection(id, 'down');
  }

  return (
    <div
      data-selection-bar
      className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 inline-flex items-center gap-2 rounded-full border border-border-strong bg-panel-2 px-3 py-1.5 text-xs text-fg shadow-lg"
    >
      <span className="px-2 font-medium">{ids.length} selected</span>
      <button
        type="button"
        aria-label="Duplicate selected sections"
        onClick={onDuplicate}
        className="inline-flex items-center gap-1 rounded p-1.5 text-muted hover:text-brand hover:bg-panel"
      >
        <Copy size={14} /> Duplicate
      </button>
      <button
        type="button"
        aria-label="Delete selected sections"
        onClick={onDelete}
        className="inline-flex items-center gap-1 rounded p-1.5 text-muted hover:text-danger hover:bg-panel"
      >
        <X size={14} /> Delete
      </button>
      <button
        type="button"
        aria-label="Move selected sections up"
        onClick={onMoveUp}
        className="inline-flex items-center gap-1 rounded p-1.5 text-muted hover:text-brand hover:bg-panel"
      >
        <ArrowUp size={14} /> Up
      </button>
      <button
        type="button"
        aria-label="Move selected sections down"
        onClick={onMoveDown}
        className="inline-flex items-center gap-1 rounded p-1.5 text-muted hover:text-brand hover:bg-panel"
      >
        <ArrowDown size={14} /> Down
      </button>
      <span className="text-border-strong">|</span>
      <button
        type="button"
        aria-label="Clear selection"
        onClick={clear}
        className="rounded p-1.5 text-muted hover:text-fg hover:bg-panel"
      >
        <X size={14} />
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run typecheck + tests**

`npm run typecheck && npm test -- --run SelectionActionBar` — 8 tests pass.

- [ ] **Step 5: Commit**

```
git add src/components/editor/canvas/SelectionActionBar.tsx tests/unit/SelectionActionBar.test.tsx
git commit -m "feat(editor): SelectionActionBar floating bulk-operations toolbar"
```

---

### Task 5: Wire selection into EditorShell + PreviewBody

**Files:**
- Modify: `src/components/editor/EditorShell.tsx`
- Modify: `src/components/editor/PreviewBody.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Mount SectionSelectionProvider in EditorShell**

In `src/components/editor/EditorShell.tsx`, import:

```tsx
import { SectionSelectionProvider } from './SectionSelectionProvider';
import { useEditor } from '@/lib/editor/StoreProvider';
```

Inside `Inner`, derive the section ids and wrap:

```tsx
function SelectionScope({ children }: { children: React.ReactNode }) {
  const sectionIds = useEditor((s) => s.data.sections.map((sec) => sec.id));
  return <SectionSelectionProvider sectionIds={sectionIds}>{children}</SectionSelectionProvider>;
}
```

Mount inside `EditorModeProvider` and outside `AssetPickerProvider`:

```tsx
return (
  <EditorModeProvider>
    <SelectionScope>
      <AssetPickerProvider workspaceSlug={workspaceSlug}>
        ...
      </AssetPickerProvider>
    </SelectionScope>
  </EditorModeProvider>
);
```

If `EditorModeProvider` is not yet imported in `EditorShell.tsx`, add it. (It already mounts there from Task 1 of the v2 spec — verify by reading the file first.)

- [ ] **Step 2: Hook selection into PreviewBody's SortableSection**

In `src/components/editor/PreviewBody.tsx`:

Imports:

```tsx
import { useSectionSelection } from './SectionSelectionProvider';
import { SelectionActionBar } from './canvas/SelectionActionBar';
```

Update `SortableSection` to read `useSectionSelection`:

```tsx
function SortableSection({ s, children }: { s: { id: string; title?: string; backgroundColor?: string }; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: s.id });
  const { toggle, isSelected } = useSectionSelection();
  const selected = isSelected(s.id);
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
  function onMouseDown(e: React.MouseEvent) {
    if (!(e.metaKey || e.ctrlKey || e.shiftKey)) return;
    e.preventDefault();
    toggle(s.id, e.shiftKey ? 'range' : 'single');
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`section-wrap ${selected ? 'selected' : ''}`}
      data-selected={selected || undefined}
      onMouseDown={onMouseDown}
    >
      <SectionToolbar
        sectionId={s.id}
        sectionTitle={s.title ?? ''}
        dragAttributes={attributes as unknown as Record<string, unknown>}
        dragListeners={listeners as unknown as Record<string, unknown> | undefined}
      />
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Clear-on-empty-canvas + Escape handler**

In `PreviewBody`'s root render, attach a clear handler to the outermost `<div className="preview-canvas">`:

```tsx
const selection = useSectionSelection();
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
```

Apply `onMouseDown={onCanvasMouseDown}` to the `<div className="preview-canvas">`. Add `useEffect` to the React import.

- [ ] **Step 4: Mount SelectionActionBar**

Render `<SelectionActionBar />` once at the end of the `PreviewBody` JSX, just before the closing `</div>` of `.preview-canvas`. Or render it as a sibling of the preview canvas — fixed positioning handles placement.

- [ ] **Step 5: Add selected outline CSS**

Append to `src/app/globals.css`:

```css
.section-wrap.selected {
  outline: 2px solid var(--color-brand);
  outline-offset: -2px;
}
```

- [ ] **Step 6: Run typecheck + tests**

`npm run typecheck && npm test -- --run` — green.

- [ ] **Step 7: Commit**

```
git add src/components/editor/EditorShell.tsx src/components/editor/PreviewBody.tsx src/app/globals.css
git commit -m "feat(editor): wire multi-select into shell and PreviewBody"
```

---

### Task 6: Motion / FLIP animation

**Files:**
- Modify: `src/components/editor/PreviewBody.tsx`

- [ ] **Step 1: Add motion imports**

```tsx
import { AnimatePresence, motion } from 'motion/react';
```

(`motion/react` is already a dep — confirm via grep.)

- [ ] **Step 2: Wrap SortableSection's inner div with motion.div**

Replace the bare `<div ref={setNodeRef} ... >` in `SortableSection` with:

```tsx
return (
  <motion.div
    ref={setNodeRef}
    layout
    initial={{ opacity: 0, scale: 0.98 }}
    animate={{ opacity: isDragging ? 0.5 : 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.98 }}
    transition={{ duration: 0.18, ease: 'easeOut' }}
    style={style}
    className={`section-wrap ${selected ? 'selected' : ''}`}
    data-selected={selected || undefined}
    onMouseDown={onMouseDown}
  >
    <SectionToolbar ... />
    {children}
  </motion.div>
);
```

Drop the `opacity` field from the `style` object (it now lives on `animate`).

- [ ] **Step 3: Wrap the sections map in AnimatePresence**

Inside the `SortableContext`, wrap the `data.sections.map(...)` in `<AnimatePresence initial={false} mode="popLayout">...</AnimatePresence>`. The insert bars (which are NOT animated) live outside the AnimatePresence.

Tricky bit: `AnimatePresence` needs a unique `key` on each immediate child. The current `<Fragment key={s.id}>` should work, but `AnimatePresence` doesn't crawl into Fragments. Replace `<Fragment key={s.id}>` with `<motion.div key={s.id} layout className="section-block">` wrapping the insert bar + `SortableSection`, or — simpler — pull the insert bar outside and animate only the `SortableSection`. The simplest version:

```tsx
{data.sections.map((s, idx) => (
  <Fragment key={s.id}>
    <SectionInsertBar atIndex={idx} />
    <AnimatePresence initial={false} mode="popLayout">
      <SortableSection key={s.id} s={s}>
        {/* TextCol / ImageCol */}
      </SortableSection>
    </AnimatePresence>
  </Fragment>
))}
```

— but that mounts a presence per section and exit animations on deletion won't fire (the parent fragment is gone). The cleaner pattern is one `AnimatePresence` around the whole sections block. Use:

```tsx
<AnimatePresence initial={false} mode="popLayout">
  {data.sections.map((s, idx) => (
    <motion.div key={s.id} layout>
      <SectionInsertBar atIndex={idx} />
      <SortableSection s={s}>...</SortableSection>
    </motion.div>
  ))}
</AnimatePresence>
{data.sections.length > 0 && <SectionInsertBar atIndex={data.sections.length} />}
```

This wraps both the insert-bar-above and the section in a motion.div so they animate together as a block.

- [ ] **Step 4: Run typecheck + tests**

`npm run typecheck && npm test -- --run` — green. Motion has zero unit-test coverage here; the smoke test will exercise it.

- [ ] **Step 5: Commit**

```
git add src/components/editor/PreviewBody.tsx
git commit -m "feat(editor): FLIP-style motion on section insert/delete/duplicate/move"
```

---

### Task 7: Manual verification

- [ ] Run `npm run dev`, open an email project, verify:
  - Hover a bullet → grip fades in. Drag grip → bullet reorders. Keyboard: Tab to grip, Space, Arrows, Space.
  - Cmd/Ctrl+click two non-adjacent sections → both outline; bottom-center bar reads "2 selected".
  - Shift+click a third section → range fills in.
  - Bar's Duplicate → all selected sections duplicated; originals stay selected.
  - Bar's Delete → confirmation reads "Delete N sections?" → confirm → all gone; Cmd+Z brings them back; selection cleared.
  - Bar's Up / Down → group migrates by one position.
  - Click empty canvas (outside any section) → selection clears.
  - Press Escape → selection clears.
  - Toggle to Preview → outlines and bar disappear; bullets render plain.
  - On a touch device or DevTools touch emulation, tap a section CTA → opens edit popover. Long-press a grip → drag works.
  - Section insert/delete/duplicate fades and slides smoothly instead of popping.

- [ ] Report any issues; re-dispatch the relevant task.
