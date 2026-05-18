# Project Translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Translate action to the editor topbar that creates a translated sibling project via a Gemini-backed pipeline operating on the `ProjectData` model (not rendered HTML).

**Architecture:** A pure `extractTranslatable`/`applyTranslations` pair walks the data model to gather/merge strings. A Gemini wrapper sends the strings to the model with a system prompt that pins brand-preservation rules, requesting JSON-shaped output. A new POST route runs the full pipeline server-side: load source → extract → translate → apply → insert new row → return new id. The client opens a dialog, calls the API, then navigates to the new project on success.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, `@google/genai` (Gemini, already a dep), Supabase server client, Vitest.

**Spec:** `docs/superpowers/specs/2026-05-18-project-translation-design.md`

**Justified deviation from spec:** The spec's "Security and cost" section says to log usage in a `translations` DB table for future quota work. For v1, usage is logged via `console.info` on the server only. Rationale: no consumer exists yet (no quota, no admin UI), and the data needed for future quota work — `{org_id, user_id, source_project_id, target_language, character_count, created_at}` — is identical between log entries and table rows. When a quota lands, add a migration and replace the `console.info` line with an insert. YAGNI compliant.

---

## File Structure

**New:**

- `src/lib/translate/languages.ts` — curated language list with `{code, label, abbrev}`.
- `src/lib/translate/fields.ts` — `extractTranslatable` and `applyTranslations` pure helpers.
- `src/lib/translate/gemini.ts` — wrapper over `@google/genai` with injectable client for testability.
- `src/app/api/projects/[id]/translate/route.ts` — POST handler running the pipeline.
- `src/components/editor/TranslateMenu.tsx` — button + modal dialog (self-contained, like `DownloadMenu`).
- `tests/unit/translate.languages.test.ts`
- `tests/unit/translate.fields.test.ts`
- `tests/unit/translate.gemini.test.ts`

**Modified:**

- `src/lib/api/projects.ts` — `translateProject` client helper.
- `src/components/editor/Topbar.tsx` — mount `<TranslateMenu />` next to `<DownloadMenu />`.

---

## Task 1: Curated language list

**Files:**
- Create: `src/lib/translate/languages.ts`
- Test: `tests/unit/translate.languages.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/translate.languages.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { LANGUAGES, isLanguageCode, getLanguage, type LanguageCode } from '@/lib/translate/languages';

describe('languages', () => {
  it('exports a non-empty list', () => {
    expect(LANGUAGES.length).toBeGreaterThan(0);
  });

  it('has unique codes', () => {
    const codes = LANGUAGES.map((l) => l.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('has non-empty labels and abbrevs', () => {
    for (const l of LANGUAGES) {
      expect(l.label.length).toBeGreaterThan(0);
      expect(l.abbrev.length).toBeGreaterThan(0);
    }
  });

  it('includes the spec languages', () => {
    const codes: LanguageCode[] = ['en', 'fr', 'es', 'pt-BR', 'pt-PT', 'it', 'de', 'nl', 'yue', 'zh-CN', 'zh-TW', 'ja'];
    for (const c of codes) {
      expect(isLanguageCode(c)).toBe(true);
    }
  });

  it('isLanguageCode rejects unknown codes', () => {
    expect(isLanguageCode('xx')).toBe(false);
    expect(isLanguageCode('')).toBe(false);
    expect(isLanguageCode('FR')).toBe(false);
  });

  it('getLanguage returns the entry for a valid code', () => {
    const fr = getLanguage('fr');
    expect(fr.code).toBe('fr');
    expect(fr.label).toBe('French');
    expect(fr.abbrev).toBe('FR');
  });
});
```

- [ ] **Step 2: Run tests, expect failure**

Run: `npm test -- tests/unit/translate.languages.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/translate/languages.ts`:

