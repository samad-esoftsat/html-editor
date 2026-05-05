# Phase 2 — Editor

> Read [`SPEC.md`](./SPEC.md) for types and contracts before starting. This phase implements §10 (state), §12 (autosave), §13 (image upload).

**Phase goal:** A user opens a project, edits global styles / header / footer / product sections, sees a live preview iframe update on every keystroke, and the work autosaves. Image upload works (URL or file). End of phase = the app is genuinely usable, modulo HTML export which lands in Phase 3.

**Prereqs:** Phase 1 complete. Editor stub at `/p/[id]` shows JSON.

---

## Task 1 — Debounce util

**Files:**
- Create: `src/lib/utils/debounce.ts`
- Test: `tests/unit/debounce.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/debounce.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { debounce } from '@/lib/utils/debounce';

describe('debounce', () => {
  it('calls underlying fn once after the delay', async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d('a'); d('b'); d('c');
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(99);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith('c');
    vi.useRealTimers();
  });

  it('flush() runs immediately with last args', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d(1); d(2);
    d.flush();
    expect(fn).toHaveBeenCalledWith(2);
    vi.useRealTimers();
  });

  it('cancel() prevents pending call', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d('x');
    d.cancel();
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run — expect fail**

```powershell
npm test
```

- [ ] **Step 3: Implement `src/lib/utils/debounce.ts`**

```typescript
export interface Debounced<F extends (...args: never[]) => void> {
  (...args: Parameters<F>): void;
  flush(): void;
  cancel(): void;
  pending(): boolean;
}

export function debounce<F extends (...args: never[]) => void>(fn: F, ms: number): Debounced<F> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<F> | null = null;

  const wrapped = ((...args: Parameters<F>) => {
    lastArgs = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (lastArgs) fn(...lastArgs);
      lastArgs = null;
    }, ms);
  }) as Debounced<F>;

  wrapped.flush = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    if (lastArgs) { fn(...lastArgs); lastArgs = null; }
  };
  wrapped.cancel = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    lastArgs = null;
  };
  wrapped.pending = () => timer !== null;

  return wrapped;
}
```

- [ ] **Step 4: Run — expect pass**

```powershell
npm test
```

- [ ] **Step 5: Commit**

```powershell
git add src/lib/utils/debounce.ts tests/unit/debounce.test.ts
git commit -m "feat(util): debounce with flush, cancel, pending"
```

---

## Task 2 — Zustand store

**Files:**
- Create: `src/lib/editor/store.ts`
- Test: `tests/unit/store.test.ts`

- [ ] **Step 1: Write failing tests for the pure mutations**

`tests/unit/store.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createEditorStore } from '@/lib/editor/store';
import { createDefaultProject } from '@/lib/editor/defaultProject';

const NOW = '2026-05-05T10:00:00Z';

function freshStore() {
  return createEditorStore({
    projectId: 'p1',
    name: 'Test',
    data: createDefaultProject(),
    serverUpdatedAt: NOW,
  });
}

describe('editor store', () => {
  it('setGlobal patches global styles', () => {
    const s = freshStore();
    s.getState().setGlobal({ backgroundColor: '#ffffff' });
    expect(s.getState().data.global.backgroundColor).toBe('#ffffff');
    expect(s.getState().data.global.fontFamily).toMatch(/Arial/);
  });

  it('addSection appends a new blank section with unique id', () => {
    const s = freshStore();
    const before = s.getState().data.sections.length;
    s.getState().addSection();
    const after = s.getState().data.sections;
    expect(after.length).toBe(before + 1);
    expect(after.at(-1)!.title).toBe('New Product');
    expect(new Set(after.map(x => x.id)).size).toBe(after.length);
  });

  it('removeSection removes by id', () => {
    const s = freshStore();
    const target = s.getState().data.sections[2].id;
    s.getState().removeSection(target);
    expect(s.getState().data.sections.find(x => x.id === target)).toBeUndefined();
  });

  it('moveSection up swaps with previous', () => {
    const s = freshStore();
    const ids = s.getState().data.sections.map(x => x.id);
    s.getState().moveSection(ids[3], 'up');
    const after = s.getState().data.sections.map(x => x.id);
    expect(after[2]).toBe(ids[3]);
    expect(after[3]).toBe(ids[2]);
  });

  it('moveSection up at index 0 is a noop', () => {
    const s = freshStore();
    const ids = s.getState().data.sections.map(x => x.id);
    s.getState().moveSection(ids[0], 'up');
    expect(s.getState().data.sections.map(x => x.id)).toEqual(ids);
  });

  it('moveSection down at last index is a noop', () => {
    const s = freshStore();
    const ids = s.getState().data.sections.map(x => x.id);
    s.getState().moveSection(ids.at(-1)!, 'down');
    expect(s.getState().data.sections.map(x => x.id)).toEqual(ids);
  });

  it('setSection patches one section, leaves siblings untouched', () => {
    const s = freshStore();
    const id = s.getState().data.sections[2].id;
    const otherTitleBefore = s.getState().data.sections[3].title;
    s.getState().setSection(id, { title: 'Renamed' });
    expect(s.getState().data.sections[2].title).toBe('Renamed');
    expect(s.getState().data.sections[3].title).toBe(otherTitleBefore);
  });
});
```

- [ ] **Step 2: Run — expect fail**

```powershell
npm test
```

- [ ] **Step 3: Implement `src/lib/editor/store.ts`**

```typescript
import { createStore, type StoreApi } from 'zustand/vanilla';
import { v4 as uuid } from 'uuid';
import type { ProjectData, GlobalStyles, Header, Footer, ProductSection } from './types';

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'error';

export interface EditorState {
  projectId: string;
  name: string;
  data: ProjectData;
  serverUpdatedAt: string;
  saving: SaveStatus;
  lastError: string | null;

  setName(name: string): void;
  setGlobal(patch: Partial<GlobalStyles>): void;
  setHeader(patch: Partial<Header>): void;
  setFooter(patch: Partial<Footer>): void;
  addSection(): void;
  removeSection(id: string): void;
  moveSection(id: string, dir: 'up' | 'down'): void;
  setSection(id: string, patch: Partial<ProductSection>): void;

