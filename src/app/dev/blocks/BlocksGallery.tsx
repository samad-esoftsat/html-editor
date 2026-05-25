'use client';

import { Editor } from '@craftjs/core';
import { useMemo } from 'react';
import { StoreProvider } from '@/lib/editor/StoreProvider';
import { EditorModeProvider, type EditorMode, useEditorMode } from '@/components/editor/EditorModeProvider';
import { AssetPickerProvider } from '@/components/editor/AssetPickerProvider';
import { PreviewBody } from '@/components/editor/PreviewBody';
import { TooltipProvider } from '@/components/ui/tooltip';
import { createDefaultProject } from '@/lib/editor/defaultProject';
import { RenderContextProvider } from '@/components/editor/craft/RenderContext';
import { RESOLVERS } from '@/components/editor/craft/resolver';
import { TreeSyncBridge } from '@/components/editor/sidebar/TreeSyncBridge';
import { useEditor as useStoreEditor, useEditorStore } from '@/lib/editor/StoreProvider';

interface Props {
  mode: EditorMode;
}

export function BlocksGallery({ mode }: Props) {
  const data = useMemo(() => createDefaultProject(), []);

  return (
    <StoreProvider
      projectId="dev-blocks-gallery"
      name="Blocks Gallery"
      data={data}
      brandKitId={null}
      workspaceSlug="dev"
      serverUpdatedAt={new Date(0).toISOString()}
    >
      <EditorModeProvider initialMode={mode}>
        <AssetPickerProvider workspaceSlug="dev">
          <TooltipProvider>
            <GalleryFrame />
          </TooltipProvider>
        </AssetPickerProvider>
      </EditorModeProvider>
    </StoreProvider>
  );
}

function GalleryFrame() {
  const store = useEditorStore();
  const data = useStoreEditor((state) => state.data);
  const { mode } = useEditorMode();

  return (
    <Editor enabled={mode === 'edit'} resolver={RESOLVERS} onNodesChange={(query) => store.getState().setTree(query.getSerializedNodes())}>
      <RenderContextProvider value={{ global: data.global, target: mode === 'preview' ? 'print' : 'editor' }}>
        <TreeSyncBridge />
        <div id="blocks-gallery" data-test-mode={mode} style={{ background: '#f6f6f6', minHeight: '100vh', padding: 24 }}>
          <PreviewBody />
        </div>
      </RenderContextProvider>
    </Editor>
  );
}
