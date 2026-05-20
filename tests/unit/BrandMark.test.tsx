import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BrandMark } from '@/components/ui/BrandMark';

describe('BrandMark', () => {
  it('renders an svg at the requested size', () => {
    const { container } = render(<BrandMark size={28} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('28');
    expect(svg.getAttribute('height')).toBe('28');
    expect(svg.getAttribute('aria-label')).toBe('GlobalTT');
  });

  it('renders an orange T inside an ink G square', () => {
    const { container } = render(<BrandMark size={28} />);
    expect(container.querySelector('[data-mark="g"]')).toBeTruthy();
    expect(container.querySelector('[data-mark="t"]')).toBeTruthy();
  });
});
