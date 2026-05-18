import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditableText } from '@/components/editor/editable/EditableText';
import { EditorModeProvider, useEditorMode } from '@/components/editor/EditorModeProvider';

function ForcePreview() {
  const { setMode } = useEditorMode();
  React.useEffect(() => { setMode('preview'); }, [setMode]);
  return null;
}

function renderEdit(ui: React.ReactNode) {
  return render(<EditorModeProvider>{ui}</EditorModeProvider>);
}

describe('EditableText', () => {
  it('renders the value as textContent', () => {
    renderEdit(<EditableText value="Hello" onChange={() => {}} ariaLabel="Title" />);
    const el = screen.getByRole('textbox', { name: 'Title' });
    expect(el.textContent).toBe('Hello');
  });

  it('renders the placeholder when value is empty', () => {
    renderEdit(<EditableText value="" onChange={() => {}} ariaLabel="Title" placeholder="Click to add" />);
    const el = screen.getByRole('textbox', { name: 'Title' });
    expect(el.getAttribute('data-empty')).toBe('true');
    expect(el.getAttribute('aria-placeholder')).toBe('Click to add');
  });

  it('commits draft on blur', () => {
    const onChange = vi.fn();
    renderEdit(<EditableText value="Old" onChange={onChange} ariaLabel="Title" />);
    const el = screen.getByRole('textbox', { name: 'Title' });
    el.textContent = 'New';
    fireEvent.input(el);
    fireEvent.blur(el);
    expect(onChange).toHaveBeenCalledWith('New');
  });

  it('does not call onChange on blur when value is unchanged', () => {
    const onChange = vi.fn();
    renderEdit(<EditableText value="Old" onChange={onChange} ariaLabel="Title" />);
    const el = screen.getByRole('textbox', { name: 'Title' });
    fireEvent.blur(el);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('commits on Enter and prevents the default newline for single-line fields', () => {
    const onChange = vi.fn();
    renderEdit(<EditableText value="Old" onChange={onChange} ariaLabel="Title" singleLine />);
    const el = screen.getByRole('textbox', { name: 'Title' });
    el.textContent = 'New';
    fireEvent.input(el);
    const ev = fireEvent.keyDown(el, { key: 'Enter' });
    expect(ev).toBe(false); // preventDefault was called
    expect(onChange).toHaveBeenCalledWith('New');
  });

  it('does NOT commit on Enter for multiline fields (allows newline)', () => {
    const onChange = vi.fn();
    renderEdit(<EditableText value="Old" onChange={onChange} ariaLabel="Address" />);
    const el = screen.getByRole('textbox', { name: 'Address' });
    el.textContent = 'A\nB';
    fireEvent.input(el);
    fireEvent.keyDown(el, { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(el);
    expect(onChange).toHaveBeenCalledWith('A\nB');
  });

  it('reverts to the committed value on Escape and does not call onChange', () => {
    const onChange = vi.fn();
    renderEdit(<EditableText value="Old" onChange={onChange} ariaLabel="Title" />);
    const el = screen.getByRole('textbox', { name: 'Title' });
    el.textContent = 'Changed';
    fireEvent.input(el);
    fireEvent.keyDown(el, { key: 'Escape' });
    expect(el.textContent).toBe('Old');
    fireEvent.blur(el);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('strips HTML on paste by inserting only plain text', () => {
    const onChange = vi.fn();
    renderEdit(<EditableText value="" onChange={onChange} ariaLabel="Title" />);
    const el = screen.getByRole('textbox', { name: 'Title' });
    el.focus();
    const dt = new DataTransfer();
    dt.setData('text/html', '<b>Bold</b>');
    dt.setData('text/plain', 'Bold');
    const ev = fireEvent.paste(el, { clipboardData: dt });
    expect(ev).toBe(false);
    fireEvent.blur(el);
    expect(onChange).toHaveBeenCalledWith('Bold');
  });

  it('updates the DOM when external value changes while not focused', () => {
    const { rerender } = renderEdit(<EditableText value="A" onChange={() => {}} ariaLabel="Title" />);
    const el = screen.getByRole('textbox', { name: 'Title' });
    expect(el.textContent).toBe('A');
    rerender(<EditorModeProvider><EditableText value="B" onChange={() => {}} ariaLabel="Title" /></EditorModeProvider>);
    expect(el.textContent).toBe('B');
  });
});

describe('EditableText — preview mode', () => {
  it('renders a non-interactive element with no contenteditable attribute', () => {
    render(
      <EditorModeProvider>
        <ForcePreview />
        <EditableText value="Hello preview" onChange={() => {}} ariaLabel="Title" />
      </EditorModeProvider>,
    );
    // Should NOT find a textbox role (contentEditable)
    expect(screen.queryByRole('textbox', { name: 'Title' })).toBeNull();
    // Text content should still be visible
    expect(screen.getByText('Hello preview')).toBeInTheDocument();
  });

  it('rendered element has no contenteditable attribute and no inline-editable class', () => {
    render(
      <EditorModeProvider>
        <ForcePreview />
        <EditableText value="Preview text" onChange={() => {}} ariaLabel="Title" className="custom" />
      </EditorModeProvider>,
    );
    const el = screen.getByText('Preview text');
    expect(el.getAttribute('contenteditable')).toBeNull();
    expect(el.classList.contains('inline-editable')).toBe(false);
  });
});
