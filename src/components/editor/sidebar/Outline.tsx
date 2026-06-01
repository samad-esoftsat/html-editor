import { useEffect, useState } from 'react';
import { ROOT_NODE, useEditor as useCraftEditor } from '@craftjs/core';

interface OutlineItem {
  id: string;
  label: string;
  children: OutlineItem[];
}

interface OutlineQuery {
  node(id: string): {
    get(): {
      data?: {
        displayName?: string;
        nodes?: string[];
      };
    };
  };
  getEvent(eventType: 'selected'): {
    first(): string | null;
  };
}

function buildOutlineItem(query: OutlineQuery, id: string): OutlineItem | null {
  try {
    const node = query.node(id).get();
    const label = typeof node?.data?.displayName === 'string' ? node.data.displayName : '';
    if (!label) return null;
    const childIds = Array.isArray(node?.data?.nodes) ? node.data.nodes : [];
    return {
      id,
      label,
      children: childIds
        .map((childId: string) => buildOutlineItem(query, childId))
        .filter((child: OutlineItem | null): child is OutlineItem => child !== null),
    };
  } catch {
    return null;
  }
}

function OutlineTree({
  items,
  depth,
  selectedId,
  onSelect,
}: {
  items: OutlineItem[];
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      {items.map((item) => {
        const selected = item.id === selectedId;
        return (
          <div key={item.id}>
            <button
              type="button"
              className={`w-full rounded px-2 py-1 text-left text-sm transition-colors ${
                selected
                  ? 'bg-ed-brand-soft text-brand'
                  : 'text-ed-ink-2 hover:bg-ed-panel-3 hover:text-ed-ink'
              }`}
              style={{ paddingLeft: depth * 14 + 8 }}
              onClick={() => onSelect(item.id)}
            >
              {item.label}
            </button>
            {item.children.length > 0 ? (
              <OutlineTree
                items={item.children}
                depth={depth + 1}
                selectedId={selectedId}
                onSelect={onSelect}
              />
            ) : null}
          </div>
        );
      })}
    </>
  );
}

function OutlineBody() {
  const { actions, items, selectedId } = useCraftEditor((_state, query) => {
    const rootChildren = (() => {
      try {
        const root = query.node(ROOT_NODE).get();
        return Array.isArray(root?.data?.nodes) ? root.data.nodes : [];
      } catch {
        return [] as string[];
      }
    })();

    return {
      items: rootChildren
        .map((id) => buildOutlineItem(query, id))
        .filter((item): item is OutlineItem => item !== null),
      selectedId: query.getEvent('selected').first() ?? null,
    };
  });

  return (
    <div className="space-y-1">
      <OutlineTree items={items} depth={0} selectedId={selectedId} onSelect={actions.selectNode} />
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
