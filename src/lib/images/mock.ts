import { aspectRatioDimensions } from './assets';
import type { ChatEditOpts, EditOpts, GenerateOpts, GeneratedImage, ImageProvider } from './provider';

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+yN7sAAAAASUVORK5CYII=',
  'base64',
);

export class MockImageProvider implements ImageProvider {
  name = 'mock' as const;

  async generate(opts: GenerateOpts): Promise<GeneratedImage[]> {
    const dims = aspectRatioDimensions(opts.aspectRatio);
    return Array.from({ length: opts.count }, () => ({
      bytes: ONE_PIXEL_PNG,
      mimeType: 'image/png',
      width: dims.width,
      height: dims.height,
    }));
  }

  async edit(_opts: EditOpts): Promise<GeneratedImage> {
    return {
      bytes: ONE_PIXEL_PNG,
      mimeType: 'image/png',
      width: 1024,
      height: 1024,
    };
  }

  async chatEdit(_opts: ChatEditOpts): Promise<GeneratedImage> {
    return {
      bytes: ONE_PIXEL_PNG,
      mimeType: 'image/png',
      width: 1024,
      height: 1024,
    };
  }
}
