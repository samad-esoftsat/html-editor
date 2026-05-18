# In-Canvas Editing v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a topbar View/Edit toggle, inline alt-text captions under images, and an `EditableLink` popover for URLs (CTA, websites, socials, phone).

**Architecture:** New `EditorModeProvider` exposes `{ mode, setMode }`. Existing editable primitives consult mode and degrade to plain DOM in `preview`. New `EditableLink` primitive renders a chain-link icon with a click-to-edit popover. `EditableImage` gains an optional alt caption strip.

**Tech Stack:** Next.js 15, React 19, TypeScript, Zustand store, Tailwind v4, Vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-05-18-in-canvas-editing-v2-design.md`

---

### Task 1: EditorModeProvider context

**Files:**
- Create: `src/components/editor/EditorModeProvider.tsx`
- Modify: `src/components/editor/EditorShell.tsx`
- Test: `tests/unit/EditorModeProvider.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/EditorModeProvider.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EditorModeProvider, useEditorMode } from '@/components/editor/EditorModeProvider';

function Probe() {
  const { mode, setMode } = useEditorMode();
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <button onClick={() => setMode('preview')}>preview</button>
      <button onClick={() => setMode('edit')}>edit</button>
    </div>
  );
}

describe('EditorModeProvider', () => {
  it('defaults to edit mode', () => {
    render(<EditorModeProvider><Probe /></EditorModeProvider>);
    expect(screen.getByTestId('mode').textContent).toBe('edit');
  });

  it('switches mode when setMode is called', async () => {
    const { getByText, getByTestId } = render(
      <EditorModeProvider><Probe /></EditorModeProvider>
    );
    getByText('preview').click();
    expect(getByTestId('mode').textContent).toBe('preview');
    getByText('edit').click();
    expect(getByTestId('mode').textContent).toBe('edit');
  });

  it('useEditorMode throws when used outside provider', () => {
    const orig = console.error;
    console.error = () => {};
    try {
      expect(() => render(<Probe />)).toThrow();
    } finally {
      console.error = orig;
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run EditorModeProvider`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement EditorModeProvider**

```tsx
// src/components/editor/EditorModeProvider.tsx
'use client';
import { createContext, useContext, useState, type ReactNode } from 'react';

export type EditorMode = 'edit' | 'preview';

interface EditorModeContextValue {
  mode: EditorMode;
  setMode: (mode: EditorMode) => void;
}

const EditorModeContext = createContext<EditorModeContextValue | null>(null);

export function EditorModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<EditorMode>('edit');
  return (
    <EditorModeContext.Provider value={{ mode, setMode }}>
      {children}
    </EditorModeContext.Provider>
  );
}

export function useEditorMode(): EditorModeContextValue {
  const ctx = useContext(EditorModeContext);
  if (!ctx) throw new Error('useEditorMode must be used inside EditorModeProvider');
  return ctx;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run EditorModeProvider`
Expected: PASS (3 tests).

- [ ] **Step 5: Mount provider in EditorShell**

In `src/components/editor/EditorShell.tsx`, wrap the existing `AssetPickerProvider` block with `EditorModeProvider`:

```tsx
import { EditorModeProvider } from './EditorModeProvider';
// ...
return (
  <EditorModeProvider>
    <AssetPickerProvider workspaceSlug={workspaceSlug}>
      <div className="flex flex-col h-dvh">
        {/* unchanged */}
      </div>
    </AssetPickerProvider>
  </EditorModeProvider>
);
```

- [ ] **Step 6: Run typecheck + tests**

Run: `npm run typecheck && npm test -- --run`
Expected: clean, all green.

- [ ] **Step 7: Commit**

```bash
git add src/components/editor/EditorModeProvider.tsx src/components/editor/EditorShell.tsx tests/unit/EditorModeProvider.test.tsx
git commit -m "feat(editor): EditorModeProvider for edit/preview mode state"
```

---

### Task 2: Mode-aware primitives — text, bullets, image

**Files:**
- Modify: `src/components/editor/editable/EditableText.tsx`
- Modify: `src/components/editor/editable/EditableBulletList.tsx`
- Modify: `src/components/editor/editable/EditableImage.tsx`
- Modify: `tests/unit/EditableText.test.tsx`
- Modify: `tests/unit/EditableBulletList.test.tsx`
- Modify: `tests/unit/EditableImage.test.tsx`

- [ ] **Step 1: Add preview-mode tests to each primitive**

Append to `tests/unit/EditableText.test.tsx`:

```tsx
import { EditorModeProvider, useEditorMode } from '@/components/editor/EditorModeProvider';

function PreviewWrap({ children }: { children: React.ReactNode }) {
  return (
    <EditorModeProvider>
      <ForcePreview />
      {children}
    </EditorModeProvider>
  );
}
function ForcePreview() {
  const { setMode } = useEditorMode();
  React.useEffect(() => { setMode('preview'); }, [setMode]);
  return null;
}

describe('EditableText in preview mode', () => {
  it('renders plain text without contentEditable', () => {
    render(
      <PreviewWrap>
        <EditableText value="Hello" onChange={() => {}} ariaLabel="t" />
      </PreviewWrap>
    );
    const el = screen.getByText('Hello');
    expect(el.getAttribute('contenteditable')).toBeNull();
    expect(el.className).not.toContain('inline-editable');
  });
});
```

Append analogous tests to `tests/unit/EditableBulletList.test.tsx` (verifies `role="textbox"` absent, no keyboard handlers fire) and `tests/unit/EditableImage.test.tsx` (verifies `<img>` has no `onClick`, no `inline-editable-image` class; empty value renders nothing).

- [ ] **Step 2: Make EditableText mode-aware**

Add at the top of the component body, after `useRef`s but before effects:

```tsx
import { useEditorMode } from '../EditorModeProvider';
// ...
const { mode } = useEditorMode();
// ...
if (mode === 'preview') {
  const Tag = (as ?? 'span') as React.ElementType;
  return <Tag className={className} style={style}>{value}</Tag>;
}
```

- [ ] **Step 3: Make EditableBulletList mode-aware**

```tsx
import { useEditorMode } from '../EditorModeProvider';
// ...
const { mode } = useEditorMode();
if (mode === 'preview') {
  return (
    <ul role="list" aria-label={ariaLabel} className={className} style={{ margin: '1em 0', paddingLeft: 40 }}>
      {items.map((b, i) => (
        <li key={i} className={liClassName} style={itemStyle}>{b}</li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Make EditableImage mode-aware**

```tsx
import { useEditorMode } from '../AssetPickerProvider'; // wrong path
```

Use the correct path:

```tsx
import { useEditorMode } from '../EditorModeProvider';
// ...
const { mode } = useEditorMode();
if (mode === 'preview') {
  if (!value) return null;
  return <img src={value} alt={alt} style={imgStyle} />;
}
```

(Plain `<img>` with no `inline-editable-image` class, no onClick, no cursor.)

- [ ] **Step 5: Run tests and typecheck**

Run: `npm run typecheck && npm test -- --run`
Expected: all green, including new preview-mode tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/editor/editable/ tests/unit/EditableText.test.tsx tests/unit/EditableBulletList.test.tsx tests/unit/EditableImage.test.tsx
git commit -m "feat(editor): editable primitives become plain DOM in preview mode"
```

---

### Task 3: Topbar segmented control + mode-aware anchor handlers

**Files:**
- Modify: `src/components/editor/Topbar.tsx`
- Modify: `src/components/editor/PreviewBody.tsx`

- [ ] **Step 1: Add segmented control to Topbar**

Inside the right-side `ml-auto` flex container, before the `canEdit && (...)` undo block, insert:

```tsx
{canEdit && <ModeToggle />}
```

And add the component at the bottom of `Topbar.tsx`:

```tsx
function ModeToggle() {
  const { mode, setMode } = useEditorMode();
  const baseBtn = 'px-2.5 py-1 text-xs transition-colors';
  return (
    <div className="inline-flex items-center rounded-md border border-border-strong overflow-hidden">
      <button
        type="button"
        aria-pressed={mode === 'edit'}
        onClick={() => setMode('edit')}
        className={`${baseBtn} ${mode === 'edit' ? 'bg-brand text-white' : 'text-fg hover:bg-panel'}`}
      >
        Edit
      </button>
      <button
        type="button"
        aria-pressed={mode === 'preview'}
        onClick={() => setMode('preview')}
        className={`${baseBtn} ${mode === 'preview' ? 'bg-brand text-white' : 'text-fg hover:bg-panel'}`}
      >
        Preview
      </button>
    </div>
  );
}
```

Add import at the top:

```tsx
import { useEditorMode } from './EditorModeProvider';
```

- [ ] **Step 2: Make PreviewBody anchors mode-aware**

In `PreviewBody.tsx`, read mode once:

```tsx
import { useEditorMode } from './EditorModeProvider';
// ...
const { mode } = useEditorMode();
const blockNav = mode === 'edit' ? (e: React.MouseEvent) => e.preventDefault() : undefined;
```

Then replace every `onClick={(e) => e.preventDefault()}` on an anchor with `onClick={blockNav}`. Five anchors total: CTA, tel, mailto, website label, social icon.

- [ ] **Step 3: Run typecheck + tests**

Run: `npm run typecheck && npm test -- --run`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/Topbar.tsx src/components/editor/PreviewBody.tsx
git commit -m "feat(editor): topbar Edit/Preview toggle and mode-aware anchors"
```

---

### Task 4: EditableLink primitive with popover

**Files:**
- Create: `src/components/editor/editable/EditableLink.tsx`
- Create: `tests/unit/EditableLink.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/EditableLink.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { EditableLink } from '@/components/editor/editable/EditableLink';
import { EditorModeProvider, useEditorMode } from '@/components/editor/EditorModeProvider';

function ForcePreview() {
  const { setMode } = useEditorMode();
  React.useEffect(() => { setMode('preview'); }, [setMode]);
  return null;
}

describe('EditableLink', () => {
  it('renders an icon button in edit mode', () => {
    render(<EditorModeProvider><EditableLink value="https://x.com" onChange={() => {}} ariaLabel="Edit link" /></EditorModeProvider>);
    expect(screen.getByLabelText('Edit link')).toBeTruthy();
  });

  it('opens a popover with the current value when clicked', () => {
    render(<EditorModeProvider><EditableLink value="https://x.com" onChange={() => {}} ariaLabel="Edit link" /></EditorModeProvider>);
    fireEvent.click(screen.getByLabelText('Edit link'));
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('https://x.com');
  });

  it('Enter commits the new value and closes the popover', () => {
    const onChange = vi.fn();
    render(<EditorModeProvider><EditableLink value="https://x.com" onChange={onChange} ariaLabel="Edit link" /></EditorModeProvider>);
    fireEvent.click(screen.getByLabelText('Edit link'));
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'https://y.com' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('https://y.com');
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('Escape closes without saving', () => {
    const onChange = vi.fn();
    render(<EditorModeProvider><EditableLink value="https://x.com" onChange={onChange} ariaLabel="Edit link" /></EditorModeProvider>);
    fireEvent.click(screen.getByLabelText('Edit link'));
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'https://nope.com' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('Save button commits', () => {
    const onChange = vi.fn();
    render(<EditorModeProvider><EditableLink value="https://x.com" onChange={onChange} ariaLabel="Edit link" /></EditorModeProvider>);
    fireEvent.click(screen.getByLabelText('Edit link'));
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'https://y.com' } });
    fireEvent.click(screen.getByText('Save'));
    expect(onChange).toHaveBeenCalledWith('https://y.com');
  });

  it('renders nothing in preview mode', () => {
    const { container } = render(
      <EditorModeProvider>
        <ForcePreview />
        <EditableLink value="https://x.com" onChange={() => {}} ariaLabel="Edit link" />
      </EditorModeProvider>
    );
    expect(container.querySelector('button[aria-label="Edit link"]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run EditableLink`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement EditableLink**

```tsx
// src/components/editor/editable/EditableLink.tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { Link as LinkIcon } from 'lucide-react';
import { useEditorMode } from '../EditorModeProvider';

export interface EditableLinkProps {
  value: string;
  onChange: (next: string) => void;
  ariaLabel: string;
  alwaysVisible?: boolean;
  className?: string;
}

export function EditableLink({
  value,
  onChange,
  ariaLabel,
  alwaysVisible,
  className,
}: EditableLinkProps) {
  const { mode } = useEditorMode();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const rootRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (rootRef.current.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  if (mode === 'preview') return null;

  function openPopover(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDraft(value);
    setOpen(true);
  }

  function save() {
    onChange(draft);
    setOpen(false);
  }

  function cancel() {
    setOpen(false);
  }

  const visibilityClass = alwaysVisible ? 'opacity-100' : 'editable-link-icon';

  return (
    <span ref={rootRef} className={`relative inline-flex items-center ${className ?? ''}`}>
      <button
        type="button"
        onClick={openPopover}
        aria-label={ariaLabel}
        className={`${visibilityClass} inline-flex items-center justify-center rounded p-0.5 text-muted hover:text-brand hover:bg-panel`}
      >
        <LinkIcon size={14} />
      </button>
      {open && (
        <span className="absolute z-50 left-0 top-full mt-1 inline-flex items-center gap-2 rounded-md border border-border-strong bg-panel-2 p-2 shadow-lg whitespace-nowrap">
          <input
            type="text"
            role="textbox"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); save(); }
              if (e.key === 'Escape') { e.preventDefault(); cancel(); }
            }}
            className="rounded border border-border-strong bg-panel px-2 py-1 text-xs text-fg outline-none focus:border-brand"
            placeholder="https://"
          />
          <button type="button" onClick={save} className="rounded bg-brand px-2 py-1 text-xs text-white">Save</button>
          <button type="button" onClick={cancel} className="rounded border border-border-strong px-2 py-1 text-xs text-fg">Cancel</button>
        </span>
      )}
    </span>
  );
}
```

- [ ] **Step 4: Add CSS for hover-visibility of the icon**

Append to `src/app/globals.css`:

```css
.editable-link-icon {
  opacity: 0;
  transition: opacity 100ms;
}
.inline-link-wrap:hover .editable-link-icon,
.inline-link-wrap:focus-within .editable-link-icon,
.editable-link-icon:focus-visible {
  opacity: 1;
}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npm run typecheck && npm test -- --run EditableLink`
Expected: 6 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/editor/editable/EditableLink.tsx tests/unit/EditableLink.test.tsx src/app/globals.css
git commit -m "feat(editor): EditableLink primitive with click-to-edit URL popover"
```

---

### Task 5: Alt caption strip on EditableImage

**Files:**
- Modify: `src/components/editor/editable/EditableImage.tsx`
- Modify: `tests/unit/EditableImage.test.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add tests for alt strip behavior**

Append to `tests/unit/EditableImage.test.tsx`:

```tsx
describe('EditableImage alt caption', () => {
  it('renders no alt strip when onAltChange is not provided', () => {
    render(<EditorModeProvider><EditableImage value="x.png" onChange={() => {}} alt="hello" placeholderLabel="ph" /></EditorModeProvider>);
    expect(screen.queryByLabelText(/alt text/i)).toBeNull();
  });

  it('renders an editable alt strip when onAltChange is provided', () => {
    const onAltChange = vi.fn();
    render(
      <EditorModeProvider>
        <EditableImage
          value="x.png"
          onChange={() => {}}
          alt="hello"
          placeholderLabel="ph"
          altLabel="Section image alt text"
          onAltChange={onAltChange}
        />
      </EditorModeProvider>
    );
    const strip = screen.getByLabelText('Section image alt text');
    expect(strip.textContent).toBe('hello');
  });

  it('does not render alt strip in preview mode', () => {
    function ForcePreview() {
      const { setMode } = useEditorMode();
      React.useEffect(() => { setMode('preview'); }, [setMode]);
      return null;
    }
    render(
      <EditorModeProvider>
        <ForcePreview />
        <EditableImage
          value="x.png"
          onChange={() => {}}
          alt="hello"
          placeholderLabel="ph"
          altLabel="Section image alt text"
          onAltChange={() => {}}
        />
      </EditorModeProvider>
    );
    expect(screen.queryByLabelText('Section image alt text')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run EditableImage`
Expected: FAIL — new props not yet supported.

- [ ] **Step 3: Update EditableImage**

Add to props:

```ts
altLabel?: string;
onAltChange?: (next: string) => void;
```

Update the value-set return to wrap when `onAltChange` is provided:

```tsx
import { EditableText } from './EditableText';
// ...
if (value) {
  const img = (
    <img
      src={value}
      alt={alt}
      onClick={open}
      className="inline-editable-image"
      style={{ cursor: 'pointer', ...imgStyle }}
    />
  );
  if (!onAltChange) return img;
  return (
    <span className="editable-image-wrap inline-flex flex-col items-stretch">
      {img}
      <span className="editable-image-alt block text-[12px] text-muted mt-1 px-1">
        Alt:{' '}
        <EditableText
          value={alt}
          onChange={onAltChange}
          singleLine
          placeholder="click to add"
          ariaLabel={altLabel ?? 'Image alt text'}
        />
      </span>
    </span>
  );
}
```

(Preview mode already returns the plain `<img>` early — alt strip is automatically suppressed.)

- [ ] **Step 4: Add hover-visibility CSS for the alt strip**

Append to `src/app/globals.css`:

```css
.editable-image-alt {
  opacity: 0;
  transition: opacity 100ms;
}
.editable-image-wrap:hover .editable-image-alt,
.editable-image-wrap:focus-within .editable-image-alt {
  opacity: 1;
}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npm run typecheck && npm test -- --run`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/components/editor/editable/EditableImage.tsx tests/unit/EditableImage.test.tsx src/app/globals.css
git commit -m "feat(editor): inline alt-text caption strip below images"
```

---

### Task 6: Wire alt and link controls into PreviewBody

**Files:**
- Modify: `src/components/editor/PreviewBody.tsx`

- [ ] **Step 1: Add EditableLink import**

```tsx
import { EditableLink } from './editable/EditableLink';
```

- [ ] **Step 2: Pass alt props to every EditableImage**

For each `<EditableImage>` instance, add the matching `altLabel` and `onAltChange` props:

| Image | Alt field | Setter call |
|---|---|---|
| Header logo | `header.logoAlt` | `setHeader({ logoAlt: v })` |
| Header banner | `header.bannerAlt` | `setHeader({ bannerAlt: v })` |
| Section image | `s.imageAlt` | `setSection(s.id, { imageAlt: v })` |
| Footer banner | `footer.bannerAlt` | `setFooter({ bannerAlt: v })` |

Example for the header logo:

```tsx
<EditableImage
  value={data.header.logoSrc}
  onChange={(v) => setHeader({ logoSrc: v })}
  alt={data.header.logoAlt}
  placeholderLabel="Logo image - click to add"
  placeholderWidth={data.header.logoWidth}
  imgStyle={{ maxWidth: data.header.logoWidth, width: '100%' }}
  altLabel="Header logo alt text"
  onAltChange={(v) => setHeader({ logoAlt: v })}
/>
```

- [ ] **Step 3: Wrap CTA text + chain icon**

Replace the `<EditableText value={s.ctaText} ... />` line with:

```tsx
<span className="inline-link-wrap inline-flex items-center gap-1">
  <EditableText
    value={s.ctaText}
    onChange={(v) => setSection(s.id, { ctaText: v })}
    singleLine
    placeholder="Click to add CTA text"
    ariaLabel={`Section ${idx + 1} CTA text`}
    style={{ color: g.buttonTextColor }}
  />
  <EditableLink
    value={s.ctaUrl ?? ''}
    onChange={(v) => setSection(s.id, { ctaUrl: v })}
    ariaLabel={`Edit section ${idx + 1} CTA URL`}
  />
</span>
```

- [ ] **Step 4: Wrap phone display + chain icon**

```tsx
<a href={`tel:${data.footer.phoneTel}`} onClick={blockNav} style={{ color: g.accentColor, textDecoration: 'none' }}>
  <span className="inline-link-wrap inline-flex items-center gap-1">
    <EditableText
      value={data.footer.phone}
      onChange={(v) => setFooter({ phone: v })}
      singleLine
      placeholder="Click to add phone"
      ariaLabel="Footer phone"
      style={{ color: g.accentColor }}
    />
    <EditableLink
      value={data.footer.phoneTel}
      onChange={(v) => setFooter({ phoneTel: v })}
      ariaLabel="Edit phone dial URL"
    />
  </span>
</a>
```

- [ ] **Step 5: Wrap each website label + chain icon**

```tsx
{data.footer.websites.map((w, i) => (
  <span key={i}>
    {i > 0 ? ' · ' : ''}
    <a href={w.url} onClick={blockNav} style={{ color: g.accentColor, textDecoration: 'none' }}>
      <span className="inline-link-wrap inline-flex items-center gap-1">
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
        <EditableLink
          value={w.url}
          onChange={(v) => {
            const next = data.footer.websites.slice();
            next[i] = { ...next[i], url: v };
            setFooter({ websites: next });
          }}
          ariaLabel={`Edit website ${i + 1} URL`}
        />
      </span>
    </a>
  </span>
))}
```

- [ ] **Step 6: Overlay chain icon on each social icon (always visible)**

```tsx
{data.footer.socials.map((s, i) => {
  const Icon = ICONS[s.platform];
  return (
    <span key={i} className="relative inline-block" style={{ margin: '0 10px' }}>
      <a href={s.url} onClick={blockNav} target="_blank" rel="noreferrer" style={{ display: 'inline-block' }}>
        <Icon size={32} color={g.footerTextColor} />
      </a>
      <EditableLink
        value={s.url}
        onChange={(v) => {
          const next = data.footer.socials.slice();
          next[i] = { ...next[i], url: v };
          setFooter({ socials: next });
        }}
        ariaLabel={`Edit ${s.platform} URL`}
        alwaysVisible
        className="absolute -top-2 -right-2 bg-panel-2 rounded-full border border-border-strong"
      />
    </span>
  );
})}
```

- [ ] **Step 7: Run typecheck and tests**

Run: `npm run typecheck && npm test -- --run`
Expected: 186+ tests, all green.

- [ ] **Step 8: Commit**

```bash
git add src/components/editor/PreviewBody.tsx
git commit -m "feat(editor): wire alt captions and URL popovers into the canvas"
```

---

### Task 7: Manual verification

- [ ] Run `npm run dev`, open an email project, and verify:
  - Topbar shows `[Edit | Preview]`. Toggling switches the canvas affordances on/off.
  - In Preview mode: no hover outlines, no chain icons, no alt strips. Clicking the CTA navigates.
  - In Edit mode: hovering an image fades in `Alt: …` below it; editing and blurring saves.
  - Hovering CTA text shows a chain icon; clicking opens a URL popover; Enter saves; Escape cancels.
  - Same for footer website labels and phone display.
  - Each social icon shows a small chain icon always; clicking opens its URL popover.
  - Editing in the sidebar updates the canvas; autosave + undo/redo cover all new edits.
  - Export still produces the same HTML.

- [ ] If issues are found, file them and re-run the relevant task.
