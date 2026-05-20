# Invite Copy-Link + Sidebar Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Two small features bundled — (A) surface the invite link in the UI so owners can share it manually, (B) topbar button to hide / show the left sidebar.

---

### Task 1: Invite token in GET + post-create URL modal + per-row Copy link

**Files:**
- Modify: `src/app/api/workspaces/[slug]/invites/route.ts`
- Modify: `src/app/w/[slug]/settings/members/MembersPanel.tsx`

- [ ] **Step 1: Add `token` to the GET response**

In `src/app/api/workspaces/[slug]/invites/route.ts`, find the `GET` handler's `.select(...)` call and add `token` to the column list:

```ts
.select('id, org_id, email, role, token, expires_at, accepted_at, created_at, invited_by')
```

(The POST handler already selects and returns `token` — no change needed there.)

- [ ] **Step 2: Add `token` to the client InviteRow type**

In `MembersPanel.tsx`, add `token: string;` to `InviteRow`:

```ts
export interface InviteRow {
  id: string;
  org_id: string;
  email: string;
  role: Role;
  token: string;        // new
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  invited_by: string;
}
```

- [ ] **Step 3: Add a helper to build the invite URL**

In `MembersPanel.tsx`, near the top (after constants), add:

```ts
function inviteUrl(token: string): string {
  if (typeof window === 'undefined') return `/invite/${token}`;
  return `${window.location.origin}/invite/${token}`;
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Show the post-create modal**

Add a state variable in `MembersPanel`:

```tsx
const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null);
```

In `InviteDialog.send()`, after the success path, change the existing `toast.success` + `onInvited()` sequence so that the dialog calls back with the token. The simplest refactor: have `onInvited` accept the token.

Update the `InviteDialogProps` interface:

```ts
interface InviteDialogProps {
  open: boolean;
  onClose: () => void;
  slug: string;
  onInvited: (token: string) => void;
}
```

In `send()`, replace:

```ts
toast.success(`Invite sent to ${next}`);
setEmail('');
setRole('editor');
onInvited();
```

with:

```ts
const data = (await res.json().catch(() => ({}))) as { invite?: { token?: string } };
const token = data.invite?.token;
toast.success(`Invite created for ${next}`);
setEmail('');
setRole('editor');
onInvited(token ?? '');
```

In the parent `MembersPanel`, update the `onInvited` callback:

```tsx
<InviteDialog
  open={inviteOpen}
  onClose={() => setInviteOpen(false)}
  slug={slug}
  onInvited={(token) => {
    setInviteOpen(false);
    if (token) setCreatedInviteUrl(inviteUrl(token));
    router.refresh();
  }}
/>
```

- [ ] **Step 5: Render the post-create URL modal**

Add a new sub-component at the bottom of `MembersPanel.tsx`:

```tsx
interface CreatedInviteDialogProps {
  url: string | null;
  onClose: () => void;
}

