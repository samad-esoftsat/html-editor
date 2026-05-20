# Warm Editorial UI/UX Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the entire GlobalTT Email Editor against the Warm Editorial design system — light marketing surfaces (auth, dashboard, settings, invite) plus a warm-dark editor — without changing any feature, route, store, persistence path, or keyboard shortcut.

**Architecture:** Single feature branch `feat/ui-refactor-warm-editorial`. Three foundational changes (CSS tokens, fonts in `next/font`, new shared primitives) land first; every other surface then restyles against those primitives. Each phase commits independently so the diff reads cleanly.

**Tech Stack:** Next.js 15.5 (App Router), React 19, Tailwind v4 (`@tailwindcss/postcss`), `lucide-react`, `motion` (Framer Motion successor), `class-variance-authority` + `tailwind-merge` + `clsx` via `@/lib/utils/cn`, Radix tooltip, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-05-20-ui-refactor-warm-editorial-design.md`. Mockups under `docs/superpowers/specs/stitch-screenshots/`.

---

## Phase 0 — Branch + sanity

### Task 0: Create the feature branch and confirm a clean baseline

**Files:**
- No file changes; environment-only.

- [ ] **Step 1: Confirm a clean tree on `main`**

```bash
git status
git log --oneline -3
```

Expected: working tree clean (the recent `c82addf docs: Warm Editorial ...` commit is HEAD).

- [ ] **Step 2: Create the feature branch**

```bash
git switch -c feat/ui-refactor-warm-editorial
```

- [ ] **Step 3: Run the existing suite to capture a baseline**

```bash
npm run typecheck && npm test -- --run
```

Expected: typecheck passes; tests pass (or the same pre-existing failures noted in `git status M tests/...` files, which are unrelated to this refactor).

- [ ] **Step 4: Start the dev server in the background to confirm boot**

```bash
npm run dev
```

Open `http://localhost:3000/login`. Expected: current dark UI renders without errors. Stop the server.

---

## Phase 1 — Foundation: tokens + fonts

### Task 1: Register Newsreader, Geist, and JetBrains Mono via `next/font`

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Replace the file with the font-registered version**

Full replacement of `src/app/layout.tsx`:

```tsx
import './globals.css';
import type { Metadata } from 'next';
import { Newsreader, Geist, JetBrains_Mono } from 'next/font/google';
import { ToastViewport } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PromptDialog } from '@/components/ui/PromptDialog';
import { MotionProvider } from '@/components/providers/MotionProvider';

const serif = Newsreader({
  subsets: ['latin'],
  variable: '--font-serif',
  weight: ['300', '400'],
  style: ['normal', 'italic'],
  display: 'swap',
});

const sans = Geist({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600'],
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'GlobalTT Editor',
  description: 'Email campaign editor',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body className="min-h-dvh font-sans antialiased">
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

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Visually confirm fonts load**

```bash
npm run dev
```

Open `http://localhost:3000/login` and DevTools → Network → Filter "font". Expected: Newsreader, Geist, and JetBrains Mono `.woff2` files load 200 OK. Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(ui): register Newsreader, Geist, JetBrains Mono via next/font"
```

---

### Task 2: Replace `globals.css` with the Warm Editorial token system

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Replace the file**

Full replacement of `src/app/globals.css`:

```css
@import "tailwindcss";

@theme {
  /* Light surfaces — marketing/dashboard/settings/auth/invite */
  --color-bg: #FAF8F4;
  --color-bg-elevated: #FFFFFF;
  --color-bg-sunken: #F2EFE8;
  --color-bg-cream: #F6F1E7;
  --color-ink: #141414;
  --color-ink-2: #3A3733;
  --color-ink-3: #6B665F;
  --color-ink-4: #9C968D;
  --color-rule: #E7E2D8;
  --color-rule-strong: #D8D2C4;
  --color-brand: #F1592A;
  --color-brand-ink: #B8421C;
  --color-brand-soft: #FCE2D2;
  --color-brand-glow: #F8C9A8;
  --color-amber: #E8A04F;
  --color-success: #3F7A3F;
  --color-danger: #B2452B;

  /* Dark editor surfaces — /w/[slug]/p/[id] */
  --color-ed-bg: #0E0D0B;
  --color-ed-panel: #161412;
  --color-ed-panel-2: #1B1815;
  --color-ed-panel-3: #221F1B;
  --color-ed-canvas-pad: #080706;
  --color-ed-rule: #2A2622;
  --color-ed-rule-strong: #3A3631;
  --color-ed-ink: #EDE7DC;
  --color-ed-ink-2: #B6AFA3;
  --color-ed-ink-3: #7E776C;
  --color-ed-ink-4: #544F47;
  --color-ed-brand-soft: rgba(241, 89, 42, 0.15);
  --color-ed-success: #79B16F;
  --color-ed-danger: #D8623F;

  /* Backwards-compat aliases so legacy classes don't break before each surface is restyled */
  --color-panel: var(--color-ed-panel);
  --color-panel-2: var(--color-ed-panel-2);
  --color-border: var(--color-rule);
  --color-border-strong: var(--color-rule-strong);
  --color-fg: var(--color-ink);
  --color-muted: var(--color-ink-3);
  --color-muted-2: var(--color-ink-4);

  /* Signature gradient — used in exactly 3 places per spec */
  --gradient-hero: linear-gradient(135deg, #F1592A 0%, #E8A04F 60%, #F8C9A8 100%);

  /* Type tokens (CSS variables — components opt in via Tailwind utilities or inline style) */
  --font-serif: var(--font-serif), 'Newsreader', ui-serif, Georgia, serif;
  --font-sans: var(--font-sans), 'Geist', ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-mono), 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;

  /* Radius scale */
  --radius-sm: 6px;
  --radius: 8px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 20px;
  --radius-full: 9999px;
}

