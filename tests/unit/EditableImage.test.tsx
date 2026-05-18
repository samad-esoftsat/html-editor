import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditableImage } from '@/components/editor/editable/EditableImage';
import { AssetPickerProvider } from '@/components/editor/AssetPickerProvider';
import { EditorModeProvider, useEditorMode } from '@/components/editor/EditorModeProvider';

function ForcePreview() {
  const { setMode } = useEditorMode();
  React.useEffect(() => { setMode('preview'); }, [setMode]);
  return null;}

vi.mock('@/components/editor/AssetPicker', () => ({
  AssetPicker: ({ onSelect, onClose }: { onSelect: (url: string) => void; onClose: () => void }) => (
    <div role="dialog" aria-label="Mock asset picker">
      <button type="button" onClick={() => onSelect('https://example.com/new.png')}>pick</button>
      <button type="button" onClick={onClose}>close</button>
    </div>
  ),
}));

function renderWithProvider(ui: React.ReactNode) {
  return render(
    <AssetPickerProvider workspaceSlug="ws">
      <EditorModeProvider>{ui}</EditorModeProvider>
    </AssetPickerProvider>,
  );
}

describe('EditableImage', () => {
  it('renders an <img> when value is set', () => {
    renderWithProvider(
      <EditableImage
        value="https://example.com/a.png"
        onChange={() => {}}
        alt="Logo"
        placeholderLabel="Logo"
      />,
    );
    const img = screen.getByRole('img', { name: 'Logo' });
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('src')).toBe('https://example.com/a.png');
  });

  it('renders a clickable placeholder when value is empty', () => {
    renderWithProvider(
      <EditableImage
        value=""
        onChange={() => {}}
        alt=""
        placeholderLabel="Logo image - click to add"
      />,
    );
    const placeholder = screen.getByRole('button', { name: /Logo image/i });
    expect(placeholder).toBeInTheDocument();
  });

  it('opens the asset picker on click and commits the selected url', async () => {
    const onChange = vi.fn();
    renderWithProvider(
      <EditableImage
        value=""
        onChange={onChange}
        alt=""
        placeholderLabel="Logo image - click to add"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Logo image/i }));
    expect(screen.getByRole('dialog', { name: 'Mock asset picker' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'pick' }));
    expect(onChange).toHaveBeenCalledWith('https://example.com/new.png');
  });

  it('clicking an already-set image opens the picker too', () => {
    const onChange = vi.fn();
    renderWithProvider(
      <EditableImage
        value="https://example.com/a.png"
        onChange={onChange}
        alt="Logo"
        placeholderLabel="Logo"
      />,
    );
    fireEvent.click(screen.getByRole('img', { name: 'Logo' }));
    expect(screen.getByRole('dialog', { name: 'Mock asset picker' })).toBeInTheDocument();
  });
});

describe('EditableImage — preview mode', () => {
  function renderPreview(ui: React.ReactNode) {
    return render(
      <AssetPickerProvider workspaceSlug="ws">
        <EditorModeProvider>
          <ForcePreview />
          {ui}
        </EditorModeProvider>
      </AssetPickerProvider>,
    );
  }

  it('renders a plain <img> with no onClick / no inline-editable-image class when value is set', () => {
    renderPreview(
      <EditableImage
        value="https://example.com/a.png"
        onChange={() => {}}
        alt="Logo"
        placeholderLabel="Logo"
      />,
    );
    const img = screen.getByRole('img', { name: 'Logo' });
    expect(img).toBeInTheDocument();
    expect(img.classList.contains('inline-editable-image')).toBe(false);
    // Clicking must NOT open the asset picker
    fireEvent.click(img);
    expect(screen.queryByRole('dialog', { name: 'Mock asset picker' })).toBeNull();
  });

  it('renders nothing (no placeholder button) when value is empty', () => {
    renderPreview(
      <EditableImage
        value=""
        onChange={() => {}}
        alt=""
        placeholderLabel="Logo image - click to add"
      />,
    );
    expect(screen.queryByRole('button', { name: /Logo image/i })).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
  });
});
