// tests/unit/BlockToolbar.test.tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { BlockToolbar } from '@/components/editor/canvas/BlockToolbar';
import { EditorModeProvider, useEditorMode } from '@/components/editor/EditorModeProvider';
import { TooltipProvider } from '@/components/ui/tooltip';

const mockDuplicate = vi.fn();
const mockRemove = vi.fn();
vi.mock('@/lib/editor/StoreProvider', () => ({
  useEditorStore: () => ({
    getState: () => ({ duplicateBlock: mockDuplicate, removeBlock: mockRemove }),
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

describe('BlockToolbar', () => {
  beforeEach(() => {
    mockDuplicate.mockClear();
    mockRemove.mockClear();
    mockConfirm.mockReset();
  });

  it('renders drag, duplicate, and delete buttons', () => {
    render(
      <TooltipProvider>
        <EditorModeProvider>
          <BlockToolbar blockId="abc" blockLabel="Title" dragAttributes={{}} dragListeners={{}} />
        </EditorModeProvider>
      </TooltipProvider>
    );
    expect(screen.getByLabelText('Drag to reorder block')).toBeTruthy();
    expect(screen.getByLabelText('Duplicate block')).toBeTruthy();
    expect(screen.getByLabelText('Delete block')).toBeTruthy();
  });

  it('clicking duplicate calls duplicateBlock with the block id', () => {
    render(
      <TooltipProvider>
        <EditorModeProvider>
          <BlockToolbar blockId="abc" blockLabel="Title" dragAttributes={{}} dragListeners={{}} />
        </EditorModeProvider>
      </TooltipProvider>
    );
    fireEvent.click(screen.getByLabelText('Duplicate block'));
    expect(mockDuplicate).toHaveBeenCalledWith('abc');
  });

  it('clicking delete confirms and then removes when confirmed', async () => {
    mockConfirm.mockResolvedValue(true);
    render(
      <TooltipProvider>
        <EditorModeProvider>
          <BlockToolbar blockId="abc" blockLabel="Title" dragAttributes={{}} dragListeners={{}} />
        </EditorModeProvider>
      </TooltipProvider>
    );
    fireEvent.click(screen.getByLabelText('Delete block'));
    await waitFor(() => expect(mockRemove).toHaveBeenCalledWith('abc'));
  });

  it('clicking delete does NOT remove when cancelled', async () => {
    mockConfirm.mockResolvedValue(false);
    render(
      <TooltipProvider>
        <EditorModeProvider>
          <BlockToolbar blockId="abc" blockLabel="Title" dragAttributes={{}} dragListeners={{}} />
        </EditorModeProvider>
      </TooltipProvider>
    );
    fireEvent.click(screen.getByLabelText('Delete block'));
    await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('renders nothing in preview mode', () => {
    const { container } = render(
      <TooltipProvider>
        <EditorModeProvider>
          <ForcePreview />
          <BlockToolbar blockId="abc" blockLabel="Title" dragAttributes={{}} dragListeners={{}} />
        </EditorModeProvider>
      </TooltipProvider>
    );
    expect(container.querySelector('button[aria-label="Duplicate block"]')).toBeNull();
  });
});