  markSaving(status: SaveStatus, error?: string | null): void;
  markSaved(updatedAt: string): void;
}

export type EditorStore = StoreApi<EditorState>;

interface Init {
  projectId: string;
  name: string;
  data: ProjectData;
  serverUpdatedAt: string;
}

function blankSection(): ProductSection {
  return {
    id: uuid(),
    title: 'New Product',
    bullets: ['Feature one', 'Feature two'],
    imageSrc: '',
    imageAlt: '',
    ctaText: 'Contact Us',
  };
}

export function createEditorStore(init: Init): EditorStore {
  return createStore<EditorState>((set) => ({
    projectId: init.projectId,
    name: init.name,
    data: init.data,
    serverUpdatedAt: init.serverUpdatedAt,
    saving: 'idle',
    lastError: null,

    setName: (name) => set({ name }),
    setGlobal: (patch) => set((s) => ({
      data: { ...s.data, global: { ...s.data.global, ...patch } },
    })),
    setHeader: (patch) => set((s) => ({
      data: { ...s.data, header: { ...s.data.header, ...patch } },
    })),
    setFooter: (patch) => set((s) => ({
      data: { ...s.data, footer: { ...s.data.footer, ...patch } },
    })),
    addSection: () => set((s) => ({
      data: { ...s.data, sections: [...s.data.sections, blankSection()] },
    })),
    removeSection: (id) => set((s) => ({
      data: { ...s.data, sections: s.data.sections.filter((x) => x.id !== id) },
    })),
    moveSection: (id, dir) => set((s) => {
      const arr = s.data.sections;
      const idx = arr.findIndex((x) => x.id === id);
      if (idx === -1) return s;
      const swap = dir === 'up' ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= arr.length) return s;
      const next = arr.slice();
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return { data: { ...s.data, sections: next } };
    }),
    setSection: (id, patch) => set((s) => ({
      data: {
        ...s.data,
        sections: s.data.sections.map((x) => (x.id === id ? { ...x, ...patch } : x)),
      },
    })),

    markSaving: (status, error = null) => set({ saving: status, lastError: error }),
    markSaved: (updatedAt) => set({ saving: 'idle', serverUpdatedAt: updatedAt, lastError: null }),
  }));
}
```

- [ ] **Step 4: Run — expect pass**

```powershell
npm test
```

- [ ] **Step 5: Commit**

```powershell
git add src/lib/editor/store.ts tests/unit/store.test.ts
git commit -m "feat(editor): Zustand store with mutations for global, header, footer, sections"
```

---

## Task 3 — Store Provider + selector hooks for React

**Files:**
- Create: `src/lib/editor/StoreProvider.tsx`

- [ ] **Step 1: Create `src/lib/editor/StoreProvider.tsx`**

```typescript
'use client';
import { createContext, useContext, useRef, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { createEditorStore, type EditorStore, type EditorState } from './store';
import type { ProjectData } from './types';

interface ProviderProps {
  projectId: string;
  name: string;
  data: ProjectData;
  serverUpdatedAt: string;
  children: ReactNode;
}

const Ctx = createContext<EditorStore | null>(null);

export function StoreProvider(props: ProviderProps) {
  const ref = useRef<EditorStore>();
  if (!ref.current) {
    ref.current = createEditorStore({
      projectId: props.projectId,
      name: props.name,
      data: props.data,
      serverUpdatedAt: props.serverUpdatedAt,
    });
  }
  return <Ctx.Provider value={ref.current}>{props.children}</Ctx.Provider>;
}

export function useEditor<T>(selector: (s: EditorState) => T): T {
  const store = useContext(Ctx);
  if (!store) throw new Error('useEditor must be used within StoreProvider');
  return useStore(store, selector);
}

export function useEditorStore(): EditorStore {
  const store = useContext(Ctx);
  if (!store) throw new Error('useEditorStore must be used within StoreProvider');
  return store;
}
```

- [ ] **Step 2: Commit**

```powershell
git add src/lib/editor/StoreProvider.tsx
git commit -m "feat(editor): React provider and selector hooks for editor store"
```

---

## Task 4 — Autosave hook

**Files:**
- Create: `src/lib/editor/autosave.ts`

- [ ] **Step 1: Create `src/lib/editor/autosave.ts`**

```typescript
'use client';
import { useEffect, useRef } from 'react';
import { useEditorStore } from './StoreProvider';
import { patchProject } from '@/lib/api/projects';
import { debounce } from '@/lib/utils/debounce';

const DEBOUNCE_MS = 800;

export function useAutosave() {
  const store = useEditorStore();
  const initialised = useRef(false);
  const debouncedRef = useRef<ReturnType<typeof debounce> | null>(null);

  useEffect(() => {
    const save = async () => {
      const { projectId, name, data, serverUpdatedAt } = store.getState();
      store.getState().markSaving('saving');
      try {
        const res = await patchProject(projectId, { name, data }, serverUpdatedAt);
        store.getState().markSaved(res.updated_at);
      } catch (e) {
        const err = e as Error & { code?: string };
        if (err.code === 'conflict') {
          store.getState().markSaving('error', 'This project changed in another tab. Reload to continue.');
        } else {
          store.getState().markSaving('error', err.message);
        }
      }
    };
    const debounced = debounce(save, DEBOUNCE_MS);
    debouncedRef.current = debounced;

    const unsub = store.subscribe((state, prev) => {
      if (!initialised.current) { initialised.current = true; return; }
      if (state.data === prev.data && state.name === prev.name) return;
      state.markSaving('pending');
      debounced();
    });

    const onUnload = (e: BeforeUnloadEvent) => {
      const status = store.getState().saving;
      if (status === 'pending' || status === 'saving') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onUnload);

    return () => {
      unsub();
      debounced.flush();
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [store]);
}
```

- [ ] **Step 2: Commit**

```powershell
git add src/lib/editor/autosave.ts
git commit -m "feat(editor): autosave hook with 800ms debounce and beforeunload guard"
```

---

## Task 5 — Live preview renderer (placeholder version)

This task ships a *visually correct* preview using React. Phase 3 replaces the export with a pure string renderer; the preview stays React for now because mutating an iframe's body via React is the cheapest way to get live updates without a heavy dependency.

**Files:**
- Create: `src/components/editor/Preview.tsx`, `src/components/editor/PreviewBody.tsx`

- [ ] **Step 1: Create `src/components/editor/PreviewBody.tsx`**

```typescript
'use client';
import { useEditor } from '@/lib/editor/StoreProvider';
import { Facebook, Linkedin, Twitter, Youtube, Instagram } from 'lucide-react';
import type { SocialPlatform } from '@/lib/editor/types';

const ICONS: Record<SocialPlatform, React.ComponentType<{ size?: number; color?: string }>> = {
  facebook: Facebook, linkedin: Linkedin, twitter: Twitter, youtube: Youtube, instagram: Instagram,
};

export function PreviewBody() {
  const data = useEditor((s) => s.data);
  const g = data.global;

  return (
    <div style={{ background: g.backgroundColor, padding: 0, minHeight: '100%', fontFamily: g.fontFamily }}>
      {/* Header */}
      <div style={{ maxWidth: 710, margin: '0 auto', padding: '20px' }}>
        {data.header.logoSrc && (
          <div style={{ textAlign: 'center' }}>
            <img src={data.header.logoSrc} alt={data.header.logoAlt} style={{ maxWidth: data.header.logoWidth, width: '100%' }} />
          </div>
        )}
        {data.header.title && (
          <h1 style={{ textAlign: 'center', fontSize: data.header.titleFontSize, color: g.textColor, fontWeight: 400, margin: '20px 0' }}>
            {data.header.title}
          </h1>
        )}
        {data.header.bannerSrc && (
          <div style={{ textAlign: 'center' }}>
            <img src={data.header.bannerSrc} alt={data.header.bannerAlt} style={{ width: '100%' }} />
          </div>
        )}
        {data.header.sectionHeading && (
          <h3 style={{ textAlign: 'center', fontSize: data.header.sectionHeadingFontSize, color: g.textColor, fontWeight: 400, margin: '12px 0' }}>
            {data.header.sectionHeading}
          </h3>
        )}
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
            {s.imageSrc && <img src={s.imageSrc} alt={s.imageAlt} style={{ maxWidth: 355, width: '100%' }} />}
          </div>
        );
        const TextCol = (
          <div style={{ width: '50%', padding: 20, verticalAlign: 'middle', display: 'inline-block' }}>
            <h1 style={{ fontSize: titleSize, color: textColor, fontWeight: 700, margin: 0 }}>{s.title}</h1>
            <ul style={{ fontSize: bulletSize, color: textColor, lineHeight: '150%' }}>
              {s.bullets.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
            <a
              href={s.ctaUrl ?? g.contactUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-block', background: buttonColor, color: g.buttonTextColor,
                padding: '10px 30px', borderRadius: 10, fontWeight: 700, fontSize: 16, textDecoration: 'none',
              }}
            >
              {s.ctaText}
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
        {data.footer.bannerSrc && (
          <img src={data.footer.bannerSrc} alt={data.footer.bannerAlt} style={{ maxWidth: 710, width: '100%' }} />
        )}
        <p style={{ fontWeight: 700, margin: '12px 0 0' }}>{data.footer.companyName}</p>
        <p style={{ whiteSpace: 'pre-line', margin: 0 }}>{data.footer.address}</p>
        <p style={{ marginTop: 12 }}>
          Tel: <a href={`tel:${data.footer.phoneTel}`} style={{ color: g.accentColor, textDecoration: 'none' }}>{data.footer.phone}</a><br />
          Email: <a href={`mailto:${data.footer.email}`} style={{ color: g.accentColor, textDecoration: 'none' }}>{data.footer.email}</a><br />
          {data.footer.websites.map((w, i) => (
            <span key={i}>
              {i > 0 ? ' · ' : ''}
              <a href={w.url} style={{ color: g.accentColor, textDecoration: 'none' }}>{w.label}</a>
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

- [ ] **Step 2: Create `src/components/editor/Preview.tsx`**

This wraps `PreviewBody` in an iframe so its CSS doesn't leak from / into the editor chrome. Uses React's portal to render into the iframe's `document.body`.

```typescript
'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PreviewBody } from './PreviewBody';

export function Preview() {
  const ref = useRef<HTMLIFrameElement>(null);
  const [body, setBody] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;
    const onLoad = () => setBody(iframe.contentDocument?.body ?? null);
    iframe.addEventListener('load', onLoad);
    if (iframe.contentDocument?.readyState === 'complete') onLoad();
    return () => iframe.removeEventListener('load', onLoad);
  }, []);

  return (
    <iframe
      ref={ref}
      title="Live preview"
      srcDoc="<!doctype html><html><head><meta charset='utf-8'><style>body{margin:0;padding:0}</style></head><body></body></html>"
      className="w-full h-full border-0 bg-white"
    >
      {body && createPortal(<PreviewBody />, body)}
    </iframe>
  );
}
```

- [ ] **Step 3: Commit**

```powershell
git add src/components/editor/Preview.tsx src/components/editor/PreviewBody.tsx
git commit -m "feat(editor): live preview iframe rendering ProjectData"
```

---

## Task 6 — Editor shell (topbar + layout)

**Files:**
- Create: `src/components/editor/EditorShell.tsx`, `src/components/editor/Topbar.tsx`, `src/components/editor/LeftPanel.tsx`
- Modify: `src/app/p/[id]/page.tsx`

- [ ] **Step 1: `src/components/editor/Topbar.tsx`**

```typescript
'use client';
import Link from 'next/link';
import { useEditor, useEditorStore } from '@/lib/editor/StoreProvider';
import { Button } from '@/components/ui/Button';
import { useState } from 'react';
import { patchProject } from '@/lib/api/projects';

export function Topbar() {
  const name = useEditor((s) => s.name);
  const saving = useEditor((s) => s.saving);
  const lastError = useEditor((s) => s.lastError);
  const store = useEditorStore();

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(name);

  const status =
    saving === 'saving' ? 'Saving…' :
    saving === 'pending' ? 'Pending…' :
    saving === 'error' ? 'Save failed' : '✓ Saved';

  async function commitName() {
    setEditing(false);
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === name) { setDraftName(name); return; }
    store.getState().setName(trimmed);
  }

  return (
    <div className="flex items-center gap-4 px-5 py-2.5 border-b border-border bg-panel-2 text-sm">
      <Link href="/" className="text-brand">← Projects</Link>
      <span className="text-border-strong">|</span>
      {editing ? (
        <input
          autoFocus
          className="bg-panel border border-border-strong rounded px-2 py-0.5"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitName();
            if (e.key === 'Escape') { setDraftName(name); setEditing(false); }
          }}
        />
      ) : (
        <button onClick={() => { setDraftName(name); setEditing(true); }} className="font-semibold text-fg">{name}</button>
      )}
      <span className={saving === 'error' ? 'text-danger' : 'text-muted'}>{status}</span>
      {lastError && <span className="text-danger text-xs">{lastError}</span>}
      <div className="ml-auto">
        <Button disabled title="Phase 3 — HTML export">⬇ Download HTML</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `src/components/editor/LeftPanel.tsx` (skeleton — fill with panels in later tasks)**

```typescript
'use client';
import { GlobalStylesPanel } from './panels/GlobalStylesPanel';
import { HeaderPanel } from './panels/HeaderPanel';
import { FooterPanel } from './panels/FooterPanel';
import { ProductSectionPanel } from './panels/ProductSectionPanel';
import { useEditor, useEditorStore } from '@/lib/editor/StoreProvider';
import { Button } from '@/components/ui/Button';

export function LeftPanel() {
  const sections = useEditor((s) => s.data.sections);
  const store = useEditorStore();

  return (
    <aside className="w-[320px] shrink-0 border-r border-border bg-panel overflow-y-auto p-3 space-y-2">
      <GlobalStylesPanel />
      <HeaderPanel />
      <div className="text-[10px] uppercase tracking-widest text-muted-2 px-1 pt-3 pb-1">Products</div>
      {sections.map((s, idx) => (
        <ProductSectionPanel key={s.id} section={s} index={idx} total={sections.length} />
      ))}
      <Button variant="secondary" className="w-full" onClick={() => store.getState().addSection()}>
        + Add Product Section
      </Button>
      <FooterPanel />
    </aside>
  );
}
```

- [ ] **Step 3: `src/components/editor/EditorShell.tsx`**

```typescript
'use client';
import { StoreProvider } from '@/lib/editor/StoreProvider';
import { useAutosave } from '@/lib/editor/autosave';
import { Topbar } from './Topbar';
import { LeftPanel } from './LeftPanel';
import { Preview } from './Preview';
import type { ProjectData } from '@/lib/editor/types';

interface Props {
  projectId: string;
  name: string;
  data: ProjectData;
  serverUpdatedAt: string;
}

function Inner() {
  useAutosave();
  return (
    <div className="flex flex-col h-dvh">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <LeftPanel />
        <div className="flex-1 bg-[#080808]"><Preview /></div>
      </div>
    </div>
  );
}

export function EditorShell(props: Props) {
  return (
    <StoreProvider {...props}>
      <Inner />
    </StoreProvider>
  );
}
```

- [ ] **Step 4: Replace `src/app/p/[id]/page.tsx`**

```typescript
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { EditorShell } from '@/components/editor/EditorShell';
import type { ProjectData } from '@/lib/editor/types';

interface Props { params: Promise<{ id: string }> }

export default async function EditorPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from('projects').select('*').eq('id', id).maybeSingle();
  if (!project) notFound();
  return (
    <EditorShell
      projectId={project.id}
      name={project.name}
      data={project.data as ProjectData}
      serverUpdatedAt={project.updated_at}
    />
  );
}
```

- [ ] **Step 5: Stub the panels so the build passes**

Create empty stubs that we'll fill in subsequent tasks:

`src/components/editor/panels/GlobalStylesPanel.tsx`:

```typescript
'use client';
export function GlobalStylesPanel() {
  return <div className="rounded-md bg-panel-2 border border-border p-3 text-xs text-muted">Global Styles (Task 8)</div>;
}
```

`src/components/editor/panels/HeaderPanel.tsx`:

```typescript
'use client';
export function HeaderPanel() {
  return <div className="rounded-md bg-panel-2 border border-border p-3 text-xs text-muted">Header (Task 9)</div>;
}
```

`src/components/editor/panels/FooterPanel.tsx`:

```typescript
'use client';
export function FooterPanel() {
  return <div className="rounded-md bg-panel-2 border border-border p-3 text-xs text-muted">Footer (Task 10)</div>;
}
```

`src/components/editor/panels/ProductSectionPanel.tsx`:

```typescript
'use client';
import type { ProductSection } from '@/lib/editor/types';
export function ProductSectionPanel({ section }: { section: ProductSection; index: number; total: number }) {
  return <div className="rounded-md bg-panel-2 border border-border p-3 text-xs text-muted">{section.title} (Task 11)</div>;
}
```

- [ ] **Step 6: Manual smoke**

`npm run dev`. Open a project. Three-region layout: topbar, left panel with stubs and product titles, white preview iframe rendering the email. Stop.

- [ ] **Step 7: Commit**

```powershell
git add src/components/editor src/app/p/[id]/page.tsx
git commit -m "feat(editor): shell with topbar, left panel, autosave, live preview"
```

---

## Task 7 — UI primitives needed by panels

**Files:**
- Create: `src/components/ui/ColorPicker.tsx`, `src/components/ui/NumberInput.tsx`, `src/components/ui/Select.tsx`, `src/components/ui/Textarea.tsx`, `src/components/ui/Field.tsx`

- [ ] **Step 1: `src/components/ui/Field.tsx`**

```typescript
import { type ReactNode } from 'react';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wide text-muted-2 mb-1">{label}</span>
      {children}
    </label>
  );
}
```

- [ ] **Step 2: `src/components/ui/ColorPicker.tsx`**

```typescript
'use client';
import { Input } from './Input';

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export function ColorPicker({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-8 h-8 rounded border border-border-strong bg-transparent cursor-pointer"
      />
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono text-xs" />
    </div>
  );
}
```

- [ ] **Step 3: `src/components/ui/NumberInput.tsx`**

```typescript
'use client';
import { Input } from './Input';

interface Props {
  value: number;
  onChange: (v: number) => void;
  min?: number; max?: number; step?: number;
}

export function NumberInput({ value, onChange, min, max, step = 1 }: Props) {
  return (
    <Input
      type="number"
      value={Number.isFinite(value) ? value : ''}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (Number.isFinite(n)) onChange(n);
      }}
      min={min} max={max} step={step}
    />
  );
}
```

- [ ] **Step 4: `src/components/ui/Select.tsx`**

```typescript
'use client';
import type { SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'w-full rounded-md bg-panel-2 border border-border-strong px-2 py-2 text-sm text-fg focus:outline-none focus:border-brand',
        className,
      )}
      {...rest}
    />
  );
}
```

- [ ] **Step 5: `src/components/ui/Textarea.tsx`**

```typescript
'use client';
import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          'w-full rounded-md bg-panel-2 border border-border-strong px-3 py-2 text-sm text-fg placeholder:text-muted-2 focus:outline-none focus:border-brand resize-y',
          className,
        )}
        {...rest}
      />
    );
  },
);
```

- [ ] **Step 6: Commit**

```powershell
git add src/components/ui
git commit -m "feat(ui): ColorPicker, NumberInput, Select, Textarea, Field"
```

---

## Task 8 — Global Styles panel

**Files:**
- Modify: `src/components/editor/panels/GlobalStylesPanel.tsx`

- [ ] **Step 1: Replace the stub with the real panel**

```typescript
'use client';
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useEditor, useEditorStore } from '@/lib/editor/StoreProvider';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { NumberInput } from '@/components/ui/NumberInput';
import { Select } from '@/components/ui/Select';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';

