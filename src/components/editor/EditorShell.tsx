'use client';
import { useMemo, useState } from 'react';
import { StoreProvider } from '@/lib/editor/StoreProvider';
import { useEditor } from '@/lib/editor/StoreProvider';
import { RoleProvider } from '@/lib/editor/RoleProvider';
import { useAutosave } from '@/lib/editor/autosave';
import { useUndoRedoShortcuts } from '@/lib/editor/useUndoRedoShortcuts';
import { useRole } from '@/lib/editor/RoleProvider';
import { AssetPickerProvider } from './AssetPickerProvider';
import { EditorModeProvider } from './EditorModeProvider';
import { SectionSelectionProvider } from './SectionSelectionProvider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Topbar } from './Topbar';
import { LeftPanel } from './LeftPanel';
import { Preview } from './Preview';
import { productSections } from '@/lib/editor/blocks';
import type { ProjectData } from '@/lib/editor/types';
import type { Role } from '@/lib/auth/workspace';
import type { WorkspaceOption } from '@/components/workspace/WorkspaceSwitcher';

interface Props {
  projectId: string;
  name: string;
  data: ProjectData;
  brandKitId: string | null;
  serverUpdatedAt: string;
  workspaceSlug: string;
  currentWorkspace: WorkspaceOption;
  workspaces: WorkspaceOption[];
  role: Role;
}

function SelectionScope({ children }: { children: React.ReactNode }) {
  const blocks = useEditor((s) => s.data.blocks);
  const sectionIds = useMemo(() => productSections(blocks).map((s) => s.id), [blocks]);
  return <SectionSelectionProvider sectionIds={sectionIds}>{children}</SectionSelectionProvider>;
}

function Inner({
  workspaceSlug,
  currentWorkspace,
  workspaces,
}: {
  workspaceSlug: string;
  currentWorkspace: WorkspaceOption;
  workspaces: WorkspaceOption[];
}) {
  const role = useRole();
  const canEdit = role !== 'viewer';
  useAutosave(canEdit);
  useUndoRedoShortcuts(canEdit);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  return (
    <TooltipProvider>
      <EditorModeProvider>
        <SelectionScope>
          <AssetPickerProvider workspaceSlug={workspaceSlug}>
            <div className="editor-shell flex h-dvh flex-col">
              <Topbar
                slug={workspaceSlug}
                currentWorkspace={currentWorkspace}
                workspaces={workspaces}
                leftPanelOpen={leftPanelOpen}
                setLeftPanelOpen={setLeftPanelOpen}
              />
              <div className="flex flex-1 overflow-hidden">
                {leftPanelOpen && <LeftPanel />}
                <div className="flex-1 overflow-auto bg-ed-canvas-pad p-8"><Preview /></div>
              </div>
            </div>
          </AssetPickerProvider>
        </SelectionScope>
      </EditorModeProvider>
    </TooltipProvider>
  );
}

export function EditorShell(props: Props) {
  return (
    <StoreProvider {...props}>
      <RoleProvider role={props.role}>
        <Inner
          workspaceSlug={props.workspaceSlug}
          currentWorkspace={props.currentWorkspace}
          workspaces={props.workspaces}
        />
      </RoleProvider>
    </StoreProvider>
  );
}
