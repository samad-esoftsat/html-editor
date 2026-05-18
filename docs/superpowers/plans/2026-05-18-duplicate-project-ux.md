# Duplicate Project UX — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users name the duplicate of a project (or accept an auto-name), show progress/result feedback via spinner + toast, and keep the user on the dashboard instead of opening the new project.

**Architecture:** Add a reusable `promptDialog` primitive (parallel to existing `confirmDialog`) with a `PromptDialog` component mounted in the root layout. Extend the duplicate API to accept an optional `name` in the body. Update the client SDK helper and rewire `ProjectCard.onDuplicate` to open the prompt, call the API with the chosen name, swap the icon for a spinner while pending, and emit a success/error toast — no navigation.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Vitest + @testing-library/react, motion/react, lucide-react, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-05-18-duplicate-project-ux-design.md`

---

## File Structure

**New:**
- `src/lib/utils/prompt.ts` — singleton-listener prompt state, `promptDialog()` API.
- `src/components/ui/PromptDialog.tsx` — modal renderer for prompt state, with text input.
- `tests/unit/prompt.test.ts` — unit tests for prompt state machine.
- `tests/unit/duplicate-route.test.ts` — unit tests for the name resolution in the duplicate API.

**Modified:**
- `src/app/layout.tsx` — mount `<PromptDialog />` next to `<ConfirmDialog />`.
- `src/app/api/projects/[id]/duplicate/route.ts` — accept optional `{ name }` body; tolerate missing/invalid bodies.
- `src/lib/api/projects.ts` — `duplicateProject(id, name?)` sends body when name provided.
- `src/components/dashboard/ProjectCard.tsx` — open prompt, show spinner while pending, toast on result, no router.push.

---

## Task 1: Prompt state module

**Files:**
- Create: `src/lib/utils/prompt.ts`
- Test: `tests/unit/prompt.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/prompt.test.ts`:

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { promptDialog, subscribe, type PromptState } from '@/lib/utils/prompt';

describe('promptDialog', () => {
  let states: (PromptState | null)[] = [];
  let unsub: () => void;

  beforeEach(() => {
    states = [];
    unsub?.();
    unsub = subscribe((s) => states.push(s));
    // first emission is the initial state (null)
    states = [];
  });

  it('emits a state when opened and resolves the trimmed value on confirm', async () => {
    const p = promptDialog({ title: 'T', defaultValue: 'x' });
    expect(states.length).toBe(1);
    const state = states[0]!;
    expect(state.title).toBe('T');
    expect(state.defaultValue).toBe('x');
    state.resolve('  hello  ');
    await expect(p).resolves.toBe('hello');
    // state cleared after resolve
    expect(states.at(-1)).toBeNull();
  });

  it('resolves to null when cancelled', async () => {
    const p = promptDialog({ title: 'T' });
    states[0]!.resolve(null);
    await expect(p).resolves.toBeNull();
  });

  it('treats an all-whitespace string as empty (returns empty string, not null)', async () => {
    const p = promptDialog({ title: 'T' });
    states[0]!.resolve('   ');
    await expect(p).resolves.toBe('');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/unit/prompt.test.ts`
Expected: FAIL — module `@/lib/utils/prompt` does not exist.

- [ ] **Step 3: Implement the prompt state module**

Create `src/lib/utils/prompt.ts`:

```ts
type Listener = (state: PromptState | null) => void;

export interface PromptState {
  title: string;
  message?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel: string;
  resolve: (value: string | null) => void;
}

const listeners = new Set<Listener>();
let current: PromptState | null = null;

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  l(current);
  return () => { listeners.delete(l); };
}

export function promptDialog(opts: {
  title: string;
  message?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
}): Promise<string | null> {
  return new Promise((resolve) => {
    current = {
      title: opts.title,
      message: opts.message,
      label: opts.label,
      placeholder: opts.placeholder,
      defaultValue: opts.defaultValue,
      confirmLabel: opts.confirmLabel ?? 'OK',
      resolve: (value) => {
        current = null;
        listeners.forEach((l) => l(null));
        resolve(value === null ? null : value.trim());
      },
    };
    listeners.forEach((l) => l(current));
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/unit/prompt.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/prompt.ts tests/unit/prompt.test.ts
git commit -m "feat(ui): add promptDialog state utility"
```

---

## Task 2: PromptDialog component

