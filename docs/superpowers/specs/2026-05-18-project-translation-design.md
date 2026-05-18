# Project Translation — Whole-Project Translation to a New Sibling

**Date:** 2026-05-18
**Status:** Approved for implementation

## Problem

Users build a campaign in one language and need to send it in others — French, Portuguese, Cantonese, Mandarin, etc. Today they would manually duplicate the project and edit every text field by hand.

## Goals

- Add a single action that translates the current project into a target language and produces a new sibling project.
- Use Gemini (already integrated for image generation) as the translation provider.
- Preserve URLs, emails, phone numbers, and other identity-bearing fields exactly.
- Preserve the rendered HTML structure and styling perfectly.

## Non-goals

- In-place translation (always create a new project).
- Inline per-field translation buttons.
- Side-by-side preview before saving.
- Hard quota / rate limit (we will log usage for future tightening but not block).
- Right-to-left (Arabic, Hebrew). Excluded from v1 because the email template body uses LTR layout; supporting RTL needs `dir="rtl"` and CSS adjustments. Easy follow-up.

## UX

1. In the editor topbar, next to the Download menu, the user clicks a **Translate…** button.
2. A dialog opens with:
   - **Target language** dropdown (12 languages, see below). Required.
   - **Name** input pre-filled with `"<Original> (FR)"` where the suffix is the abbrev for the chosen language. Editable.
   - **Tone / extra instructions** textarea (optional). Empty by default.
   - **Cancel** / **Translate** buttons.
3. On Translate: the button shows a spinner, dialog stays open.
4. On success: dialog closes, success toast `"Translated project created"`, then `router.push('/w/<slug>/p/<newId>')` — the user lands in the new project, ready to review and tweak.
5. On error: dialog stays open with an inline error message; the spinner clears so the user can retry or cancel.

## Curated languages (v1)

| Code | Label | Abbrev (for name) |
|---|---|---|
| `en` | English | EN |
| `fr` | French | FR |
| `es` | Spanish | ES |
| `pt-BR` | Portuguese (Brazilian) | pt-BR |
| `pt-PT` | Portuguese (European) | pt-PT |
| `it` | Italian | IT |
| `de` | German | DE |
| `nl` | Dutch | NL |
| `yue` | Cantonese | yue |
| `zh-CN` | Mandarin (Simplified) | zh-CN |
| `zh-TW` | Mandarin (Traditional) | zh-TW |
| `ja` | Japanese | JA |

Source language is **auto-detected** by the model — the user picks only the target.

## Architecture

```
[Translate dialog]                         [POST /api/projects/:id/translate]
     │                                              │
     ├── name / language / tone ─────────────────►  │
     │                                              ├── auth (workspace editor role)
     │                                              ├── load source project
     │                                              ├── extractTranslatable(data)
     │                                              │     → { paths -> strings }
     │                                              ├── Gemini call (structured output)
     │                                              ├── applyTranslations(data, response)
     │                                              ├── insert new project row
     │                                              ▼
     │                                         { id, name }
     │ ◄────────────────────────────────────────── │
     ▼
[router.push to new project, success toast]
```

## Files

**New:**

- `src/lib/translate/languages.ts` — exports the curated language list with `{ code, label, abbrev }`. Single source of truth for what the dropdown shows and how the name suffix is built.

- `src/lib/translate/fields.ts` — pure helpers:
  - `extractTranslatable(data: ProjectData): Record<string, string>` — returns a flat map of dot-path keys to source strings (e.g. `"header.title"`, `"sections.0.bullets.2"`, `"footer.address"`).
  - `applyTranslations(data: ProjectData, translations: Record<string, string>): ProjectData` — deep-clones the data, walks the same paths, and substitutes translated strings. Missing keys fall back to the original. Non-string values are ignored defensively.
  - Round-trip identity: `applyTranslations(data, extractTranslatable(data))` deep-equals `data`.

- `src/lib/translate/gemini.ts` — thin wrapper around `@google/genai`:
  - `translateStrings({ strings, targetLanguage, tone }): Promise<Record<string, string>>`
  - Uses Gemini's structured-output mode with a `responseSchema` shaped as an object of `string` values keyed by the same paths it received.
  - System prompt pins the brand-preservation rules (see below).
  - Throws on API failure; caller decides how to respond.

