'use client';
import { GlobalStylesPanel } from '@/components/editor/panels/GlobalStylesPanel';
import { NodeInspector } from './sidebar/NodeInspector';
import { SelectedToolbar } from './sidebar/SelectedToolbar';

export function LeftPanel() {
  return (
    <aside className="w-[320px] shrink-0 overflow-y-auto border-r border-ed-rule bg-ed-panel p-3">
      <div className="space-y-3">
        <SelectedToolbar />
        <NodeInspector />
        <GlobalStylesPanel />
      </div>
    </aside>
  );
}
