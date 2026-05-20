import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SettingsNav } from '@/components/ui/SettingsNav';

describe('SettingsNav', () => {
  const items = [
    { href: '/g', label: 'General' },
    { href: '/m', label: 'Members' },
    { href: '/k', label: 'Brand kits' },
  ];

  it('marks the active item with brand-soft pill', () => {
    const { getByText } = render(<SettingsNav items={items} activeHref="/m" />);
    const members = getByText('Members').closest('a')!;
    expect(members.getAttribute('data-active')).toBe('true');
    expect(members.className).toMatch(/bg-brand-soft/);
    const general = getByText('General').closest('a')!;
    expect(general.getAttribute('data-active')).toBe('false');
  });
});