- `src/app/api/projects/[id]/translate/route.ts` — POST handler.
  - Auth via `createClient` + workspace role check (editor minimum).
  - Body shape: `{ name?: string; language: string; tone?: string }`.
  - Validates `language` is one of the curated codes; otherwise 400.
  - Pipeline: load source → extract → translate → apply → insert new row with translated `data`, the chosen name, and the source project's `org_id` / `template_source` / `brand_kit_id`.
  - Image fields (`logoSrc`, `bannerSrc`, `imageSrc`) are copied unchanged — translation does not regenerate images.
  - Returns `{ id, name }` (status 201).

- `src/components/editor/TranslateMenu.tsx` — client component:
  - Button styled like the Download button (primary + chevron not needed; opens a modal, not a popover).
  - Dialog uses the same overlay/panel pattern as the existing `ConfirmDialog` / `PromptDialog` (mounted ad-hoc as the component owns its own state — no global singleton needed since only the editor renders this).
  - Internal state: open, language code, name, tone, pending.
  - On submit: calls the client SDK helper, then `router.push` to the new project on success, or sets a local error message on failure.

- `src/lib/api/projects.ts` — extend with `translateProject(id, { name?, language, tone? }): Promise<{ id, name }>`.

- `tests/unit/translate.fields.test.ts` — unit tests for `extractTranslatable` and `applyTranslations`.

- `tests/unit/translate.languages.test.ts` — sanity: language codes are unique, abbrevs are non-empty, labels are non-empty.

**Modified:**

- `src/components/editor/Topbar.tsx` — render `<TranslateMenu projectId slug projectName />` in the right-hand button cluster, next to `<DownloadMenu />`.

## Translatable schema

For each field in `ProjectData`, classify as:

**TRANSLATE — sent to Gemini, replaced by response:**

- `header.title`
- `header.sectionHeading`
- `header.logoAlt`
- `header.bannerAlt`
- `sections[].title`
- `sections[].bullets[]`
- `sections[].imageAlt`
- `sections[].ctaText`
- `footer.bannerAlt`
- `footer.companyName` (sent with explicit "preserve unless a generic descriptor" instruction)
- `footer.address` (sent with explicit "translate city/country, keep street/postal/numbers" instruction)
- `footer.websites[].label`

**PRESERVE — never sent to the model, copied bit-for-bit:**

- All URLs: `header.logoSrc`, `header.bannerSrc`, `sections[].imageSrc`, `sections[].ctaUrl`, `footer.bannerSrc`, `footer.websites[].url`, `footer.socials[].url`, `global.contactUrl`.
- Contact data: `footer.email`, `footer.phone`, `footer.phoneTel`.
- All colors, font sizes, font family, layout numbers.
- All IDs (`sections[].id`).
- Social platform enums.
- Schema metadata (`schemaVersion`).

## Gemini call

**System prompt (constant):**

```
You translate marketing email content from one language to another.

Target language: <language>.

Rules:
- Translate marketing copy naturally and concisely. Match the tone of the source unless the user provides an override below.
- Preserve URLs, email addresses, and phone numbers EXACTLY. Never translate them.
- Preserve proper nouns: company names, product names, person names, brand-specific terms. If a value clearly is a brand name, keep it unchanged.
- For addresses: translate city and country names where commonly localized (e.g. "London" -> "Londres" in French), but keep street names, street numbers, postal/zip codes, and unit numbers exactly as written.
- Preserve newline characters (\n) inside multi-line strings.
- Do not add quotation marks, prefixes, or commentary. Return only the translated string.
- Match capitalization conventions of the target language.

<tone_override_block, only present if user provided tone>
Tone instructions (override the default): <tone>
</tone_override_block>

Return a JSON object with the same keys you received. Each value is the translated string for that key.
```

**User content:** the JSON object from `extractTranslatable(data)`.

**Response schema (Gemini structured output):** the same JSON object shape. We do not enumerate keys in the schema (variable number of sections / bullets / websites) — we rely on the description: `{ type: "object", additionalProperties: { type: "string" } }`.

**Defensive parsing:** after the call returns, the server iterates the keys we sent, looks up each key in the response, and only replaces the source string if the value is a non-empty string. Missing keys → keep original. Non-string values → keep original.

## HTML and styling preservation

This is the architectural reason translation cannot break styling:

