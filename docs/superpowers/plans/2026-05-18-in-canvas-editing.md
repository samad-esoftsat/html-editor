# In-Canvas Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every visible text and image on the editor preview directly click-to-edit, while keeping the sidebar for styling and structural controls.

**Architecture:** Drop the iframe wrapping the preview. Introduce three reusable primitives — `EditableText`, `EditableBulletList`, `EditableImage` — that wrap each text and image element. A singleton `AssetPickerProvider` context exposes `openAssetPicker({ onSelect })` so all image edits open the same modal. `PreviewBody` is rewired to bind each primitive to the existing Zustand store setters.

**Tech Stack:** Next.js 15, React 19, TypeScript, Zustand (existing store), Vitest + jsdom + @testing-library/react (existing).

**Spec:** `docs/superpowers/specs/2026-05-18-in-canvas-editing-design.md`

---

## File Structure

**New:**

- `src/components/editor/editable/EditableText.tsx`
- `src/components/editor/editable/EditableBulletList.tsx`
- `src/components/editor/editable/EditableImage.tsx`
- `src/components/editor/AssetPickerProvider.tsx` — React context + singleton modal.
- `tests/unit/EditableText.test.tsx`
- `tests/unit/EditableBulletList.test.tsx`
- `tests/unit/EditableImage.test.tsx`

**Modified:**

- `src/components/editor/Preview.tsx` — drop iframe, render `<PreviewBody>` directly.
- `src/components/editor/PreviewBody.tsx` — wire each editable field through the new primitives.
- `src/components/editor/EditorShell.tsx` — mount `<AssetPickerProvider>` around the editor inner tree.

**Untouched:**

- `src/components/editor/AssetPicker.tsx` and `AssetPickerButton.tsx` — still used by the sidebar's existing inputs.
- `src/lib/editor/store.ts`, `autosave.ts`, `types.ts` — no schema or store changes.
- `src/lib/export/renderEmail.ts` — independent of the editor preview, unchanged.

---

## Task 1: `EditableText` primitive

**Files:**
- Create: `src/components/editor/editable/EditableText.tsx`
- Test: `tests/unit/EditableText.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/EditableText.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditableText } from '@/components/editor/editable/EditableText';

describe('EditableText', () => {
  it('renders the value as textContent', () => {
    render(<EditableText value="Hello" onChange={() => {}} ariaLabel="Title" />);
    const el = screen.getByRole('textbox', { name: 'Title' });
    expect(el.textContent).toBe('Hello');
  });

  it('renders the placeholder when value is empty', () => {
    render(<EditableText value="" onChange={() => {}} ariaLabel="Title" placeholder="Click to add" />);
    const el = screen.getByRole('textbox', { name: 'Title' });
    expect(el.getAttribute('data-empty')).toBe('true');
    expect(el.getAttribute('aria-placeholder')).toBe('Click to add');
  });

  it('commits draft on blur', () => {
    const onChange = vi.fn();
    render(<EditableText value="Old" onChange={onChange} ariaLabel="Title" />);
    const el = screen.getByRole('textbox', { name: 'Title' });
    el.textContent = 'New';
    fireEvent.input(el);
    fireEvent.blur(el);
    expect(onChange).toHaveBeenCalledWith('New');
  });

  it('does not call onChange on blur when value is unchanged', () => {
    const onChange = vi.fn();
    render(<EditableText value="Old" onChange={onChange} ariaLabel="Title" />);
    const el = screen.getByRole('textbox', { name: 'Title' });
    fireEvent.blur(el);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('commits on Enter and prevents the default newline for single-line fields', () => {
    const onChange = vi.fn();
    render(<EditableText value="Old" onChange={onChange} ariaLabel="Title" singleLine />);
    const el = screen.getByRole('textbox', { name: 'Title' });
    el.textContent = 'New';
    fireEvent.input(el);
    const ev = fireEvent.keyDown(el, { key: 'Enter' });
    expect(ev).toBe(false); // preventDefault was called
    expect(onChange).toHaveBeenCalledWith('New');
  });

  it('does NOT commit on Enter for multiline fields (allows newline)', () => {
    const onChange = vi.fn();
    render(<EditableText value="Old" onChange={onChange} ariaLabel="Address" />);
    const el = screen.getByRole('textbox', { name: 'Address' });
    el.textContent = 'A\nB';
    fireEvent.input(el);
    fireEvent.keyDown(el, { key: 'Enter' });
    // onChange fires on blur, not on Enter
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(el);
    expect(onChange).toHaveBeenCalledWith('A\nB');
  });

  it('reverts to the committed value on Escape and does not call onChange', () => {
    const onChange = vi.fn();
    render(<EditableText value="Old" onChange={onChange} ariaLabel="Title" />);
    const el = screen.getByRole('textbox', { name: 'Title' });
    el.textContent = 'Changed';
    fireEvent.input(el);
    fireEvent.keyDown(el, { key: 'Escape' });
    expect(el.textContent).toBe('Old');
    fireEvent.blur(el);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('strips HTML on paste by inserting only plain text', () => {
    const onChange = vi.fn();
    render(<EditableText value="" onChange={onChange} ariaLabel="Title" />);
    const el = screen.getByRole('textbox', { name: 'Title' });
    el.focus();
    const dt = new DataTransfer();
    dt.setData('text/html', '<b>Bold</b>');
    dt.setData('text/plain', 'Bold');
    const ev = fireEvent.paste(el, { clipboardData: dt });
    expect(ev).toBe(false);
    fireEvent.blur(el);
    expect(onChange).toHaveBeenCalledWith('Bold');
  });

  it('updates the DOM when external value changes while not focused', () => {
    const { rerender } = render(<EditableText value="A" onChange={() => {}} ariaLabel="Title" />);
    const el = screen.getByRole('textbox', { name: 'Title' });
    expect(el.textContent).toBe('A');
    rerender(<EditableText value="B" onChange={() => {}} ariaLabel="Title" />);
    expect(el.textContent).toBe('B');
  });
});
```

