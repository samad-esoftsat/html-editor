import { aspectRatioDimensions, getImageDimensions, inferMimeType } from './assets';
import { ProviderError } from './errors';
import type { EditOpts, GenerateOpts, GeneratedImage, ImageProvider } from './provider';

const DEFAULT_MODEL = 'gemini-3.1-flash-image-preview';
const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models';

interface GeminiInlineDataPart {
  inlineData?: {
    mimeType?: string;
    data?: string;
  };
  text?: string;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: GeminiInlineDataPart[];
    };
  }>;
  error?: {
    message?: string;
    code?: number;
    status?: string;
  };
}

export function buildGeminiGenerateBody(opts: GenerateOpts) {
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
  return {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ['Image'],
      imageConfig: {
        aspectRatio: opts.aspectRatio,
        imageSize: '2K',
      },
    },
  };
}

export function buildGeminiEditBody(opts: EditOpts) {
  return {
    contents: [
      {
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
    generationConfig: {
      responseModalities: ['Image'],
      imageConfig: {
        imageSize: '2K',
      },
    },
  };
}

export function parseGeminiGeneratedImage(
  payload: GeminiResponse,
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
  private apiKey: string;

  constructor(model = process.env.GEMINI_IMAGE_MODEL ?? DEFAULT_MODEL, apiKey = process.env.GEMINI_API_KEY ?? '') {
    this.model = model;
    this.apiKey = apiKey;
  }

  async generate(opts: GenerateOpts): Promise<GeneratedImage[]> {
    if (!this.apiKey) {
      throw new ProviderError('GEMINI_API_KEY is not configured.', 502, 'provider_not_configured');
    }

    const fallback = aspectRatioDimensions(opts.aspectRatio);
    const requests = Array.from({ length: opts.count }, async () => {
      const response = await this.callGemini(buildGeminiGenerateBody(opts));
      return parseGeminiGeneratedImage(response, fallback);
    });
    return Promise.all(requests);
  }

  async edit(opts: EditOpts): Promise<GeneratedImage> {
    if (!this.apiKey) {
      throw new ProviderError('GEMINI_API_KEY is not configured.', 502, 'provider_not_configured');
    }
    const response = await this.callGemini(buildGeminiEditBody(opts));
    return parseGeminiGeneratedImage(response, { width: null, height: null });
  }

  private async callGemini(body: unknown): Promise<GeminiResponse> {
    const response = await fetch(`${API_ROOT}/${this.model}:generateContent`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify(body),
    });
    const json = (await response.json().catch(() => ({}))) as GeminiResponse;
    if (!response.ok) {
      const status = response.status >= 400 && response.status < 500 ? 400 : 502;
      throw new ProviderError(json.error?.message ?? 'Provider unavailable.', status, json.error?.status ?? 'provider_error');
    }
    return json;
  }
}
