import { describe, expect, it } from 'vitest';
import {
  buildGeminiChatEditBody,
  buildGeminiEditBody,
  buildGeminiGenerateBody,
  parseGeminiGeneratedImage,
} from '@/lib/images/gemini';

const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+yN7sAAAAASUVORK5CYII=';
const PNG_BYTES = Buffer.from(PNG_BASE64, 'base64');

function firstContent(contents: unknown): { role?: string; parts: unknown[] } {
  if (!Array.isArray(contents) || contents.length === 0) {
    throw new Error('expected contents array');
  }
  return contents[0] as { role?: string; parts: unknown[] };
}

describe('gemini image provider helpers', () => {
  it('builds a generate payload with image response config', () => {
    const params = buildGeminiGenerateBody({
      prompt: 'Create a banner for a travel email',
      aspectRatio: '16:9',
      count: 2,
    });
    expect(firstContent(params.contents)).toEqual({
      role: 'user',
      parts: [{ text: 'Create a banner for a travel email' }],
    });
    expect(params.config.responseModalities).toEqual(['IMAGE']);
    expect(params.config.imageConfig).toEqual({ aspectRatio: '16:9', imageSize: '2K' });
    expect(params.config.tools).toBeUndefined();
  });

  it('appends reference inlineData parts when references are provided', () => {
    const params = buildGeminiGenerateBody({
      prompt: 'Stylize like these references',
      aspectRatio: '1:1',
      count: 1,
      references: [
        { bytes: PNG_BYTES, mimeType: 'image/png' },
        { bytes: PNG_BYTES, mimeType: 'image/jpeg' },
      ],
    });
    const content = firstContent(params.contents);
    expect(content.parts).toHaveLength(3);
    expect(content.parts[0]).toEqual({ text: 'Stylize like these references' });
    expect(content.parts[1]).toMatchObject({ inlineData: { mimeType: 'image/png' } });
    expect(content.parts[2]).toMatchObject({ inlineData: { mimeType: 'image/jpeg' } });
  });

  it('omits tools when useGoogleSearch is not set', () => {
    const params = buildGeminiGenerateBody({
      prompt: 'hello',
      aspectRatio: '1:1',
      count: 1,
    });
    expect(params.config.tools).toBeUndefined();
  });

  it('adds googleSearch tool with both web and image search when useGoogleSearch is true', () => {
    const params = buildGeminiGenerateBody({
      prompt: 'latest news headline as an image',
      aspectRatio: '16:9',
      count: 1,
      useGoogleSearch: true,
    });
    expect(params.config.tools).toEqual([
      {
        googleSearch: {
          searchTypes: { webSearch: {}, imageSearch: {} },
        },
      },
    ]);
  });

  it('builds an edit payload with inline image and mask data', () => {
    const params = buildGeminiEditBody({
      prompt: 'Replace the product background with a soft beige gradient',
      image: PNG_BYTES,
      mask: PNG_BYTES,
    });
    const content = firstContent(params.contents);
    expect(content.parts).toHaveLength(3);
    expect(content.parts[1]).toMatchObject({ inlineData: { mimeType: 'image/png' } });
    expect(content.parts[2]).toMatchObject({ inlineData: { mimeType: 'image/png' } });
  });

  it('builds a chat-edit payload with seed image on first user turn and signature on model turn', () => {
    const params = buildGeminiChatEditBody({
      turns: [
        {
          role: 'user',
          text: 'Add sunglasses',
          images: [{ bytes: PNG_BYTES, mimeType: 'image/png' }],
        },
        {
          role: 'model',
          image: { bytes: PNG_BYTES, mimeType: 'image/png' },
          thoughtSignature: 'sig-A',
        },
        { role: 'user', text: 'Now make it night' },
      ],
    });
    const contents = params.contents as Array<{ role: string; parts: Array<Record<string, unknown>> }>;
    expect(contents).toHaveLength(3);
    expect(contents[0].role).toBe('user');
    expect(contents[0].parts[0]).toMatchObject({ inlineData: { mimeType: 'image/png' } });
    expect(contents[0].parts[1]).toEqual({ text: 'Add sunglasses' });
    expect(contents[1].role).toBe('model');
    expect(contents[1].parts[0]).toMatchObject({
      inlineData: { mimeType: 'image/png' },
      thoughtSignature: 'sig-A',
    });
    expect(contents[2]).toEqual({ role: 'user', parts: [{ text: 'Now make it night' }] });
  });

  it('parses thoughtSignature from response when present', () => {
    const parsed = parseGeminiGeneratedImage({
      candidates: [
        {
          content: {
            parts: [
              { inlineData: { mimeType: 'image/png', data: PNG_BASE64 }, thoughtSignature: 'sig-B' },
            ],
          },
        },
      ],
    }, { width: null, height: null });
    expect(parsed.thoughtSignature).toBe('sig-B');
  });

  it('parses returned inline image data into bytes and dimensions', () => {
    const parsed = parseGeminiGeneratedImage({
      candidates: [
        {
          content: {
            parts: [
              { text: 'Generated image' },
              { inlineData: { mimeType: 'image/png', data: PNG_BASE64 } },
            ],
          },
        },
      ],
    }, { width: 2752, height: 1536 });

    expect(parsed.mimeType).toBe('image/png');
    expect(parsed.bytes.length).toBeGreaterThan(0);
    expect(parsed.width).toBe(1);
    expect(parsed.height).toBe(1);
  });
});
