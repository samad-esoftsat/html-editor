import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { SelectionActionBar } from '@/components/editor/canvas/SelectionActionBar';
import {
  SectionSelectionProvider,
  useSectionSelection,
} from '@/components/editor/SectionSelectionProvider';
import { EditorModeProvider, useEditorMode } from '@/components/editor/EditorModeProvider';
import { TooltipProvider } from '@/components/ui/tooltip';

const mockDuplicate = vi.fn();
const mockRemove = vi.fn();
const mockMove = vi.fn();
const fakeBlocks = [
  { id: '__header__', type: 'header' },
  { id: 'a', type: 'product-section' },
  { id: 'b', type: 'product-section' },
  { id: 'c', type: 'product-section' },
  { id: '__footer__', type: 'footer' },
];
vi.mock('@/lib/editor/StoreProvider', () => ({
  useEditorStore: () => ({
    getState: () => ({
      duplicateBlock: mockDuplicate,
      removeBlock: mockRemove,
      moveBlock: mockMove,
      data: { blocks: fakeBlocks },
    }),
  }),
}));

const mockConfirm = vi.fn();
vi.mock('@/lib/utils/confirm', () => ({
  confirmDialog: (...args: unknown[]) => mockConfirm(...args),
}));

function Seed({ ids }: { ids: string[] }) {
  const { toggle } = useSectionSelection();
  React.useEffect(() => {
    for (const id of ids) toggle(id, 'single');
  }, [ids, toggle]);
  return null;
}

function ForcePreview() {
  const { setMode } = useEditorMode();
  React.useEffect(() => { setMode('preview'); }, [setMode]);
  return null;
}

function Wrap({ ids, sectionIds = ['a', 'b', 'c'] }: { ids: string[]; sectionIds?: string[] }) {
  return (
    <TooltipProvider>
      <EditorModeProvider>
        <SectionSelectionProvider sectionIds={sectionIds}>
          <Seed ids={ids} />
          <SelectionActionBar />
        </SectionSelectionProvider>
      </EditorModeProvider>
    </TooltipProvider>
  );
}

describe('SelectionActionBar', () => {
  beforeEach(() => {
    mockDuplicate.mockClear();
    mockRemove.mockClear();
    mockMove.mockClear();
    mockConfirm.mockReset();
  });

  it('renders nothing when selection is empty', () => {
    const { container } = render(<Wrap ids={[]} />);
    expect(container.querySelector('[data-selection-bar]')).toBeNull();
  });

  it('renders the count and action buttons when 1+ selected', () => {
    render(<Wrap ids={['a', 'b']} />);
    expect(screen.getByText(/2 selected/i)).toBeTruthy();
    expect(screen.getByLabelText(/duplicate selected/i)).toBeTruthy();
    expect(screen.getByLabelText(/delete selected/i)).toBeTruthy();
    expect(screen.getByLabelText(/move selected blocks up/i)).toBeTruthy();
    expect(screen.getByLabelText(/move selected blocks down/i)).toBeTruthy();
    expect(screen.getByLabelText(/clear selection/i)).toBeTruthy();
  });

  it('Duplicate calls duplicateBlock for each selected id in store order', () => {
    render(<Wrap ids={['b', 'a']} />); // toggled in 'b, a' order
    fireEvent.click(screen.getByLabelText(/duplicate selected/i));
    expect(mockDuplicate.mock.calls).toEqual([['a'], ['b']]);
  });

  it('Delete confirms then removes each id on confirm', async () => {
    mockConfirm.mockResolvedValue(true);
    render(<Wrap ids={['a', 'b']} />);
    fireEvent.click(screen.getByLabelText(/delete selected/i));
    await waitFor(() => expect(mockRemove).toHaveBeenCalledTimes(2));
    expect(mockRemove).toHaveBeenCalledWith('a');
    expect(mockRemove).toHaveBeenCalledWith('b');
  });

  it('Delete does NOT remove when cancelled', async () => {
    mockConfirm.mockResolvedValue(false);
    render(<Wrap ids={['a']} />);
    fireEvent.click(screen.getByLabelText(/delete selected/i));
    await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('Move up calls moveBlock in document order', () => {
    render(<Wrap ids={['a', 'b']} />);
    fireEvent.click(screen.getByLabelText(/move selected blocks up/i));
    expect(mockMove.mock.calls).toEqual([['a', 'up'], ['b', 'up']]);
  });

  it('Move down calls moveBlock in reverse document order', () => {
    render(<Wrap ids={['a', 'b']} />);
    fireEvent.click(screen.getByLabelText(/move selected blocks down/i));
    expect(mockMove.mock.calls).toEqual([['b', 'down'], ['a', 'down']]);
  });

  it('renders nothing in preview mode even with selection', () => {
    const { container } = render(
      <TooltipProvider>
        <EditorModeProvider>
          <ForcePreview />
          <SectionSelectionProvider sectionIds={['a']}>
            <Seed ids={['a']} />
            <SelectionActionBar />
          </SectionSelectionProvider>
        </EditorModeProvider>
      </TooltipProvider>
    );
    expect(container.querySelector('[data-selection-bar]')).toBeNull();
  });
});
