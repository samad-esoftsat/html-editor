'use client';
import { useEffect, useRef, useState } from 'react';
import { Frame } from '@craftjs/core';
import type { SerializedNodes as CraftSerializedNodes } from '@craftjs/core';
import { useEditor as useStoreEditor, useEditorStore } from '@/lib/editor/StoreProvider';
import { paperMetricsFor } from '@/lib/editor/types';
import { PageBreakOverlay } from './canvas/PageBreakOverlay';

// Strip orphan child-id references and unreachable nodes from a serialized
// tree. Defensive: an earlier crash class persisted partial-mutation trees
// (a parent's `nodes` array pointing at a child that was never written) and
// Craft.js's <Frame> deserialize crashes opaquely on those.
function sanitizeTree(raw: CraftSerializedNodes): CraftSerializedNodes {
  const ids = new Set(Object.keys(raw));
  const cleaned: CraftSerializedNodes = {};
  for (const [id, node] of Object.entries(raw)) {
    if (!node) continue;
    const safeNodes = Array.isArray(node.nodes) ? node.nodes.filter((c) => ids.has(c)) : [];
    cleaned[id] = {
      ...node,
      props: node.props && typeof node.props === 'object' ? node.props : {},
      nodes: safeNodes,
      linkedNodes: node.linkedNodes ?? {},
    };
  }
  // Drop unreachable nodes (parent removed but child still in the map).
  const reachable = new Set<string>();
  const stack = ['ROOT'];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    const node = cleaned[id];
    if (node) {
      for (const child of node.nodes) stack.push(child);
      for (const linked of Object.values(node.linkedNodes ?? {})) stack.push(linked as string);
    }
  }
  const final: CraftSerializedNodes = {};
  for (const id of reachable) {
    if (cleaned[id]) final[id] = cleaned[id];
  }
  return final;
}

export function PreviewBody() {
  // Capture the initial tree exactly once on mount. After that, Craft owns the
  // live tree state; the store is a downstream mirror (autosave/export/translate)
  // populated via EditorShell's `onNodesChange`. Re-passing `data` to <Frame>
  // on every store change re-initializes the editor and produces duplicate
  // React keys mid-mutation (e.g. when deleting a node).
  const store = useEditorStore();
  const global = useStoreEditor((state) => state.data.global);
  const [initialTree] = useState<CraftSerializedNodes | null>(() => {
    const raw = store.getState().data.tree as unknown as CraftSerializedNodes | undefined;
    if (!raw || !raw.ROOT) return null;
    return sanitizeTree(raw);
  });

  // Craft.js's <Frame> mounts hooks that are not SSR-safe in Next 15's
  // 'use client' SSR pass. Defer the Frame render until after mount so SSR
  // produces an empty preview shell and the client takes over.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const paper = paperMetricsFor(global);

  // The page-break overlay observes `canvasRef` for size/mutation
  // changes. If it rendered as a *child* of that ref, its own DOM
  // updates would trigger its own observer (infinite measure loop that
  // freezes the page). Wrap canvas + overlay in a relative positioning
  // parent so the overlay sits as a sibling, not a descendant.
  return (
    <div className="relative mx-auto w-full" style={{ maxWidth: paper.widthPx }}>
      <div
        ref={canvasRef}
        className="preview-canvas w-full"
        style={{
          background: global.backgroundColor,
          fontFamily: global.fontFamily,
          minHeight: '100%',
        }}
      >
        {mounted && initialTree ? (
          <Frame data={initialTree} />
        ) : (
          <div
            className="flex min-h-[480px] items-center justify-center rounded border border-dashed border-ed-rule-strong bg-white/70 text-sm text-ed-ink-3"
            aria-live="polite"
          >
            Loading editor content…
          </div>
        )}
      </div>
      {mounted ? <PageBreakOverlay targetRef={canvasRef} /> : null}
    </div>
  );
}
