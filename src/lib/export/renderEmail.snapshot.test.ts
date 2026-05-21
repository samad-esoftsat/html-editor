import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderEmail } from './renderEmail';
import { createDefaultProject } from '../editor/defaultProject';
import { createBlankProject } from '../editor/templates';

describe('renderEmail snapshot parity', () => {
  it('GlobalTT template renders byte-equal to baseline', () => {
    const baseline = readFileSync('src/lib/export/__fixtures__/baseline-globaltt.html', 'utf8');
    expect(renderEmail(createDefaultProject())).toBe(baseline);
  });

  it('Blank template renders byte-equal to baseline', () => {
    const baseline = readFileSync('src/lib/export/__fixtures__/baseline-blank.html', 'utf8');
    expect(renderEmail(createBlankProject())).toBe(baseline);
  });
});
