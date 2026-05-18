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

  it('throws if all values in the response are non-strings (empty result)', async () => {
    const fakeClient = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          text: JSON.stringify({ 'a': 123, 'b': null }),
        }),
      },
    };
    await expect(
      translateStrings({ strings: { a: 'x', b: 'y' }, targetLanguageLabel: 'French', client: fakeClient }),
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