```ts
const LANGUAGES_RAW = [
  { code: 'en', label: 'English', abbrev: 'EN' },
  { code: 'fr', label: 'French', abbrev: 'FR' },
  { code: 'es', label: 'Spanish', abbrev: 'ES' },
  { code: 'pt-BR', label: 'Portuguese (Brazilian)', abbrev: 'pt-BR' },
  { code: 'pt-PT', label: 'Portuguese (European)', abbrev: 'pt-PT' },
  { code: 'it', label: 'Italian', abbrev: 'IT' },
  { code: 'de', label: 'German', abbrev: 'DE' },
  { code: 'nl', label: 'Dutch', abbrev: 'NL' },
  { code: 'yue', label: 'Cantonese', abbrev: 'yue' },
  { code: 'zh-CN', label: 'Mandarin (Simplified)', abbrev: 'zh-CN' },
  { code: 'zh-TW', label: 'Mandarin (Traditional)', abbrev: 'zh-TW' },
  { code: 'ja', label: 'Japanese', abbrev: 'JA' },
] as const;

export type LanguageCode = typeof LANGUAGES_RAW[number]['code'];

export interface Language {
  code: LanguageCode;
  label: string;
  abbrev: string;
}

export const LANGUAGES: readonly Language[] = LANGUAGES_RAW;

const CODE_SET = new Set<string>(LANGUAGES.map((l) => l.code));

export function isLanguageCode(value: unknown): value is LanguageCode {
  return typeof value === 'string' && CODE_SET.has(value);
}

export function getLanguage(code: LanguageCode): Language {
  const found = LANGUAGES.find((l) => l.code === code);
  if (!found) throw new Error(`unknown language code: ${code}`);
  return found;
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npm test -- tests/unit/translate.languages.test.ts`
Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/translate/languages.ts tests/unit/translate.languages.test.ts
git commit -m "feat(translate): curated language list with type guard helpers"
```

---

## Task 2: Translatable schema (`fields.ts`)

**Files:**
- Create: `src/lib/translate/fields.ts`
- Test: `tests/unit/translate.fields.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/translate.fields.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { extractTranslatable, applyTranslations } from '@/lib/translate/fields';
import type { ProjectData } from '@/lib/editor/types';

function sample(): ProjectData {
  return {
    schemaVersion: 1,
    global: {
      backgroundColor: '#fff', fontFamily: 'Arial', baseFontSize: 14, headingFontSize: 24,
      textColor: '#000', buttonColor: '#0a0', buttonTextColor: '#fff', accentColor: '#999',
      footerBackgroundColor: '#222', footerTextColor: '#ddd', contactUrl: 'https://example.com/contact',
    },
    header: {
      logoSrc: 'https://example.com/logo.png', logoAlt: 'Logo', logoWidth: 200,
      title: 'Welcome to our event', titleFontSize: 28,
      bannerSrc: 'https://example.com/banner.png', bannerAlt: 'Conference banner',
      sectionHeading: 'Our offerings', sectionHeadingFontSize: 20,
    },
    sections: [
      {
        id: 's1', title: 'First section',
        bullets: ['Bullet one', 'Bullet two'],
        imageSrc: 'https://example.com/a.png', imageAlt: 'Product A',
        ctaText: 'Learn more', ctaUrl: 'https://example.com/a',
      },
      {
        id: 's2', title: 'Second section',
        bullets: ['Only bullet'],
        imageSrc: 'https://example.com/b.png', imageAlt: 'Product B',
        ctaText: 'Order now',
      },
    ],
    footer: {
      bannerSrc: 'https://example.com/fb.png', bannerAlt: 'Footer banner',
      companyName: 'Acme Corp', address: '123 Main St\nLondon\nUK',
      phone: '+44 20 1234 5678', phoneTel: '+442012345678',
      email: 'hello@acme.example',
      websites: [{ label: 'Visit us', url: 'https://acme.example' }],
      socials: [{ platform: 'linkedin', url: 'https://linkedin.com/company/acme' }],
    },
  };
}