**Files:**
- Create: `src/components/ui/PromptDialog.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create the PromptDialog component**

Create `src/components/ui/PromptDialog.tsx`:

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from './Button';
import { fade, scaleFade } from '@/lib/motion';
import { subscribe, type PromptState } from '@/lib/utils/prompt';

export function PromptDialog() {
  const [state, setState] = useState<PromptState | null>(null);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => subscribe((s) => {
    setState(s);
    setValue(s?.defaultValue ?? '');
  }), []);

  useEffect(() => {
    if (!state) return;
    // Focus and select after the modal mounts.
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(id);
  }, [state]);

  return (
    <AnimatePresence>
      {state && (
        <motion.div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-6"
          variants={fade}
          initial="hidden"
          animate="show"
          exit="exit"
        >
          <motion.div
            className="bg-panel border border-border-strong rounded-xl p-6 w-[420px]"
            variants={scaleFade}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            <div className="font-semibold text-fg mb-2">{state.title}</div>
            {state.message && (
              <div className="text-sm text-muted mb-4">{state.message}</div>
            )}
            {state.label && (
              <label className="block text-xs font-medium text-muted-2 mb-1">
                {state.label}
              </label>
            )}
            <input
              ref={inputRef}
              className="mb-2 w-full rounded border border-border-strong bg-panel-2 px-2 py-1.5 text-sm text-fg focus:outline-none focus:border-brand"
              value={value}
              placeholder={state.placeholder}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  state.resolve(value);
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  state.resolve(null);
                }
              }}
            />
            <div className="text-xs text-muted-2 mb-6">Leave blank to use the default name.</div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => state.resolve(null)}>Cancel</Button>
              <Button variant="primary" onClick={() => state.resolve(value)}>
                {state.confirmLabel}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Mount it in the root layout**

In `src/app/layout.tsx`, add the import and render `<PromptDialog />` after `<ConfirmDialog />`:

```tsx
import './globals.css';
import type { Metadata } from 'next';
import { ToastViewport } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PromptDialog } from '@/components/ui/PromptDialog';
import { MotionProvider } from '@/components/providers/MotionProvider';

