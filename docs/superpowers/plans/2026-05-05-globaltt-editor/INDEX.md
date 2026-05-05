# GlobalTT Email Editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a multi-tenant Next.js + Supabase web app where GlobalTT staff create, edit, and export customised HTML email campaigns without writing code, replacing the current manual HTML-editing workflow.

**Architecture:** Next.js 15 App Router (TS) on Vercel, Supabase Postgres for data, Supabase Auth for users, Supabase Storage for uploaded images. Editor state is a single JSONB blob per project; live preview renders that blob through the same pure renderer used for export, guaranteeing WYSIWYG. Row Level Security enforces multi-tenancy at the database layer.

**Tech Stack:** Next.js 15, React 19, TypeScript 5, Tailwind CSS 4, Zustand, Supabase JS v2 (`@supabase/supabase-js` + `@supabase/ssr`), Vitest + React Testing Library, Playwright, Vercel hosting.

---

## Document layout

This plan is split into focused files. **Read SPEC.md first** — every phase plan references its types and contracts. Then work through phases 1 → 4 in order.

| File | Purpose |
| --- | --- |
| [`SPEC.md`](./SPEC.md) | Technical contract: data model, DB schema, routes, export/import contracts, state, auth, autosave, non-goals. |
| [`PHASE-1-FOUNDATION.md`](./PHASE-1-FOUNDATION.md) | Scaffolding, Supabase init, auth, middleware, database migrations, dashboard with full CRUD on projects. |
| [`PHASE-2-EDITOR.md`](./PHASE-2-EDITOR.md) | Editor route, Zustand store, live preview iframe, autosave, control panels for global styles / header / footer / product sections, image upload. |
| [`PHASE-3-IMPORT-EXPORT.md`](./PHASE-3-IMPORT-EXPORT.md) | Pure HTML export renderer (TDD), download endpoint, HTML import parser (TDD), import wizard UI (upload → review → confirm). |
| [`PHASE-4-POLISH-DEPLOY.md`](./PHASE-4-POLISH-DEPLOY.md) | Empty/error/loading states, toasts, confirmation dialogs, Google OAuth, password reset, Vercel deploy, production env, smoke tests. |

## Phase dependency

```
SPEC ──► PHASE-1 ──► PHASE-2 ──► PHASE-3 ──► PHASE-4
                       │
                       └─ image upload sub-step is independent of import/export
```

Each phase ends in a deployable, demoable state. Stop, demo, get feedback before starting the next.

## Reference artefacts (already in repo)

- `globaltt-email.html` — master campaign template the renderer must reproduce byte-equivalently for the default project. Move to `reference/` in Phase 1, Task 1.
- `globaltt-email-editor.html` — earlier prototype, kept for reference only.
- `globaltt-editor-presentation.html` — stakeholder deck, source of truth for UX.

## Conventions used in every phase doc

- Exact file paths, exact commands, exact code blocks. No "TBD", no "etc.", no "similar to above".
- All commands written for **PowerShell on Windows 11**. POSIX-equivalent given when meaningfully different.
- TDD applied where pure functions exist (export renderer, import parser, validators). UI work uses "build then verify in browser" with Playwright spec for the golden path.
- Commits are frequent — one per task by default. Commit messages follow Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`).

## Out of scope for v1 (do not build)

- Real-time multi-user editing (last-write-wins is fine).
- Undo/redo history (browser back inside textarea is sufficient).
- Drag-and-drop section reordering (up/down buttons only).
- Template marketplace / sharing between accounts (Phase-3-deck feature, post-v1).
- Direct Nutshell CRM integration (manual HTML download is the v1 contract).
- A11y audit (basic semantic HTML and labels only).
- I18n of the editor UI itself (English only).

---

**Next step:** Open `SPEC.md` and read it end-to-end before starting Phase 1.
