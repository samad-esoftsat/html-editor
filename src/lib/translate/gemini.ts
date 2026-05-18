import { GoogleGenAI } from '@google/genai';

const DEFAULT_MODEL = 'gemini-2.5-flash';

export interface BuildPromptArgs {
  strings: Record<string, string>;
  targetLanguageLabel: string;
  tone?: string;
}

export interface TranslateArgs extends BuildPromptArgs {
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
  try { return JSON.parse(trimmed); } catch { /* fall through to other strategies */ }
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) {
    return JSON.parse(fenced[1]);
  }
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

  if (!args.client) {
    const apiKey = process.env.GEMINI_API_KEY ?? '';
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
  }
  const client = args.client ?? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' });

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
  const result = asStringMap(parsed);
  if (Object.keys(result).length === 0) {
    throw new Error('translation response contained no usable string values');
  }
  return result;
}
