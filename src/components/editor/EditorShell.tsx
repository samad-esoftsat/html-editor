'use client';
import { StoreProvider } from '@/lib/editor/StoreProvider';
import { RoleProvider } from '@/lib/editor/RoleProvider';
import { useAutosave } from '@/lib/editor/autosave';
import { useUndoRedoShortcuts } from '@/lib/editor/useUndoRedoShortcuts';
import { useRole } from '@/lib/editor/RoleProvider';
import { Topbar } from './Topbar';
import { LeftPanel } from './LeftPanel';
import { Preview } from './Preview';
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
  return (
    <div className="flex flex-col h-dvh">
      <Topbar slug={workspaceSlug} currentWorkspace={currentWorkspace} workspaces={workspaces} />
      <div className="flex flex-1 overflow-hidden">
        <LeftPanel />
        <div className="flex-1 bg-[#080808]"><Preview /></div>
      </div>
    </div>
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
