import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { EditableBulletList } from '@/components/editor/editable/EditableBulletList';

function setup(bullets: string[]) {
  const onChange = vi.fn();
  render(<EditableBulletList bullets={bullets} onChange={onChange} ariaLabel="Bullets" />);
  return { onChange };
}

function items(): HTMLElement[] {
  const list = screen.getByRole('list', { name: 'Bullets' });
  return within(list).getAllByRole('listitem');
}

describe('EditableBulletList', () => {
  it('renders one <li> per bullet', () => {
    setup(['One', 'Two', 'Three']);
    expect(items().length).toBe(3);
  });

  it('Enter inside a bullet splits and inserts a new bullet after it', () => {
    const { onChange } = setup(['One', 'Two']);
    const second = items()[1];
    const editor = within(second).getByRole('textbox');
    editor.textContent = 'Two';
    fireEvent.input(editor);
    fireEvent.keyDown(editor, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(['One', 'Two', '']);
  });

  it('Backspace at the start of an empty bullet removes it', () => {
    const { onChange } = setup(['One', '', 'Three']);
    const second = items()[1];
    const editor = within(second).getByRole('textbox');
    fireEvent.keyDown(editor, { key: 'Backspace' });
    expect(onChange).toHaveBeenCalledWith(['One', 'Three']);
  });

  it('Backspace at the start of a non-empty bullet merges into the previous bullet', () => {
    const { onChange } = setup(['One', 'Two']);
    const second = items()[1];
    const editor = within(second).getByRole('textbox');
    const range = document.createRange();
    range.setStart(editor.firstChild ?? editor, 0);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    fireEvent.keyDown(editor, { key: 'Backspace' });
    expect(onChange).toHaveBeenCalledWith(['OneTwo']);
  });

  it('committing a bullet text via blur updates the array at that index', () => {
    const { onChange } = setup(['One', 'Two']);
    const first = items()[0];
    const editor = within(first).getByRole('textbox');
    editor.textContent = 'Edited';
    fireEvent.input(editor);
    fireEvent.blur(editor);
    expect(onChange).toHaveBeenCalledWith(['Edited', 'Two']);
  });

  it('rendering with zero bullets shows an empty list and renders a single empty editable to start with', () => {
    setup([]);
    expect(items().length).toBe(1);
  });
});
