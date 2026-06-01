import { useEffect, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
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

function collectAncestorIds(items: OutlineItem[], targetId: string): string[] {
  for (const item of items) {
    if (item.id === targetId) {
      return [];
    }
    const childAncestors = collectAncestorIds(item.children, targetId);
    if (childAncestors.length > 0 || item.children.some((child) => child.id === targetId)) {
      return [item.id, ...childAncestors];
    }
  }
  return [];
}

function OutlineTree({
  items,
  depth,
  expandedIds,
  selectedId,
  onSelect,
  onToggleExpanded,
}: {
  items: OutlineItem[];
  depth: number;
  expandedIds: Set<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleExpanded: (id: string) => void;
}) {
  return (
    <>
      {items.map((item) => {
        const selected = item.id === selectedId;
        const hasChildren = item.children.length > 0;
        const expanded = expandedIds.has(item.id);
        return (
          <div key={item.id}>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label={expanded ? `Collapse ${item.label}` : `Expand ${item.label}`}
                className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-ed-ink-3 transition-colors ${
                  hasChildren ? 'hover:bg-ed-panel-3 hover:text-ed-ink' : 'opacity-30'
                }`}
                style={{ marginLeft: depth * 14 }}
                onClick={() => hasChildren && onToggleExpanded(item.id)}
                disabled={!hasChildren}
              >
                <ChevronRight
                  size={12}
                  className={expanded ? 'rotate-90 transition-transform' : 'transition-transform'}
                />
              </button>
              <button
                type="button"
                className={`min-w-0 flex-1 rounded px-2 py-1 text-left text-sm transition-colors ${
                  selected
                    ? 'bg-ed-brand-soft text-brand'
                    : 'text-ed-ink-2 hover:bg-ed-panel-3 hover:text-ed-ink'
                }`}
                onClick={() => onSelect(item.id)}
              >
                {item.label}
              </button>
            </div>
            {hasChildren && expanded ? (
              <OutlineTree
                items={item.children}
                depth={depth + 1}
                expandedIds={expandedIds}
                selectedId={selectedId}
                onSelect={onSelect}
                onToggleExpanded={onToggleExpanded}
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

  const selectedAncestors = useMemo(
    () => (selectedId ? collectAncestorIds(items, selectedId) : []),
    [items, selectedId],
  );

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (selectedAncestors.length === 0) return;
    setExpandedIds((current) => {
      const next = new Set(current);
      let changed = false;
      for (const id of selectedAncestors) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [selectedAncestors]);

  function toggleExpanded(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="space-y-1">
      <OutlineTree
        items={items}
        depth={0}
        expandedIds={expandedIds}
        selectedId={selectedId}
        onSelect={actions.selectNode}
        onToggleExpanded={toggleExpanded}
      />
    </div>
  );
}

export function Outline() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(t);
  }, []);
  if (!ready) return <div className="space-y-1" />;
  return <OutlineBody />;
}
