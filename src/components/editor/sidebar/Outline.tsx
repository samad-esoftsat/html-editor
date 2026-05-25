import { useEffect, useState } from 'react';
import { ROOT_NODE, useEditor as useCraftEditor } from '@craftjs/core';

function OutlineNode({ id, depth }: { id: string; depth: number }) {
  const { actions, label, children } = useCraftEditor((state, query) => {
    try {
      const node = query.node(id).get();
      const kids = node?.data?.nodes;
      return {
        label: node?.data?.displayName ?? '',
        children: Array.isArray(kids) ? kids : [],
      };
    } catch {
      return { label: '', children: [] as string[] };
    }
  });

  if (!label) return null;

  return (
    <div>
      <button
        type="button"
        className="w-full rounded px-2 py-1 text-left text-sm text-ed-ink-2 hover:bg-ed-panel-3 hover:text-ed-ink"
        style={{ paddingLeft: depth * 14 + 8 }}
        onClick={() => actions.selectNode(id)}
      >
        {label}
      </button>
      {children.map((child) => <OutlineNode key={child} id={child} depth={depth + 1} />)}
    </div>
  );
}

function OutlineBody() {
  const rootChildren = useCraftEditor((state, query) => {
    try {
      const root = query.node(ROOT_NODE).get();
      const kids = root?.data?.nodes;
      return Array.isArray(kids) ? kids : [];
    } catch {
      return [] as string[];
    }
  });
  const list = Array.isArray(rootChildren) ? rootChildren : [];
  return (
    <div className="space-y-1">
      {list.map((id) => <OutlineNode key={id} id={id} depth={0} />)}
    </div>
  );
}

export function Outline() {
  // Wait until after Craft's <Editor> has done its first render+commit before
  // subscribing. Otherwise the subscription fires inside Editor's initial
  // render, triggers a setState on us mid-render, and React 19 escalates with
  // "Cannot update a component while rendering a different component".
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(t);
  }, []);
  if (!ready) return <div className="space-y-1" />;
  return <OutlineBody />;
}
