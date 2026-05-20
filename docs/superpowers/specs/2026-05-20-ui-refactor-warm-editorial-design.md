# UI/UX Refactor — Warm Editorial

**Status:** draft for review · **Date:** 2026-05-20 · **Owner:** product/eng
**Scope:** visual + interaction refresh across the entire app. No feature changes.

## Goal

Lift the GlobalTT Email Editor from "functional dark dashboard" to a SaaS product that signals craft and design taste from the moment a visitor lands on the sign-in page. Preserve every existing feature, route, store, persistence path, and keyboard shortcut. The work is entirely in tokens, typography, layout, and component styling.

## Direction: "Warm Editorial"

Marketing-grade light surfaces (auth, dashboard, settings, invite) paired with a warm-dark editor. Newsreader serif for display moments + Geist for UI + JetBrains Mono for status/timestamps. The GlobalTT orange `#f1592a` stays the only chromatic accent; one signature gradient lives on hero surfaces. Reference influences: Resend's restraint, Linear marketing's clarity, Stripe's editorial polish, NYT product surfaces.

Two design systems power this — both already created in Stitch and locked:

- **Light** — `assets/8839809532302695665` — auth, dashboard, settings, invite acceptance, public preview.
- **Dark editor** — `assets/2044372008074932280` — `/w/[slug]/p/[id]` only.

Validated screen mockups + raw HTML are committed under `docs/superpowers/specs/stitch-screenshots/`.

## What changes (and what doesn't)

**Changes:**

- `src/app/globals.css` — extended color tokens (warm palette), 4-step ink scale, gradient token, font tokens for Newsreader/Geist/JetBrains Mono.
- `src/app/layout.tsx` — adds the three Google Fonts via `next/font` and exposes their CSS variables.
- Every page/component restyled against the new tokens. The component tree, props, and behavior are unchanged.
- New shared primitives under `src/components/ui/` to capture the recurring patterns (eyebrow, masthead, settings nav, role pill, swatch chip, status pill).

**Does NOT change:**