- **The translator never sees HTML.** It operates on the `ProjectData` model — plain string values like `"Welcome to our event"`. The HTML structure (tables, MSO conditionals, inline styles, `@media` rules, CSS classes, colors, font sizes) is **not** in the data we translate.
- **`renderEmail(translatedData)` regenerates the entire HTML deterministically.** The output is structurally identical to the source HTML; only the text inside `<h2>`, `<li>`, `<a>`, etc. changes.
- **`renderEmail` already HTML-escapes every user-supplied string** via `htmlEscape()` and `attrEscape()`. Any stray characters in a translated value (`<`, `>`, `&`, quotes) are made safe automatically — there is no path from a translated string to a broken tag.

**Concrete safeguards on top of that:**

1. **Structured output** — Gemini returns JSON with the same shape it received. The schema (`additionalProperties: string`) prevents nested objects, arrays, numbers, or nulls from leaking in.
2. **Per-key type check** — server-side, before applying. If a value is not a non-empty string, the original is kept.
3. **Missing-key fallback** — any key Gemini drops gets filled from the original. Worst case: a partial translation, never a structurally broken project.
4. **Newline preservation** — explicit instruction in the system prompt; unit test covers a multi-line `footer.address` round-trip.
5. **Untranslatable fields are filtered out before the request** — URLs, emails, phone numbers, social URLs, colors are never sent. The model cannot accidentally rewrite them because it never sees them.

**The one thing we cannot fully prevent: length expansion.** German is often 30–50% longer than English; French ~20–30% longer. A short button label can become long enough to wrap awkwardly. We mitigate, not eliminate, this:

- The user lands in the new project after translation and can hand-tweak any oversize text (font sizes are per-section adjustable).
- The success toast carries a one-line nudge so users know to review.
- Future improvement (not v1): a length-delta sanity check that flags fields where the translation is more than 2× the source length.

## Error handling

- 401 / 403 — auth (no workspace, or role below editor).
- 400 — invalid `language` code (not in the curated list) or missing required field.
- 404 — source project not in the user's workspace.
- 500 — Gemini call failed, response was not valid JSON, or the response was missing all expected keys. The client shows the message inline in the dialog.
- 5xx from insert — pass through the supabase error.

## Security and cost

- The translate route requires editor role; same as create/update.
- Gemini text-only calls are cheap; we will not enforce a quota in v1. Log a usage row (`translations` table with `org_id, user_id, source_project_id, target_language, created_at, character_count`) so a future quota can be added without code changes. Schema migration is part of the plan.
- No SSRF risk — we do not fetch arbitrary URLs from the translated data.
- No PII leakage beyond what already happens with image generation: project text is sent to Gemini. Same data-flow as the existing image features, no additional disclosure surface.

## Testing

**Unit (Vitest):**

- `extractTranslatable`:
  - Returns the expected keyed map for a representative project with header, two sections (each with bullets), and a footer with websites and address.
  - Preserves field order (alphabetical or schema order is fine; just consistent).
  - Does not include URLs, emails, phones, colors, social platforms.

- `applyTranslations`:
  - Round-trip identity when the translation map equals the extracted map.
  - Missing keys → original preserved.
  - Non-string values in the map → original preserved (defensive).
  - Multi-line strings (address) survive `\n` round-trip.
  - Adding extra bullets / sections via the data still works after apply (no key mismatch crash).

- `languages.ts`:
  - All codes unique, all labels non-empty, all abbrevs non-empty.

**Mocked integration:**

- Route handler with a stubbed Gemini provider that returns a known translation map → asserts the new project row contains the translated strings, preserves URLs/emails/phones, and is owned by the same org.
- Route handler with a stubbed Gemini provider that returns an invalid response (object with wrong types) → asserts the new project is created with the source strings as fallback (no broken state) OR a 500 if all keys missing.

**Manual:**

- Translate a project from English to French, German, and Cantonese. Open each new project: text is translated, URLs/emails/phones are exact matches, layout renders, images appear in their original positions.
- Add `<b>test</b>` to a section bullet, translate. Verify the angle brackets survive HTML-escape and render as text, not tags.
- Translate a project with multi-line `footer.address`. Verify line breaks are preserved.
- Cancel the dialog mid-translation. Verify no orphan project row was created.
- Trigger a deliberate 500 from the API; verify the dialog shows the error and the user can retry.

## Out of scope (recap)

- Inline per-field translation buttons.
- In-place translation.
- Side-by-side preview.
- Hard quota / rate limit (logging only).
- Arabic / RTL languages.
- Image regeneration in target language (image generation is a separate feature).
