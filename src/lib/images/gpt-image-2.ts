import type { ChatEditOpts, EditOpts, GenerateOpts, GeneratedImage, ImageProvider } from './provider';

export class GptImage2Provider implements ImageProvider {
  name = 'gpt-image-2' as const;

  async generate(_opts: GenerateOpts): Promise<GeneratedImage[]> {
    throw new Error('Not implemented');
  }

  async edit(_opts: EditOpts): Promise<GeneratedImage> {
    throw new Error('Not implemented');
  }

  async chatEdit(_opts: ChatEditOpts): Promise<GeneratedImage> {
    throw new Error('Not implemented');
  }
}
