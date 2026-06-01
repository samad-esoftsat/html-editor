'use client';
import { Palette } from './sidebar/Palette';

export function RightPanel() {
  return (
    <aside className="w-[300px] shrink-0 overflow-y-auto border-l border-ed-rule bg-ed-panel p-3">
      <div className="space-y-4">
        <section className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ed-ink-3">Add</div>
          <Palette />
        </section>
      </div>
    </aside>
  );
}
