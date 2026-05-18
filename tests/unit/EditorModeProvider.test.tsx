import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditorModeProvider, useEditorMode } from '@/components/editor/EditorModeProvider';

function Probe() {
  const { mode, setMode } = useEditorMode();
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <button onClick={() => setMode('preview')}>preview</button>
      <button onClick={() => setMode('edit')}>edit</button>
    </div>
  );
}

describe('EditorModeProvider', () => {
  it('defaults to edit mode', () => {
    render(<EditorModeProvider><Probe /></EditorModeProvider>);
    expect(screen.getByTestId('mode').textContent).toBe('edit');
  });

  it('switches mode when setMode is called', async () => {
    const { getByText, getByTestId } = render(
      <EditorModeProvider><Probe /></EditorModeProvider>
    );
    fireEvent.click(getByText('preview'));
    expect(getByTestId('mode').textContent).toBe('preview');
    fireEvent.click(getByText('edit'));
    expect(getByTestId('mode').textContent).toBe('edit');
  });

  it('useEditorMode throws when used outside provider', () => {
    const orig = console.error;
    console.error = () => {};
    try {
      expect(() => render(<Probe />)).toThrow();
    } finally {
      console.error = orig;
    }
  });
});