function CreatedInviteDialog({ url, onClose }: CreatedInviteDialogProps) {
  const [copied, setCopied] = useState(false);
  if (!url) return null;
  async function copy() {
    const ok = await copyToClipboard(url!);
    if (ok) {
      setCopied(true);
      toast.success('Invite link copied');
      window.setTimeout(() => setCopied(false), 1500);
    } else {
      toast.error('Failed to copy');
    }
  }
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-6"
        onClick={onClose}
        variants={fade}
        initial="hidden"
        animate="show"
        exit="exit"
      >
        <motion.div
          className="w-[500px] max-w-full rounded-xl border border-border-strong bg-panel p-6"
          onClick={(e) => e.stopPropagation()}
          variants={scaleFade}
          initial="hidden"
          animate="show"
          exit="exit"
        >
          <div className="mb-1 font-semibold text-fg">Invite link ready</div>
          <div className="mb-4 text-sm text-muted">
            Email delivery isn&apos;t set up yet. Copy this link and send it to your teammate manually. It expires in 7 days.
          </div>
          <Field label="Invite URL">
            <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
          </Field>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Done</Button>
            <Button onClick={copy}>{copied ? 'Copied!' : 'Copy link'}</Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
```

Mount it in `MembersPanel`'s return, after the existing `<InviteDialog ... />`:

```tsx
<CreatedInviteDialog url={createdInviteUrl} onClose={() => setCreatedInviteUrl(null)} />
```

- [ ] **Step 6: Add "Copy link" action to pending invites**

In the pending invites table, modify each row's right-side action cell. Today there's a single `Revoke` button for managers. Change it to:

```tsx
<td className="px-4 py-3 text-right">
  <div className="inline-flex items-center gap-1 justify-end">
    <Button
      variant="ghost"
      onClick={async () => {
        const ok = await copyToClipboard(inviteUrl(inv.token));
        if (ok) toast.success('Invite link copied');
        else toast.error('Failed to copy');
      }}
    >
      Copy link
    </Button>
    {canManage && (
      <Button
        variant="ghost"
        onClick={() => revokeInvite(inv)}
        disabled={busy}
        className="text-danger hover:text-danger hover:bg-danger/10"
      >
        Revoke
      </Button>
    )}
  </div>
</td>
```

- [ ] **Step 7: Add the manual-share note above the pending invites section**

Inside the existing pending invites `<section>`, insert below the `<h2>`:

```tsx
<div className="rounded-md border border-border-strong bg-panel px-4 py-2 text-xs text-muted">
  Invite links don&apos;t send emails yet — share the link manually until email delivery lands.
</div>
```

- [ ] **Step 8: Typecheck + tests + commit**

```
npm run typecheck && npm test -- --run
git add src/app/api/workspaces/[slug]/invites/route.ts src/app/w/[slug]/settings/members/MembersPanel.tsx
git commit -m "feat(invites): copy-link UX after create and per-row in pending list"
```

---

### Task 2: Sidebar hide/collapse toggle

**Files:**
- Modify: `src/components/editor/EditorShell.tsx`
- Modify: `src/components/editor/Topbar.tsx`

- [ ] **Step 1: Sidebar visibility state in EditorShell.Inner**

In `src/components/editor/EditorShell.tsx`, inside `Inner`:

```tsx
const [leftPanelOpen, setLeftPanelOpen] = useState(true);
```

Add `useState` to the React import block. Pass two new props to `Topbar`:

```tsx
<Topbar
  slug={workspaceSlug}
  currentWorkspace={currentWorkspace}
  workspaces={workspaces}
  leftPanelOpen={leftPanelOpen}
  setLeftPanelOpen={setLeftPanelOpen}
/>
```

And conditionally render `<LeftPanel />`:

```tsx
<div className="flex flex-1 overflow-hidden">
  {leftPanelOpen && <LeftPanel />}
  <div className="flex-1 bg-[#080808]"><Preview /></div>
</div>
```

- [ ] **Step 2: Topbar toggle button + keyboard shortcut**

In `src/components/editor/Topbar.tsx`, extend `TopbarProps`:

```ts
interface TopbarProps {
  slug: string;
  currentWorkspace: WorkspaceOption;
  workspaces: WorkspaceOption[];
  leftPanelOpen: boolean;
  setLeftPanelOpen: (open: boolean) => void;
}
```

Destructure in the function signature. Add `PanelLeftClose, PanelLeftOpen` to the lucide-react import block.

Add a sidebar toggle button as the FIRST item in the `ml-auto` right-side cluster (before the existing `canEdit && (...)` group). Wrap in a `canEdit` check too:

```tsx
{canEdit && (
  <button
    type="button"
    onClick={() => setLeftPanelOpen(!leftPanelOpen)}
    title={leftPanelOpen ? 'Hide sidebar (Ctrl/Cmd+\\)' : 'Show sidebar (Ctrl/Cmd+\\)'}
    aria-label={leftPanelOpen ? 'Hide sidebar' : 'Show sidebar'}
    className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-2.5 py-1.5 text-xs text-fg hover:bg-panel hover:border-brand/40 transition-colors"
  >
    {leftPanelOpen ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
  </button>
)}
```

Add a keyboard shortcut in the same component:

```tsx
useEffect(() => {
  if (!canEdit) return;
  function onKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
      e.preventDefault();
      setLeftPanelOpen(!leftPanelOpen);
    }
  }
  document.addEventListener('keydown', onKey);
  return () => document.removeEventListener('keydown', onKey);
}, [canEdit, leftPanelOpen, setLeftPanelOpen]);
```

Add `useEffect` to the React import line.

- [ ] **Step 3: Typecheck + tests + commit**

```
npm run typecheck && npm test -- --run
git add src/components/editor/EditorShell.tsx src/components/editor/Topbar.tsx
git commit -m "feat(editor): topbar button + Cmd/Ctrl+\\ to hide/show the sidebar"
```

---

### Task 3: Manual verification

- [ ] Open the workspace settings → members. Click `Invite member` → fill email/role → send. A modal appears with the invite URL and a `Copy` button.
- [ ] Refresh; the pending invite row now has a `Copy link` action that puts the same URL on the clipboard.
- [ ] Open an email project. Click the sidebar-toggle button in the topbar. Sidebar hides, canvas expands. Click again → sidebar restores.
- [ ] Press Cmd+\\ (Mac) or Ctrl+\\ (Win) → same toggle.
- [ ] Toggle works in both Edit and Preview modes (the toggle only renders for editors, not viewers).
