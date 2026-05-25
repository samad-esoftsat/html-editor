'use client';

import { useEditor, useNode } from '@craftjs/core';
import { useCallback } from 'react';
import type { ImageProps } from '@/lib/editor/types';
import { useAssetPicker } from '../AssetPickerProvider';

/**
 * Wires the AssetPicker to a Craft Image node.
 *
 * Returns:
 *   - `isSelected` — true when this node is the current Craft selection.
 *     Use this to gate click-to-open so a first click only selects the
 *     node (Craft default) and a second click opens the picker.
 *   - `openPicker` — opens the AssetPicker modal seeded with the current
 *     `src` / `alt`. On selection, updates the node's `src` prop.
 */
export function useAssetPickerForNode(): { isSelected: boolean; openPicker: () => void } {
  const { openAssetPicker } = useAssetPicker();

  const { id, actions, src, alt } = useNode((node) => {
    const props = node.data.props as ImageProps;
    return {
      src: props.src ?? '',
      alt: props.alt ?? '',
    };
  });

  const isSelected = useEditor((state) => ({
    isSelected: state.events.selected.has(id),
  })).isSelected;

  const openPicker = useCallback(() => {
    openAssetPicker({
      value: src,
      altText: alt,
      onSelect: (url) => {
        actions.setProp((props: ImageProps) => {
          props.src = url;
        });
      },
    });
  }, [openAssetPicker, src, alt, actions]);

  return { isSelected, openPicker };
}
