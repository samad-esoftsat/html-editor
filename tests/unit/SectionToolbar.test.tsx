// tests/unit/SectionToolbar.test.tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { SectionToolbar } from '@/components/editor/canvas/SectionToolbar';
import { EditorModeProvider, useEditorMode } from '@/components/editor/EditorModeProvider';

const mockDuplicate = vi.fn();
const mockRemove = vi.fn();
vi.mock('@/lib/editor/StoreProvider', () => ({
  useEditorStore: () => ({
    getState: () => ({ duplicateSection: mockDuplicate, removeSection: mockRemove }),
  }),
}));

const mockConfirm = vi.fn();
vi.mock('@/lib/utils/confirm', () => ({
  confirmDialog: (...args: unknown[]) => mockConfirm(...args),
}));

function ForcePreview() {
  const { setMode } = useEditorMode();
  React.useEffect(() => { setMode('preview'); }, [setMode]);
  return null;
}

describe('SectionToolbar', () => {
  beforeEach(() => {
    mockDuplicate.mockClear();
    mockRemove.mockClear();
    mockConfirm.mockReset();
  });

  it('renders drag, duplicate, and delete buttons', () => {
    render(
      <EditorModeProvider>
        <SectionToolbar sectionId="abc" sectionTitle="Title" dragAttributes={{}} dragListeners={{}} />
      </EditorModeProvider>
    );
    expect(screen.getByLabelText('Drag to reorder section')).toBeTruthy();
    expect(screen.getByLabelText('Duplicate section')).toBeTruthy();
    expect(screen.getByLabelText('Delete section')).toBeTruthy();
  });

  it('clicking duplicate calls duplicateSection with the section id', () => {
    render(
      <EditorModeProvider>
        <SectionToolbar sectionId="abc" sectionTitle="Title" dragAttributes={{}} dragListeners={{}} />
      </EditorModeProvider>
    );
    fireEvent.click(screen.getByLabelText('Duplicate section'));
    expect(mockDuplicate).toHaveBeenCalledWith('abc');
  });

  it('clicking delete confirms and then removes when confirmed', async () => {
    mockConfirm.mockResolvedValue(true);
    render(
      <EditorModeProvider>
        <SectionToolbar sectionId="abc" sectionTitle="Title" dragAttributes={{}} dragListeners={{}} />
      </EditorModeProvider>
    );
    fireEvent.click(screen.getByLabelText('Delete section'));
    await waitFor(() => expect(mockRemove).toHaveBeenCalledWith('abc'));
  });

  it('clicking delete does NOT remove when cancelled', async () => {
    mockConfirm.mockResolvedValue(false);
    render(
      <EditorModeProvider>
        <SectionToolbar sectionId="abc" sectionTitle="Title" dragAttributes={{}} dragListeners={{}} />
      </EditorModeProvider>
    );
    fireEvent.click(screen.getByLabelText('Delete section'));
    await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('renders nothing in preview mode', () => {
    const { container } = render(
      <EditorModeProvider>
        <ForcePreview />
        <SectionToolbar sectionId="abc" sectionTitle="Title" dragAttributes={{}} dragListeners={{}} />
      </EditorModeProvider>
    );
    expect(container.querySelector('button[aria-label="Duplicate section"]')).toBeNull();
  });
});