const FONT_FAMILIES = [
  'Arial, Helvetica Neue, Helvetica, sans-serif',
  'Georgia, "Times New Roman", serif',
  'Verdana, Geneva, sans-serif',
  '"Courier New", Courier, monospace',
  '"Trebuchet MS", Helvetica, sans-serif',
  '"Lucida Sans Unicode", "Lucida Grande", sans-serif',
];

export function GlobalStylesPanel() {
  const [open, setOpen] = useState(true);
  const g = useEditor((s) => s.data.global);
  const setGlobal = useEditorStore().getState().setGlobal;

  return (
    <div className="rounded-md bg-panel-2 border border-border overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-fg">
        <span>🎨 Global Styles</span>
        {open ? <ChevronDown size={14} className="text-muted-2" /> : <ChevronRight size={14} className="text-muted-2" />}
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-3 p-3 border-t border-border">
          <Field label="Background"><ColorPicker value={g.backgroundColor} onChange={(v) => setGlobal({ backgroundColor: v })} /></Field>
          <Field label="Text color"><ColorPicker value={g.textColor} onChange={(v) => setGlobal({ textColor: v })} /></Field>
          <Field label="Button color"><ColorPicker value={g.buttonColor} onChange={(v) => setGlobal({ buttonColor: v })} /></Field>
          <Field label="Button text"><ColorPicker value={g.buttonTextColor} onChange={(v) => setGlobal({ buttonTextColor: v })} /></Field>
          <Field label="Accent / link"><ColorPicker value={g.accentColor} onChange={(v) => setGlobal({ accentColor: v })} /></Field>
          <Field label="Footer bg"><ColorPicker value={g.footerBackgroundColor} onChange={(v) => setGlobal({ footerBackgroundColor: v })} /></Field>
          <Field label="Footer text"><ColorPicker value={g.footerTextColor} onChange={(v) => setGlobal({ footerTextColor: v })} /></Field>
          <Field label="Heading size px"><NumberInput value={g.headingFontSize} onChange={(v) => setGlobal({ headingFontSize: v })} min={10} max={64} /></Field>
          <Field label="Body size px"><NumberInput value={g.baseFontSize} onChange={(v) => setGlobal({ baseFontSize: v })} min={10} max={32} /></Field>
          <div className="col-span-2">
            <Field label="Font family">
              <Select value={g.fontFamily} onChange={(e) => setGlobal({ fontFamily: e.target.value })}>
                {FONT_FAMILIES.map(f => <option key={f} value={f}>{f.split(',')[0].replace(/['"]/g, '')}</option>)}
              </Select>
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Default Contact URL">
              <Input value={g.contactUrl} onChange={(e) => setGlobal({ contactUrl: e.target.value })} />
            </Field>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Manual test**

Open editor. Change background colour — preview updates instantly. Stop after a few changes; verify "Saved" indicator transitions through Pending → Saving → Saved. Reload — changes persist.

- [ ] **Step 3: Commit**

```powershell
git add src/components/editor/panels/GlobalStylesPanel.tsx
git commit -m "feat(editor): global styles panel"
```

---

## Task 9 — Header panel

**Files:**
- Create: `src/components/editor/ImageInput.tsx` (URL-only for now; upload added Task 13)
- Modify: `src/components/editor/panels/HeaderPanel.tsx`

- [ ] **Step 1: `src/components/editor/ImageInput.tsx`**

```typescript
'use client';
import { Input } from '@/components/ui/Input';

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function ImageInput({ value, onChange, placeholder = 'Image URL' }: Props) {
  return (
    <div className="flex gap-2 items-center">
      {value && <img src={value} alt="" className="w-10 h-10 object-cover rounded border border-border-strong" />}
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="flex-1" />
    </div>
  );
}
```

- [ ] **Step 2: Replace `src/components/editor/panels/HeaderPanel.tsx`**

```typescript
'use client';
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useEditor, useEditorStore } from '@/lib/editor/StoreProvider';
import { Input } from '@/components/ui/Input';
import { NumberInput } from '@/components/ui/NumberInput';
import { Field } from '@/components/ui/Field';
import { ImageInput } from '../ImageInput';

export function HeaderPanel() {
  const [open, setOpen] = useState(false);
  const h = useEditor((s) => s.data.header);
  const setHeader = useEditorStore().getState().setHeader;

  return (
    <div className="rounded-md bg-panel-2 border border-border overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-fg">
        <span>🖼 Header</span>
        {open ? <ChevronDown size={14} className="text-muted-2" /> : <ChevronRight size={14} className="text-muted-2" />}
      </button>
      {open && (
        <div className="space-y-3 p-3 border-t border-border">
          <Field label="Logo image"><ImageInput value={h.logoSrc} onChange={(v) => setHeader({ logoSrc: v })} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Logo alt"><Input value={h.logoAlt} onChange={(e) => setHeader({ logoAlt: e.target.value })} /></Field>
            <Field label="Logo width px"><NumberInput value={h.logoWidth} onChange={(v) => setHeader({ logoWidth: v })} min={100} max={710} /></Field>
          </div>
          <Field label="Header title"><Input value={h.title} onChange={(e) => setHeader({ title: e.target.value })} /></Field>
          <Field label="Header title size px"><NumberInput value={h.titleFontSize} onChange={(v) => setHeader({ titleFontSize: v })} min={10} max={36} /></Field>
          <Field label="Banner image"><ImageInput value={h.bannerSrc} onChange={(v) => setHeader({ bannerSrc: v })} /></Field>
          <Field label="Banner alt"><Input value={h.bannerAlt} onChange={(e) => setHeader({ bannerAlt: e.target.value })} /></Field>
          <Field label="Section heading"><Input value={h.sectionHeading} onChange={(e) => setHeader({ sectionHeading: e.target.value })} /></Field>
          <Field label="Section heading size px"><NumberInput value={h.sectionHeadingFontSize} onChange={(v) => setHeader({ sectionHeadingFontSize: v })} min={12} max={48} /></Field>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```powershell
git add src/components/editor/ImageInput.tsx src/components/editor/panels/HeaderPanel.tsx
git commit -m "feat(editor): header panel with logo, banner, titles"
```

---

## Task 10 — Footer panel

**Files:**
- Modify: `src/components/editor/panels/FooterPanel.tsx`

- [ ] **Step 1: Replace stub**

```typescript
'use client';
import { useState } from 'react';
import { ChevronDown, ChevronRight, X, Plus } from 'lucide-react';
import { useEditor, useEditorStore } from '@/lib/editor/StoreProvider';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Field } from '@/components/ui/Field';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { ImageInput } from '../ImageInput';
import { Button } from '@/components/ui/Button';
import type { SocialPlatform } from '@/lib/editor/types';

const PLATFORMS: SocialPlatform[] = ['facebook', 'linkedin', 'twitter', 'youtube', 'instagram'];

export function FooterPanel() {
  const [open, setOpen] = useState(false);
  const f = useEditor((s) => s.data.footer);
  const setFooter = useEditorStore().getState().setFooter;

  return (
    <div className="rounded-md bg-panel-2 border border-border overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-fg">
        <span>📞 Footer</span>
        {open ? <ChevronDown size={14} className="text-muted-2" /> : <ChevronRight size={14} className="text-muted-2" />}
      </button>
      {open && (
        <div className="space-y-3 p-3 border-t border-border">
          <Field label="Footer banner"><ImageInput value={f.bannerSrc} onChange={(v) => setFooter({ bannerSrc: v })} /></Field>
          <Field label="Banner alt"><Input value={f.bannerAlt} onChange={(e) => setFooter({ bannerAlt: e.target.value })} /></Field>
          <Field label="Company name"><Input value={f.companyName} onChange={(e) => setFooter({ companyName: e.target.value })} /></Field>
          <Field label="Address (multi-line)"><Textarea rows={3} value={f.address} onChange={(e) => setFooter({ address: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Phone (display)"><Input value={f.phone} onChange={(e) => setFooter({ phone: e.target.value })} /></Field>
            <Field label="Phone (tel link)"><Input value={f.phoneTel} onChange={(e) => setFooter({ phoneTel: e.target.value })} /></Field>
          </div>
          <Field label="Email"><Input value={f.email} onChange={(e) => setFooter({ email: e.target.value })} /></Field>

          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-2 mb-1">Websites</div>
            <div className="space-y-2">
              {f.websites.map((w, i) => (
                <div key={i} className="flex gap-2">
                  <Input className="flex-1" placeholder="Label" value={w.label}
                    onChange={(e) => setFooter({ websites: f.websites.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} />
                  <Input className="flex-1" placeholder="https://..." value={w.url}
                    onChange={(e) => setFooter({ websites: f.websites.map((x, j) => j === i ? { ...x, url: e.target.value } : x) })} />
                  <button onClick={() => setFooter({ websites: f.websites.filter((_, j) => j !== i) })} className="text-muted-2 hover:text-danger px-1"><X size={14} /></button>
                </div>
              ))}
              <Button variant="secondary" className="w-full" onClick={() => setFooter({ websites: [...f.websites, { label: '', url: '' }] })}><Plus size={14} /> Website</Button>
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-2 mb-1">Socials</div>
            <div className="space-y-2">
              {f.socials.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <Select className="w-32" value={s.platform}
                    onChange={(e) => setFooter({ socials: f.socials.map((x, j) => j === i ? { ...x, platform: e.target.value as SocialPlatform } : x) })}>
                    {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </Select>
                  <Input className="flex-1" placeholder="https://..." value={s.url}
                    onChange={(e) => setFooter({ socials: f.socials.map((x, j) => j === i ? { ...x, url: e.target.value } : x) })} />
                  <button onClick={() => setFooter({ socials: f.socials.filter((_, j) => j !== i) })} className="text-muted-2 hover:text-danger px-1"><X size={14} /></button>
                </div>
              ))}
              <Button variant="secondary" className="w-full" onClick={() => setFooter({ socials: [...f.socials, { platform: 'facebook', url: '' }] })}><Plus size={14} /> Social</Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Background override"><ColorPicker value={f.backgroundColor ?? ''} onChange={(v) => setFooter({ backgroundColor: v || undefined })} /></Field>
            <Field label="Text override"><ColorPicker value={f.textColor ?? ''} onChange={(v) => setFooter({ textColor: v || undefined })} /></Field>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```powershell
git add src/components/editor/panels/FooterPanel.tsx
git commit -m "feat(editor): footer panel with address, contacts, websites, socials, overrides"
```

---

## Task 11 — Product section panel + bullets editor

**Files:**
- Create: `src/components/editor/BulletList.tsx`
- Modify: `src/components/editor/panels/ProductSectionPanel.tsx`

- [ ] **Step 1: `src/components/editor/BulletList.tsx`**

```typescript
'use client';
import { Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface Props {
  bullets: string[];
  onChange: (next: string[]) => void;
}

export function BulletList({ bullets, onChange }: Props) {
  return (
    <div className="space-y-1.5">
      {bullets.map((b, i) => (
        <div key={i} className="flex gap-1.5">
          <Input value={b} onChange={(e) => onChange(bullets.map((x, j) => j === i ? e.target.value : x))} />
          <button onClick={() => onChange(bullets.filter((_, j) => j !== i))} className="text-muted-2 hover:text-danger px-1.5"><X size={14} /></button>
        </div>
      ))}
      <Button variant="secondary" className="w-full text-success border-success/40" onClick={() => onChange([...bullets, ''])}>
        <Plus size={14} /> Bullet
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Replace `src/components/editor/panels/ProductSectionPanel.tsx`**

```typescript
'use client';
import { useState } from 'react';
import { ChevronDown, ChevronRight, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { useEditorStore } from '@/lib/editor/StoreProvider';
import type { ProductSection } from '@/lib/editor/types';
import { Input } from '@/components/ui/Input';
import { NumberInput } from '@/components/ui/NumberInput';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { Field } from '@/components/ui/Field';
import { ImageInput } from '../ImageInput';
import { BulletList } from '../BulletList';

interface Props { section: ProductSection; index: number; total: number; }

export function ProductSectionPanel({ section, index, total }: Props) {
  const [open, setOpen] = useState(false);
  const [overrides, setOverrides] = useState(false);
  const store = useEditorStore();
  const set = (patch: Partial<ProductSection>) => store.getState().setSection(section.id, patch);

  return (
    <div className={`rounded-md border bg-panel-2 overflow-hidden ${open ? 'border-brand/30' : 'border-border'}`}>
      <div className="flex items-center justify-between px-3 py-2">
        <button onClick={() => setOpen(o => !o)} className="text-sm font-medium text-fg flex items-center gap-2 flex-1 text-left">
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <span className="truncate">{section.title || '(untitled)'}</span>
        </button>
        <div className="flex items-center gap-1 text-muted-2">
          <button disabled={index === 0} onClick={() => store.getState().moveSection(section.id, 'up')} className="disabled:opacity-30 hover:text-fg"><ArrowUp size={12} /></button>
          <button disabled={index === total - 1} onClick={() => store.getState().moveSection(section.id, 'down')} className="disabled:opacity-30 hover:text-fg"><ArrowDown size={12} /></button>
          <button onClick={() => { if (confirm(`Remove "${section.title}"?`)) store.getState().removeSection(section.id); }} className="hover:text-danger"><Trash2 size={12} /></button>
        </div>
      </div>
      {open && (
        <div className="space-y-3 p-3 border-t border-border">
          <Field label="Title"><Input value={section.title} onChange={(e) => set({ title: e.target.value })} /></Field>
          <Field label="Image"><ImageInput value={section.imageSrc} onChange={(v) => set({ imageSrc: v })} /></Field>
          <Field label="Image alt"><Input value={section.imageAlt} onChange={(e) => set({ imageAlt: e.target.value })} /></Field>
          <Field label="Bullets"><BulletList bullets={section.bullets} onChange={(next) => set({ bullets: next })} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Button text"><Input value={section.ctaText} onChange={(e) => set({ ctaText: e.target.value })} /></Field>
            <Field label="Button URL (override)"><Input value={section.ctaUrl ?? ''} onChange={(e) => set({ ctaUrl: e.target.value || undefined })} /></Field>
          </div>

          <button onClick={() => setOverrides(o => !o)} className="text-xs text-muted-2 hover:text-fg w-full text-left pt-1 border-t border-border">
            Section style overrides {overrides ? '▾' : '▸'}
          </button>
          {overrides && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Field label="Title size px"><NumberInput value={section.titleFontSize ?? 0} onChange={(v) => set({ titleFontSize: v || undefined })} min={0} max={60} /></Field>
              <Field label="Bullet size px"><NumberInput value={section.bulletFontSize ?? 0} onChange={(v) => set({ bulletFontSize: v || undefined })} min={0} max={32} /></Field>
              <Field label="Text color"><ColorPicker value={section.textColor ?? ''} onChange={(v) => set({ textColor: v || undefined })} /></Field>
              <Field label="Button color"><ColorPicker value={section.buttonColor ?? ''} onChange={(v) => set({ buttonColor: v || undefined })} /></Field>
              <div className="col-span-2"><Field label="Section background"><ColorPicker value={section.backgroundColor ?? ''} onChange={(v) => set({ backgroundColor: v || undefined })} /></Field></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Manual test**

Open editor. Expand a section. Edit title — preview updates. Reorder up/down. Add/remove bullets. Toggle overrides, change a section bg colour. Stop.

- [ ] **Step 4: Commit**

```powershell
git add src/components/editor/BulletList.tsx src/components/editor/panels/ProductSectionPanel.tsx
git commit -m "feat(editor): product section panel with bullets, reorder, delete, overrides"
```

---

## Task 12 — Image upload server route

**Files:**
- Create: `src/app/api/upload/route.ts`

- [ ] **Step 1: Create route**

```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { v4 as uuid } from 'uuid';
import { createClient } from '@/lib/supabase/server';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file');
  const projectId = form.get('projectId');
  if (!(file instanceof File))     return NextResponse.json({ error: 'no_file' }, { status: 400 });
  if (typeof projectId !== 'string') return NextResponse.json({ error: 'no_project' }, { status: 400 });
  if (!ALLOWED.has(file.type))     return NextResponse.json({ error: 'bad_type' }, { status: 415 });
  if (file.size > MAX_BYTES)       return NextResponse.json({ error: 'too_large' }, { status: 413 });

  // Verify the project belongs to the user (RLS will also enforce on read)
  const { data: row } = await supabase.from('projects').select('id').eq('id', projectId).maybeSingle();
  if (!row) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const ext = file.type === 'image/png' ? 'png'
            : file.type === 'image/jpeg' ? 'jpg'
            : file.type === 'image/webp' ? 'webp' : 'gif';
  const path = `${user.id}/${projectId}/${uuid()}.${ext}`;

  const buf = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage.from('project-assets').upload(path, buf, {
    contentType: file.type, upsert: false,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: { publicUrl } } = supabase.storage.from('project-assets').getPublicUrl(path);
  return NextResponse.json({ publicUrl });
}
```

- [ ] **Step 2: Commit**

```powershell
git add src/app/api/upload
git commit -m "feat(api): /api/upload writes to user/project folder, returns public URL"
```

---

## Task 13 — Image upload client + integrate with `ImageInput`

**Files:**
- Create: `src/lib/api/upload.ts`
- Modify: `src/components/editor/ImageInput.tsx`

- [ ] **Step 1: `src/lib/api/upload.ts` — client-side resize + upload**

```typescript
const MAX_DIM = 1400;

async function resize(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  if (ratio === 1 && file.size < 1.5 * 1024 * 1024) return file; // skip — small enough

  const w = Math.round(bitmap.width * ratio);
  const h = Math.round(bitmap.height * ratio);
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, w, h);

  // Keep PNG if input has alpha (we keep it for any png), else JPEG
  const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  return canvas.convertToBlob({ type: mime, quality: 0.85 });
}

export async function uploadImage(file: File, projectId: string): Promise<string> {
  const blob = await resize(file);
  const fd = new FormData();
  fd.append('file', new File([blob], file.name, { type: blob.type }));
  fd.append('projectId', projectId);
  const res = await fetch('/api/upload', { method: 'POST', body: fd });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'upload_failed');
  }
  const { publicUrl } = await res.json();
  return publicUrl as string;
}
```

- [ ] **Step 2: Replace `src/components/editor/ImageInput.tsx`**

```typescript
'use client';
import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useEditor } from '@/lib/editor/StoreProvider';
import { uploadImage } from '@/lib/api/upload';

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function ImageInput({ value, onChange, placeholder = 'Image URL' }: Props) {
  const projectId = useEditor((s) => s.projectId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setErr(null);
    try {
      const url = await uploadImage(file, projectId);
      onChange(url);
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2 items-center">
        {value && <img src={value} alt="" className="w-10 h-10 object-cover rounded border border-border-strong" />}
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="flex-1" />
        <Button variant="secondary" type="button" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? '…' : <><Upload size={14} /> Upload</>}
        </Button>
        <input ref={inputRef} type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif" onChange={onPick} />
      </div>
      {err && <div className="text-xs text-danger">{err}</div>}
    </div>
  );
}
```

- [ ] **Step 3: Manual test**

Open editor. Upload a local PNG/JPEG into the logo field. URL appears, image renders in preview. Stop.

- [ ] **Step 4: Commit**

```powershell
git add src/lib/api/upload.ts src/components/editor/ImageInput.tsx
git commit -m "feat(editor): image upload with client-side resize and per-user storage path"
```

---

## Task 14 — Editor E2E

**Files:**
- Create: `tests/e2e/editor.spec.ts`

- [ ] **Step 1: Create the test**

```typescript
import { test, expect } from '@playwright/test';

test('open project, edit a section title, autosave, reload, persists', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('Email address').fill(process.env.E2E_EMAIL!);
  await page.getByPlaceholder('Password').fill(process.env.E2E_PASSWORD!);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL('/');

  await page.getByRole('button', { name: /new project/i }).click();
  await expect(page).toHaveURL(/\/p\//);

  // Open first product section
  await page.getByRole('button', { name: /Starlink Solutions/ }).first().click();
  const titleField = page.locator('input[value="Starlink Solutions"]').first();
  await titleField.fill('My Custom Title');

  // Wait for autosave settle
  await expect(page.getByText(/Saved/)).toBeVisible({ timeout: 5000 });

  await page.reload();
  await expect(page.locator('input[value="My Custom Title"]')).toBeVisible();
});
```

- [ ] **Step 2: Run E2E**

```powershell
npm run e2e
```

- [ ] **Step 3: Commit**

```powershell
git add tests/e2e/editor.spec.ts
git commit -m "test(e2e): editor edit + autosave + reload"
```

---

## Phase 2 acceptance

- ☑ Open editor → topbar shows project name, save status; left panel shows Global / Header / Footer / 8 product sections / Add Product button; right pane shows live email preview.
- ☑ Edit any field → preview updates instantly; "Saved" indicator transitions Pending → Saving → ✓ Saved within ~1 s.
- ☑ Reorder, delete, add product sections.
- ☑ Add/remove bullets, edit text, swap images by URL or upload.
- ☑ Section style overrides apply only to that section.
- ☑ Reload page → all changes persist.
- ☑ Two tabs editing the same project: second save returns 409 → "This project changed in another tab" error displayed.
- ☑ `npm test` and `npm run e2e` green.

**Phase complete. Move to `PHASE-3-IMPORT-EXPORT.md`.**
