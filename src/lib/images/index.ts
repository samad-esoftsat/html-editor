import type { ImageProvider } from './provider';
import { GeminiImageProvider } from './gemini';
import { GptImage2Provider } from './gpt-image-2';
import { MockImageProvider } from './mock';

export function getImageProvider(): ImageProvider {
  const name = process.env.IMAGE_PROVIDER ?? 'gemini-image';
  switch (name) {
    case 'gemini-image':
      return new GeminiImageProvider();
    case 'gpt-image-2':
      return new GptImage2Provider();
    case 'mock':
      return new MockImageProvider();
    default:
      throw new Error(`Unknown IMAGE_PROVIDER: ${name}`);
  }
}
