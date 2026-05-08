'use client';
import { StoreProvider } from '@/lib/editor/StoreProvider';
import { useAutosave } from '@/lib/editor/autosave';
import { useUndoRedoShortcuts } from '@/lib/editor/useUndoRedoShortcuts';
import { Topbar } from './Topbar';
import { LeftPanel } from './LeftPanel';
import { Preview } from './Preview';
import type { ProjectData } from '@/lib/editor/types';

interface Props {
  projectId: string;
  name: string;
  data: ProjectData;
  serverUpdatedAt: string;
}

function Inner() {
  useAutosave();
  useUndoRedoShortcuts();
  return (
    <div className="flex flex-col h-dvh">
      <Topbar />
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
      <Inner />
    </StoreProvider>
  );
}
