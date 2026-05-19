// tests/unit/SectionInsertBar.test.tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { SectionInsertBar } from '@/components/editor/canvas/SectionInsertBar';
import { EditorModeProvider, useEditorMode } from '@/components/editor/EditorModeProvider';

const mockAddSection = vi.fn();
vi.mock('@/lib/editor/StoreProvider', () => ({
  useEditorStore: () => ({
    getState: () => ({ addSection: mockAddSection }),
  }),
}));

function ForcePreview() {
  const { setMode } = useEditorMode();
  React.useEffect(() => { setMode('preview'); }, [setMode]);
  return null;
}

describe('SectionInsertBar', () => {
  beforeEach(() => { mockAddSection.mockClear(); });

  it('renders an Add section button', () => {
    render(<EditorModeProvider><SectionInsertBar atIndex={0} /></EditorModeProvider>);
    expect(screen.getByLabelText('Add section')).toBeTruthy();
  });

  it('calls addSection with the given index when clicked', () => {
    render(<EditorModeProvider><SectionInsertBar atIndex={2} /></EditorModeProvider>);
    fireEvent.click(screen.getByLabelText('Add section'));
    expect(mockAddSection).toHaveBeenCalledWith(2);
  });

  it('renders nothing in preview mode', () => {
    const { container } = render(
      <EditorModeProvider>
        <ForcePreview />
        <SectionInsertBar atIndex={0} />
      </EditorModeProvider>
    );
    expect(container.querySelector('button[aria-label="Add section"]')).toBeNull();
  });
});
