# SaaS Roadmap — Brainstorm

Captured 2026-05-08. Frame: this is a single-tenant-ish HTML email editor for GlobalTT today (one user, one brand, autosave to Supabase, Outlook-safe export, Blank/GlobalTT template picker). To become a real SaaS, every feature must either (a) shorten time-to-first-send for a new user, (b) make repeat sends nearly free, or (c) prove the email actually works.

## Tier 1 — Survivable as a product (ship next)

Table-stakes the moment a second company signs up.

- **Workspaces / multi-tenancy.** `organizations` table, `members` (role: owner/editor/viewer), RLS scoped to `org_id`. Today `projects.user_id` is one user — can't invite a designer.
- **Brand kits.** Reusable `brand_kits` row attached to org: global colors, fonts, logo, footer NAP. New project → pick brand kit → header/footer/colors prefilled. Biggest "this saves me time" moment for repeat users.
- **User-saved templates.** "Save this project as a template" → appears in the picker for the org. With brand kits, blank → send-ready in under a minute.
- **Real send / handoff.** Wire up "Send a test to me," then "Send to a list" via Resend or Postmark. The moment users send *from* the tool, switching cost spikes.
- **Version history.** Already have `updated_at` + optimistic concurrency — add `project_revisions` on every autosave-flush (or every N minutes). Turns the autosave-anxiety symptom (footer image showing previous URL) into a non-issue with "Restore previous version."

## Tier 2 — Friendly & enticing

- **Live mobile preview toggle.** Split-view desktop/mobile with a device frame. Email design lives or dies on Outlook + iPhone Mail.
- **Inbox preview.** Litmus / Email on Acid integration, or lighter version with headless Chrome screenshots of common clients. Premium feature.
- **AI copy assist per section.** "Generate 5 bullets about Starlink for a maritime audience" → fill. Tied to brand kit's tone-of-voice setting. Killer feature for non-writers; structured section schema makes prompts much better than generic AI tools.
- **AI image gen / stock search built in.** Replace "imageSrc URL" with: upload, pick from brand library, search Unsplash, generate from prompt. Persist to Supabase Storage with alt-text suggestions.
- **Section library + drag-to-reorder.** New section types beyond the product card — hero, testimonial, pricing table, two-column. Drag handles instead of up/down buttons.
- **Comments & approvals.** Click anywhere on the preview → leave a comment. Mention a teammate. "Request approval" sends a read-only preview link. Turns a tool into a workflow product.
- **Public share preview links.** Read-only URL, no login, 7-day expiry. For client review.

## Tier 3 — Why-they-stay (data and moat)

- **Send analytics.** If you control sending, you own opens, clicks, bounces. Heatmaps on the email itself.
- **A/B subject line + section testing.** Trivial once you control sending.
- **Audience / contact lists.** Lightweight CRM-lite (CSV import, segment, suppression) — or stay focused and integrate with HubSpot/Mailchimp/Klaviyo as the "design layer."
- **Scheduled & recurring sends.**
- **Reusable content blocks.** Brand kits but for repeated marketing chunks (footer disclaimers, product blurbs).

## Tier 4 — Strategic bets

- **Multi-channel output from the same project.** Same structured sections render as: email HTML, landing page, PDF one-pager, social card images. Data model already separates content from presentation — lean into it. The wedge that makes you not "another email builder."
- **API + Zapier.** "When a new product is added in Airtable, generate an email draft."
- **Embeddable editor SDK.** Sell the editor as a component to other SaaS products. Long shot, high-margin.
- **Translation / multi-locale.** AI translates each section in place, preserves layout. Big for international audiences like GlobalTT's.

## Recommended ship order

Each unlocks the next:

1. **Workspaces + brand kits + user-saved templates** — required to onboard a second customer.
2. **Test send + version history** — removes the two scariest moments (autosave-image confusion, "did this actually arrive looking right?").
3. **AI copy assist + image picker** — the "this is magic" moment that converts trials.
4. **Comments + share links** — solo tool → team workflow.
5. **Real send + analytics** — switching cost becomes prohibitive.

Everything else is Tier-3+ and can wait.