- [ ] **Step 2: Run tests, expect failure**

Run: `npm test -- tests/unit/EditableText.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/components/editor/editable/EditableText.tsx`:

```tsx
'use client';
import { useEffect, useRef } from 'react';

export interface EditableTextProps {
  value: string;
  onChange: (next: string) => void;
  singleLine?: boolean;
  placeholder?: string;
  ariaLabel: string;
  className?: string;
  style?: React.CSSProperties;
  as?: keyof JSX.IntrinsicElements;
}

export function EditableText({
  value,
  onChange,
  singleLine,
  placeholder,
  ariaLabel,
  className,
  style,
  as,
}: EditableTextProps) {
  const ref = useRef<HTMLElement | null>(null);
  const committedRef = useRef<string>(value);

  useEffect(() => {
    committedRef.current = value;
    const el = ref.current;
    if (!el) return;
    // Only push external updates into the DOM when the user is not actively editing.
    if (document.activeElement !== el) {
      el.textContent = value;
    }
  }, [value]);

  function commit() {
    const el = ref.current;
    if (!el) return;
    const next = el.textContent ?? '';
    if (next === committedRef.current) return;
    committedRef.current = next;
    onChange(next);
  }

  function revert() {
    const el = ref.current;
    if (!el) return;
    el.textContent = committedRef.current;
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      revert();
      (e.currentTarget as HTMLElement).blur();
      return;
    }
    if (e.key === 'Enter' && singleLine) {
      e.preventDefault();
      commit();
      (e.currentTarget as HTMLElement).blur();
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    // Insert plain text at the current selection. Fall back to append if no selection.
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      range.collapse(false);
    } else {
      const el = ref.current;
      if (el) el.textContent = (el.textContent ?? '') + text;
    }
  }

  const Tag = (as ?? 'span') as keyof JSX.IntrinsicElements;
  const isEmpty = value.length === 0;
  const baseClass = [
    'inline-editable',
    'outline-none',
    isEmpty ? 'opacity-50' : '',
    className ?? '',
  ].filter(Boolean).join(' ');

  return (
    <Tag
      ref={ref as React.Ref<HTMLElement> & React.Ref<HTMLSpanElement>}
      role="textbox"
      aria-label={ariaLabel}
      aria-multiline={!singleLine}
      aria-placeholder={placeholder}
      data-empty={isEmpty ? 'true' : 'false'}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      onBlur={commit}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      className={baseClass}
      style={style}
    >
      {value}
    </Tag>
  );
}
```

Add minimal styles for hover/focus in `src/app/globals.css` (append at the bottom):

```css
.inline-editable {
  cursor: text;
  border-radius: 2px;
  transition: outline-color 100ms ease-out;
  outline-offset: 2px;
}
.inline-editable:hover {
  outline: 1px solid color-mix(in oklab, var(--brand, #6366f1) 40%, transparent);
}
.inline-editable:focus {
  outline: 1.5px solid var(--brand, #6366f1);
}
.inline-editable[data-empty='true']::before {
  content: attr(aria-placeholder);
  pointer-events: none;
}
.inline-editable[data-empty='true']:focus::before {
  content: none;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/unit/EditableText.test.tsx`
