import { useEffect, useRef } from 'react';
import { useConnectedRef } from './internals';
import { useRenderContext } from './RenderContext';

/**
 * Makes a leaf primitive's rendered element contentEditable in editor mode.
 * Keeps the Craft connect+drag ref wired alongside ours, syncs the DOM when
 * the underlying text prop changes from outside (e.g., inspector input, undo),
 * and commits user edits via setProp on each input event so the inspector
 * stays live.
 *
 * Usage:
 *   const editable = useEditableNode(text, (next) =>
 *     setProp((props) => { props.text = next; })
 *   );
 *   return <p {...editable.props}>{text}</p>;
 */
export function useEditableNode(
  text: string,
  onChange: (next: string) => void,
): {
  props: {
    ref: (el: HTMLElement | null) => void;
    contentEditable: boolean;
    suppressContentEditableWarning: true;
    onInput: (event: React.FormEvent<HTMLElement>) => void;
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
    onMouseDown: (event: React.MouseEvent<HTMLElement>) => void;
  };
} {
  const { target } = useRenderContext();
  const editable = target === 'editor';
  const connectRef = useConnectedRef();
  const elRef = useRef<HTMLElement | null>(null);
  const lastCommittedRef = useRef(text);

  // Sync DOM when text changes externally (e.g., undo, inspector). Skip when
  // the element is focused so we don't clobber the user's caret.
  useEffect(() => {
    const el = elRef.current;
    if (!editable || !el) return;
    if (document.activeElement === el) return;
    if (el.innerText !== text) {
      el.innerText = text;
    }
    lastCommittedRef.current = text;
  }, [text, editable]);

  return {
    props: {
      ref: (el: HTMLElement | null) => {
        elRef.current = el;
        connectRef(el);
      },
      contentEditable: editable,
      suppressContentEditableWarning: true,
      onInput: (event) => {
        const next = (event.currentTarget as HTMLElement).innerText;
        if (next !== lastCommittedRef.current) {
          lastCommittedRef.current = next;
          onChange(next);
        }
      },
      onKeyDown: (event) => {
        if (event.key === 'Escape') {
          (event.currentTarget as HTMLElement).blur();
        }
      },
      // Stop mousedown from bubbling up to Craft's drag handler so clicking
      // inside text places the caret instead of starting a drag.
      onMouseDown: (event) => {
        if (editable) event.stopPropagation();
      },
    },
  };
}
