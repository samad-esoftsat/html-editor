import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PageMasthead } from '@/components/ui/PageMasthead';

describe('PageMasthead', () => {
  it('renders eyebrow, title, italic accent, and subtitle', () => {
    const { getByText, container } = render(
      <PageMasthead
        eyebrow="Workspace"
        title="My"
        italicWord="projects"
        subtitle="12 projects · last updated 4 hours ago"
      />
    );
    expect(getByText('WORKSPACE')).toBeTruthy();
    expect(getByText('My')).toBeTruthy();
    const italic = getByText('projects');
    expect(italic.tagName.toLowerCase()).toBe('em');
    expect(getByText(/12 projects/)).toBeTruthy();
    expect(container.querySelector('[data-masthead-rule]')).toBeTruthy();
  });
});