- Routing (`src/app/page.tsx`, `src/app/w/[slug]/...`, `src/app/p/[id]/...`).
- Auth (`src/lib/supabase/*`, `requireWorkspace`, role provider).
- Editor store (`StoreProvider`, autosave, undo/redo, FLIP motion).
- Persistence, Supabase schema, RLS policies.
- Keyboard shortcuts (`⌘\` panel toggle, `⌘Z`/`⌘⇧Z` undo/redo, etc.).
- Existing motion patterns (FLIP on section reorder, tooltip animations).

## Design tokens

Tokens replace the existing values in `src/app/globals.css`. Names are deliberately semantic, not literal, so dark+light can share rule names.

### Light palette (marketing/dashboard/settings/invite/auth)

| Token | Value | Use |
| --- | --- | --- |
| `--color-bg` | `#FAF8F4` | warm off-white canvas — never pure white |
| `--color-bg-elevated` | `#FFFFFF` | cards, modals, popovers |
| `--color-bg-sunken` | `#F2EFE8` | input fills, hovered rows, secondary sections |
| `--color-bg-cream` | `#F6F1E7` | empty-state cards, hero blocks |
| `--color-ink` | `#141414` | primary text |
| `--color-ink-2` | `#3A3733` | secondary text |
| `--color-ink-3` | `#6B665F` | tertiary, metadata, labels |
| `--color-ink-4` | `#9C968D` | placeholder, disabled |
| `--color-rule` | `#E7E2D8` | default 1px hairline borders |
| `--color-rule-strong` | `#D8D2C4` | hover/active borders |
| `--color-brand` | `#F1592A` | CTAs, focus rings, selected state |
| `--color-brand-ink` | `#B8421C` | orange used on small text/icons (AA on light) |
| `--color-brand-soft` | `#FCE2D2` | tinted fills, focus halos, "YOU"/role chips |
| `--color-amber` | `#E8A04F` | gradient mid-stop |
| `--color-brand-glow` | `#F8C9A8` | gradient end-stop |
| `--color-success` | `#3F7A3F` | saved state |
| `--color-danger` | `#B2452B` | destructive |
| `--gradient-hero` | `linear-gradient(135deg,#F1592A 0%,#E8A04F 60%,#F8C9A8 100%)` | used in exactly 3 places: login hero pane, dashboard "+ New project" empty card, brand mark on auth |

### Dark editor palette

| Token | Value | Use |
| --- | --- | --- |
| `--ed-bg` | `#0E0D0B` | viewport background (warm near-black) |
| `--ed-panel` | `#161412` | left panel surface |
| `--ed-panel-2` | `#1B1815` | topbar, popovers, nested controls |
| `--ed-panel-3` | `#221F1B` | hover/selected row |
| `--ed-canvas-pad` | `#080706` | area around the email substrate |
| `--ed-rule` | `#2A2622` | 1px borders |
| `--ed-rule-strong` | `#3A3631` | hover borders, region dividers |
| `--ed-ink` | `#EDE7DC` | warm off-white primary text |
| `--ed-ink-2` | `#B6AFA3` | secondary |
| `--ed-ink-3` | `#7E776C` | tertiary, mono timestamps |
| `--ed-ink-4` | `#544F47` | disabled |
| `--color-brand` | `#F1592A` | shared with light — primary accent |
| `--ed-brand-soft` | `rgba(241,89,42,0.15)` | selection halos, hover tints |
| `--ed-success` | `#79B16F`, `--ed-danger` | `#D8623F` | save status |

### Typography

Three font families, loaded via `next/font/google` with `display: swap` in `src/app/layout.tsx`:

```ts
import { Newsreader, Geist, JetBrains_Mono } from 'next/font/google';
const serif = Newsreader({ subsets:['latin'], variable:'--font-serif', weight:['300','400'], style:['normal','italic'] });
const sans  = Geist({       subsets:['latin'], variable:'--font-sans',  weight:['400','500','600'] });
const mono  = JetBrains_Mono({ subsets:['latin'], variable:'--font-mono', weight:['400'] });
```

Exposed as `--font-serif`, `--font-sans`, `--font-mono`. The CSS `--font-sans` token replaces the existing `-apple-system, BlinkMacSystemFont, "Segoe UI"` stack.

Type scale (semantic level → spec):

| Level | Family · Size · Weight · Tracking · Line-height | Used for |
| --- | --- | --- |
| `display-2xl` | Newsreader 88 / 300 / -0.04em / 0.96 | login hero headline |
| `display-xl` | Newsreader 56 / 400 / -0.03em / 1.02 | dashboard + settings page titles |
| `display-lg` | Newsreader 36 / 400 / -0.02em / 1.1 | card titles in marketing |
| `display-italic` | same as display, `font-style: italic`, weight 300 | the one-word accent per page |
| `heading-lg` | Geist 20 / 600 / -0.01em / 1.3 | section headers |
| `heading-md` | Geist 16 / 600 / -0.005em / 1.4 | card titles, table section heads |
| `body-lg` | Geist 17 / 400 / 0 / 1.6 | marketing copy, settings descriptions |
| `body-md` | Geist 14 / 400 / 0 / 1.55 | default UI body |
| `body-sm` | Geist 13 / 400 / 0 / 1.5 | secondary copy |
| `label-eyebrow` | Geist 11 / 500 / 0.22em / 1 · UPPERCASE | eyebrow over every page title |
| `label-md` | Geist 12 / 500 / 0.02em / 1 | input labels, role pills |
| `mono-md` | JetBrains Mono 12 / 400 / 0 / 1 | timestamps, hex codes, status |
| `mono-sm` | JetBrains Mono 11 / 400 / 0 / 1 | editor save status, keyboard hints |

Editor-only adds `topbar-name` (Newsreader 18 / 400 / -0.01em) for the editable project name, `panel-section` (Geist 11 / 600 / 0.18em / UPPERCASE) for "GLOBAL STYLES" / "PRODUCTS" / etc., and `panel-label` / `panel-value`.

### Radius scale

Project-wide: `--radius-sm: 6px`, `--radius: 8px`, `--radius-md: 10px`, `--radius-lg: 14px`, `--radius-xl: 20px`, `--radius-full: 9999px`.

### Motion

- Standard hover transitions: 100–150ms `cubic-bezier(0.16,1,0.3,1)`.
- Modal/popover open: 200–250ms same easing.
- Italic display word on initial load: 350ms slide-up + fade-in, delayed 60ms after the rest of the title block.
- Existing FLIP motion on section insert/delete/duplicate/move is preserved verbatim.
- No springs, no looping animations, no glow.

## Signature devices (the things to get right)

1. **Italic-accent display word.** Every marketing page title has exactly one italic word: "My *projects*", "*Welcome* back.", "Workspace *settings*.", "Brand *kits*.", "You've been invited to *Acme Co.*". This is the visual signature of the brand. Implemented as `<span class="font-serif italic font-light">…</span>`.
2. **Eyebrow + masthead rule.** Every marketing page starts with an `label-eyebrow` ink-3 line, then the display title, then `body-lg` ink-2 subtitle, then a full-width 1px hairline rule — magazine masthead device.
3. **220 / 760 editorial split** for settings pages. Left column = section list (vertical, no borders between items, ACTIVE state is a `brand-soft` pill behind the active text). Right column = content with its own header row.
4. **Mono accents.** Timestamps, hex codes, status indicators, project counts ("· 4"), keyboard hints, project IDs in URLs — all in JetBrains Mono. This is what gives the dashboard craft-tool credibility.
5. **Rules over shadows.** 1px hairlines (`--color-rule` / `--ed-rule`) carry hierarchy. Shadows only on modals, dragged cards, and the rotated email-preview card on the login hero — always warm-tinted.
6. **One gradient, three places.** `--gradient-hero` appears only on (a) login hero pane background, (b) dashboard "+ New project" empty card border, (c) auth-screen brand mark. Anywhere else, orange is solid.
7. **Warm-dark editor, not cool slate.** Every editor surface is mixed toward the ink-brown spectrum (`#0E0D0B` base). The contrast between the warm-dark frame and the white email substrate at the center is the entire visual concept — the email is treated like a piece of paper on a desk.

## Screen-by-screen application

References below point to the Stitch mockups under `docs/superpowers/specs/stitch-screenshots/` and to the existing route/component files.

### Sign-in — `src/app/login/page.tsx` (also signup/reset same shell)

Mockup: `03-login.png` / `03-login.html`.

- Two-pane composition: 60/40 split, left pane `--color-bg`, right pane `--gradient-hero`.
- Top-left: 24px GT monogram (orange T cut from filled ink G) + "GlobalTT Editor" wordmark.
- Left pane content block, max 460px, vertically centered. Eyebrow "SIGN IN" → headline "*Welcome* back." (display-2xl with italic on "Welcome") → body-lg subtitle → form (email, password with "Forgot?" link aligned right of label, primary orange "Continue" 40px full-width) → "or" with hairline rules → SSO buttons (Google, Microsoft) → footer link "New to GlobalTT? *Create an account.*" with animated orange underline on hover.
- Right pane: gradient background with a slightly rotated (~-3°) white email-preview card floating off-center, soft warm shadow `0 30px 80px -20px rgba(180,66,28,0.35)`. Below it, white eyebrow "WHAT YOU'LL BUILD" + 24px Newsreader "Emails that *ship*." with italic on "ship".
- Faint 4%-opacity noise overlay on the gradient pane to add warmth.

### Sign-up / Reset

Same two-pane shell as login; only the form body changes. Sign-up adds Name and a TOS checkbox; Reset shows a single-field "Send reset link" form with a success-state mockup variant.

### Invite acceptance — `src/app/invite/[token]/page.tsx`

Mockup: `05-invite.png` / `05-invite.html`. Centered single-pane composition on `--color-bg`. No nav.

- Top-left: GT monogram + wordmark.
- Center, 520px max: eyebrow "INVITATION" → headline "You've been invited to *Acme Co.*" (48px Newsreader, italic on the workspace name).
- Subtitle: "Jorge Martínez has invited you to join the Acme Co. workspace on GlobalTT Editor as an Editor."
- Invite card (`bg-elevated`, 1px rule, 14px radius, 460px wide): three rows separated by 1px hairlines. Each row: label-eyebrow on left, content on right (workspace identity, inviter identity, role pill + role description).
- Primary "Accept invitation" orange button (44px tall, 460px wide).
- Ghost "Decline" link below.
- Footer body-sm ink-3 "This invitation expires in 7 days."
- Optional editorial flourish (bottom-right corner): 1px dotted line + a small postal-stamp circle containing the GT monogram and a tiny date "MAY 20" in tracked mono. Skip if it complicates the implementation.

### Workspace dashboard — `src/app/w/[slug]/page.tsx` + `src/components/dashboard/*`

Mockup: `02-dashboard.png` / `02-dashboard.html`.

- 64px sticky topbar `--color-bg` with 95% opacity backdrop-blur + 1px bottom rule. Left: GT monogram + workspace switcher pill ("Acme Co" + chevron, 1px rule, hover `--color-bg-sunken`). Right: ghost "Import" + primary orange "+ New project" + 32px avatar (initials in `--color-brand-ink` on `--color-brand-soft`).
  - The mockup added Campaigns / Workflows / Audience / Library tabs in the topbar. The refactor keeps the existing scope and omits those (no such features exist yet).
- Masthead (64px x padding, 56px top): eyebrow "WORKSPACE" → "My *projects*" (display-xl, italic on "projects") → body-lg ink-2 subtitle "12 projects · last updated 4 hours ago" with "4 hours ago" in mono → 24px gap → full-width hairline rule.
- Filter row 32px below the rule: tabs (All / Drafts / Archived) on left with the active tab carrying a 2px brand underline; on the right, a 240px search pill + sort dropdown pill.
- Project grid: 3 columns, 32px gutters. Each `ProjectCard` rebuilt per the spec — 16:10 preview region (render a small actual mocked email DOM, not a screenshot), 1px hairline, metadata row with project name in `heading-md` + mono timestamp + optional brand-soft "DRAFT" pill. Hover lifts border to `rule-strong` + tiny warm shadow + reveals a "⋯" button.
- The empty-state "+ New project" card lives as the last slot in the grid (or as the only slot when there are no projects). Dashed 1px border with `--gradient-hero` stroke applied via mask, `bg-cream` tint, centered plus icon + heading + body-sm caption.

### Project editor — `src/app/w/[slug]/p/[id]/page.tsx` + `src/components/editor/*`

Mockup: `01-editor.png` / `01-editor.html`.

Topbar (`Topbar.tsx`):

- 52px tall (currently 2.5px+2.5 py = ~44px; bumping to 52px). `--ed-panel-2` fill, 1px bottom rule.
- Left cluster: 24px GT monogram · arrow-left + workspace name in `--ed-ink-3` · 1px vertical rule · project name in Newsreader 18px (becomes the inline-editable field) · save-status mono badge with a 6px round colored dot (success/amber/brand/danger). The save status replaces the current text-only `statusIcon` + `statusLabel` pattern but keeps the existing state machine.
- Right cluster: undo/redo (32px icon buttons, tooltip-wired) · 1px vertical rule · panel-toggle (existing `leftPanelOpen` state, active state is `brand-soft` fill + orange icon) · translate menu pill · download menu pill · share button (primary orange).
- Tooltips on every icon-only button — already wired via the recently merged work, just restyle.

Left panel (`LeftPanel.tsx` + `panels/*`):

- 320px fixed, `--ed-panel` fill, 1px right rule, scrollable.
- Each `GlobalStylesPanel`, `HeaderPanel`, `ProductSectionPanel`, `FooterPanel` becomes a "panel section card": `--ed-panel-2` fill, 1px `--ed-rule` border, 10px radius, 10px padding, with `inset 0 1px 0 rgba(237,231,220,0.04)` hairline highlight on the top edge.
- Section titles use `panel-section` style (uppercase, 0.18em tracked).
- Field labels inside cards: `panel-label` (uppercase 0.05em 11px ink-2).
- Inputs in panels: 28px height (dense), `--ed-panel` background, 1px rule, 6px radius. Focus: 1px brand border + 2px brand-soft outer ring.
- Color swatch fields: 28×28 tile with 6px radius + 1px ink-4 inset border.
- `Products` group has its own uppercase header "PRODUCTS · 3" (count in mono).
- `+ Add Product Section` becomes a full-width dashed-rule ghost button.

Canvas (`Preview.tsx` / `PreviewBody.tsx`):

- Page background changes from the current `#080808` to `--ed-canvas-pad` (`#080706`), 32px padding around the email substrate.
- Existing white substrate is preserved as-is (it represents the user's actual email).
- Selected section outline (currently 2px brand) is preserved exactly — `--color-brand` 2px solid, `-2px` inset.

Floating toolbars (`SectionToolbar.tsx`, `SelectionActionBar.tsx`, `SectionInsertBar.tsx`):

- Pill shape, `--ed-panel-2` fill, 1px `--ed-rule-strong` border, 8px padding, 6px gap between 32px icon buttons. Icons in `--ed-ink-2`, hover `--ed-ink`, active `--color-brand`.
- `SelectionActionBar` adds a slightly heavier warm shadow `0 8px 24px -8px rgba(0,0,0,0.5)` to differentiate from the section toolbar.
- `SectionInsertBar` hover state: hairline becomes an orange dashed line + centered "+ Insert section" pill.

Modals/popovers (`AssetPicker`, `DownloadMenu`, `TranslateMenu`, `ChatRefinePanel`):

- `--ed-panel-2` fill, 1px `--ed-rule` border, 12px radius, `0 20px 60px -20px rgba(0,0,0,0.6)` warm shadow.

### Settings → Members — `src/app/w/[slug]/settings/members/page.tsx`

Mockup: `04-settings-members.png` / `04-settings-members.html`.

- Reuse the dashboard topbar.
- Add a 48px secondary breadcrumb row "← Projects / Settings".
- Masthead: eyebrow "SETTINGS" → "Workspace *settings*." → subtitle "Manage your workspace, members, and brand kits." → full-width hairline.
- Two-column 220/760 split. Left = vertical settings nav (General, Members ACTIVE, Brand kits, Billing, API tokens). Active state: `brand-soft` pill behind active text + ink-1 color. Inactive: ink-3.
- Right = section header ("Members" + orange "+ Invite member"), description, then the members table.
- Members table: header row in `label-eyebrow` ink-3 36px tall, 1px bottom rule. Data rows 64px, 1px bottom rule, hover `--color-bg-sunken`. Columns: Name (32px avatar + name in Geist 14 ink-1) / Email (Geist 14 ink-2) / Role (outlined pill, 1px rule, ink-1 text, NO fill; plus a small brand-soft "YOU" pill next to the current user's row) / Joined (JetBrains Mono 12 ink-3) / "⋯" ghost button.
- Below table: "Pending invitations · 2" (count in mono). Each pending invite as a `bg-sunken` card (1px rule, 10px radius, 56px tall): envelope icon circle + email + outlined role pill + ghost "Copy link" + ghost "Revoke".
- Footer body-sm ink-3 "Invitations expire in 7 days."

### Settings → General — `src/app/w/[slug]/settings/general/page.tsx`

Reuses the masthead + 220/760 split established by Members. Right column content: a form for workspace name + slug (with mono prefix `globaltt.com/w/`), workspace logo upload (uses `ImageInput`), and a "Danger zone" card with a 1px `--color-danger` border and a "Delete workspace" secondary button (ink fill on light, dialog confirmation).

### Settings → Brand Kits — `src/app/w/[slug]/settings/brand-kits/page.tsx`

Mockup: `06-brandkits-a.png` / `06-brandkits-a.html` (preferred variant). Variants `b` and `c` are alternates with slightly different swatch proportions and active-nav treatment, kept under `stitch-screenshots/` for reference.

- Same masthead + nav as Members; active item is "Brand kits".
- Right column header: "Brand kits · 4" (count in mono) + orange "+ New brand kit" button right-aligned, then a body-md ink-3 description.
- Grid: 2 columns, 24px gutter, 4 kit cards + 1 empty-state slot.
- Each kit card: 64px-tall horizontal **5-swatch band** at top (the signature device — kits identifiable in 1 second) → 1px hairline → 16px padding → kit name in `heading-md` + brand-soft "DEFAULT" pill on the default kit → row of 5 hex chips in mono → metadata row in body-sm ink-3 (font names + project count + relative date in mono) → 1px hairline → ghost Edit / Duplicate / "⋯" action row.
- Empty-state slot: 1px dashed border (using `--gradient-hero` via mask), `--color-bg-cream` fill, plus icon + heading + caption.

### Settings → Billing, API tokens

Not yet implemented features. Build the nav slots but stub the right-column content with an editorial "Coming soon" block (display-lg Newsreader "Soon." italic + body-lg ink-3 description). Skip if not in scope at refactor time.

## Components — what to add / change

New shared primitives under `src/components/ui/`:

- `Eyebrow.tsx` — wraps `label-eyebrow` style. Used on every marketing page.
- `PageMasthead.tsx` — composes Eyebrow + serif title (with italic-accent prop) + subtitle + hairline rule. Single component to enforce the device.
- `SettingsNav.tsx` — the 220px vertical nav with active-pill state. Takes an array of `{href, label, active}`.
- `RolePill.tsx` — outlined variant (default) and brand-soft variant ("YOU", "DEFAULT") — used in members table and brand kits.
- `SwatchChip.tsx` — 28×28 color tile + optional hex caption underneath. Used in Brand Kits and in the editor's GlobalStylesPanel.
- `StatusBadge.tsx` — the editor's mono save-status badge with the colored leading dot.
- `BrandMark.tsx` — the GT monogram (SVG, 24/28/56px sizes).

Existing primitives to restyle (not replace):

- `Button` (`src/components/ui/Button.tsx`) — adds `variant: primary | secondary | ghost | link` matching the spec. Internal top-highlight on primary. Hover translate -1px + warm shadow.
- `WorkspaceSwitcher` — restyle as a pill with chevron; no behavioral change.
- `DownloadMenu`, `TranslateMenu`, `UserMenu` — restyle popovers per the editor/dashboard popover spec.
- `Tooltip` (already shadcn) — tweak background to `--ed-panel-2` in dark contexts, `ink` in light.

## Files touched

```
src/app/globals.css                         (tokens, font wiring, base resets)
src/app/layout.tsx                          (next/font registration)
src/components/ui/Button.tsx                (variants)
src/components/ui/Eyebrow.tsx               NEW
src/components/ui/PageMasthead.tsx          NEW
src/components/ui/SettingsNav.tsx           NEW
src/components/ui/RolePill.tsx              NEW
src/components/ui/SwatchChip.tsx            NEW
src/components/ui/StatusBadge.tsx           NEW
src/components/ui/BrandMark.tsx             NEW
src/app/login/page.tsx                      (compose two-pane)
src/app/signup/page.tsx                     (reuse two-pane)
src/app/reset/page.tsx                      (reuse two-pane)
src/app/invite/[token]/page.tsx             (centered card composition)
src/app/w/[slug]/page.tsx                   (masthead + filter row)
src/components/dashboard/ProjectGrid.tsx
src/components/dashboard/ProjectCard.tsx
src/components/dashboard/UserMenu.tsx
src/components/workspace/WorkspaceSwitcher.tsx
src/app/w/[slug]/settings/general/page.tsx
src/app/w/[slug]/settings/members/page.tsx
src/app/w/[slug]/settings/brand-kits/page.tsx
src/components/editor/EditorShell.tsx       (52px topbar height)
src/components/editor/Topbar.tsx            (left/right cluster restructure, save badge)
src/components/editor/LeftPanel.tsx         (panel section card styling)
src/components/editor/panels/*.tsx          (input density + labels)
src/components/editor/canvas/SectionToolbar.tsx
src/components/editor/canvas/SelectionActionBar.tsx
src/components/editor/canvas/SectionInsertBar.tsx
src/components/editor/Preview.tsx           (canvas pad color)
```

## Rollout

Single feature branch (`feat/ui-refactor-warm-editorial`), big-bang PR.

Suggested commit order so each commit reads cleanly in the diff:

1. Tokens + fonts + `globals.css` rewrite.
2. New shared primitives (`Eyebrow`, `PageMasthead`, `SettingsNav`, `RolePill`, `SwatchChip`, `StatusBadge`, `BrandMark`).
3. `Button` variant refresh.
4. Auth surfaces (login → signup → reset → invite).
5. Dashboard (`w/[slug]/page.tsx` + dashboard components).
6. Settings (general → members → brand-kits).
7. Editor topbar.
8. Editor left panel + panels.
9. Editor canvas pad + floating toolbars.

Each commit should pass `npm run typecheck` and the existing test suite. Tests that assert specific class names or copy will need updates — adjust them as part of the relevant commit.

## Acceptance criteria

- All routes render with no console errors, no hydration warnings.
- Editor: every existing keyboard shortcut, save/undo/redo, FLIP motion, and selection behavior works identically.
- Auth flow (login → workspace bootstrap → editor) completes end-to-end.
- Members table allows the same role mutations as before.
- Lighthouse a11y score ≥ 95 on dashboard + editor.
- Newsreader italic loads (`font-display: swap` allowed; no FOIT > 200ms on warm cache).
- Side-by-side screenshot diff against the 4 Stitch mockups for the surfaces they cover (login, dashboard, editor, members).

## Open items

- **Email substrate styling inside the editor** — keep substrate fully driven by user data (Global Styles + Brand Kit), not by editor chrome tokens. Already true; flagged because the Stitch editor mockup happens to show an orange-heavy email which could mislead implementers.
- **Postal-stamp flourish on invite acceptance** — the Stitch mockup includes it in the bottom-right corner. Implement as a small inline SVG; drop if it adds friction.
- **Brand Kits variant choice** — three variants exist (`a`/`b`/`c`); `a` is the recommended source. Variants `b`/`c` differ mainly in swatch band ratio and active-nav styling.

## References

- `docs/superpowers/specs/stitch-screenshots/01-editor.{png,html}`
- `docs/superpowers/specs/stitch-screenshots/02-dashboard.{png,html}`
- `docs/superpowers/specs/stitch-screenshots/03-login.{png,html}`
- `docs/superpowers/specs/stitch-screenshots/04-settings-members.{png,html}`
- `docs/superpowers/specs/stitch-screenshots/05-invite.{png,html}`
- `docs/superpowers/specs/stitch-screenshots/06-brandkits-a.{png,html}` (recommended source), plus variants `06-brandkits-b.*` and `06-brandkits-c.*`
- Stitch project: `projects/15011100066150914960`
- Stitch design systems: `assets/8839809532302695665` (light), `assets/2044372008074932280` (dark editor)
