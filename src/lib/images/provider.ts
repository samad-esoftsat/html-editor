export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3';

export type GenerateOpts = {
  prompt: string;
  aspectRatio: AspectRatio;
  count: 1 | 2 | 4;
};

export type EditOpts = {
  image: Buffer;
  mask: Buffer;
  prompt: string;
};

export type GeneratedImage = {
  bytes: Buffer;
  mimeType: string;
  width: number | null;
  height: number | null;
};

export interface ImageProvider {
  name: 'gemini-image' | 'gpt-image-2' | 'mock';
  generate(opts: GenerateOpts): Promise<GeneratedImage[]>;
  edit(opts: EditOpts): Promise<GeneratedImage>;
}
