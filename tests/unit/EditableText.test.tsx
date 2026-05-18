import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditableText } from '@/components/editor/editable/EditableText';

describe('EditableText', () => {
  it('renders the value as textContent', () => {
    render(<EditableText value="Hello" onChange={() => {}} ariaLabel="Title" />);
    const el = screen.getByRole('textbox', { name: 'Title' });
    expect(el.textContent).toBe('Hello');
  });

  it('renders the placeholder when value is empty', () => {
    render(<EditableText value="" onChange={() => {}} ariaLabel="Title" placeholder="Click to add" />);
    const el = screen.getByRole('textbox', { name: 'Title' });
    expect(el.getAttribute('data-empty')).toBe('true');
    expect(el.getAttribute('aria-placeholder')).toBe('Click to add');
  });

  it('commits draft on blur', () => {
    const onChange = vi.fn();
    render(<EditableText value="Old" onChange={onChange} ariaLabel="Title" />);
    const el = screen.getByRole('textbox', { name: 'Title' });
    el.textContent = 'New';
    fireEvent.input(el);
    fireEvent.blur(el);
    expect(onChange).toHaveBeenCalledWith('New');
  });

  it('does not call onChange on blur when value is unchanged', () => {
    const onChange = vi.fn();
    render(<EditableText value="Old" onChange={onChange} ariaLabel="Title" />);
    const el = screen.getByRole('textbox', { name: 'Title' });
    fireEvent.blur(el);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('commits on Enter and prevents the default newline for single-line fields', () => {
    const onChange = vi.fn();
    render(<EditableText value="Old" onChange={onChange} ariaLabel="Title" singleLine />);
    const el = screen.getByRole('textbox', { name: 'Title' });
    el.textContent = 'New';
    fireEvent.input(el);
    const ev = fireEvent.keyDown(el, { key: 'Enter' });
    expect(ev).toBe(false); // preventDefault was called
    expect(onChange).toHaveBeenCalledWith('New');
  });

  it('does NOT commit on Enter for multiline fields (allows newline)', () => {
    const onChange = vi.fn();
    render(<EditableText value="Old" onChange={onChange} ariaLabel="Address" />);
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
    render(<EditableText value="Old" onChange={onChange} ariaLabel="Title" />);
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
    render(<EditableText value="" onChange={onChange} ariaLabel="Title" />);
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
    const { rerender } = render(<EditableText value="A" onChange={() => {}} ariaLabel="Title" />);
    const el = screen.getByRole('textbox', { name: 'Title' });
    expect(el.textContent).toBe('A');
    rerender(<EditableText value="B" onChange={() => {}} ariaLabel="Title" />);
    expect(el.textContent).toBe('B');
  });
});
