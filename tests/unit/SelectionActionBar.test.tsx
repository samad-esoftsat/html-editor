import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { SelectionActionBar } from '@/components/editor/canvas/SelectionActionBar';
import {
  SectionSelectionProvider,
  useSectionSelection,
} from '@/components/editor/SectionSelectionProvider';
import { EditorModeProvider, useEditorMode } from '@/components/editor/EditorModeProvider';

const mockDuplicate = vi.fn();
const mockRemove = vi.fn();
const mockMove = vi.fn();
const fakeSections = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
vi.mock('@/lib/editor/StoreProvider', () => ({
  useEditorStore: () => ({
    getState: () => ({
      duplicateSection: mockDuplicate,
      removeSection: mockRemove,
      moveSection: mockMove,
      data: { sections: fakeSections },
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
    <EditorModeProvider>
      <SectionSelectionProvider sectionIds={sectionIds}>
        <Seed ids={ids} />
        <SelectionActionBar />
      </SectionSelectionProvider>
    </EditorModeProvider>
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
    expect(screen.getByLabelText(/move selected sections up/i)).toBeTruthy();
    expect(screen.getByLabelText(/move selected sections down/i)).toBeTruthy();
    expect(screen.getByLabelText(/clear selection/i)).toBeTruthy();
  });

  it('Duplicate calls duplicateSection for each selected id in store order', () => {
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

  it('Move up calls moveSection in document order', () => {
    render(<Wrap ids={['a', 'b']} />);
    fireEvent.click(screen.getByLabelText(/move selected sections up/i));
    expect(mockMove.mock.calls).toEqual([['a', 'up'], ['b', 'up']]);
  });

  it('Move down calls moveSection in reverse document order', () => {
    render(<Wrap ids={['a', 'b']} />);
    fireEvent.click(screen.getByLabelText(/move selected sections down/i));
    expect(mockMove.mock.calls).toEqual([['b', 'down'], ['a', 'down']]);
  });

  it('renders nothing in preview mode even with selection', () => {
    const { container } = render(
      <EditorModeProvider>
        <ForcePreview />
        <SectionSelectionProvider sectionIds={['a']}>
          <Seed ids={['a']} />
          <SelectionActionBar />
        </SectionSelectionProvider>
      </EditorModeProvider>
    );
    expect(container.querySelector('[data-selection-bar]')).toBeNull();
  });
});
