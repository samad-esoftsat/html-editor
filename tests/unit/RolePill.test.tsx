import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RolePill } from '@/components/ui/RolePill';

describe('RolePill', () => {
  it('outlined variant has rule border + no fill', () => {
    const { getByText } = render(<RolePill>EDITOR</RolePill>);
    const el = getByText('EDITOR');
    expect(el.className).toMatch(/border-rule/);
    expect(el.className).not.toMatch(/bg-brand-soft/);
  });

  it('soft variant uses brand-soft fill', () => {
    const { getByText } = render(<RolePill variant="soft">YOU</RolePill>);
    expect(getByText('YOU').className).toMatch(/bg-brand-soft/);
  });
});