Expected: 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/editable/EditableText.tsx tests/unit/EditableText.test.tsx src/app/globals.css
git commit -m "feat(editor): EditableText primitive (contentEditable with paste sanitization)"
```

---

## Task 2: `EditableBulletList` primitive

**Files:**
- Create: `src/components/editor/editable/EditableBulletList.tsx`
- Test: `tests/unit/EditableBulletList.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/EditableBulletList.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { EditableBulletList } from '@/components/editor/editable/EditableBulletList';

function setup(bullets: string[]) {
  const onChange = vi.fn();
  render(<EditableBulletList bullets={bullets} onChange={onChange} ariaLabel="Bullets" />);
  return { onChange };
}

function items(): HTMLElement[] {
  const list = screen.getByRole('list', { name: 'Bullets' });
  return within(list).getAllByRole('listitem');
}

describe('EditableBulletList', () => {
  it('renders one <li> per bullet', () => {
    setup(['One', 'Two', 'Three']);
    expect(items().length).toBe(3);
  });

  it('Enter inside a bullet splits and inserts a new bullet after it', () => {
    const { onChange } = setup(['One', 'Two']);
    const second = items()[1];
    const editor = within(second).getByRole('textbox');
    editor.textContent = 'Two';
    fireEvent.input(editor);
    // Place caret at the end (simulate Enter at end)
    fireEvent.keyDown(editor, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(['One', 'Two', '']);
  });

  it('Backspace at the start of an empty bullet removes it', () => {
    const { onChange } = setup(['One', '', 'Three']);
    const second = items()[1];
    const editor = within(second).getByRole('textbox');
    fireEvent.keyDown(editor, { key: 'Backspace' });
    expect(onChange).toHaveBeenCalledWith(['One', 'Three']);
  });

  it('Backspace at the start of a non-empty bullet merges into the previous bullet', () => {
    const { onChange } = setup(['One', 'Two']);
    const second = items()[1];
    const editor = within(second).getByRole('textbox');
    // Simulate caret at start of "Two"
    const range = document.createRange();
    range.setStart(editor.firstChild ?? editor, 0);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    fireEvent.keyDown(editor, { key: 'Backspace' });
    expect(onChange).toHaveBeenCalledWith(['OneTwo']);
  });

  it('committing a bullet text via blur updates the array at that index', () => {
    const { onChange } = setup(['One', 'Two']);
    const first = items()[0];
    const editor = within(first).getByRole('textbox');
    editor.textContent = 'Edited';
    fireEvent.input(editor);
    fireEvent.blur(editor);
    expect(onChange).toHaveBeenCalledWith(['Edited', 'Two']);
  });

  it('rendering with zero bullets shows an empty list and renders a single empty editable to start with', () => {
    setup([]);
    // Always shows at least one editable item so the user can click to start typing
    expect(items().length).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests, expect failure**

Run: `npm test -- tests/unit/EditableBulletList.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/components/editor/editable/EditableBulletList.tsx`:

```tsx
'use client';
import { useLayoutEffect, useRef } from 'react';
import { EditableText } from './EditableText';

export interface EditableBulletListProps {
  bullets: string[];
  onChange: (next: string[]) => void;
  ariaLabel: string;
  itemStyle?: React.CSSProperties;
  className?: string;
  liClassName?: string;
}

function caretAtStart(el: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return true;
  const r = sel.getRangeAt(0);
  if (!r.collapsed) return false;
  if (r.startOffset !== 0) return false;
  // Walk up to confirm anchor is the element or its first descendant text node at offset 0
  let node: Node | null = r.startContainer;
  while (node && node !== el) {
    if (node.previousSibling) return false;
    node = node.parentNode;
  }
  return node === el;
}

export function EditableBulletList({
  bullets,
  onChange,
  ariaLabel,
  itemStyle,
  className,
  liClassName,
}: EditableBulletListProps) {
  // Render at least one item so an empty list is still clickable.
  const items = bullets.length > 0 ? bullets : [''];

  // Track requested focus after structural changes.
  const focusRequest = useRef<{ index: number; caret: 'start' | 'end' } | null>(null);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);

  useLayoutEffect(() => {
    const req = focusRequest.current;
    if (!req) return;
    focusRequest.current = null;
    const target = itemRefs.current[req.index];
    if (!target) return;
    target.focus();
    const sel = window.getSelection();
    const range = document.createRange();
    if (req.caret === 'start') {
      range.setStart(target, 0);
    } else {
      range.selectNodeContents(target);
      range.collapse(false);
    }
    sel?.removeAllRanges();
    sel?.addRange(range);
  });

  function commitIndex(index: number, next: string) {
    if (bullets.length === 0 && next === '') return;
    const arr = bullets.length === 0 ? [''] : bullets.slice();
    arr[index] = next;
    onChange(arr);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLElement>, index: number) {
    const el = e.currentTarget as HTMLElement;
    if (e.key === 'Enter') {
      e.preventDefault();
      const currentText = el.textContent ?? '';
      const arr = items.slice();
      arr[index] = currentText;
      arr.splice(index + 1, 0, '');
      focusRequest.current = { index: index + 1, caret: 'start' };
      onChange(arr);
      return;
    }
    if (e.key === 'Backspace' && caretAtStart(el)) {
      const currentText = el.textContent ?? '';
      if (items.length === 1) {
        // Don't remove the last item; allow normal backspace within it.
        return;
      }
      e.preventDefault();
      const arr = items.slice();
      if (currentText.length === 0) {
        arr.splice(index, 1);
        const focusIndex = Math.max(0, index - 1);
        focusRequest.current = { index: focusIndex, caret: 'end' };
        onChange(arr);
      } else if (index > 0) {
        const prev = arr[index - 1];
        arr[index - 1] = prev + currentText;
        arr.splice(index, 1);
        focusRequest.current = { index: index - 1, caret: 'end' };
        onChange(arr);
      }
    }
  }

  return (
    <ul
      role="list"
      aria-label={ariaLabel}
      className={className}
      style={{ margin: 0, paddingLeft: '20px' }}
    >
      {items.map((b, i) => (
        <li
          key={i}
          role="listitem"
          className={liClassName}
          style={itemStyle}
          onKeyDown={(e) => onKeyDown(e, i)}
        >
          <EditableText
            value={b}
            onChange={(v) => commitIndex(i, v)}
            ariaLabel={`${ariaLabel} item ${i + 1}`}
            placeholder=""
            singleLine={false}
          />
        </li>
      ))}
    </ul>
  );
}
```

Note on the implementation: the `<EditableText>` inside each `<li>` handles its own ref. To run focus management at the list level we capture each item via the `onKeyDown` of the `<li>`, which receives the actual editable element as `e.currentTarget` through event bubbling (`role="textbox"` on the `<span>` inside). Since we don't have direct refs to the inner span, this version sets focus via the `<li>`'s descendant lookup in a follow-up — keep the simple version that works for our tests:

Actually, simplify by replacing `itemRefs.current[req.index]` with a query inside the corresponding `<li>`. Update the focus block:

```tsx
useLayoutEffect(() => {
  const req = focusRequest.current;
  if (!req) return;
  focusRequest.current = null;
  const liNodes = document.querySelectorAll(`[data-bullet-list="${ariaLabel}"] > li`);
  const li = liNodes[req.index] as HTMLElement | undefined;
  if (!li) return;
  const target = li.querySelector('[role="textbox"]') as HTMLElement | null;
  if (!target) return;
  target.focus();
  const sel = window.getSelection();
  const range = document.createRange();
  if (req.caret === 'start') {
    range.setStart(target, 0);
  } else {
    range.selectNodeContents(target);
    range.collapse(false);
  }
  sel?.removeAllRanges();
  sel?.addRange(range);
});
```

And add `data-bullet-list={ariaLabel}` on the `<ul>`. This avoids the `itemRefs` machinery and works in jsdom.

The final `<ul>` becomes:

```tsx
<ul
  role="list"
  aria-label={ariaLabel}
  data-bullet-list={ariaLabel}
  className={className}
  style={{ margin: 0, paddingLeft: '20px' }}
>
```

Remove the unused `itemRefs` declaration.

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/unit/EditableBulletList.test.tsx`
Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/editable/EditableBulletList.tsx tests/unit/EditableBulletList.test.tsx
git commit -m "feat(editor): EditableBulletList with Enter to split, Backspace to merge"
```

---

## Task 3: `AssetPickerProvider` context

**Files:**
- Create: `src/components/editor/AssetPickerProvider.tsx`
- Modify: `src/components/editor/EditorShell.tsx`

- [ ] **Step 1: Create the provider**

Create `src/components/editor/AssetPickerProvider.tsx`:

```tsx
'use client';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AssetPicker } from './AssetPicker';

interface PendingPick {
  value: string;
  altText?: string;
  onSelect: (url: string) => void;
}

interface AssetPickerContextValue {
  openAssetPicker: (args: { value?: string; altText?: string; onSelect: (url: string) => void }) => void;
}

const AssetPickerContext = createContext<AssetPickerContextValue | null>(null);

export function useAssetPicker(): AssetPickerContextValue {
  const ctx = useContext(AssetPickerContext);
  if (!ctx) throw new Error('useAssetPicker must be used within AssetPickerProvider');
  return ctx;
}

interface ProviderProps {
  workspaceSlug: string;
  children: React.ReactNode;
}

export function AssetPickerProvider({ workspaceSlug, children }: ProviderProps) {
  const [pending, setPending] = useState<PendingPick | null>(null);
  const pendingRef = useRef<PendingPick | null>(null);

  const openAssetPicker = useCallback<AssetPickerContextValue['openAssetPicker']>((args) => {
    const next: PendingPick = {
      value: args.value ?? '',
      altText: args.altText,
      onSelect: args.onSelect,
    };
    pendingRef.current = next;
    setPending(next);
  }, []);

  const value = useMemo(() => ({ openAssetPicker }), [openAssetPicker]);

  return (
    <AssetPickerContext.Provider value={value}>
      {children}
      {pending && (
        <AssetPicker
          workspaceSlug={workspaceSlug}
          value={pending.value}
          altText={pending.altText}
          onClose={() => {
            pendingRef.current = null;
            setPending(null);
          }}
          onSelect={(url) => {
            const cb = pendingRef.current?.onSelect;
            pendingRef.current = null;
            setPending(null);
            cb?.(url);
          }}
        />
      )}
    </AssetPickerContext.Provider>
  );
}
```

- [ ] **Step 2: Mount the provider in `EditorShell.tsx`**

Replace the `Inner` function body so it wraps everything in `<AssetPickerProvider>`:

```tsx
import { AssetPickerProvider } from './AssetPickerProvider';

// ... existing imports unchanged

function Inner({
  workspaceSlug,
  currentWorkspace,
  workspaces,
}: {
  workspaceSlug: string;
  currentWorkspace: WorkspaceOption;
  workspaces: WorkspaceOption[];
}) {
  const role = useRole();
  const canEdit = role !== 'viewer';
  useAutosave(canEdit);
  useUndoRedoShortcuts(canEdit);
  return (
    <AssetPickerProvider workspaceSlug={workspaceSlug}>
      <div className="flex flex-col h-dvh">
        <Topbar slug={workspaceSlug} currentWorkspace={currentWorkspace} workspaces={workspaces} />
        <div className="flex flex-1 overflow-hidden">
          <LeftPanel />
          <div className="flex-1 bg-[#080808]"><Preview /></div>
        </div>
      </div>
    </AssetPickerProvider>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/AssetPickerProvider.tsx src/components/editor/EditorShell.tsx
git commit -m "feat(editor): AssetPickerProvider context with singleton picker modal"
```

---

## Task 4: `EditableImage` primitive

**Files:**
- Create: `src/components/editor/editable/EditableImage.tsx`
- Test: `tests/unit/EditableImage.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/EditableImage.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditableImage } from '@/components/editor/editable/EditableImage';
import { AssetPickerProvider } from '@/components/editor/AssetPickerProvider';

vi.mock('@/components/editor/AssetPicker', () => ({
  AssetPicker: ({ onSelect, onClose }: { onSelect: (url: string) => void; onClose: () => void }) => (
    <div role="dialog" aria-label="Mock asset picker">
      <button type="button" onClick={() => onSelect('https://example.com/new.png')}>pick</button>
      <button type="button" onClick={onClose}>close</button>
    </div>
  ),
}));

function renderWithProvider(ui: React.ReactNode) {
  return render(<AssetPickerProvider workspaceSlug="ws">{ui}</AssetPickerProvider>);
}

describe('EditableImage', () => {
  it('renders an <img> when value is set', () => {
    renderWithProvider(
      <EditableImage
        value="https://example.com/a.png"
        onChange={() => {}}
        alt="Logo"
        placeholderLabel="Logo"
      />,
    );
    const img = screen.getByRole('img', { name: 'Logo' });
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('src')).toBe('https://example.com/a.png');
  });

  it('renders a clickable placeholder when value is empty', () => {
    renderWithProvider(
      <EditableImage
        value=""
        onChange={() => {}}
        alt=""
        placeholderLabel="Logo image - click to add"
      />,
    );
    const placeholder = screen.getByRole('button', { name: /Logo image/i });
    expect(placeholder).toBeInTheDocument();
  });

  it('opens the asset picker on click and commits the selected url', async () => {
    const onChange = vi.fn();
    renderWithProvider(
      <EditableImage
        value=""
        onChange={onChange}
        alt=""
        placeholderLabel="Logo image - click to add"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Logo image/i }));
    expect(screen.getByRole('dialog', { name: 'Mock asset picker' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'pick' }));
    expect(onChange).toHaveBeenCalledWith('https://example.com/new.png');
  });

  it('clicking an already-set image opens the picker too', () => {
    const onChange = vi.fn();
    renderWithProvider(
      <EditableImage
        value="https://example.com/a.png"
        onChange={onChange}
        alt="Logo"
        placeholderLabel="Logo"
      />,
    );
    fireEvent.click(screen.getByRole('img', { name: 'Logo' }));
    expect(screen.getByRole('dialog', { name: 'Mock asset picker' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests, expect failure**

Run: `npm test -- tests/unit/EditableImage.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/components/editor/editable/EditableImage.tsx`:

```tsx
'use client';
import { useAssetPicker } from '../AssetPickerProvider';

export interface EditableImageProps {
  value: string;
  onChange: (next: string) => void;
  alt: string;
  placeholderLabel: string;
  placeholderWidth?: number;
  placeholderHeight?: number;
  imgStyle?: React.CSSProperties;
}

export function EditableImage({
  value,
  onChange,
  alt,
  placeholderLabel,
  placeholderWidth,
  placeholderHeight,
  imgStyle,
}: EditableImageProps) {
  const { openAssetPicker } = useAssetPicker();

  function open() {
    openAssetPicker({
      value,
      altText: alt,
      onSelect: (url) => onChange(url),
    });
  }

  if (value) {
    return (
      <img
        src={value}
        alt={alt}
        onClick={open}
        className="inline-editable-image"
        style={{ cursor: 'pointer', ...imgStyle }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={open}
      aria-label={placeholderLabel}
      className="inline-editable-image-placeholder"
      style={{
        width: '100%',
        maxWidth: placeholderWidth ?? 355,
        aspectRatio: placeholderWidth && placeholderHeight
          ? `${placeholderWidth} / ${placeholderHeight}`
          : '4/3',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#eaeaea',
        color: '#888',
        border: '1px dashed #bbb',
        fontSize: 12,
        cursor: 'pointer',
        padding: 0,
      }}
    >
      {placeholderLabel}
    </button>
  );
}
```

Add image hover styles to `src/app/globals.css` (append):

```css
.inline-editable-image {
  outline: 1px solid transparent;
  outline-offset: 2px;
  transition: outline-color 100ms ease-out;
}
.inline-editable-image:hover {
  outline-color: color-mix(in oklab, var(--brand, #6366f1) 40%, transparent);
}
.inline-editable-image-placeholder:hover {
  border-color: var(--brand, #6366f1) !important;
  color: var(--brand, #6366f1) !important;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/unit/EditableImage.test.tsx`
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/editable/EditableImage.tsx tests/unit/EditableImage.test.tsx src/app/globals.css
git commit -m "feat(editor): EditableImage primitive opening the singleton asset picker"
```

---

## Task 5: Drop the iframe in `Preview`

**Files:**
- Modify: `src/components/editor/Preview.tsx`

- [ ] **Step 1: Replace the file**

Replace `src/components/editor/Preview.tsx` with:

```tsx
'use client';
import { PreviewBody } from './PreviewBody';

export function Preview() {
  return (
    <div className="w-full h-full overflow-auto bg-white">
      <PreviewBody />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + run full test suite**

Run: `npm run typecheck && npm test`
Expected: clean typecheck, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/Preview.tsx
git commit -m "refactor(editor): drop iframe wrapper, render PreviewBody directly"
```

---

## Task 6: Rewire `PreviewBody` to use the editable primitives

**Files:**
- Modify: `src/components/editor/PreviewBody.tsx`

- [ ] **Step 1: Replace the file**

Replace `src/components/editor/PreviewBody.tsx` with:

```tsx
'use client';
import { useEditor, useEditorStore } from '@/lib/editor/StoreProvider';
import { Facebook, Linkedin, Twitter, Youtube, Instagram } from 'lucide-react';
import type { SocialPlatform } from '@/lib/editor/types';
import { EditableText } from './editable/EditableText';
import { EditableBulletList } from './editable/EditableBulletList';
import { EditableImage } from './editable/EditableImage';

const ICONS: Record<SocialPlatform, React.ComponentType<{ size?: number; color?: string }>> = {
  facebook: Facebook, linkedin: Linkedin, twitter: Twitter, youtube: Youtube, instagram: Instagram,
};

export function PreviewBody() {
  const data = useEditor((s) => s.data);
  const store = useEditorStore();
  const g = data.global;
  const setHeader = store.getState().setHeader;
  const setFooter = store.getState().setFooter;
  const setSection = store.getState().setSection;

  return (
    <div style={{ background: g.backgroundColor, padding: 0, minHeight: '100%', fontFamily: g.fontFamily }}>
      {/* Header */}
      <div style={{ maxWidth: 710, margin: '0 auto', padding: '20px' }}>
        <div style={{ textAlign: 'center' }}>
          <EditableImage
            value={data.header.logoSrc}
            onChange={(v) => setHeader({ logoSrc: v })}
            alt={data.header.logoAlt}
            placeholderLabel="Logo image - click to add"
            placeholderWidth={data.header.logoWidth}
            imgStyle={{ maxWidth: data.header.logoWidth, width: '100%' }}
          />
        </div>
        <h1 style={{ textAlign: 'center', fontSize: data.header.titleFontSize, color: g.textColor, fontWeight: 400, margin: '20px 0' }}>
          <EditableText
            value={data.header.title}
            onChange={(v) => setHeader({ title: v })}
            singleLine
            placeholder="Click to add a title"
            ariaLabel="Header title"
          />
        </h1>
        <div style={{ textAlign: 'center' }}>
          <EditableImage
            value={data.header.bannerSrc}
            onChange={(v) => setHeader({ bannerSrc: v })}
            alt={data.header.bannerAlt}
            placeholderLabel="Header banner - click to add"
            imgStyle={{ width: '100%' }}
          />
        </div>
        <h3 style={{ textAlign: 'center', fontSize: data.header.sectionHeadingFontSize, color: g.textColor, fontWeight: 400, margin: '12px 0' }}>
          <EditableText
            value={data.header.sectionHeading}
            onChange={(v) => setHeader({ sectionHeading: v })}
            singleLine
            placeholder="Click to add a section heading"
            ariaLabel="Section heading"
          />
        </h3>
      </div>

      {/* Sections */}
      {data.sections.map((s, idx) => {
        const reverse = idx % 2 === 1;
        const titleSize = s.titleFontSize ?? g.headingFontSize;
        const bulletSize = s.bulletFontSize ?? g.baseFontSize;
        const textColor = s.textColor ?? g.textColor;
        const buttonColor = s.buttonColor ?? g.buttonColor;
        const bg = s.backgroundColor;

        const ImageCol = (
          <div style={{ width: '50%', padding: 20, verticalAlign: 'middle', display: 'inline-block' }}>
            <EditableImage
              value={s.imageSrc}
              onChange={(v) => setSection(s.id, { imageSrc: v })}
              alt={s.imageAlt}
              placeholderLabel="Section image - click to add"
              imgStyle={{ maxWidth: 355, width: '100%' }}
            />
          </div>
        );
        const TextCol = (
          <div style={{ width: '50%', padding: 20, verticalAlign: 'middle', display: 'inline-block' }}>
            <h1 style={{ fontSize: titleSize, color: textColor, fontWeight: 700, margin: 0 }}>
              <EditableText
                value={s.title}
                onChange={(v) => setSection(s.id, { title: v })}
                singleLine
                placeholder="Click to add a section title"
                ariaLabel={`Section ${idx + 1} title`}
              />
            </h1>
            <EditableBulletList
              bullets={s.bullets}
              onChange={(next) => setSection(s.id, { bullets: next })}
              ariaLabel={`Section ${idx + 1} bullets`}
              itemStyle={{ fontSize: bulletSize, color: textColor, lineHeight: '150%' }}
            />
            <a
              href={s.ctaUrl ?? g.contactUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.preventDefault()}
              style={{
                display: 'inline-block', background: buttonColor, color: g.buttonTextColor,
                padding: '10px 30px', borderRadius: 10, fontWeight: 700, fontSize: 16, textDecoration: 'none',
              }}
            >
              <EditableText
                value={s.ctaText}
                onChange={(v) => setSection(s.id, { ctaText: v })}
                singleLine
                placeholder="Click to add CTA text"
                ariaLabel={`Section ${idx + 1} CTA text`}
                style={{ color: g.buttonTextColor }}
              />
            </a>
          </div>
        );

        return (
          <div key={s.id} style={{ background: bg, maxWidth: 710, margin: '0 auto', whiteSpace: 'nowrap' }}>
            {reverse ? <>{TextCol}{ImageCol}</> : <>{ImageCol}{TextCol}</>}
          </div>
        );
      })}

      {/* Footer */}
      <div style={{
        background: data.footer.backgroundColor ?? g.footerBackgroundColor,
        color: data.footer.textColor ?? g.footerTextColor,
        textAlign: 'center', padding: '20px',
      }}>
        <EditableImage
          value={data.footer.bannerSrc}
          onChange={(v) => setFooter({ bannerSrc: v })}
          alt={data.footer.bannerAlt}
          placeholderLabel="Footer banner - click to add"
          placeholderWidth={710}
          imgStyle={{ maxWidth: 710, width: '100%' }}
        />
        <p style={{ fontWeight: 700, margin: '12px 0 0' }}>
          <EditableText
            value={data.footer.companyName}
            onChange={(v) => setFooter({ companyName: v })}
            singleLine
            placeholder="Click to add company name"
            ariaLabel="Footer company name"
          />
        </p>
        <p style={{ whiteSpace: 'pre-line', margin: 0 }}>
          <EditableText
            value={data.footer.address}
            onChange={(v) => setFooter({ address: v })}
            placeholder="Click to add address (multiple lines allowed)"
            ariaLabel="Footer address"
          />
        </p>
        <p style={{ marginTop: 12 }}>
          Tel:{' '}
          <a href={`tel:${data.footer.phoneTel}`} onClick={(e) => e.preventDefault()} style={{ color: g.accentColor, textDecoration: 'none' }}>
            <EditableText
              value={data.footer.phone}
              onChange={(v) => setFooter({ phone: v })}
              singleLine
              placeholder="Click to add phone"
              ariaLabel="Footer phone"
              style={{ color: g.accentColor }}
            />
          </a>
          <br />
          Email:{' '}
          <a href={`mailto:${data.footer.email}`} onClick={(e) => e.preventDefault()} style={{ color: g.accentColor, textDecoration: 'none' }}>
            <EditableText
              value={data.footer.email}
              onChange={(v) => setFooter({ email: v })}
              singleLine
              placeholder="Click to add email"
              ariaLabel="Footer email"
              style={{ color: g.accentColor }}
            />
          </a>
          <br />
          {data.footer.websites.map((w, i) => (
            <span key={i}>
              {i > 0 ? ' · ' : ''}
              <a href={w.url} onClick={(e) => e.preventDefault()} style={{ color: g.accentColor, textDecoration: 'none' }}>
                <EditableText
                  value={w.label}
                  onChange={(v) => {
                    const next = data.footer.websites.slice();
                    next[i] = { ...next[i], label: v };
                    setFooter({ websites: next });
                  }}
                  singleLine
                  placeholder="Website label"
                  ariaLabel={`Website ${i + 1} label`}
                  style={{ color: g.accentColor }}
                />
              </a>
            </span>
          ))}
        </p>
        <div style={{ marginTop: 16 }}>
          {data.footer.socials.map((s, i) => {
            const Icon = ICONS[s.platform];
            return (
              <a key={i} href={s.url} target="_blank" rel="noreferrer" style={{ margin: '0 10px', display: 'inline-block' }}>
                <Icon size={32} color={g.footerTextColor} />
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

Note: the inline anchor `onClick={(e) => e.preventDefault()}` prevents the canvas link from navigating away when the user clicks the text inside (the user is editing, not navigating). The exported HTML still has working anchors because `renderEmail` is unchanged.

- [ ] **Step 2: Typecheck and full test suite**

Run: `npm run typecheck && npm test`
Expected: clean typecheck, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/PreviewBody.tsx
git commit -m "feat(editor): wire EditableText/BulletList/Image into the canvas"
```

---

## Task 7: Manual verification

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`. Open a project in the editor.

- [ ] **Step 2: Verify hover and click-to-edit on every text field**

- Hover the header title: thin brand outline appears, cursor becomes I-beam. Click: outline becomes solid. Type to edit.
- Hover the section heading, section title, each bullet, the CTA text, the footer company name, address, phone, email, website labels — same affordance for each.
- Press Enter on a single-line field (e.g. section title): the value commits, focus blurs. Confirm via the sidebar.
- Press Escape on a field while editing: the value reverts. Sidebar still shows the old value.

- [ ] **Step 3: Verify bullets**

- Click into a bullet, press Enter: a new bullet appears below; cursor lands at its start.
- Press Backspace at the start of an empty bullet: it disappears and the cursor jumps to the end of the previous bullet.
- Press Backspace at the start of a non-empty bullet: the two bullets merge.

- [ ] **Step 4: Verify image editing**

- Click the header logo: the asset picker modal opens. Pick or upload an image. Modal closes, the canvas updates.
- Click an empty image placeholder: same flow, picker opens.
- Click the footer banner: picker opens for that field.

- [ ] **Step 5: Verify sidebar ↔ canvas sync**

- Edit a section title via the sidebar; the canvas updates immediately.
- Edit the same field via the canvas; the sidebar input updates immediately.

- [ ] **Step 6: Verify autosave and persistence**

- Edit a field via the canvas. Wait ~2 seconds. Sidebar saving indicator should show "Saved".
- Reload the page. The edit persists.

- [ ] **Step 7: Verify undo/redo**

- Edit a field via the canvas. Press Ctrl/Cmd+Z. The edit is undone in both the canvas and the sidebar.
- Press Ctrl/Cmd+Shift+Z. The edit is redone.

- [ ] **Step 8: Verify paste sanitization**

- Copy formatted text from another web page or a Word document.
- Paste into a canvas text field. Only the plain text appears — no HTML tags, no styling.

- [ ] **Step 9: Verify export still works**

- Open the Download menu and download the HTML (for email). Open the file: the email renders identically to the canvas. All your inline edits are present.
- Open the print preview. Same content, same colors, same structure.
