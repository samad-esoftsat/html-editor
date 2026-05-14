import { describe, expect, it } from 'vitest';
import { buildGeminiEditBody, buildGeminiGenerateBody, parseGeminiGeneratedImage } from '@/lib/images/gemini';

const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+yN7sAAAAASUVORK5CYII=';
const PNG_BYTES = Buffer.from(PNG_BASE64, 'base64');

describe('gemini image provider helpers', () => {
  it('builds a generate payload with image response config', () => {
    expect(buildGeminiGenerateBody({
      prompt: 'Create a banner for a travel email',
      aspectRatio: '16:9',
      count: 2,
    })).toEqual({
      contents: [{ parts: [{ text: 'Create a banner for a travel email' }] }],
      generationConfig: {
        responseModalities: ['Image'],
        imageConfig: {
          aspectRatio: '16:9',
          imageSize: '2K',
        },
      },
    });
  });

  it('appends reference inlineData parts when references are provided', () => {
    const body = buildGeminiGenerateBody({
      prompt: 'Stylize like these references',
      aspectRatio: '1:1',
      count: 1,
      references: [
        { bytes: PNG_BYTES, mimeType: 'image/png' },
        { bytes: PNG_BYTES, mimeType: 'image/jpeg' },
      ],
    });
    expect(body.contents[0]?.parts).toHaveLength(3);
    expect(body.contents[0]?.parts[0]).toEqual({ text: 'Stylize like these references' });
    expect(body.contents[0]?.parts[1]).toMatchObject({ inlineData: { mimeType: 'image/png' } });
    expect(body.contents[0]?.parts[2]).toMatchObject({ inlineData: { mimeType: 'image/jpeg' } });
  });

  it('omits the tools field when useGoogleSearch is not set', () => {
    const body = buildGeminiGenerateBody({
      prompt: 'hello',
      aspectRatio: '1:1',
      count: 1,
    });
    expect('tools' in body).toBe(false);
  });

  it('adds google_search tool with both web and image search when useGoogleSearch is true', () => {
    const body = buildGeminiGenerateBody({
      prompt: 'latest news headline as an image',
      aspectRatio: '16:9',
      count: 1,
      useGoogleSearch: true,
    });
    expect(body.tools).toEqual([
      {
        google_search: {
          searchTypes: {
            webSearch: {},
            imageSearch: {},
          },
        },
      },
    ]);
  });

  it('builds an edit payload with inline image and mask data', () => {
    const body = buildGeminiEditBody({
      prompt: 'Replace the product background with a soft beige gradient',
      image: PNG_BYTES,
      mask: PNG_BYTES,
    });
    expect(body.contents[0]?.parts).toHaveLength(3);
    expect(body.contents[0]?.parts[1]).toMatchObject({
      inlineData: {
        mimeType: 'image/png',
      },
    });
    expect(body.contents[0]?.parts[2]).toMatchObject({
      inlineData: {
        mimeType: 'image/png',
      },
    });
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
