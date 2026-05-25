'use client';
import { Editor } from '@craftjs/core';
import { useState } from 'react';
import { StoreProvider } from '@/lib/editor/StoreProvider';
import { RoleProvider } from '@/lib/editor/RoleProvider';
import { useAutosave } from '@/lib/editor/autosave';
import { useUndoRedoShortcuts } from '@/lib/editor/useUndoRedoShortcuts';
import { useRole } from '@/lib/editor/RoleProvider';
import { AssetPickerProvider } from './AssetPickerProvider';
import { EditorModeProvider } from './EditorModeProvider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Topbar } from './Topbar';
import { LeftPanel } from './LeftPanel';
import { RightPanel } from './RightPanel';
import { Preview } from './Preview';
import { RenderContextProvider } from './craft/RenderContext';
import { RESOLVERS } from './craft/resolver';
import { TreeSyncBridge } from './sidebar/TreeSyncBridge';
import type { ProjectData } from '@/lib/editor/types';
import type { Role } from '@/lib/auth/workspace';
import type { WorkspaceOption } from '@/components/workspace/WorkspaceSwitcher';
import { useEditor as useStoreEditor, useEditorStore } from '@/lib/editor/StoreProvider';
import { useEditorMode } from './EditorModeProvider';

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
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [busy, setBusy] = useState<'duplicating' | 'deleting' | null>(null);
  return (
    <TooltipProvider>
      <EditorModeProvider>
        <AssetPickerProvider workspaceSlug={workspaceSlug}>
          <div className="editor-shell relative flex h-dvh flex-col">
            <Topbar
                slug={workspaceSlug}
                currentWorkspace={currentWorkspace}
                workspaces={workspaces}
                leftPanelOpen={leftPanelOpen}
                setLeftPanelOpen={setLeftPanelOpen}
                rightPanelOpen={rightPanelOpen}
                setRightPanelOpen={setRightPanelOpen}
                busy={busy}
                setBusy={setBusy}
            />
            <CraftWorkspace
              canEdit={canEdit && busy === null}
              leftPanelOpen={leftPanelOpen}
              rightPanelOpen={rightPanelOpen}
            />
            {busy !== null && <BusyOverlay label={busy === 'duplicating' ? 'Duplicating project…' : 'Deleting project…'} />}
          </div>
        </AssetPickerProvider>
      </EditorModeProvider>
    </TooltipProvider>
  );
}

function BusyOverlay({ label }: { label: string }) {
  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[1px]"
      aria-live="polite"
      role="status"
    >
      <div className="rounded-md border border-ed-rule-strong bg-ed-panel-2 px-4 py-3 text-sm text-ed-ink shadow-[0_18px_40px_-12px_rgba(0,0,0,0.6)]">
        {label}
      </div>
    </div>
  );
}

function CraftWorkspace({
  canEdit,
  leftPanelOpen,
  rightPanelOpen,
}: {
  canEdit: boolean;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
}) {
  const store = useEditorStore();
  const data = useStoreEditor((state) => state.data);
  const { mode } = useEditorMode();

  return (
    <Editor
      enabled={canEdit && mode === 'edit'}
      resolver={RESOLVERS}
      onNodesChange={(query) => {
        // Defer the store write out of Craft's render commit. Craft fires
        // onNodesChange synchronously during its own state transitions; writing
        // to Zustand here would trigger subscribers (Outline, etc.) to update
        // mid-render and crash React 19 with "Cannot update a component while
        // rendering a different component".
        const snapshot = query.getSerializedNodes();
        queueMicrotask(() => {
          store.getState().setTree(snapshot);
        });
      }}
    >
      <RenderContextProvider value={{ global: data.global, target: mode === 'preview' ? 'print' : 'editor' }}>
        <TreeSyncBridge />
        <div className="flex flex-1 overflow-hidden">
          {leftPanelOpen && <LeftPanel />}
          <div className="flex-1 overflow-auto bg-ed-canvas-pad p-8">
            <Preview />
          </div>
          {canEdit && rightPanelOpen && <RightPanel />}
        </div>
      </RenderContextProvider>
    </Editor>
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
