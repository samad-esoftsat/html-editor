export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3';

export type ReferenceImage = {
  bytes: Buffer;
  mimeType: string;
};

export type GenerateOpts = {
  prompt: string;
  aspectRatio: AspectRatio;
  count: 1 | 2 | 4;
  references?: ReferenceImage[];
  useGoogleSearch?: boolean;
};

export type EditOpts = {
  image: Buffer;
  mask: Buffer;
  prompt: string;
};

export type ChatTurn =
  | { role: 'user'; text: string; images?: ReferenceImage[] }
  | { role: 'model'; image: ReferenceImage; thoughtSignature?: string };

export type ChatEditOpts = {
  turns: ChatTurn[];
};

export type GeneratedImage = {
  bytes: Buffer;
  mimeType: string;
  width: number | null;
  height: number | null;
  thoughtSignature?: string;
};

export interface ImageProvider {
  name: 'gemini-image' | 'gpt-image-2' | 'mock';
  generate(opts: GenerateOpts): Promise<GeneratedImage[]>;
  edit(opts: EditOpts): Promise<GeneratedImage>;
  chatEdit(opts: ChatEditOpts): Promise<GeneratedImage>;
}
