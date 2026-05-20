import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SwatchChip } from '@/components/ui/SwatchChip';

describe('SwatchChip', () => {
  it('renders the color as inline background', () => {
    const { container } = render(<SwatchChip color="#F1592A" />);
    const tile = container.querySelector('[data-swatch]') as HTMLElement;
    expect(tile.style.backgroundColor).toBe('rgb(241, 89, 42)');
  });

  it('renders an uppercased hex caption when showHex', () => {
    const { getByText } = render(<SwatchChip color="#abcdef" showHex />);
    expect(getByText('#ABCDEF')).toBeTruthy();
  });
});
