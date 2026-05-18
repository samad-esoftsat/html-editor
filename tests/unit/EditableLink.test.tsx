import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { EditableLink } from '@/components/editor/editable/EditableLink';
import { EditorModeProvider, useEditorMode } from '@/components/editor/EditorModeProvider';

function ForcePreview() {
  const { setMode } = useEditorMode();
  React.useEffect(() => { setMode('preview'); }, [setMode]);
  return null;
}

describe('EditableLink', () => {
  it('renders an icon button in edit mode', () => {
    render(<EditorModeProvider><EditableLink value="https://x.com" onChange={() => {}} ariaLabel="Edit link" /></EditorModeProvider>);
    expect(screen.getByLabelText('Edit link')).toBeTruthy();
  });

  it('opens a popover with the current value when clicked', () => {
    render(<EditorModeProvider><EditableLink value="https://x.com" onChange={() => {}} ariaLabel="Edit link" /></EditorModeProvider>);
    fireEvent.click(screen.getByLabelText('Edit link'));
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('https://x.com');
  });

  it('Enter commits the new value and closes the popover', () => {
    const onChange = vi.fn();
    render(<EditorModeProvider><EditableLink value="https://x.com" onChange={onChange} ariaLabel="Edit link" /></EditorModeProvider>);
    fireEvent.click(screen.getByLabelText('Edit link'));
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'https://y.com' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('https://y.com');
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('Escape closes without saving', () => {
    const onChange = vi.fn();
    render(<EditorModeProvider><EditableLink value="https://x.com" onChange={onChange} ariaLabel="Edit link" /></EditorModeProvider>);
    fireEvent.click(screen.getByLabelText('Edit link'));
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'https://nope.com' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('Save button commits', () => {
    const onChange = vi.fn();
    render(<EditorModeProvider><EditableLink value="https://x.com" onChange={onChange} ariaLabel="Edit link" /></EditorModeProvider>);
    fireEvent.click(screen.getByLabelText('Edit link'));
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'https://y.com' } });
    fireEvent.click(screen.getByText('Save'));
    expect(onChange).toHaveBeenCalledWith('https://y.com');
  });

  it('renders nothing in preview mode', () => {
    const { container } = render(
      <EditorModeProvider>
        <ForcePreview />
        <EditableLink value="https://x.com" onChange={() => {}} ariaLabel="Edit link" />
      </EditorModeProvider>
    );
    expect(container.querySelector('button[aria-label="Edit link"]')).toBeNull();
  });
});
