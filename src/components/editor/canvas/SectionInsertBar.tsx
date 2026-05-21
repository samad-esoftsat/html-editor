'use client';
import { Plus } from 'lucide-react';
import { useEditorStore } from '@/lib/editor/StoreProvider';
import { useEditorMode } from '../EditorModeProvider';

export interface SectionInsertBarProps {
  atIndex: number;
}

export function SectionInsertBar({ atIndex }: SectionInsertBarProps) {
  const { mode } = useEditorMode();
  const store = useEditorStore();
  if (mode === 'preview') return null;
  return (
    <div className="section-insert-bar">
      <button
        type="button"
        aria-label="Add section"
        onClick={() => store.getState().addSection(atIndex)}
        className="section-insert-btn inline-flex items-center gap-1 rounded-full border border-ed-rule-strong bg-ed-panel-2 px-3 py-1 text-xs text-ed-ink-2 transition-colors hover:border-brand hover:text-brand"
      >
        <Plus size={12} /> Add section
      </button>
    </div>
  );
}
