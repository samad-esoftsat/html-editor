import { GoogleGenAI, type ContentListUnion, type GenerateContentConfig } from '@google/genai';
import { aspectRatioDimensions, getImageDimensions, inferMimeType } from './assets';
import { ProviderError } from './errors';
import type { ChatEditOpts, EditOpts, GenerateOpts, GeneratedImage, ImageProvider } from './provider';

const DEFAULT_MODEL = 'gemini-3.1-flash-image-preview';

export type GeminiCallParams = {
  contents: ContentListUnion;
  config: GenerateContentConfig;
};

export function buildGeminiGenerateBody(opts: GenerateOpts): GeminiCallParams {
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
    { text: opts.prompt },
  ];
  for (const ref of opts.references ?? []) {
    parts.push({
      inlineData: {
        mimeType: ref.mimeType,
        data: ref.bytes.toString('base64'),
      },
    });
  }
  const config: GenerateContentConfig = {
    responseModalities: ['IMAGE'],
    imageConfig: {
      aspectRatio: opts.aspectRatio,
      imageSize: '2K',
    },
  };
  if (opts.useGoogleSearch) {
    // Combined web + image search grounding per
    // https://ai.google.dev/gemini-api/docs/image-generation#image-search
    config.tools = [
      {
        googleSearch: {
          searchTypes: { webSearch: {}, imageSearch: {} },
        },
      } as unknown as NonNullable<GenerateContentConfig['tools']>[number],
    ];
  }
  return { contents: [{ role: 'user', parts }], config };
}

export function buildGeminiEditBody(opts: EditOpts): GeminiCallParams {
  return {
    contents: [
      {
        role: 'user',
        parts: [
          { text: opts.prompt },
          {
            inlineData: {
              mimeType: inferMimeType(opts.image),
              data: opts.image.toString('base64'),
            },
          },
          {
            inlineData: {
              mimeType: 'image/png',
              data: opts.mask.toString('base64'),
            },
          },
        ],
      },
    ],
    config: {
      responseModalities: ['IMAGE'],
      imageConfig: { imageSize: '2K' },
    },
  };
}

export function buildGeminiChatEditBody(opts: ChatEditOpts): GeminiCallParams {
  return {
    contents: opts.turns.map((turn) => {
      if (turn.role === 'user') {
        return { role: 'user', parts: [{ text: turn.text }] };
      }
      return {
        role: 'model',
        parts: [
          {
            inlineData: {
              mimeType: turn.image.mimeType,
              data: turn.image.bytes.toString('base64'),
            },
          },
        ],
      };
    }),
    config: {
      responseModalities: ['IMAGE'],
      imageConfig: { imageSize: '2K' },
    },
  };
}

type GeminiCandidatePart = {
  text?: string;
  inlineData?: { mimeType?: string; data?: string };
};

type GeminiResponseLike = {
  candidates?: Array<{
    content?: {
      parts?: GeminiCandidatePart[];
    };
  }>;
};

export function parseGeminiGeneratedImage(
  payload: GeminiResponseLike,
  fallback: { width: number | null; height: number | null },
): GeneratedImage {
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  const inline = parts.find((part) => part.inlineData?.data);
  if (!inline?.inlineData?.data) {
    throw new ProviderError('Provider returned no image.', 502, 'provider_empty');
  }
  const bytes = Buffer.from(inline.inlineData.data, 'base64');
  const mimeType = inline.inlineData.mimeType || inferMimeType(bytes);
  const dims = getImageDimensions(bytes, mimeType);
  return {
    bytes,
    mimeType,
    width: dims?.width ?? fallback.width,
    height: dims?.height ?? fallback.height,
  };
}

export class GeminiImageProvider implements ImageProvider {
  name = 'gemini-image' as const;
  private model: string;
  private client: GoogleGenAI | null;

  constructor(model = process.env.GEMINI_IMAGE_MODEL ?? DEFAULT_MODEL, apiKey = process.env.GEMINI_API_KEY ?? '') {
    this.model = model;
    this.client = apiKey ? new GoogleGenAI({ apiKey }) : null;
  }

  async generate(opts: GenerateOpts): Promise<GeneratedImage[]> {
    const client = this.requireClient();
    const fallback = aspectRatioDimensions(opts.aspectRatio);
    const params = buildGeminiGenerateBody(opts);
    const requests = Array.from({ length: opts.count }, async () => {
      const response = await this.invoke(client, params);
      return parseGeminiGeneratedImage(response, fallback);
    });
    return Promise.all(requests);
  }

  async edit(opts: EditOpts): Promise<GeneratedImage> {
    const client = this.requireClient();
    const response = await this.invoke(client, buildGeminiEditBody(opts));
    return parseGeminiGeneratedImage(response, { width: null, height: null });
  }

  async chatEdit(opts: ChatEditOpts): Promise<GeneratedImage> {
    const client = this.requireClient();
    const response = await this.invoke(client, buildGeminiChatEditBody(opts));
    return parseGeminiGeneratedImage(response, { width: null, height: null });
  }

  private requireClient(): GoogleGenAI {
    if (!this.client) {
      throw new ProviderError('GEMINI_API_KEY is not configured.', 502, 'provider_not_configured');
    }
    return this.client;
  }

  private async invoke(client: GoogleGenAI, params: GeminiCallParams): Promise<GeminiResponseLike> {
    try {
      const response = await client.models.generateContent({
        model: this.model,
        contents: params.contents,
        config: params.config,
      });
      return response as unknown as GeminiResponseLike;
    } catch (error) {
      const status = typeof (error as { status?: number }).status === 'number'
        ? (error as { status: number }).status
        : 502;
      const message = error instanceof Error ? error.message : 'Provider unavailable.';
      const code = (error as { name?: string }).name === 'ApiError' ? 'provider_api_error' : 'provider_error';
      throw new ProviderError(message, status >= 400 && status < 500 ? 400 : 502, code);
    }
  }
}
