import { ROOT_NODE, useEditor as useCraftEditor } from '@craftjs/core';
import { Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function SelectedToolbar() {
  const { actions, canDelete, canDuplicate, query, selectedId } = useCraftEditor((state, query) => {
    const selectedId = query.getEvent('selected').first();
    if (!selectedId) {
      return { canDelete: false, canDuplicate: false, query, selectedId: null as string | null };
    }
    const node = query.node(selectedId).get();
    const isTopLevelLocked = node.data.parent === ROOT_NODE && node.data.props.locked === true;
    return {
      canDelete: !isTopLevelLocked && selectedId !== ROOT_NODE,
      canDuplicate: selectedId !== ROOT_NODE && !isTopLevelLocked,
      query,
      selectedId,
    };
  });

  if (!selectedId) {
    return null;
  }

  return (
    <div className="mb-3 flex items-center gap-2 rounded-md border border-ed-rule bg-white p-2 shadow-sm">
      <Button
        variant="secondary"
        disabled={!canDuplicate}
        onClick={() => {
          if (!selectedId) {
            return;
          }
          const parentId = query.node(selectedId).get().data.parent ?? ROOT_NODE;
          const siblings = query.node(parentId).get().data.nodes;
          const index = siblings.findIndex((id) => id === selectedId);
          const tree = query.node(selectedId).toNodeTree();
          actions.addNodeTree(tree, parentId, index + 1);
        }}
      >
        <Copy size={14} />
        Duplicate
      </Button>
      <Button variant="secondary" disabled={!canDelete} onClick={() => selectedId && actions.delete(selectedId)}>
        <Trash2 size={14} />
        Delete
      </Button>
    </div>
  );
}