describe('extractTranslatable', () => {
  it('returns translatable string fields keyed by dot-path', () => {
    const map = extractTranslatable(sample());
    expect(map['header.title']).toBe('Welcome to our event');
    expect(map['header.sectionHeading']).toBe('Our offerings');
    expect(map['header.logoAlt']).toBe('Logo');
    expect(map['header.bannerAlt']).toBe('Conference banner');
    expect(map['sections.0.title']).toBe('First section');
    expect(map['sections.0.bullets.0']).toBe('Bullet one');
    expect(map['sections.0.bullets.1']).toBe('Bullet two');
    expect(map['sections.0.imageAlt']).toBe('Product A');
    expect(map['sections.0.ctaText']).toBe('Learn more');
    expect(map['sections.1.title']).toBe('Second section');
    expect(map['sections.1.bullets.0']).toBe('Only bullet');
    expect(map['footer.bannerAlt']).toBe('Footer banner');
    expect(map['footer.companyName']).toBe('Acme Corp');
    expect(map['footer.address']).toBe('123 Main St\nLondon\nUK');
    expect(map['footer.websites.0.label']).toBe('Visit us');
  });

  it('does not include URLs, emails, phones, colors, ids, or social platforms', () => {
    const map = extractTranslatable(sample());
    const keys = Object.keys(map);
    expect(keys).not.toContain('header.logoSrc');
    expect(keys).not.toContain('header.bannerSrc');
    expect(keys).not.toContain('sections.0.imageSrc');
    expect(keys).not.toContain('sections.0.ctaUrl');
    expect(keys).not.toContain('sections.0.id');
    expect(keys).not.toContain('global.contactUrl');
    expect(keys).not.toContain('global.backgroundColor');
    expect(keys).not.toContain('footer.email');
    expect(keys).not.toContain('footer.phone');
    expect(keys).not.toContain('footer.phoneTel');
    expect(keys).not.toContain('footer.websites.0.url');
    expect(keys).not.toContain('footer.socials.0.url');
    expect(keys).not.toContain('footer.socials.0.platform');
  });

  it('omits empty strings (no point translating empty fields)', () => {
    const data = sample();
    data.header.logoAlt = '';
    const map = extractTranslatable(data);
    expect(map['header.logoAlt']).toBeUndefined();
  });
});

