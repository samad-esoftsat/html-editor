import { useEditor as useCraftEditor } from '@craftjs/core';
import { createElement } from 'react';

export function NodeInspector() {
  const { settings } = useCraftEditor((state, query) => {
    const id = query.getEvent('selected').first();
    if (!id) {
      return { settings: null };
    }
    return {
      settings: query.node(id).get().related?.settings ?? null,
    };
  });

  if (!settings) {
    return null;
  }

  return <div className="space-y-3">{createElement(settings)}</div>;
}
