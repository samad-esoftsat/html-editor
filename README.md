# GlobalTT Email Editor

Multi-tenant Next.js + Supabase web app for creating, customising, and exporting GlobalTT email campaigns. Replaces the manual HTML-editing workflow with a visual editor anyone on the team can use.

## Quick start

```powershell
npm install
cp .env.local.example .env.local      # then fill in Supabase URL + anon key
npm run dev
```

Open http://localhost:3000.

## Database

Apply migrations once per Supabase project, in order:

1. Paste `supabase/migrations/0001_init.sql` into Supabase Dashboard → SQL Editor → Run.
2. Paste `supabase/migrations/0002_storage.sql` → Run.

## Tests

| Command | Scope |
| --- | --- |
| `npm test`        | Vitest unit tests (export, import, store, debounce). |
| `npm run e2e`     | Playwright end-to-end (requires `E2E_EMAIL` / `E2E_PASSWORD` in `.env.local`). |
| `npm run lint`    | ESLint. |
| `npm run typecheck` | `tsc --noEmit`. |

## Project layout

See `docs/superpowers/plans/2026-05-05-globaltt-editor/SPEC.md` §3.

## Deployment

Hosted on Vercel. `main` branch auto-deploys to production. Required env vars on Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `NEXT_PUBLIC_SITE_URL`