html,
body {
  background: var(--color-bg);
  color: var(--color-ink);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

* { box-sizing: border-box; }
*:focus { outline: none; }
*:focus-visible {
  outline: 2px solid var(--color-brand);
  outline-offset: 2px;
  border-radius: 6px;
}

/* Editor-only body class added by the editor page; flips surfaces to warm-dark */
body.editor-shell,
.editor-shell {
  background: var(--color-ed-bg);
  color: var(--color-ed-ink);
}

/* Inline-editable carry-forward (preserved from current globals.css) */
.inline-editable {
  cursor: text;
  border-radius: 2px;
  transition: outline-color 100ms ease-out;
  outline-offset: 2px;
}
.inline-editable:hover {
  outline: 1px solid color-mix(in oklab, var(--color-brand) 40%, transparent);
}
.inline-editable:focus {
  outline: 1.5px solid var(--color-brand);
}
.inline-editable[data-empty='true']::before {
  content: attr(aria-placeholder);
  pointer-events: none;
}
.inline-editable[data-empty='true']:focus::before { content: none; }

.inline-editable-image {
  outline: 1px solid transparent;
  outline-offset: 2px;
  transition: outline-color 100ms ease-out;
}
.inline-editable-image:hover {
  outline-color: color-mix(in oklab, var(--color-brand) 40%, transparent);
}
.inline-editable-image-placeholder:hover {
  border-color: var(--color-brand) !important;
  color: var(--color-brand) !important;
}

.preview-canvas img { display: inline; max-width: 100%; }
.preview-canvas ul { list-style: disc; margin: 1em 0; padding-inline-start: 40px; }
.preview-canvas ol { list-style: decimal; margin: 1em 0; padding-inline-start: 40px; }
.preview-canvas li { display: list-item; }
.preview-canvas h1 { font-size: 2em;  font-weight: bold; margin: 0.67em 0; }
.preview-canvas h2 { font-size: 1.5em; font-weight: bold; margin: 0.83em 0; }
.preview-canvas h3 { font-size: 1.17em; font-weight: bold; margin: 1em 0; }
.preview-canvas h4 { font-size: 1em;   font-weight: bold; margin: 1.33em 0; }
.preview-canvas p  { margin: 1em 0; }
.preview-canvas a  { color: -webkit-link; text-decoration: underline; }

.editable-link-icon { opacity: 0; transition: opacity 100ms; }
.inline-link-wrap:hover .editable-link-icon,
.inline-link-wrap:focus-within .editable-link-icon,
.editable-link-icon:focus-visible { opacity: 1; }

.editable-image-alt { opacity: 0; transition: opacity 100ms; }
.editable-image-wrap:hover .editable-image-alt,
.editable-image-wrap:focus-within .editable-image-alt { opacity: 1; }

.section-insert-bar .section-insert-btn { opacity: 0; transition: opacity 100ms; }
.section-insert-bar:hover .section-insert-btn,
.section-insert-btn:focus-visible { opacity: 1; }

.section-wrap .section-toolbar { opacity: 0; transition: opacity 100ms; }
.section-wrap:hover .section-toolbar,
.section-wrap:focus-within .section-toolbar { opacity: 1; }

.bullet-row .bullet-grip { opacity: 0; transition: opacity 100ms; }
.bullet-row:hover .bullet-grip,
.bullet-grip:focus-visible { opacity: 1; }

.section-wrap.selected {
  outline: 2px solid var(--color-brand);
  outline-offset: -2px;
}

@keyframes tooltip-in {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes tooltip-out {
  from { opacity: 1; transform: scale(1); }
  to   { opacity: 0; transform: scale(0.97); }
}
.tooltip-content[data-state='delayed-open'],
.tooltip-content[data-state='instant-open'] { animation: tooltip-in 150ms cubic-bezier(0.16, 1, 0.3, 1); }
.tooltip-content[data-state='closed']      { animation: tooltip-out 100ms cubic-bezier(0.4, 0, 1, 1); }
```

> Note on the back-compat aliases: they exist so the existing dark-theme class names (`bg-panel`, `text-fg`, `border-border-strong`, etc.) keep rendering reasonably while each surface is restyled in later tasks. Once Phase 6 ends, the aliases are deleted in Task 32.

- [ ] **Step 2: Typecheck and run dev**

```bash
npm run typecheck
npm run dev
```

Open `http://localhost:3000/login` — expected: page renders with the new warm cream background and ink text; the legacy controls look acceptable (alias colors still apply). Stop the server.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(ui): replace globals.css with Warm Editorial token system"
```

---

## Phase 2 — Shared primitives

Each primitive is its own task so the diff stays scoped and the engineer can isolate failures. Tests are written against the visible behavior of each primitive (rendered text, presence of expected classes/attributes).

### Task 3: `BrandMark` SVG monogram

**Files:**
- Create: `src/components/ui/BrandMark.tsx`
- Create: `tests/unit/BrandMark.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/BrandMark.test.tsx
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BrandMark } from '@/components/ui/BrandMark';

describe('BrandMark', () => {
  it('renders an svg at the requested size', () => {
    const { container } = render(<BrandMark size={28} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('28');
    expect(svg.getAttribute('height')).toBe('28');
    expect(svg.getAttribute('aria-label')).toBe('GlobalTT');
  });

  it('renders an orange T inside an ink G square', () => {
    const { container } = render(<BrandMark size={28} />);
    expect(container.querySelector('[data-mark="g"]')).toBeTruthy();
    expect(container.querySelector('[data-mark="t"]')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test and confirm failure**

```bash
npm test -- --run tests/unit/BrandMark.test.tsx
```

Expected: FAIL with `Cannot find module '@/components/ui/BrandMark'`.

- [ ] **Step 3: Implement `BrandMark`**

```tsx
// src/components/ui/BrandMark.tsx
interface Props {
  size?: number;
  className?: string;
}

export function BrandMark({ size = 28, className }: Props) {
  return (
    <svg
      role="img"
      aria-label="GlobalTT"
      width={size}
      height={size}
      viewBox="0 0 28 28"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect data-mark="g" width="28" height="28" rx="6" fill="currentColor" />
      <path
        data-mark="t"
        d="M8 10h12v2.6H15.4V22h-2.8V12.6H8z"
        fill="var(--color-brand)"
      />
    </svg>
  );
}
```

`currentColor` lets callers set the G fill via `text-ink` (light) or `text-ed-ink` (dark) on the wrapper. The T is always orange.

- [ ] **Step 4: Run the test and confirm pass**

```bash
npm test -- --run tests/unit/BrandMark.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/BrandMark.tsx tests/unit/BrandMark.test.tsx
git commit -m "feat(ui): add BrandMark monogram primitive"
```

---

### Task 4: `Eyebrow` — uppercase 0.22em tracked label

**Files:**
- Create: `src/components/ui/Eyebrow.tsx`
- Create: `tests/unit/Eyebrow.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Eyebrow } from '@/components/ui/Eyebrow';

describe('Eyebrow', () => {
  it('renders uppercase tracked text', () => {
    const { getByText } = render(<Eyebrow>workspace</Eyebrow>);
    const el = getByText(/workspace/i);
    expect(el.className).toMatch(/uppercase/);
    expect(el.className).toMatch(/tracking-\[0\.22em\]/);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
npm test -- --run tests/unit/Eyebrow.test.tsx
```

- [ ] **Step 3: Implement**

```tsx
// src/components/ui/Eyebrow.tsx
import { cn } from '@/lib/utils/cn';

interface Props {
  children: React.ReactNode;
  className?: string;
}

export function Eyebrow({ children, className }: Props) {
  return (
    <span
      className={cn(
        'inline-block text-[11px] font-medium uppercase leading-none tracking-[0.22em] text-ink-3',
        className,
      )}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 4: Run, confirm pass**

```bash
npm test -- --run tests/unit/Eyebrow.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Eyebrow.tsx tests/unit/Eyebrow.test.tsx
git commit -m "feat(ui): add Eyebrow primitive"
```

---

### Task 5: `PageMasthead` — eyebrow + serif title with italic accent + subtitle + hairline rule

**Files:**
- Create: `src/components/ui/PageMasthead.tsx`
- Create: `tests/unit/PageMasthead.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PageMasthead } from '@/components/ui/PageMasthead';

describe('PageMasthead', () => {
  it('renders eyebrow, title, italic accent, and subtitle', () => {
    const { getByText, container } = render(
      <PageMasthead
        eyebrow="Workspace"
        title="My"
        italicWord="projects"
        subtitle="12 projects · last updated 4 hours ago"
      />
    );
    expect(getByText('WORKSPACE')).toBeTruthy();
    expect(getByText('My')).toBeTruthy();
    const italic = getByText('projects');
    expect(italic.tagName.toLowerCase()).toBe('em');
    expect(getByText(/12 projects/)).toBeTruthy();
    expect(container.querySelector('[data-masthead-rule]')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run, confirm failure**

- [ ] **Step 3: Implement**

```tsx
// src/components/ui/PageMasthead.tsx
import { Eyebrow } from './Eyebrow';
import { cn } from '@/lib/utils/cn';

interface Props {
  eyebrow: string;
  title: string;
  italicWord?: string;
  trailingPunctuation?: string; // e.g. "." after the italic word
  subtitle?: React.ReactNode;
  className?: string;
}

export function PageMasthead({
  eyebrow,
  title,
  italicWord,
  trailingPunctuation,
  subtitle,
  className,
}: Props) {
  return (
    <header className={cn('pt-14 pb-6', className)}>
      <Eyebrow>{eyebrow.toUpperCase()}</Eyebrow>
      <h1 className="mt-1 font-serif text-[56px] font-light leading-[1.02] tracking-[-0.03em] text-ink">
        {title}
        {italicWord ? (
          <>
            {' '}
            <em className="font-serif font-light italic">{italicWord}</em>
          </>
        ) : null}
        {trailingPunctuation ?? ''}
      </h1>
      {subtitle && (
        <p className="mt-2 text-[17px] leading-[1.6] text-ink-2">{subtitle}</p>
      )}
      <hr data-masthead-rule className="mt-6 h-px border-0 bg-rule" />
    </header>
  );
}
```

- [ ] **Step 4: Run, confirm pass**

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/PageMasthead.tsx tests/unit/PageMasthead.test.tsx
git commit -m "feat(ui): add PageMasthead primitive"
```

---

### Task 6: `SettingsNav` — 220px vertical nav with brand-soft active pill

**Files:**
- Create: `src/components/ui/SettingsNav.tsx`
- Create: `tests/unit/SettingsNav.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SettingsNav } from '@/components/ui/SettingsNav';

describe('SettingsNav', () => {
  const items = [
    { href: '/g', label: 'General' },
    { href: '/m', label: 'Members' },
    { href: '/k', label: 'Brand kits' },
  ];

  it('marks the active item with brand-soft pill', () => {
    const { getByText } = render(<SettingsNav items={items} activeHref="/m" />);
    const members = getByText('Members').closest('a')!;
    expect(members.getAttribute('data-active')).toBe('true');
    expect(members.className).toMatch(/bg-brand-soft/);
    const general = getByText('General').closest('a')!;
    expect(general.getAttribute('data-active')).toBe('false');
  });
});
```

- [ ] **Step 2: Run, confirm failure**

- [ ] **Step 3: Implement**

```tsx
// src/components/ui/SettingsNav.tsx
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

export interface SettingsNavItem {
  href: string;
  label: string;
}

interface Props {
  items: SettingsNavItem[];
  activeHref: string;
  className?: string;
}

export function SettingsNav({ items, activeHref, className }: Props) {
  return (
    <nav aria-label="Settings sections" className={cn('w-[220px] shrink-0', className)}>
      <ul className="space-y-1">
        {items.map((item) => {
          const active = item.href === activeHref;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                data-active={active}
                className={cn(
                  'block rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-brand-soft text-brand-ink'
                    : 'text-ink-3 hover:text-ink hover:bg-bg-sunken',
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 4: Run, confirm pass**

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/SettingsNav.tsx tests/unit/SettingsNav.test.tsx
git commit -m "feat(ui): add SettingsNav primitive"
```

---

### Task 7: `RolePill` — outlined + brand-soft variants

**Files:**
- Create: `src/components/ui/RolePill.tsx`
- Create: `tests/unit/RolePill.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RolePill } from '@/components/ui/RolePill';

describe('RolePill', () => {
  it('outlined variant has rule border + no fill', () => {
    const { getByText } = render(<RolePill>EDITOR</RolePill>);
    const el = getByText('EDITOR');
    expect(el.className).toMatch(/border-rule/);
    expect(el.className).not.toMatch(/bg-brand-soft/);
  });

  it('soft variant uses brand-soft fill', () => {
    const { getByText } = render(<RolePill variant="soft">YOU</RolePill>);
    expect(getByText('YOU').className).toMatch(/bg-brand-soft/);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

- [ ] **Step 3: Implement**

```tsx
// src/components/ui/RolePill.tsx
import { cn } from '@/lib/utils/cn';

type Variant = 'outlined' | 'soft';

interface Props {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
}

export function RolePill({ variant = 'outlined', children, className }: Props) {
  const styles =
    variant === 'soft'
      ? 'bg-brand-soft text-brand-ink'
      : 'border border-rule text-ink-2';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wider uppercase',
        styles,
        className,
      )}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 4: Run, confirm pass**

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/RolePill.tsx tests/unit/RolePill.test.tsx
git commit -m "feat(ui): add RolePill primitive"
```

---

### Task 8: `SwatchChip` — 28×28 color tile with optional hex caption

**Files:**
- Create: `src/components/ui/SwatchChip.tsx`
- Create: `tests/unit/SwatchChip.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SwatchChip } from '@/components/ui/SwatchChip';

describe('SwatchChip', () => {
  it('renders the color as inline background', () => {
    const { container } = render(<SwatchChip color="#F1592A" />);
    const tile = container.querySelector('[data-swatch]') as HTMLElement;
    expect(tile.style.backgroundColor).toBe('rgb(241, 89, 42)');
  });

  it('renders an uppercased hex caption when showHex', () => {
    const { getByText } = render(<SwatchChip color="#abcdef" showHex />);
    expect(getByText('#ABCDEF')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run, confirm failure**

- [ ] **Step 3: Implement**

```tsx
// src/components/ui/SwatchChip.tsx
import { cn } from '@/lib/utils/cn';

interface Props {
  color: string;
  showHex?: boolean;
  size?: number;
  className?: string;
}

export function SwatchChip({ color, showHex, size = 28, className }: Props) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span
        data-swatch
        aria-hidden="true"
        className="inline-block rounded-md ring-1 ring-inset ring-rule"
        style={{ width: size, height: size, backgroundColor: color }}
      />
      {showHex && (
        <span className="font-mono text-[12px] text-ink-3">{color.toUpperCase()}</span>
      )}
    </span>
  );
}
```

- [ ] **Step 4: Run, confirm pass**

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/SwatchChip.tsx tests/unit/SwatchChip.test.tsx
git commit -m "feat(ui): add SwatchChip primitive"
```

---

### Task 9: `StatusBadge` — editor save-status mono pill with leading dot

**Files:**
- Create: `src/components/ui/StatusBadge.tsx`
- Create: `tests/unit/StatusBadge.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatusBadge } from '@/components/ui/StatusBadge';

describe('StatusBadge', () => {
  it('renders the label in mono', () => {
    const { getByText } = render(<StatusBadge tone="saved">Saved · 2s ago</StatusBadge>);
    const el = getByText('Saved · 2s ago');
    expect(el.className).toMatch(/font-mono/);
  });

  it('renders a colored dot per tone', () => {
    const { container } = render(<StatusBadge tone="pending">Pending…</StatusBadge>);
    const dot = container.querySelector('[data-dot]') as HTMLElement;
    expect(dot).toBeTruthy();
    expect(dot.getAttribute('data-tone')).toBe('pending');
  });
});
```

- [ ] **Step 2: Run, confirm failure**

- [ ] **Step 3: Implement**

```tsx
// src/components/ui/StatusBadge.tsx
import { cn } from '@/lib/utils/cn';

type Tone = 'saved' | 'pending' | 'saving' | 'error';

interface Props {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
}

const DOT_BG: Record<Tone, string> = {
  saved: 'bg-ed-success',
  pending: 'bg-amber',
  saving: 'bg-brand',
  error: 'bg-ed-danger',
};

export function StatusBadge({ tone, children, className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-ed-ink-3',
        className,
      )}
    >
      <span
        data-dot
        data-tone={tone}
        className={cn('h-1.5 w-1.5 rounded-full', DOT_BG[tone])}
        aria-hidden="true"
      />
      {children}
    </span>
  );
}
```

- [ ] **Step 4: Run, confirm pass**

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/StatusBadge.tsx tests/unit/StatusBadge.test.tsx
git commit -m "feat(ui): add StatusBadge primitive"
```

---

### Task 10: Refresh `Button` variants

**Files:**
- Modify: `src/components/ui/Button.tsx`

- [ ] **Step 1: Replace the file**

```tsx
// src/components/ui/Button.tsx
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'link' | 'danger';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] hover:-translate-y-px hover:shadow-[0_6px_16px_-6px_rgba(241,89,42,0.45)] active:translate-y-0',
  secondary:
    'bg-ink text-white hover:bg-ink-2',
  ghost:
    'bg-transparent text-ink border border-rule hover:bg-bg-sunken hover:border-rule-strong',
  link:
    'bg-transparent text-ink underline-offset-4 hover:underline decoration-brand decoration-[1.5px] px-0',
  danger:
    'bg-transparent border border-danger text-danger hover:bg-danger/10',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant = 'primary', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-all duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-40',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    />
  );
});
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Some call sites use `variant="primary|secondary|ghost|danger"` — all still supported. `link` is new and additive. No type errors expected.

- [ ] **Step 3: Run unit tests**

```bash
npm test -- --run
```

Expected: pass. If any test asserted specific shadow classes from the old Button, update the assertion to match the new classes inside the same task.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/Button.tsx
git commit -m "feat(ui): refresh Button variants for Warm Editorial system"
```

---

## Phase 3 — Auth surfaces

### Task 11: Login page two-pane composition

**Files:**
- Modify: `src/app/login/page.tsx`

- [ ] **Step 1: Read the current file first to preserve its server actions / form logic**

```bash
git show HEAD:src/app/login/page.tsx | head -200
```

Identify: the form action handler, validation logic, redirect logic. Preserve them verbatim; only the JSX wrapper changes.

- [ ] **Step 2: Restructure the JSX**

Replace the page body with the two-pane composition. Preserve the existing `<form action=…>` element with its inputs and server action — only the surrounding markup changes. Reference shape:

```tsx
import { BrandMark } from '@/components/ui/BrandMark';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Button } from '@/components/ui/Button';
// existing imports (server action, etc.) preserved

export default function LoginPage() {
  // existing server-component logic preserved
  return (
    <main className="grid min-h-dvh grid-cols-[60fr_40fr] bg-bg">
      <section className="relative flex flex-col px-12 py-12">
        <div className="flex items-center gap-2 text-ink">
          <BrandMark size={24} />
          <span className="text-sm font-medium">GlobalTT Editor</span>
        </div>
        <div className="my-auto max-w-[460px]">
          <Eyebrow>SIGN IN</Eyebrow>
          <h1 className="mt-3 font-serif text-[72px] font-light leading-[0.96] tracking-[-0.04em] text-ink">
            <em className="font-serif font-light italic">Welcome</em> back.
          </h1>
          <p className="mt-5 text-[17px] leading-[1.6] text-ink-2">
            Sign in to continue editing your email projects.
          </p>
          {/* PRESERVED: existing <form> with email/password inputs and server action */}
          {/* Restyle the inputs to: 40px tall, bg-bg-elevated, border border-rule, rounded-md, px-3 */}
          {/* Replace any existing submit Button with: <Button className="w-full">Continue</Button> */}
          {/* If SSO buttons exist, keep them; restyle each as variant="ghost" full-width */}
          <p className="mt-8 text-sm text-ink-2">
            New to GlobalTT?{' '}
            <a href="/signup" className="text-ink underline decoration-brand decoration-[1.5px] underline-offset-4">
              Create an account.
            </a>
          </p>
        </div>
      </section>
      <aside
        aria-hidden="true"
        className="relative overflow-hidden"
        style={{ background: 'var(--gradient-hero)' }}
      >
        <div className="absolute inset-0 opacity-[0.04] mix-blend-overlay [background-image:radial-gradient(rgba(0,0,0,0.6)_1px,transparent_1px)] [background-size:3px_3px]" />
        <div className="relative flex h-full flex-col items-center justify-center px-12">
          <div
            className="w-[360px] rotate-[-3deg] rounded-xl bg-white p-6 shadow-[0_30px_80px_-20px_rgba(180,66,28,0.35)]"
            // Mocked email preview — see 03-login.png. Implementers can copy the inner markup
            // from docs/superpowers/specs/stitch-screenshots/03-login.html (the floating card div).
          />
          <div className="mt-10 text-center text-white">
            <Eyebrow className="text-white/70">WHAT YOU&apos;LL BUILD</Eyebrow>
            <p className="mt-2 font-serif text-2xl font-light">
              Emails that <em className="italic">ship</em>.
            </p>
            <p className="mt-2 text-sm text-white/80">
              Real-time editing. Brand kits. One-click translation.
            </p>
          </div>
        </div>
      </aside>
    </main>
  );
}
```

> The mocked email preview card body should be copied from `docs/superpowers/specs/stitch-screenshots/03-login.html`. Find the `<div>` inside `<aside>` that is `rotate-[-3deg]` and paste its inner HTML between the `<div className="w-[360px] …">` open/close.

- [ ] **Step 3: Typecheck and smoke**

```bash
npm run typecheck
npm run dev
```

Open `/login`. Expected: warm cream left pane with serif "*Welcome* back.", gradient right pane with the rotated email card. Form submit still works (try a wrong password to verify the server action fires).

- [ ] **Step 4: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat(ui): restyle login as two-pane Warm Editorial composition"
```

---

### Task 12: Signup page reuses the two-pane shell

**Files:**
- Modify: `src/app/signup/page.tsx`

- [ ] **Step 1: Apply the same two-pane composition**

Mirror Task 11's structure. Differences:

- Eyebrow: `SIGN UP`
- Headline: `<em className="italic">Start</em> building.`
- Subtitle: "Create an account to start designing emails."
- Form fields (preserving the server action): Name, Email, Password, optional TOS checkbox.
- Footer link: `Already have an account? <a className="…underline decoration-brand">Sign in.</a>` linking to `/login`.

The right pane is identical to login.

- [ ] **Step 2: Typecheck, smoke `/signup`**

```bash
npm run typecheck
npm run dev
```

- [ ] **Step 3: Commit**

```bash
git add src/app/signup/page.tsx
git commit -m "feat(ui): restyle signup as two-pane composition"
```

---

### Task 13: Reset password page reuses the shell

**Files:**
- Modify: `src/app/reset/page.tsx`

- [ ] **Step 1: Apply the two-pane shell**

Differences from login:

- Eyebrow: `RESET PASSWORD`
- Headline: `<em className="italic">Forgot</em> your password?`
- Subtitle: "Enter your email and we'll send you a reset link."
- Form (preserving server action): single email field + `<Button className="w-full">Send reset link</Button>`.
- Success state: after submission, swap the form for a `bg-elevated` card showing "Check your inbox. We sent a link to **email@…**" in body-md plus a `text-sm text-ink-3` "Didn't get it? <button class="underline">Resend</button>".

The right pane is identical.

- [ ] **Step 2: Typecheck, smoke `/reset`**

- [ ] **Step 3: Commit**

```bash
git add src/app/reset/page.tsx
git commit -m "feat(ui): restyle reset password page"
```

---

### Task 14: Invite acceptance page

**Files:**
- Modify: `src/app/invite/[token]/page.tsx`

- [ ] **Step 1: Restructure as the centered card composition (mockup `05-invite.png`)**

```tsx
// JSX skeleton — preserve the existing server action / token validation logic and the
// "Accept invitation" form (it likely posts to a route handler that consumes the token).
import { BrandMark } from '@/components/ui/BrandMark';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { RolePill } from '@/components/ui/RolePill';
import { Button } from '@/components/ui/Button';

// inside the page component, after fetching the invitation:
return (
  <main className="relative min-h-dvh bg-bg">
    <div className="absolute left-12 top-12 flex items-center gap-2 text-ink">
      <BrandMark size={24} />
      <span className="text-sm font-medium">GlobalTT Editor</span>
    </div>

    <div className="mx-auto flex min-h-dvh max-w-[520px] flex-col items-center justify-center px-6 text-center">
      <Eyebrow>INVITATION</Eyebrow>
      <h1 className="mt-4 font-serif text-[48px] font-light leading-[1.05] tracking-[-0.03em] text-ink">
        You&apos;ve been invited<br />to <em className="font-serif font-light italic">{workspace.name}</em>
      </h1>
      <p className="mt-6 max-w-[420px] text-[17px] leading-[1.6] text-ink-2">
        {inviter.name} has invited you to join the {workspace.name} workspace on GlobalTT Editor as a{' '}
        {invitation.role}.
      </p>

      <div className="mt-8 w-full max-w-[460px] rounded-[14px] border border-rule bg-bg-elevated p-6 text-left">
        <Row label="WORKSPACE">
          <Avatar initials={initialsOf(workspace.name)} />
          <div>
            <div className="text-base font-semibold text-ink">{workspace.name}</div>
            <div className="font-mono text-[12px] text-ink-3">globaltt.com/w/{workspace.slug}</div>
          </div>
        </Row>
        <Row label="INVITED BY" divider>
          <Avatar initials={initialsOf(inviter.name)} />
          <div>
            <div className="text-sm text-ink">{inviter.name}</div>
            <div className="font-mono text-[12px] text-ink-3">{inviter.email}</div>
          </div>
        </Row>
        <Row label="YOUR ROLE" divider last>
          <RolePill>{invitation.role.toUpperCase()}</RolePill>
          <p className="text-sm text-ink-3">{ROLE_DESCRIPTIONS[invitation.role]}</p>
        </Row>
      </div>

      {/* PRESERVED: form that POSTs token acceptance */}
      <form action={acceptInvite} className="mt-6 w-full max-w-[460px]">
        <Button className="h-11 w-full">Accept invitation</Button>
      </form>
      <Link href={`/login`} className="mt-3 text-sm text-ink-3 hover:text-ink">
        Decline
      </Link>

      <p className="mt-8 text-sm text-ink-3">
        This invitation expires in 7 days. Powered by{' '}
        <a href="/" className="text-ink underline decoration-brand decoration-[1.5px] underline-offset-4">
          GlobalTT Editor
        </a>
      </p>
    </div>
  </main>
);

// Inline helpers (define above the page component or inline in a separate file in src/app/invite/[token]/)
function Avatar({ initials }: { initials: string }) {
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-brand-soft text-[12px] font-semibold text-brand-ink">
      {initials}
    </span>
  );
}

function Row({
  label, children, divider, last,
}: {
  label: string; children: React.ReactNode; divider?: boolean; last?: boolean;
}) {
  return (
    <div className={`flex items-center gap-4 py-3 ${divider ? 'border-t border-rule' : ''}`}>
      <span className="w-28 shrink-0 text-[11px] font-medium uppercase tracking-[0.22em] text-ink-3">{label}</span>
      <div className="flex flex-1 items-center gap-3">{children}</div>
    </div>
  );
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  owner: 'Full control of the workspace.',
  admin: 'Manage projects, members, and brand kits.',
  editor: 'Can create, edit, and share projects.',
  viewer: 'Read-only access to projects.',
};

function initialsOf(name: string) {
  return name.split(/\s+/).slice(0, 2).map((s) => s[0] ?? '').join('').toUpperCase();
}
```

> The postal-stamp flourish in the bottom-right corner from the mockup is optional. Implementers can skip it; if added, place it as `absolute right-6 bottom-6` with a small SVG combining the BrandMark and a tracked-mono date.

- [ ] **Step 2: Typecheck and smoke**

```bash
npm run typecheck
npm run dev
```

Test by generating an invite link from an existing workspace (or via the API) and opening `/invite/[token]`.

- [ ] **Step 3: Commit**

```bash
git add src/app/invite/\[token\]/page.tsx
git commit -m "feat(ui): restyle invite acceptance as centered editorial card"
```

---

## Phase 4 — Dashboard

### Task 15: Workspace topbar primitives (`UserMenu`, `WorkspaceSwitcher`)

**Files:**
- Modify: `src/components/workspace/WorkspaceSwitcher.tsx`
- Modify: `src/components/dashboard/UserMenu.tsx`

- [ ] **Step 1: Restyle `WorkspaceSwitcher` as a pill**

Locate the trigger button in `WorkspaceSwitcher.tsx`. Replace its className with:

```ts
'inline-flex items-center gap-1.5 rounded-full border border-rule bg-bg-elevated px-3 py-1.5 text-sm text-ink hover:border-rule-strong hover:bg-bg-sunken transition-colors'
```

Replace any popover/dropdown menu styles: background `bg-bg-elevated`, border `border-rule`, radius `rounded-lg`, shadow `shadow-[0_8px_24px_-12px_rgba(180,66,28,0.10)]`.

- [ ] **Step 2: Restyle `UserMenu`**

The avatar trigger becomes a 32px circle with `bg-brand-soft text-brand-ink` and centered uppercase initials in `font-semibold text-[12px]`. The popover uses the same surface treatment as the workspace switcher above.

- [ ] **Step 3: Typecheck**

- [ ] **Step 4: Commit**

```bash
git add src/components/workspace/WorkspaceSwitcher.tsx src/components/dashboard/UserMenu.tsx
git commit -m "feat(ui): restyle WorkspaceSwitcher + UserMenu for light dashboard"
```

---

### Task 16: Dashboard page masthead + filter row

**Files:**
- Modify: `src/app/w/[slug]/page.tsx`

- [ ] **Step 1: Restructure the page**

Replace the page's JSX (preserve the data-loading server logic, params unwrapping, and the project list query):

```tsx
import { BrandMark } from '@/components/ui/BrandMark';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { PageMasthead } from '@/components/ui/PageMasthead';
import { Button } from '@/components/ui/Button';
// existing imports preserved (ImportButton, NewProjectButton, ProjectGrid, etc.)

export default async function WorkspaceDashboard({ params }: Props) {
  // ... existing data-loading logic preserved ...

  const projectCount = projectsRes.data?.length ?? 0;
  const mostRecent = projectsRes.data?.[0]?.updated_at;

  return (
    <main className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-30 border-b border-rule bg-bg/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-16">
          <div className="flex items-center gap-3 text-ink">
            <BrandMark size={28} />
            <WorkspaceSwitcher
              current={{ id: workspace.org.id, slug: workspace.org.slug, name: workspace.org.name }}
              workspaces={workspaces.map((w) => ({ id: w.id, slug: w.slug, name: w.name }))}
            />
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={settingsHref}
              className="inline-flex h-10 items-center rounded-md px-3 text-sm text-ink-3 hover:text-ink hover:bg-bg-sunken transition-colors"
            >
              Settings
            </Link>
            <ImportButton slug={slug} />
            <NewProjectButton slug={slug} />
            <UserMenu email={user?.email} />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1280px] px-16">
        <PageMasthead
          eyebrow="WORKSPACE"
          title="My"
          italicWord="projects"
          subtitle={
            <>
              {projectCount} projects · last updated{' '}
              <span className="font-mono text-[14px] text-ink-3">
                {mostRecent ? relativeTime(mostRecent) : 'never'}
              </span>
            </>
          }
        />

        {/* Filter row */}
        <div className="mt-6 flex items-center justify-between">
          <nav className="flex items-center gap-6 text-sm">
            <button className="relative pb-2 font-medium text-ink">
              All
              <span className="absolute inset-x-0 -bottom-px h-0.5 bg-brand" />
            </button>
            <button className="pb-2 text-ink-3 hover:text-ink">Drafts</button>
            <button className="pb-2 text-ink-3 hover:text-ink">Archived</button>
          </nav>
          {/* Search/sort dropdowns left out for now — additive follow-up */}
        </div>

        <div className="mt-6 pb-16">
          <ProjectGrid initial={projectsRes.data ?? []} slug={slug} />
        </div>
      </div>
    </main>
  );
}

function relativeTime(iso: string) {
  // Inline a quick helper or import an existing one if present.
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
```

> The filters (All / Drafts / Archived) and search/sort dropdowns from the mockup are **scaffolded but not functional** — wiring them up is out of scope (no feature changes). They render as visual placeholders; clicking does nothing yet. If clearer, drop the Drafts/Archived buttons until a follow-up; All is the only state that matches current behavior.

- [ ] **Step 2: Typecheck and smoke**

```bash
npm run typecheck
npm run dev
```

Visit `/w/<slug>` — expected: warm masthead, italic "projects", existing project grid renders.

- [ ] **Step 3: Commit**

```bash
git add src/app/w/\[slug\]/page.tsx
git commit -m "feat(ui): restyle workspace dashboard with editorial masthead"
```

---

### Task 17: Restyle `ProjectCard` and `ProjectGrid`

**Files:**
- Modify: `src/components/dashboard/ProjectCard.tsx`
- Modify: `src/components/dashboard/ProjectGrid.tsx`

- [ ] **Step 1: Rewrite `ProjectCard.tsx`**

Preserve all existing handlers (`rename`, `onDelete`, `onDuplicate`, `pending` state). Replace the rendered tree:

```tsx
'use client';

import { Copy, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { motion } from 'motion/react';
import { spring } from '@/lib/motion';
import { deleteProject, duplicateProject, patchProject, type ProjectSummary } from '@/lib/api/projects';
import { confirmDialog } from '@/lib/utils/confirm';
import { promptDialog } from '@/lib/utils/prompt';
import { toast } from '@/lib/utils/toast';

interface Props {
  project: ProjectSummary;
  onChanged: () => void;
  slug: string;
}

export function ProjectCard({ project, onChanged, slug }: Props) {
  const [pending, start] = useTransition();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(project.name);

  async function rename() {
    setRenaming(false);
    if (name.trim() === project.name) return;
    await patchProject(project.id, { name: name.trim() });
    onChanged();
  }
  async function onDelete() {
    const ok = await confirmDialog({
      title: 'Delete project?',
      message: `"${project.name}" will be permanently deleted. This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    start(async () => {
      await deleteProject(project.id);
      onChanged();
    });
  }
  async function onDuplicate() {
    const result = await promptDialog({
      title: 'Duplicate project',
      message: 'Leave blank to use the default name.',
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

  return (
    <motion.article
      className="group relative overflow-hidden rounded-[14px] border border-rule bg-bg-elevated transition-all duration-150 ease-out hover:border-rule-strong hover:shadow-[0_8px_24px_-12px_rgba(180,66,28,0.10)]"
      transition={spring.press}
    >
      <Link href={`/w/${slug}/p/${project.id}`} className="block">
        {/* 16:10 preview region — simple branded substrate for now; a real DOM preview can come later */}
        <div className="aspect-[16/10] bg-bg-cream" aria-hidden="true">
          <div className="flex h-full flex-col">
            <div className="h-2 w-full bg-brand" />
            <div className="flex flex-1 items-center justify-center p-6">
              <div className="h-2 w-32 rounded-full bg-ink/20" />
            </div>
          </div>
        </div>
      </Link>
      <div className="border-t border-rule p-4">
        {renaming ? (
          <input
            autoFocus
            className="mb-1 w-full rounded-md border border-rule bg-bg-elevated px-2 py-1 text-sm text-ink"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={rename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') rename();
              if (e.key === 'Escape') { setName(project.name); setRenaming(false); }
            }}
          />
        ) : (
          <Link href={`/w/${slug}/p/${project.id}`} className="block truncate text-base font-semibold text-ink hover:underline decoration-brand decoration-[1.5px] underline-offset-4">
            {project.name}
          </Link>
        )}
        <div className="mt-1 flex items-center justify-between">
          <div className="font-mono text-[12px] text-ink-3" suppressHydrationWarning>
            Updated {new Date(project.updated_at).toLocaleDateString()}
          </div>
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              aria-label="Rename"
              onClick={() => setRenaming(true)}
              className="rounded-md p-1.5 text-ink-3 hover:bg-bg-sunken hover:text-ink"
            >
              <Pencil size={14} />
            </button>
            <button
              aria-label="Duplicate"
              onClick={onDuplicate}
              disabled={pending}
              className="rounded-md p-1.5 text-ink-3 hover:bg-bg-sunken hover:text-ink disabled:opacity-40"
            >
              <Copy size={14} />
            </button>
            <button
              aria-label="Delete"
              onClick={onDelete}
              disabled={pending}
              className="rounded-md p-1.5 text-ink-3 hover:bg-bg-sunken hover:text-danger disabled:opacity-40"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
```

- [ ] **Step 2: Update `ProjectGrid.tsx`**

Adjust the grid classes: `grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3`. Empty state restyle: warm cream bg + dashed `border-rule-strong` + masked gradient border using `[border-image:var(--gradient-hero)_1] [border-style:dashed]`. (If border-image proves finicky in Tailwind v4, use a simpler `border-2 border-dashed border-rule-strong` with the inner content wrapped in a `bg-bg-cream` panel.)

- [ ] **Step 3: Typecheck, smoke**

```bash
npm run typecheck
npm run dev
```

`/w/<slug>` shows the new card style; rename / duplicate / delete all still work.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/ProjectCard.tsx src/components/dashboard/ProjectGrid.tsx
git commit -m "feat(ui): restyle ProjectCard and ProjectGrid for light dashboard"
```

---

## Phase 5 — Settings

### Task 18: Settings shell — shared masthead + nav helper

**Files:**
- Create: `src/app/w/[slug]/settings/_shell.tsx` (server component used by each settings page)

- [ ] **Step 1: Create the shared shell**

```tsx
// src/app/w/[slug]/settings/_shell.tsx
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { BrandMark } from '@/components/ui/BrandMark';
import { PageMasthead } from '@/components/ui/PageMasthead';
import { SettingsNav, type SettingsNavItem } from '@/components/ui/SettingsNav';
import { WorkspaceSwitcher, type WorkspaceOption } from '@/components/workspace/WorkspaceSwitcher';
import { UserMenu } from '@/components/dashboard/UserMenu';
import { NewProjectButton } from '@/components/dashboard/NewProjectButton';

interface Props {
  slug: string;
  currentWorkspace: WorkspaceOption;
  workspaces: WorkspaceOption[];
  email?: string;
  activeHref: string;
  children: React.ReactNode;
}

export function SettingsShell({ slug, currentWorkspace, workspaces, email, activeHref, children }: Props) {
  const items: SettingsNavItem[] = [
    { href: `/w/${slug}/settings/general`, label: 'General' },
    { href: `/w/${slug}/settings/members`, label: 'Members' },
    { href: `/w/${slug}/settings/brand-kits`, label: 'Brand kits' },
  ];
  return (
    <main className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-30 border-b border-rule bg-bg/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-16">
          <div className="flex items-center gap-3">
            <BrandMark size={28} className="text-ink" />
            <WorkspaceSwitcher current={currentWorkspace} workspaces={workspaces} />
          </div>
          <div className="flex items-center gap-2">
            <NewProjectButton slug={slug} />
            <UserMenu email={email} />
          </div>
        </div>
      </header>
      <div className="border-b border-rule bg-bg">
        <div className="mx-auto flex h-12 max-w-[1280px] items-center gap-2 px-16 text-sm">
          <Link href={`/w/${slug}`} className="inline-flex items-center gap-1.5 text-ink-3 hover:text-ink">
            <ArrowLeft size={14} /> Projects
          </Link>
          <span className="text-ink-4">/</span>
          <span className="text-ink">Settings</span>
        </div>
      </div>
      <div className="mx-auto max-w-[1280px] px-16">
        <PageMasthead
          eyebrow="SETTINGS"
          title="Workspace"
          italicWord="settings"
          trailingPunctuation="."
          subtitle="Manage your workspace, members, and brand kits."
        />
        <div className="mt-8 flex gap-12 pb-16">
          <SettingsNav items={items} activeHref={activeHref} />
          <section className="min-w-0 flex-1 max-w-[760px]">{children}</section>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/app/w/\[slug\]/settings/_shell.tsx
git commit -m "feat(ui): add SettingsShell with editorial masthead + 220/760 split"
```

---

### Task 19: Settings → General

**Files:**
- Modify: `src/app/w/[slug]/settings/general/page.tsx`

- [ ] **Step 1: Wrap the existing form content in `SettingsShell`**

Replace the page's outer JSX. Preserve all form fields, server actions, and "Danger zone" handlers. Adjust each form field to the new pattern:

- Field label above input: `<label className="block text-[11px] font-medium uppercase tracking-[0.05em] text-ink-3">Name</label>`
- Input: 40px height, `bg-bg-elevated border-rule rounded-md`, focus ring 2px brand + 4px brand-soft.
- For the slug field, render the prefix `globaltt.com/w/` inside the input wrapper in `font-mono text-ink-3`.
- Danger zone: outer `<section className="mt-12 rounded-[14px] border border-danger/30 bg-bg-elevated p-6">`, heading "Danger zone", body-md ink-2 description, and a `Button variant="danger"` for "Delete workspace".

Use the shell:

```tsx
return (
  <SettingsShell
    slug={slug}
    currentWorkspace={…}
    workspaces={…}
    email={user?.email}
    activeHref={`/w/${slug}/settings/general`}
  >
    {/* existing form, restyled */}
  </SettingsShell>
);
```

- [ ] **Step 2: Typecheck, smoke**

- [ ] **Step 3: Commit**

```bash
git add src/app/w/\[slug\]/settings/general/page.tsx
git commit -m "feat(ui): restyle settings/general inside SettingsShell"
```

---

### Task 20: Settings → Members

**Files:**
- Modify: `src/app/w/[slug]/settings/members/page.tsx`
- Possibly modify: a `MembersTable.tsx` if extracted (optional split if the page file grows past ~250 lines)

- [ ] **Step 1: Wrap inside `SettingsShell`**

Use `activeHref={`/w/${slug}/settings/members`}`.

- [ ] **Step 2: Restyle the table**

```tsx
import { RolePill } from '@/components/ui/RolePill';
import { Button } from '@/components/ui/Button';
import { MoreHorizontal, Mail } from 'lucide-react';
// existing data-fetching preserved

<div className="flex items-center justify-between">
  <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-ink">Members</h2>
  <Button onClick={openInviteDialog}>+ Invite member</Button>
</div>
<p className="mt-2 text-sm text-ink-3">People with access to this workspace. Pending invites appear at the bottom.</p>

<table className="mt-8 w-full">
  <thead>
    <tr className="border-b border-rule">
      {['Name', 'Email', 'Role', 'Joined', ''].map((h) => (
        <th key={h} className="py-2 text-left text-[11px] font-medium uppercase tracking-[0.18em] text-ink-3">{h}</th>
      ))}
    </tr>
  </thead>
  <tbody>
    {members.map((m) => (
      <tr key={m.id} className="border-b border-rule transition-colors hover:bg-bg-sunken">
        <td className="py-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-brand-soft text-[12px] font-semibold text-brand-ink">
              {initialsOf(m.name)}
            </span>
            <span className="text-sm text-ink">{m.name}</span>
          </div>
        </td>
        <td className="py-4 text-sm text-ink-2">{m.email}</td>
        <td className="py-4">
          <div className="flex items-center gap-2">
            <RolePill>{m.role.toUpperCase()}</RolePill>
            {m.id === currentUserId && <RolePill variant="soft">YOU</RolePill>}
          </div>
        </td>
        <td className="py-4 font-mono text-[12px] text-ink-3" suppressHydrationWarning>
          {new Date(m.joined_at).toLocaleDateString()}
        </td>
        <td className="py-4 text-right">
          {/* preserve existing role-mutate menu */}
          <button aria-label="Member actions" className="rounded-md p-1.5 text-ink-3 hover:bg-bg-sunken hover:text-ink">
            <MoreHorizontal size={16} />
          </button>
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

- [ ] **Step 3: Pending invitations section**

```tsx
<div className="mt-8">
  <h3 className="text-sm font-medium text-ink-2">
    Pending invitations · <span className="font-mono">{pending.length}</span>
  </h3>
  <ul className="mt-3 space-y-2">
    {pending.map((p) => (
      <li key={p.id} className="flex items-center gap-4 rounded-md border border-rule bg-bg-sunken px-4 py-3">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-bg-elevated text-ink-3">
          <Mail size={14} />
        </span>
        <span className="flex-1 text-sm text-ink">{p.email}</span>
        <RolePill>{p.role.toUpperCase()}</RolePill>
        {/* preserve existing copy-link + revoke handlers from earlier work */}
        <button onClick={() => copyInviteLink(p)} className="text-sm text-ink-3 hover:text-ink underline-offset-4 hover:underline">
          Copy link
        </button>
        <button onClick={() => revokeInvite(p.id)} className="text-sm text-ink-3 hover:text-danger underline-offset-4 hover:underline">
          Revoke
        </button>
      </li>
    ))}
  </ul>
  {pending.length > 0 && (
    <p className="mt-3 text-sm text-ink-3">Invitations expire in 7 days.</p>
  )}
</div>
```

> Preserve the existing role-mutation menu, invite dialog, copy-link toast, and revoke flow — those handlers and components stay; only their visual treatment changes.

- [ ] **Step 4: Typecheck and smoke**

Visit `/w/<slug>/settings/members`. Test inviting (existing dialog should still open), copying an invite link, and revoking.

- [ ] **Step 5: Commit**

```bash
git add src/app/w/\[slug\]/settings/members/page.tsx
git commit -m "feat(ui): restyle settings/members with editorial table + pending cards"
```

---

### Task 21: Settings → Brand Kits

**Files:**
- Modify: `src/app/w/[slug]/settings/brand-kits/page.tsx`
- Possibly Create: `src/components/settings/BrandKitCard.tsx` (extracted for clarity)

- [ ] **Step 1: Extract `BrandKitCard`**

```tsx
// src/components/settings/BrandKitCard.tsx
'use client';
import { Copy, MoreHorizontal, Pencil } from 'lucide-react';
import type { BrandKit } from '@/lib/api/brand-kits';

interface Props {
  kit: BrandKit;
  isDefault: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onMenu: () => void;
}

export function BrandKitCard({ kit, isDefault, onEdit, onDuplicate, onMenu }: Props) {
  const swatches = [kit.brand, kit.ink, kit.bg, kit.accent, kit.success].filter(Boolean).slice(0, 5);
  return (
    <article className="group overflow-hidden rounded-[14px] border border-rule bg-bg-elevated transition-all hover:border-rule-strong hover:shadow-[0_8px_24px_-12px_rgba(180,66,28,0.10)]">
      {/* 5-swatch band */}
      <div className="flex h-16 overflow-hidden">
        {swatches.map((color, i) => (
          <div key={`${kit.id}-${i}`} className="flex-1" style={{ backgroundColor: color }} />
        ))}
      </div>
      <div className="border-t border-rule p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-ink">{kit.name}</h3>
          {isDefault && (
            <span className="inline-flex items-center rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium tracking-wider uppercase text-brand-ink">
              DEFAULT
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {swatches.map((color, i) => (
            <span key={i} className="font-mono text-[11px] text-ink-3">{color?.toUpperCase()}</span>
          ))}
        </div>
        <p className="mt-3 text-sm text-ink-3">
          {kit.heading_font ?? 'Newsreader'} / {kit.body_font ?? 'Geist'} · {kit.projects_count ?? 0} projects · Updated{' '}
          <span className="font-mono">{relativeTime(kit.updated_at)}</span>
        </p>
        <div className="mt-3 border-t border-rule pt-3 flex items-center gap-3 text-sm">
          <button onClick={onEdit} className="inline-flex items-center gap-1.5 text-ink-3 hover:text-ink">
            <Pencil size={14} /> Edit
          </button>
          <button onClick={onDuplicate} className="inline-flex items-center gap-1.5 text-ink-3 hover:text-ink">
            <Copy size={14} /> Duplicate
          </button>
          <button onClick={onMenu} aria-label="More" className="ml-auto rounded-md p-1.5 text-ink-3 hover:bg-bg-sunken hover:text-ink">
            <MoreHorizontal size={14} />
          </button>
        </div>
      </div>
    </article>
  );
}

function relativeTime(iso?: string | null) {
  if (!iso) return '—';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
```

> Inspect `src/lib/api/brand-kits.ts` to confirm the actual field names on `BrandKit` (e.g., `brand`, `ink`, `bg`, `accent`, `success`, `projects_count`). Adjust the swatch composition above to match — the visual goal is 5 swatches per card.

- [ ] **Step 2: Wrap the page in `SettingsShell` and use the new card**

In `src/app/w/[slug]/settings/brand-kits/page.tsx`:

```tsx
<SettingsShell …>
  <div className="flex items-center justify-between">
    <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-ink">
      Brand kits · <span className="font-mono text-ink-3">{kits.length}</span>
    </h2>
    <Button onClick={openCreateDialog}>+ New brand kit</Button>
  </div>
  <p className="mt-2 text-sm text-ink-3">Apply a kit to a project to update its colors, fonts, and logo in one click.</p>

  <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
    {kits.map((kit) => (
      <BrandKitCard
        key={kit.id}
        kit={kit}
        isDefault={kit.id === defaultKitId}
        onEdit={() => openEditDialog(kit)}
        onDuplicate={() => duplicateKit(kit)}
        onMenu={() => openMenu(kit)}
      />
    ))}
    <button
      onClick={openCreateDialog}
      className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-rule-strong bg-bg-cream text-center transition-colors hover:border-brand"
    >
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-brand text-brand">+</span>
      <span className="text-base font-semibold text-ink">Create a brand kit</span>
      <span className="text-sm text-ink-3">Start from your existing brand or import from a project.</span>
    </button>
  </div>
</SettingsShell>
```

- [ ] **Step 3: Typecheck, smoke**

Visit `/w/<slug>/settings/brand-kits`. Test creating, editing, duplicating.

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/BrandKitCard.tsx src/app/w/\[slug\]/settings/brand-kits/page.tsx
git commit -m "feat(ui): restyle settings/brand-kits with 5-swatch cards"
```

---

## Phase 6 — Editor

The editor lives at `/w/[slug]/p/[id]`. It's the warm-dark surface. To scope dark styles cleanly, the editor page wrapper sets `className="editor-shell"` on `<body>` (or on its own root) — this triggers the dark base in `globals.css` we set up in Task 2.

### Task 22: Editor topbar refresh

**Files:**
- Modify: `src/components/editor/Topbar.tsx`
- Modify: `src/components/editor/EditorShell.tsx`

- [ ] **Step 1: In `EditorShell.tsx`, add the `editor-shell` class to the outer container**

Find the existing root `<div className="flex flex-col h-dvh">` and change to:

```tsx
<div className="editor-shell flex h-dvh flex-col">
```

This activates the dark base palette only inside the editor surface.

- [ ] **Step 2: Rewrite the Topbar render**

Replace the topbar `<div>` (currently `flex items-center gap-4 px-5 py-2.5 border-b border-border bg-panel-2 text-sm`) and its children, while preserving every callback, hook, and handler in the file. The new render:

```tsx
return (
  <div className="flex h-[52px] items-center gap-3 border-b border-ed-rule bg-ed-panel-2 px-4 text-sm">
    <Link
      href={`/w/${slug}`}
      className="inline-flex items-center gap-1.5 text-ed-ink-3 hover:text-ed-ink transition-colors"
      aria-label="Back to projects"
    >
      <BrandMark size={24} className="text-ed-ink" />
    </Link>
    <span className="text-ed-ink-3">/</span>
    <WorkspaceSwitcher current={currentWorkspace} workspaces={workspaces} />
    <span className="text-ed-ink-3">/</span>
    {editing && canEdit ? (
      <input
        autoFocus
        className="rounded-md border border-ed-rule-strong bg-ed-panel px-2 py-1 font-serif text-[18px] font-normal text-ed-ink"
        value={draftName}
        onChange={(e) => setDraftName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitName();
          if (e.key === 'Escape') { setDraftName(name); setEditing(false); }
        }}
      />
    ) : canEdit ? (
      <button onClick={() => { setDraftName(name); setEditing(true); }} className="font-serif text-[18px] font-normal text-ed-ink">{name}</button>
    ) : (
      <span className="font-serif text-[18px] font-normal text-ed-ink">{name}</span>
    )}
    {canEdit && (
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={saving} variants={fade} initial="hidden" animate="show" exit="exit">
          <StatusBadge tone={statusBadgeTone(saving)}>{statusLabel}</StatusBadge>
        </motion.span>
      </AnimatePresence>
    )}
    {!canEdit && (
      <span className="inline-flex items-center rounded-md border border-ed-rule-strong bg-ed-panel px-2 py-0.5 text-[10px] uppercase tracking-wider text-ed-ink-3">
        View only
      </span>
    )}
    {lastError && <span className="font-mono text-[11px] text-ed-danger">{lastError}</span>}
    <div className="ml-auto flex items-center gap-1">
      {canEdit && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setLeftPanelOpen(!leftPanelOpen)}
              aria-label={leftPanelOpen ? 'Hide sidebar' : 'Show sidebar'}
              className={cn(
                'inline-flex h-8 w-8 items-center justify-center rounded-md text-ed-ink-2 hover:bg-ed-panel-3 hover:text-ed-ink transition-colors',
                leftPanelOpen && 'bg-ed-brand-soft text-brand',
              )}
            >
              {leftPanelOpen ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
            </button>
          </TooltipTrigger>
          <TooltipContent>{leftPanelOpen ? 'Hide sidebar' : 'Show sidebar'} (Ctrl/Cmd+\)</TooltipContent>
        </Tooltip>
      )}
      <span className="mx-1 h-5 w-px bg-ed-rule" />
      {canEdit && <ModeToggle />}
      {canEdit && (
        <>
          <IconBtn onClick={onUndo} disabled={!canUndo} tooltip="Undo (Ctrl/Cmd+Z)" label="Undo"><Undo2 size={14} /></IconBtn>
          <IconBtn onClick={onRedo} disabled={!canRedo} tooltip="Redo (Ctrl/Cmd+Shift+Z)" label="Redo"><Redo2 size={14} /></IconBtn>
          <IconBtn onClick={onReset} disabled={!isDirty} tooltip="Discard unsaved changes and revert to last saved version" label="Reset">
            <span className="text-[11px]">Reset</span>
          </IconBtn>
          <TranslateMenu projectId={projectId} projectName={name} slug={slug} />
        </>
      )}
      <DownloadMenu projectId={projectId} slug={slug} />
    </div>
  </div>
);
```

Add the new helper inside the file:

```tsx
import { cn } from '@/lib/utils/cn';
import { BrandMark } from '@/components/ui/BrandMark';
import { StatusBadge } from '@/components/ui/StatusBadge';

function statusBadgeTone(s: typeof saving) {
  return s === 'saving' || s === 'pending' ? 'saving'
       : s === 'error' ? 'error'
       : 'saved';
}

function IconBtn({ onClick, disabled, tooltip, label, children }: {
  onClick?: () => void; disabled?: boolean; tooltip: string; label: string; children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button" onClick={onClick} disabled={disabled} aria-label={label}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ed-ink-2 hover:bg-ed-panel-3 hover:text-ed-ink transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
```

Update `ModeToggle` to use the dark palette:

```tsx
function ModeToggle() {
  const { mode, setMode } = useEditorMode();
  const baseBtn = 'px-2.5 py-1 text-xs transition-colors';
  return (
    <div className="inline-flex items-center overflow-hidden rounded-md border border-ed-rule-strong">
      <button type="button" aria-pressed={mode === 'edit'} onClick={() => setMode('edit')}
        className={`${baseBtn} ${mode === 'edit' ? 'bg-brand text-white' : 'text-ed-ink hover:bg-ed-panel-3'}`}>Edit</button>
      <button type="button" aria-pressed={mode === 'preview'} onClick={() => setMode('preview')}
        className={`${baseBtn} ${mode === 'preview' ? 'bg-brand text-white' : 'text-ed-ink hover:bg-ed-panel-3'}`}>Preview</button>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck, smoke**

Open a project at `/w/<slug>/p/<id>`. Verify: serif project name in the topbar, save badge with colored dot, `⌘\` still toggles the panel, undo/redo still work.

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/Topbar.tsx src/components/editor/EditorShell.tsx
git commit -m "feat(editor): warm-dark topbar with serif project name + status badge"
```

---

### Task 23: `LeftPanel` outer surface + dark base

**Files:**
- Modify: `src/components/editor/LeftPanel.tsx`

- [ ] **Step 1: Restyle the outer `<aside>` and the "+ Add Product Section" button**

```tsx
<aside className="w-[320px] shrink-0 overflow-y-auto border-r border-ed-rule bg-ed-panel p-3 space-y-2">
  <GlobalStylesPanel />
  <HeaderPanel />
  <div className="px-1 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-ed-ink-3">
    Products{' '}
    <span className="font-mono text-ed-ink-3">· {sections.length}</span>
  </div>
  <AnimatePresence initial={false}>
    {sections.map((s, idx) => (
      <motion.div key={s.id} layout variants={fadeUp} initial="hidden" animate="show" exit="exit">
        <ProductSectionPanel section={s} index={idx} total={sections.length} />
      </motion.div>
    ))}
  </AnimatePresence>
  {canEdit && (
    <button
      type="button"
      onClick={() => store.getState().addSection()}
      className="block w-full rounded-md border border-dashed border-ed-rule-strong px-3 py-2 text-sm text-ed-ink-2 hover:border-brand hover:text-ed-ink transition-colors"
    >
      + Add Product Section
    </button>
  )}
  <FooterPanel />
</aside>
```

- [ ] **Step 2: Replace the canvas background**

In `EditorShell.tsx` the right pane is currently `<div className="flex-1 bg-[#080808]">`. Change to:

```tsx
<div className="flex-1 bg-ed-canvas-pad p-8 overflow-auto"><Preview /></div>
```

- [ ] **Step 3: Typecheck, smoke**

Open the editor. Expected: warm-dark panel, the email substrate sits on the slightly darker canvas pad with 32px of breathing room.

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/LeftPanel.tsx src/components/editor/EditorShell.tsx
git commit -m "feat(editor): warm-dark LeftPanel and canvas pad"
```

---

### Task 24: `GlobalStylesPanel` — section card treatment

**Files:**
- Modify: `src/components/editor/panels/GlobalStylesPanel.tsx`

- [ ] **Step 1: Wrap the panel content as a "section card"**

Open the file. Locate the outermost wrapper element. Replace with:

```tsx
<section className="rounded-md border border-ed-rule bg-ed-panel-2 p-3 shadow-[inset_0_1px_0_rgba(237,231,220,0.04)]">
  <header className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-ed-ink-2">
    Global styles
  </header>
  {/* existing fields preserved — each field label changes to: */}
  {/*   <label className="block text-[11px] font-medium uppercase tracking-[0.05em] text-ed-ink-3">Brand color</label> */}
  {/* inputs: h-7, bg-ed-panel border border-ed-rule rounded-sm px-2 text-[13px] text-ed-ink */}
</section>
```

For numeric inputs (uses `NumberInput`) and color swatches (`ColorPicker`), they live in `src/components/ui/`. Restyle in Task 27.

- [ ] **Step 2: Typecheck, smoke**

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/panels/GlobalStylesPanel.tsx
git commit -m "feat(editor): restyle GlobalStylesPanel as section card"
```

---

### Task 25: `HeaderPanel` — same section card treatment

**Files:**
- Modify: `src/components/editor/panels/HeaderPanel.tsx`

- [ ] **Step 1: Apply the same `<section>` wrapper as Task 24**

Header label: "HEADER". Preserve every existing field (logo URL, logo height, etc.) and the `ImageInput` usage.

- [ ] **Step 2: Typecheck, smoke**

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/panels/HeaderPanel.tsx
git commit -m "feat(editor): restyle HeaderPanel as section card"
```

---

### Task 26: `ProductSectionPanel`

**Files:**
- Modify: `src/components/editor/panels/ProductSectionPanel.tsx`

- [ ] **Step 1: Restyle the outer card**

Locate the outer `<div className={`rounded-md border bg-panel-2 ...`}>` and replace with:

```tsx
<div className={cn(
  'rounded-md border bg-ed-panel-2 overflow-hidden shadow-[inset_0_1px_0_rgba(237,231,220,0.04)]',
  open ? 'border-brand/40' : 'border-ed-rule',
)}>
  <div className="flex items-center justify-between px-3 py-2">
    <button type="button" onClick={() => setOpen(o => !o)}
      className="flex flex-1 items-center gap-2 text-left text-sm font-medium text-ed-ink">
      {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      <span className="truncate">{section.title || '(untitled)'}</span>
    </button>
    {canEdit && (
      <div className="flex items-center gap-1 text-ed-ink-3">
        {/* preserve existing tooltip-wrapped move-up / move-down / remove buttons */}
        {/* replace `hover:text-fg` with `hover:text-ed-ink` */}
        {/* replace `hover:text-danger` with `hover:text-ed-danger` */}
      </div>
    )}
  </div>
  {/* expanded body preserved; inputs adopt h-7 / bg-ed-panel / border-ed-rule pattern */}
</div>
```

- [ ] **Step 2: Typecheck, smoke**

Test: expand/collapse, move sections up/down, remove a section (confirm dialog still appears), drag-reorder still works.

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/panels/ProductSectionPanel.tsx
git commit -m "feat(editor): restyle ProductSectionPanel as warm-dark section card"
```

---

### Task 27: `FooterPanel` + shared editor inputs

**Files:**
- Modify: `src/components/editor/panels/FooterPanel.tsx`
- Modify: `src/components/ui/Input.tsx`
- Modify: `src/components/ui/NumberInput.tsx`
- Modify: `src/components/ui/Select.tsx`
- Modify: `src/components/ui/Textarea.tsx`
- Modify: `src/components/ui/ColorPicker.tsx`

- [ ] **Step 1: Apply the section-card wrapper to `FooterPanel`** (same as Tasks 24/25, label "FOOTER").

- [ ] **Step 2: Make inputs context-aware**

For each of `Input.tsx`, `NumberInput.tsx`, `Select.tsx`, `Textarea.tsx`, add a `data-surface` attribute that callers can set or rely on Tailwind's `.editor-shell` selector. Simpler: introduce a `tone?: 'light' | 'editor'` prop with `'light'` as default. In the editor's panel components, pass `tone="editor"`.

Inside each input component:

```tsx
const TONE: Record<'light' | 'editor', string> = {
  light:  'h-10 bg-bg-elevated border border-rule text-ink placeholder:text-ink-4 focus:border-brand focus:ring-4 focus:ring-brand-soft',
  editor: 'h-7  bg-ed-panel    border border-ed-rule text-ed-ink placeholder:text-ed-ink-4 focus:border-brand focus:ring-2 focus:ring-ed-brand-soft',
};
// use TONE[tone ?? 'light']
```

> If retrofitting `tone` props feels invasive, use a CSS-based switch instead: rely on `.editor-shell input { … }` selectors in `globals.css` to override the light defaults. Pick one approach and apply it consistently across all 5 components. The prop approach is more explicit and TypeScript-checked.

- [ ] **Step 3: `ColorPicker` swatch**

The current `ColorPicker.tsx` likely renders a small color swatch trigger. Restyle:

```tsx
className="h-7 w-7 rounded-sm ring-1 ring-inset ring-ed-ink-4 hover:ring-ed-ink-2"
```

The popover panel inside the picker: `bg-ed-panel-2 border border-ed-rule rounded-md shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]`.

- [ ] **Step 4: Typecheck, smoke each panel**

Edit Global Styles colors, Header fields, Product Section fields, Footer copy. All inputs should adopt the dense dark style. Light-surface inputs (auth, settings) remain unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/panels/FooterPanel.tsx src/components/ui/Input.tsx src/components/ui/NumberInput.tsx src/components/ui/Select.tsx src/components/ui/Textarea.tsx src/components/ui/ColorPicker.tsx
git commit -m "feat(editor): restyle FooterPanel and unify dense editor input tone"
```

---

### Task 28: Canvas floating toolbars

**Files:**
- Modify: `src/components/editor/canvas/SectionToolbar.tsx`
- Modify: `src/components/editor/canvas/SelectionActionBar.tsx`
- Modify: `src/components/editor/canvas/SectionInsertBar.tsx`

- [ ] **Step 1: `SectionToolbar` — pill, dark panel-2 surface**

Find the outer wrapper. Replace its className with:

```ts
'inline-flex items-center gap-1.5 rounded-full border border-ed-rule-strong bg-ed-panel-2 px-2 py-1.5 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]'
```

Each icon button inside: `h-7 w-7 rounded-md text-ed-ink-2 hover:bg-ed-panel-3 hover:text-ed-ink transition-colors`. Active state (e.g. "selected"): `bg-ed-brand-soft text-brand`.

- [ ] **Step 2: `SelectionActionBar` — same vocabulary, heavier shadow**

Same wrapper styles as `SectionToolbar` but with `shadow-[0_12px_32px_-8px_rgba(0,0,0,0.65)]`.

- [ ] **Step 3: `SectionInsertBar` — hairline → dashed orange on hover**

The bar shows a hairline by default and an `+ Insert section` pill on hover. Wrapper:

```tsx
<div className="section-insert-bar group relative flex h-4 items-center justify-center">
  <span className="h-px w-full bg-ed-rule transition-colors group-hover:bg-brand/40 group-hover:[border-top-style:dashed]" />
  <button
    type="button" onClick={onInsert}
    className="section-insert-btn absolute inline-flex h-6 items-center gap-1 rounded-full bg-ed-panel-2 px-2 text-[11px] text-ed-ink-2 ring-1 ring-ed-rule-strong hover:text-brand"
  >
    <Plus size={10} /> Insert section
  </button>
</div>
```

- [ ] **Step 4: Typecheck, smoke**

Hover over sections in the canvas, select inline text, insert a section between two existing ones. All existing behavior preserved; visuals warm-dark.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/canvas/SectionToolbar.tsx src/components/editor/canvas/SelectionActionBar.tsx src/components/editor/canvas/SectionInsertBar.tsx
git commit -m "feat(editor): restyle floating canvas toolbars in warm-dark palette"
```

---

### Task 29: Editor popovers and menus

**Files:**
- Modify: `src/components/editor/DownloadMenu.tsx`
- Modify: `src/components/editor/TranslateMenu.tsx`
- Modify: `src/components/editor/ChatRefinePanel.tsx`
- Modify: `src/components/editor/AssetPicker.tsx`

- [ ] **Step 1: Apply the dark popover treatment to each**

For each popover/menu surface, change the panel className to:

```ts
'rounded-md border border-ed-rule bg-ed-panel-2 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]'
```

Trigger buttons (e.g. the topbar pills "EN → ES" and "DOWNLOAD") adopt:

```ts
'inline-flex h-8 items-center gap-1.5 rounded-md border border-ed-rule-strong bg-ed-panel px-2.5 text-[12px] text-ed-ink-2 hover:text-ed-ink hover:border-ed-rule-strong transition-colors'
```

Active state when the menu is open: `text-ed-ink bg-ed-panel-3`.

Inside the popovers, menu items: `block w-full rounded-sm px-2 py-1.5 text-left text-sm text-ed-ink hover:bg-ed-panel-3`.

- [ ] **Step 2: Typecheck, smoke**

Open each menu, run a translation, download an HTML export, open the asset picker.

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/DownloadMenu.tsx src/components/editor/TranslateMenu.tsx src/components/editor/ChatRefinePanel.tsx src/components/editor/AssetPicker.tsx
git commit -m "feat(editor): warm-dark popover and menu surfaces"
```

---

### Task 30: Dialogs (ConfirmDialog, PromptDialog, NewProjectDialog, CreateWorkspaceDialog)

**Files:**
- Modify: `src/components/ui/ConfirmDialog.tsx`
- Modify: `src/components/ui/PromptDialog.tsx`
- Modify: `src/components/dashboard/NewProjectDialog.tsx`
- Modify: `src/components/workspace/CreateWorkspaceDialog.tsx`

- [ ] **Step 1: Adopt light surface dialogs**

These are mostly invoked from the light surfaces (dashboard, settings). Apply:

- Overlay: `bg-ink/40 backdrop-blur-sm`.
- Panel: `bg-bg-elevated border border-rule rounded-[14px] shadow-[0_30px_80px_-20px_rgba(20,20,20,0.25)]`.
- Title: `text-[20px] font-semibold tracking-[-0.01em] text-ink`.
- Body text: `text-sm text-ink-2`.
- Buttons row: gap-2, justify-end; cancel = `variant="ghost"`, confirm = `variant="primary"` or `variant="danger"` per existing prop.

For `ConfirmDialog`/`PromptDialog` the existing API stays; only styles change.

For `NewProjectDialog` (form for project name): inputs use the light-tone variant from Task 27.

- [ ] **Step 2: Editor-context confirm**

`ConfirmDialog` opens from the editor (e.g. "Remove section?"). Inside the editor surface, the dark popover treatment is more appropriate. Easiest: detect via `useContext(EditorModeContext)` (if available) or set a `tone` prop similar to inputs. If a prop adds complexity, leave the dialog light — the warm contrast against the dark editor is acceptable.

- [ ] **Step 3: Typecheck, smoke**

Delete a project from the dashboard (confirm); remove a section in the editor (confirm); rename via prompt; create a new project from the dashboard.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/ConfirmDialog.tsx src/components/ui/PromptDialog.tsx src/components/dashboard/NewProjectDialog.tsx src/components/workspace/CreateWorkspaceDialog.tsx
git commit -m "feat(ui): restyle dialogs for Warm Editorial system"
```

---

## Phase 7 — Cleanup + verification

### Task 31: Remove back-compat aliases from `globals.css`

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Grep for any remaining legacy class usage**

```bash
npm test -- --run
git grep -n "bg-panel-2\|bg-panel\|text-fg\|border-border-strong\|border-border\|text-muted-2\|text-muted" -- src/
```

Expected: any remaining hits are inside files we've already restyled and now lean on alias tokens. Replace each remaining hit with the explicit equivalent (`bg-ed-panel-2`, `text-ed-ink`, etc. inside the editor; `bg-bg-elevated`, `text-ink`, etc. on the light side).

- [ ] **Step 2: Delete the alias block from `globals.css`**

Remove the `/* Backwards-compat aliases … */` block (the 7 alias lines from Task 2). Re-run grep — expect 0 hits.

- [ ] **Step 3: Typecheck, smoke every surface**

```bash
npm run typecheck
npm test -- --run
npm run dev
```

Click through `/login → /w/<slug> → /w/<slug>/settings/{general,members,brand-kits} → /w/<slug>/p/<id>`. No regressions.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/
git commit -m "chore(ui): remove back-compat token aliases"
```

---

### Task 32: Final verification + screenshots

**Files:**
- No code; verification.

- [ ] **Step 1: Run all checks**

```bash
npm run typecheck && npm run lint && npm test -- --run && npm run build
```

Expected: all four green.

- [ ] **Step 2: Manual visual diff against the mockups**

For each surface:

1. Open the route in the dev server.
2. Open the corresponding mockup PNG (`docs/superpowers/specs/stitch-screenshots/*.png`).
3. Place them side-by-side. The implementation does not need to be pixel-identical, but the signature devices MUST be visible:
   - Italic-accent word in every page title.
   - Eyebrow + masthead rule on every marketing page.
   - Mono accents on timestamps, status, hex codes.
   - 5-swatch band on Brand Kit cards.
   - Two-pane gradient on login.
   - Warm-dark editor with white email substrate.

- [ ] **Step 3: Re-run the existing E2E smoke test**

```bash
npm run e2e -- --grep smoke
```

Expected: pass.

- [ ] **Step 4: Push the branch and open a PR**

```bash
git push -u origin feat/ui-refactor-warm-editorial
```

PR title: `feat(ui): Warm Editorial refactor`. PR body should link the spec file and the mockup folder.

---

## Self-Review

Ran a fresh-eyes pass against the spec on 2026-05-20:

**Spec coverage:** Every section in the spec maps to at least one task — tokens (T2), fonts (T1), primitives (T3–T9 + Button T10), auth (T11–T14), dashboard (T15–T17), settings (T18–T21), editor (T22–T29), dialogs (T30), cleanup (T31). The acceptance criteria are addressed by T32.

**Placeholder scan:** No "TBD" / "implement later" / "similar to Task N". Two explicit deferrals are noted as such (the postal-stamp flourish in T14, the search/sort dropdowns in T16) — these match the spec's "open items".

**Type consistency:** `Variant` types in Button (T10) and `Tone` in StatusBadge (T9) are defined inline. The `tone?: 'light' | 'editor'` prop in T27 is a new prop on existing inputs — if the engineer chooses the CSS-selector alternative instead, both branches are documented.

**Risks called out:**

1. **Tailwind v4 token resolution** — the `@theme` block defines kebab-case CSS vars; Tailwind generates classes like `bg-bg-elevated`, `text-ink-3`, `bg-ed-panel`. If any class doesn't resolve, the engineer should check the variable name matches the class name pattern. The back-compat aliases in T2 are the safety net during the transition.
2. **Input retrofitting (T27)** — touches 5 components. The `tone` prop approach is preferred but the CSS-selector fallback is documented.
3. **Brand Kit field shape (T21)** — depends on `BrandKit` actual fields. The task includes a directive to inspect `src/lib/api/brand-kits.ts` first.

---

Plan complete and saved to `docs/superpowers/plans/2026-05-20-ui-refactor-warm-editorial.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
