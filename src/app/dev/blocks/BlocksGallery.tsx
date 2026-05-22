'use client';

import { useMemo } from 'react';
import { StoreProvider } from '@/lib/editor/StoreProvider';
import { EditorModeProvider, type EditorMode } from '@/components/editor/EditorModeProvider';
import { SectionSelectionProvider } from '@/components/editor/SectionSelectionProvider';
import { AssetPickerProvider } from '@/components/editor/AssetPickerProvider';
import { PreviewBody } from '@/components/editor/PreviewBody';
import { TooltipProvider } from '@/components/ui/tooltip';
import { createDefaultProject } from '@/lib/editor/defaultProject';

interface Props {
  mode: EditorMode;
}

export function BlocksGallery({ mode }: Props) {
  const data = useMemo(() => createDefaultProject(), []);
  const sectionIds = useMemo(() => data.blocks.map((b) => b.id), [data]);

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
        <SectionSelectionProvider sectionIds={sectionIds}>
          <AssetPickerProvider workspaceSlug="dev">
            <TooltipProvider>
              <div
                id="blocks-gallery"
                data-test-mode={mode}
                style={{ background: '#f6f6f6', minHeight: '100vh' }}
              >
                <PreviewBody />
              </div>
            </TooltipProvider>
          </AssetPickerProvider>
        </SectionSelectionProvider>
      </EditorModeProvider>
    </StoreProvider>
  );
}
