import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatusBadge } from '@/components/ui/StatusBadge';

describe('StatusBadge', () => {
  it('renders the label in mono', () => {
    const { getByText } = render(<StatusBadge tone="saved">Saved · 2s ago</StatusBadge>);
    const el = getByText('Saved · 2s ago');
    expect(el.className).toMatch(/font-mono/);
  });

  it('renders a colored dot per tone', () => {
    const { container } = render(<StatusBadge tone="pending">Pending…</StatusBadge>);
    const dot = container.querySelector('[data-dot]') as HTMLElement;
    expect(dot).toBeTruthy();
    expect(dot.getAttribute('data-tone')).toBe('pending');
  });
});
