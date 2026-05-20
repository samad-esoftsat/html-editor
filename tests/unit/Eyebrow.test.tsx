import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Eyebrow } from '@/components/ui/Eyebrow';

describe('Eyebrow', () => {
  it('renders uppercase tracked text', () => {
    const { getByText } = render(<Eyebrow>workspace</Eyebrow>);
    const el = getByText(/workspace/i);
    expect(el.className).toMatch(/uppercase/);
    expect(el.className).toMatch(/tracking-\[0\.22em\]/);
  });
});
