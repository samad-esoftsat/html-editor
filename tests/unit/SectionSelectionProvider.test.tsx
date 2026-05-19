import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  SectionSelectionProvider,
  useSectionSelection,
} from '@/components/editor/SectionSelectionProvider';

function Probe({ sectionIds }: { sectionIds: string[] }) {
  const { selected, isSelected, toggle, clear } = useSectionSelection();
  return (
    <div>
      <span data-testid="size">{selected.size}</span>
      <span data-testid="set">{Array.from(selected).join(',')}</span>
      {sectionIds.map((id) => (
        <button key={id} onClick={(e) => toggle(id, e.shiftKey ? 'range' : 'single')}>
          {id}:{isSelected(id) ? '1' : '0'}
        </button>
      ))}
      <button onClick={clear}>clear</button>
    </div>
  );
}

describe('SectionSelectionProvider', () => {
  it('defaults to empty', () => {
    render(
      <SectionSelectionProvider sectionIds={['a', 'b']}>
        <Probe sectionIds={['a', 'b']} />
      </SectionSelectionProvider>
    );
    expect(screen.getByTestId('size').textContent).toBe('0');
  });

  it('single toggle adds and removes ids', () => {
    render(
      <SectionSelectionProvider sectionIds={['a', 'b', 'c']}>
        <Probe sectionIds={['a', 'b', 'c']} />
      </SectionSelectionProvider>
    );
    fireEvent.click(screen.getByText(/^a:/));
    expect(screen.getByTestId('size').textContent).toBe('1');
    fireEvent.click(screen.getByText(/^a:/));
    expect(screen.getByTestId('size').textContent).toBe('0');
  });

  it('range toggle selects inclusive range from anchor', () => {
    render(
      <SectionSelectionProvider sectionIds={['a', 'b', 'c', 'd']}>
        <Probe sectionIds={['a', 'b', 'c', 'd']} />
      </SectionSelectionProvider>
    );
    fireEvent.click(screen.getByText(/^a:/));
    fireEvent.click(screen.getByText(/^c:/), { shiftKey: true });
    const ids = screen.getByTestId('set').textContent ?? '';
    expect(ids.split(',').sort()).toEqual(['a', 'b', 'c']);
  });

  it('clear empties the set', () => {
    render(
      <SectionSelectionProvider sectionIds={['a', 'b']}>
        <Probe sectionIds={['a', 'b']} />
      </SectionSelectionProvider>
    );
    fireEvent.click(screen.getByText(/^a:/));
    fireEvent.click(screen.getByText('clear'));
    expect(screen.getByTestId('size').textContent).toBe('0');
  });

  it('prunes ids that disappear from sectionIds', () => {
    const { rerender } = render(
      <SectionSelectionProvider sectionIds={['a', 'b', 'c']}>
        <Probe sectionIds={['a', 'b', 'c']} />
      </SectionSelectionProvider>
    );
    fireEvent.click(screen.getByText(/^a:/));
    fireEvent.click(screen.getByText(/^b:/));
    rerender(
      <SectionSelectionProvider sectionIds={['b', 'c']}>
        <Probe sectionIds={['b', 'c']} />
      </SectionSelectionProvider>
    );
    const ids = screen.getByTestId('set').textContent ?? '';
    expect(ids).toBe('b');
  });
});
