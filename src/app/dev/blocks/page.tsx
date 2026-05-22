import { notFound } from 'next/navigation';
import { BlocksGallery } from './BlocksGallery';
import type { EditorMode } from '@/components/editor/EditorModeProvider';

interface Props {
  searchParams: Promise<{ mode?: string }>;
}

export default async function DevBlocksPage({ searchParams }: Props) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const mode: EditorMode = sp.mode === 'preview' ? 'preview' : 'edit';
  return <BlocksGallery mode={mode} />;
}