export const metadata: Metadata = {
  title: 'GlobalTT Editor',
  description: 'Email campaign editor',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <MotionProvider>
          {children}
          <ToastViewport />
          <ConfirmDialog />
          <PromptDialog />
        </MotionProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/PromptDialog.tsx src/app/layout.tsx
git commit -m "feat(ui): add PromptDialog component and mount in root layout"
```

---

## Task 3: Duplicate API accepts optional name

**Files:**
- Modify: `src/app/api/projects/[id]/duplicate/route.ts`
- Test: `tests/unit/duplicate-route.test.ts`

- [ ] **Step 1: Refactor the route so name resolution is testable**

Replace `src/app/api/projects/[id]/duplicate/route.ts` with:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface Ctx {
  params: Promise<{ id: string }>;
}

export function resolveDuplicateName(requested: unknown, sourceName: string): string {
  if (typeof requested === 'string') {
    const trimmed = requested.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return `${sourceName} (copy)`;
}

async function readBody(req: NextRequest): Promise<{ name?: unknown }> {
  try {
    const body = await req.json();
    if (body && typeof body === 'object') return body as { name?: unknown };
  } catch {
    // missing or invalid JSON body — treat as empty
  }
  return {};
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: src, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!src) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const body = await readBody(req);
  const name = resolveDuplicateName(body.name, src.name);

  const { data, error: insErr } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      org_id: src.org_id,
      name,
      data: src.data,
      template_source: src.template_source,
      raw_html_path: src.raw_html_path,
      brand_kit_id: src.brand_kit_id,
    })
    .select('id')
    .single();

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
```

- [ ] **Step 2: Write tests for the name resolver**

Create `tests/unit/duplicate-route.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveDuplicateName } from '@/app/api/projects/[id]/duplicate/route';

describe('resolveDuplicateName', () => {
  it('uses the trimmed requested name when non-empty', () => {
    expect(resolveDuplicateName('  Hello  ', 'Original')).toBe('Hello');
  });

  it('falls back to "<source> (copy)" when name is missing', () => {
    expect(resolveDuplicateName(undefined, 'Original')).toBe('Original (copy)');
  });

  it('falls back when name is an empty or whitespace string', () => {
    expect(resolveDuplicateName('', 'Original')).toBe('Original (copy)');
    expect(resolveDuplicateName('   ', 'Original')).toBe('Original (copy)');
  });

  it('falls back when name is a non-string value', () => {
    expect(resolveDuplicateName(123 as unknown, 'Original')).toBe('Original (copy)');
    expect(resolveDuplicateName(null, 'Original')).toBe('Original (copy)');
  });
});
```

- [ ] **Step 3: Run tests + typecheck**

Run: `npm test -- tests/unit/duplicate-route.test.ts && npm run typecheck`
Expected: PASS (4 tests), no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/projects/[id]/duplicate/route.ts tests/unit/duplicate-route.test.ts
git commit -m "feat(api): duplicate route accepts optional name in body"
```

---

## Task 4: Client SDK passes name through

**Files:**
- Modify: `src/lib/api/projects.ts`

- [ ] **Step 1: Update `duplicateProject` signature**

Replace the existing `duplicateProject` in `src/lib/api/projects.ts`:

```ts
export async function duplicateProject(id: string, name?: string): Promise<{ id: string }> {
  const init: RequestInit = { method: 'POST' };
  if (typeof name === 'string') {
    init.headers = { 'content-type': 'application/json' };
    init.body = JSON.stringify({ name });
  }
  const res = await fetch(`/api/projects/${id}/duplicate`, init);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/api/projects.ts
git commit -m "feat(api-client): duplicateProject accepts optional name"
```

---

## Task 5: Rewire ProjectCard.onDuplicate

**Files:**
- Modify: `src/components/dashboard/ProjectCard.tsx`

- [ ] **Step 1: Update imports**

Replace the imports block at the top of `src/components/dashboard/ProjectCard.tsx` with:

```tsx
'use client';

import { Copy, Loader2, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/Button';
import { spring } from '@/lib/motion';
import { deleteProject, duplicateProject, patchProject, type ProjectSummary } from '@/lib/api/projects';
import { confirmDialog } from '@/lib/utils/confirm';
import { promptDialog } from '@/lib/utils/prompt';
import { toast } from '@/lib/utils/toast';
```

Note: `useRouter` import removed.

- [ ] **Step 2: Remove the router and replace `onDuplicate`**

In the component body:

- Delete the line `const router = useRouter();`.
- Replace the existing `onDuplicate` function with:

```tsx
  async function onDuplicate() {
    const result = await promptDialog({
      title: 'Duplicate project',
      label: 'Name',
      defaultValue: `${project.name} (copy)`,
      confirmLabel: 'Duplicate',
    });
    if (result === null) return;
    start(async () => {
      try {
        await duplicateProject(project.id, result.length > 0 ? result : undefined);
        toast.success('Project duplicated');
        onChanged();
      } catch (err) {
        toast.error(err instanceof Error && err.message ? err.message : 'Could not duplicate project');
      }
    });
  }
```

- [ ] **Step 3: Swap the icon for a spinner while pending**

Replace the duplicate `<Button>` in the JSX:

```tsx
        <Button
          variant="secondary"
          className="h-9 w-9 min-h-0 !px-0 !py-0"
          onClick={onDuplicate}
          disabled={pending}
          title="Duplicate"
          aria-label="Duplicate"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
        </Button>
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS, no unused-import errors.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/ProjectCard.tsx
git commit -m "feat(dashboard): name prompt + spinner + toast for duplicate"
```

---

## Task 6: Manual verification

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Open: `http://localhost:3000` and sign in.

- [ ] **Step 2: Verify the happy path with default name**

- Click the duplicate icon on any project card.
- Confirm the dialog opens with the input pre-filled `"<name> (copy)"` and focused/selected.
- Click **Duplicate** without changing the value.
- Expected: the duplicate button shows a spinner briefly, then a green success toast `"Project duplicated"` appears, the grid refreshes with the new card named `"<name> (copy)"`, and the URL does NOT change.

- [ ] **Step 3: Verify the happy path with a custom name**

- Duplicate again, type `My custom copy`, press Enter.
- Expected: new card appears named `My custom copy`.

- [ ] **Step 4: Verify cancel + empty submit + keyboard**

- Open the prompt, press Escape → nothing happens.
- Open the prompt, click Cancel → nothing happens.
- Open the prompt, clear the input, press Enter → new card is created with the auto-name `"<name> (copy)"`.

- [ ] **Step 5: Verify error path**

- In DevTools Network, set the duplicate request to fail (e.g. block `/api/projects/*/duplicate`).
- Trigger duplicate.
- Expected: error toast appears; duplicate button returns to its idle icon; no new card is added.

- [ ] **Step 6: Verify double-click is safe**

- Trigger duplicate, then immediately click the duplicate icon on the same card again while the spinner is showing.
- Expected: the second click is ignored (button is disabled).

- [ ] **Step 7: Note any issues**

If any of the manual steps fail, fix in a follow-up commit before declaring done. If all pass, no additional commit is needed.