describe('applyTranslations', () => {
  it('substitutes values at the matching paths', () => {
    const data = sample();
    const result = applyTranslations(data, {
      'header.title': 'Bienvenue à notre événement',
      'sections.0.title': 'Première section',
      'sections.0.bullets.1': 'Point deux',
    });
    expect(result.header.title).toBe('Bienvenue à notre événement');
    expect(result.sections[0].title).toBe('Première section');
    expect(result.sections[0].bullets[1]).toBe('Point deux');
    // Untouched fields kept
    expect(result.sections[0].bullets[0]).toBe('Bullet one');
    expect(result.footer.companyName).toBe('Acme Corp');
    // URLs preserved
    expect(result.header.logoSrc).toBe('https://example.com/logo.png');
    expect(result.footer.email).toBe('hello@acme.example');
  });

  it('round-trips: apply(data, extract(data)) deep-equals data', () => {
    const data = sample();
    const result = applyTranslations(data, extractTranslatable(data));
    expect(result).toEqual(data);
  });

  it('does not mutate the input data', () => {
    const data = sample();
    const before = JSON.parse(JSON.stringify(data));
    applyTranslations(data, { 'header.title': 'Changed' });
    expect(data).toEqual(before);
  });

  it('ignores non-string values defensively (keeps original)', () => {
    const data = sample();
    const result = applyTranslations(data, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'header.title': 123 as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'sections.0.title': null as any,
    });
    expect(result.header.title).toBe('Welcome to our event');
    expect(result.sections[0].title).toBe('First section');
  });

  it('preserves newlines in multi-line strings', () => {
    const data = sample();
    const translated = '123 rue Principale\nLondres\nRoyaume-Uni';
    const result = applyTranslations(data, { 'footer.address': translated });
    expect(result.footer.address).toBe(translated);
    expect(result.footer.address.split('\n').length).toBe(3);
  });

  it('handles a translation map containing keys that no longer exist (ignored)', () => {
    const data = sample();
    const result = applyTranslations(data, {
      'sections.5.title': 'Out of range',
      'sections.0.bullets.99': 'Out of range',
    });
    expect(result.sections.length).toBe(2);
    expect(result.sections[0].bullets.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests, expect failure**

Run: `npm test -- tests/unit/translate.fields.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/translate/fields.ts`:

```ts
import type { ProjectData } from '@/lib/editor/types';

type StringMap = Record<string, string>;

function add(out: StringMap, key: string, value: unknown): void {
  if (typeof value === 'string' && value.length > 0) {
    out[key] = value;
  }
}

export function extractTranslatable(data: ProjectData): StringMap {
  const out: StringMap = {};

  add(out, 'header.title', data.header.title);
  add(out, 'header.sectionHeading', data.header.sectionHeading);
  add(out, 'header.logoAlt', data.header.logoAlt);
  add(out, 'header.bannerAlt', data.header.bannerAlt);

  data.sections.forEach((s, i) => {
    add(out, `sections.${i}.title`, s.title);
    add(out, `sections.${i}.imageAlt`, s.imageAlt);
    add(out, `sections.${i}.ctaText`, s.ctaText);
    s.bullets.forEach((b, j) => add(out, `sections.${i}.bullets.${j}`, b));
  });

  add(out, 'footer.bannerAlt', data.footer.bannerAlt);
  add(out, 'footer.companyName', data.footer.companyName);
  add(out, 'footer.address', data.footer.address);
  data.footer.websites.forEach((w, i) => add(out, `footer.websites.${i}.label`, w.label));

  return out;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function isUsableString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function applyTranslations(data: ProjectData, translations: StringMap): ProjectData {
  const out: ProjectData = deepClone(data);

  if (isUsableString(translations['header.title'])) out.header.title = translations['header.title'];
  if (isUsableString(translations['header.sectionHeading'])) out.header.sectionHeading = translations['header.sectionHeading'];
  if (isUsableString(translations['header.logoAlt'])) out.header.logoAlt = translations['header.logoAlt'];
  if (isUsableString(translations['header.bannerAlt'])) out.header.bannerAlt = translations['header.bannerAlt'];

  out.sections.forEach((s, i) => {
    const t = translations[`sections.${i}.title`];
    if (isUsableString(t)) s.title = t;
    const ia = translations[`sections.${i}.imageAlt`];
    if (isUsableString(ia)) s.imageAlt = ia;
    const ct = translations[`sections.${i}.ctaText`];
    if (isUsableString(ct)) s.ctaText = ct;
    s.bullets.forEach((_, j) => {
      const b = translations[`sections.${i}.bullets.${j}`];
      if (isUsableString(b)) s.bullets[j] = b;
    });
  });

  if (isUsableString(translations['footer.bannerAlt'])) out.footer.bannerAlt = translations['footer.bannerAlt'];
  if (isUsableString(translations['footer.companyName'])) out.footer.companyName = translations['footer.companyName'];
  if (isUsableString(translations['footer.address'])) out.footer.address = translations['footer.address'];
  out.footer.websites.forEach((w, i) => {
    const lab = translations[`footer.websites.${i}.label`];
    if (isUsableString(lab)) w.label = lab;
  });

  return out;
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npm test -- tests/unit/translate.fields.test.ts`
Expected: PASS (all describe blocks).

- [ ] **Step 5: Commit**

```bash
git add src/lib/translate/fields.ts tests/unit/translate.fields.test.ts
git commit -m "feat(translate): extractTranslatable + applyTranslations on ProjectData"
```

---

## Task 3: Gemini wrapper (`gemini.ts`)

**Files:**
- Create: `src/lib/translate/gemini.ts`
- Test: `tests/unit/translate.gemini.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/translate.gemini.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { translateStrings, buildTranslationPrompt } from '@/lib/translate/gemini';

describe('buildTranslationPrompt', () => {
  it('contains the target language and the strings as JSON', () => {
    const { system, user } = buildTranslationPrompt({
      strings: { 'a': 'Hello', 'b': 'World' },
      targetLanguageLabel: 'French',
    });
    expect(system).toContain('French');
    expect(system).toContain('URLs');
    expect(system).toContain('proper nouns');
    expect(user).toContain('"a": "Hello"');
    expect(user).toContain('"b": "World"');
  });

  it('appends tone override when provided', () => {
    const { system } = buildTranslationPrompt({
      strings: {},
      targetLanguageLabel: 'French',
      tone: 'keep it formal',
    });
    expect(system).toContain('keep it formal');
  });

  it('omits the tone block when tone is empty', () => {
    const { system } = buildTranslationPrompt({
      strings: {},
      targetLanguageLabel: 'French',
    });
    expect(system).not.toContain('Tone instructions');
  });
});

describe('translateStrings', () => {
  it('returns the model response parsed as a string map', async () => {
    const fakeClient = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          text: JSON.stringify({ 'header.title': 'Bonjour', 'sections.0.title': 'Première' }),
        }),
      },
    };
    const out = await translateStrings({
      strings: { 'header.title': 'Hello', 'sections.0.title': 'First' },
      targetLanguageLabel: 'French',
      client: fakeClient,
    });
    expect(out).toEqual({ 'header.title': 'Bonjour', 'sections.0.title': 'Première' });
    expect(fakeClient.models.generateContent).toHaveBeenCalledTimes(1);
  });

  it('extracts JSON from a fenced code block if the model wraps it', async () => {
    const fakeClient = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          text: '```json\n{"a": "1"}\n```',
        }),
      },
    };
    const out = await translateStrings({
      strings: { a: 'x' },
      targetLanguageLabel: 'French',
      client: fakeClient,
    });
    expect(out).toEqual({ a: '1' });
  });

  it('throws if the response is not parseable JSON', async () => {
    const fakeClient = {
      models: {
        generateContent: vi.fn().mockResolvedValue({ text: 'not json at all' }),
      },
    };
    await expect(
      translateStrings({ strings: { a: 'x' }, targetLanguageLabel: 'French', client: fakeClient }),
    ).rejects.toThrow();
  });

  it('throws if the response is not an object of strings', async () => {
    const fakeClient = {
      models: {
        generateContent: vi.fn().mockResolvedValue({ text: '[1, 2, 3]' }),
      },
    };
    await expect(
      translateStrings({ strings: { a: 'x' }, targetLanguageLabel: 'French', client: fakeClient }),
    ).rejects.toThrow();
  });

  it('skips the call when strings is empty (returns empty)', async () => {
    const fakeClient = {
      models: { generateContent: vi.fn() },
    };
    const out = await translateStrings({
      strings: {},
      targetLanguageLabel: 'French',
      client: fakeClient,
    });
    expect(out).toEqual({});
    expect(fakeClient.models.generateContent).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests, expect failure**

Run: `npm test -- tests/unit/translate.gemini.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/translate/gemini.ts`:

```ts
import { GoogleGenAI } from '@google/genai';

const DEFAULT_MODEL = 'gemini-2.5-flash';

export interface BuildPromptArgs {
  strings: Record<string, string>;
  targetLanguageLabel: string;
  tone?: string;
}

export interface TranslateArgs extends BuildPromptArgs {
  // Injectable for tests. In production, omit and a real GoogleGenAI client is constructed.
  // The shape is "minimum surface this wrapper uses" rather than the full SDK type.
  client?: {
    models: {
      generateContent: (req: {
        model: string;
        contents: unknown;
        config?: unknown;
      }) => Promise<{ text?: string | null }>;
    };
  };
  model?: string;
}

export function buildTranslationPrompt(args: BuildPromptArgs): { system: string; user: string } {
  const lines: string[] = [];
  lines.push(`You translate marketing email content from one language to another.`);
  lines.push(``);
  lines.push(`Target language: ${args.targetLanguageLabel}.`);
  lines.push(``);
  lines.push(`Rules:`);
  lines.push(`- Translate marketing copy naturally and concisely. Match the tone of the source unless overridden.`);
  lines.push(`- Preserve URLs, email addresses, and phone numbers EXACTLY. Never translate them.`);
  lines.push(`- Preserve proper nouns: company names, product names, person names, brand-specific terms.`);
  lines.push(`- For addresses: translate city and country names where commonly localized; keep street names, street numbers, postal codes, and unit numbers exactly as written.`);
  lines.push(`- Preserve newline characters inside multi-line strings.`);
  lines.push(`- Do not add quotation marks, prefixes, or commentary. Return only the translated string for each key.`);
  lines.push(`- Match capitalization conventions of the target language.`);
  if (args.tone && args.tone.trim().length > 0) {
    lines.push(``);
    lines.push(`Tone instructions (override the default): ${args.tone.trim()}`);
  }
  lines.push(``);
  lines.push(`You will receive a JSON object. Return a JSON object with the same keys, where each value is the translated string for that key. Output JSON only, with no surrounding text.`);

  const system = lines.join('\n');
  const user = JSON.stringify(args.strings, null, 2);
  return { system, user };
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  // Try direct parse first.
  try { return JSON.parse(trimmed); } catch {}
  // Strip ```json ... ``` or ``` ... ``` fences if present.
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) {
    return JSON.parse(fenced[1]);
  }
  // Find the first { ... } block as a last resort.
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }
  throw new Error('translation response was not parseable JSON');
}

function asStringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('translation response was not a JSON object');
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

export async function translateStrings(args: TranslateArgs): Promise<Record<string, string>> {
  if (Object.keys(args.strings).length === 0) return {};

  const { system, user } = buildTranslationPrompt(args);
  const model = args.model ?? DEFAULT_MODEL;

  const client = args.client ?? new GoogleGenAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY ?? '' });

  const res = await client.models.generateContent({
    model,
    contents: [
      { role: 'user', parts: [{ text: user }] },
    ],
    config: {
      systemInstruction: system,
      responseMimeType: 'application/json',
    },
  });

  const text = res.text ?? '';
  const parsed = extractJsonObject(text);
  return asStringMap(parsed);
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npm test -- tests/unit/translate.gemini.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/translate/gemini.ts tests/unit/translate.gemini.test.ts
git commit -m "feat(translate): Gemini wrapper with JSON output and injectable client"
```

---

## Task 4: API route

**Files:**
- Create: `src/app/api/projects/[id]/translate/route.ts`

- [ ] **Step 1: Implement the route**

Create `src/app/api/projects/[id]/translate/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { extractTranslatable, applyTranslations } from '@/lib/translate/fields';
import { translateStrings } from '@/lib/translate/gemini';
import { isLanguageCode, getLanguage } from '@/lib/translate/languages';
import type { ProjectData } from '@/lib/editor/types';

interface Ctx {
  params: Promise<{ id: string }>;
}

interface Body {
  name?: unknown;
  language?: unknown;
  tone?: unknown;
}

async function readBody(req: NextRequest): Promise<Body> {
  try {
    const body = await req.json();
    if (body && typeof body === 'object' && !Array.isArray(body)) return body as Body;
  } catch {
    // empty / invalid JSON
  }
  return {};
}

function resolveTranslatedName(requested: unknown, sourceName: string, abbrev: string): string {
  if (typeof requested === 'string') {
    const trimmed = requested.trim();
    if (trimmed.length > 0) return trimmed.slice(0, 200);
  }
  return `${sourceName} (${abbrev})`.slice(0, 200);
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await readBody(req);
  if (!isLanguageCode(body.language)) {
    return NextResponse.json({ error: 'invalid_language' }, { status: 400 });
  }
  const language = getLanguage(body.language);
  const tone = typeof body.tone === 'string' ? body.tone : undefined;

  const { data: src, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!src) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const sourceData = src.data as ProjectData;
  const strings = extractTranslatable(sourceData);

  let translations: Record<string, string>;
  try {
    translations = await translateStrings({
      strings,
      targetLanguageLabel: language.label,
      tone,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'translation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const translatedData = applyTranslations(sourceData, translations);

  const name = resolveTranslatedName(body.name, src.name as string, language.abbrev);

  // Log usage for future quota work (see plan deviation note). No DB table in v1.
  const characterCount = Object.values(strings).reduce((n, s) => n + s.length, 0);
  console.info('[translate]', JSON.stringify({
    org_id: src.org_id,
    user_id: user.id,
    source_project_id: id,
    target_language: language.code,
    character_count: characterCount,
  }));

  const { data: inserted, error: insErr } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      org_id: src.org_id,
      name,
      data: translatedData,
      template_source: src.template_source,
      raw_html_path: src.raw_html_path,
      brand_kit_id: src.brand_kit_id,
    })
    .select('id, name')
    .single();

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  return NextResponse.json(inserted, { status: 201 });
}
```

- [ ] **Step 2: Typecheck + full test suite**

Run: `npm run typecheck && npm test`
Expected: clean typecheck, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/projects/[id]/translate/route.ts
git commit -m "feat(api): translate route runs extract -> Gemini -> apply -> insert pipeline"
```

---

## Task 5: Client SDK helper

**Files:**
- Modify: `src/lib/api/projects.ts`

- [ ] **Step 1: Add `translateProject`**

In `src/lib/api/projects.ts`, append a new exported function:

```ts
export async function translateProject(
  id: string,
  opts: { name?: string; language: string; tone?: string },
): Promise<{ id: string; name: string }> {
  const res = await fetch(`/api/projects/${id}/translate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(opts),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `translate failed: ${res.status}`);
  }
  return res.json();
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/api/projects.ts
git commit -m "feat(api-client): translateProject helper"
```

---

## Task 6: TranslateMenu component

**Files:**
- Create: `src/components/editor/TranslateMenu.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/editor/TranslateMenu.tsx`:

```tsx
'use client';
import { useEffect, useMemo, useState } from 'react';
import { Languages, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { fade, scaleFade } from '@/lib/motion';
import { LANGUAGES, getLanguage, isLanguageCode, type LanguageCode } from '@/lib/translate/languages';
import { translateProject } from '@/lib/api/projects';
import { toast } from '@/lib/utils/toast';

interface Props {
  projectId: string;
  projectName: string;
  slug: string;
}

export function TranslateMenu({ projectId, projectName, slug }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState<LanguageCode>('fr');
  const [name, setName] = useState('');
  const [tone, setTone] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abbrev = useMemo(() => getLanguage(language).abbrev, [language]);

  useEffect(() => {
    if (open) {
      setName(`${projectName} (${abbrev})`);
      setError(null);
    }
  }, [open, projectName, abbrev]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !pending) setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, pending]);

  async function submit() {
    if (!isLanguageCode(language)) return;
    setPending(true);
    setError(null);
    try {
      const { id } = await translateProject(projectId, {
        name: name.trim() || undefined,
        language,
        tone: tone.trim() || undefined,
      });
      toast.success('Translated project created');
      setOpen(false);
      router.push(`/w/${slug}/p/${id}`);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Translation failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border-strong px-3 py-2 text-sm font-medium text-fg hover:bg-panel hover:border-brand/40 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        title="Translate to another language"
      >
        <Languages size={14} /> Translate
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-6"
            variants={fade}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            <motion.div
              className="bg-panel border border-border-strong rounded-xl p-6 w-[460px] max-w-full"
              variants={scaleFade}
              initial="hidden"
              animate="show"
              exit="exit"
            >
              <div className="font-semibold text-fg mb-1">Translate project</div>
              <div className="text-xs text-muted-2 mb-4">A new translated project will be created. The original is not modified.</div>

              <label className="mb-4 block text-xs font-medium text-muted-2">
                <span className="mb-1 block">Target language</span>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as LanguageCode)}
                  disabled={pending}
                  className="w-full rounded border border-border-strong bg-panel-2 px-2 py-1.5 text-sm text-fg focus:outline-none focus:border-brand"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
              </label>

              <label className="mb-4 block text-xs font-medium text-muted-2">
                <span className="mb-1 block">Name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={pending}
                  className="w-full rounded border border-border-strong bg-panel-2 px-2 py-1.5 text-sm text-fg focus:outline-none focus:border-brand"
                />
              </label>

              <label className="mb-4 block text-xs font-medium text-muted-2">
                <span className="mb-1 block">Tone or extra instructions (optional)</span>
                <textarea
                  rows={2}
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  disabled={pending}
                  placeholder="e.g. keep tone friendly and casual"
                  className="w-full rounded border border-border-strong bg-panel-2 px-2 py-1.5 text-sm text-fg focus:outline-none focus:border-brand resize-none"
                />
              </label>

              {error && (
                <div className="mb-4 rounded border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
                  {error}
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
                <Button variant="primary" onClick={submit} disabled={pending}>
                  {pending ? <Loader2 size={14} className="animate-spin" /> : null}
                  {pending ? 'Translating…' : 'Translate'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/TranslateMenu.tsx
git commit -m "feat(editor): TranslateMenu dialog (language, name, tone, error display)"
```

---

## Task 7: Mount TranslateMenu in Topbar

**Files:**
- Modify: `src/components/editor/Topbar.tsx`

- [ ] **Step 1: Add import and render**

In `src/components/editor/Topbar.tsx`:

1. After the existing `import { DownloadMenu } from './DownloadMenu';` line, add:

```tsx
import { TranslateMenu } from './TranslateMenu';
```

2. The current right-cluster JSX has `<DownloadMenu projectId={projectId} slug={slug} />` as the last child of its container `div`. Add `<TranslateMenu />` immediately before `<DownloadMenu />` so the order in the topbar reads left-to-right: existing buttons → Translate → Download.

The block becomes:

```tsx
        <TranslateMenu projectId={projectId} projectName={name} slug={slug} />
        <DownloadMenu projectId={projectId} slug={slug} />
```

`name` is already a local in this component (loaded via `useEditor((s) => s.name)`).

- [ ] **Step 2: Typecheck + run the full test suite**

Run: `npm run typecheck && npm test`
Expected: clean typecheck, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/Topbar.tsx
git commit -m "feat(editor): mount TranslateMenu in topbar next to DownloadMenu"
```

---

## Task 8: Manual verification

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`. Open an English project in the editor.

Ensure `GOOGLE_GENAI_API_KEY` is set in the environment (the same key used for image generation). If missing, `translateStrings` will fail at runtime.

- [ ] **Step 2: French translation, default name and tone**

- Click **Translate**. Default language is French; name pre-fills as `<original> (FR)`.
- Click **Translate**. Spinner appears for ~1–3 seconds.
- Expected: the editor navigates to the new project. Success toast `"Translated project created"`. The header title, section titles, bullets, CTA labels, and footer copy are in French. URLs, emails, and phone numbers are unchanged.

- [ ] **Step 3: German translation, custom name and tone**

- Open the original English project again.
- Click **Translate**. Pick German. Set name to `Spring Campaign — DE`. Set tone to `formal, business-appropriate`.
- Click **Translate**. Verify the new project uses the chosen name and the German text reads formally.

- [ ] **Step 4: Cantonese translation**

- Translate to Cantonese. Verify the text renders in traditional Chinese characters with Cantonese phrasing. URLs and contact info still exact.

- [ ] **Step 5: Multi-line address preservation**

- Edit the source project's footer address to have three lines (street / city / country).
- Translate to French. Verify the new project's footer address still has three lines, with city/country translated (e.g. "London" → "Londres") and street info preserved.

- [ ] **Step 6: HTML-safe characters**

- Edit a bullet in the source to `<b>important</b>`.
- Translate. Open the print view of the new project. Verify the angle brackets render as text (not HTML), and the document renders normally.

- [ ] **Step 7: Cancel mid-flight**

- Open the dialog, click Translate, immediately click Cancel.
- Expected: Cancel is disabled while pending (per the implementation). Wait for completion or use a deliberate API error to test the error display.

- [ ] **Step 8: Error display**

- Temporarily unset `GOOGLE_GENAI_API_KEY` in the dev environment (or stop the dev server, change `.env.local`, and restart).
- Trigger a translation. Expected: the dialog stays open, the error block shows the provider error, the Translate button is re-enabled.
