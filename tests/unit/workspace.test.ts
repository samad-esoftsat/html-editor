import { describe, expect, it } from 'vitest';
import { resolveMinRole } from '@/lib/auth/workspace';

describe('resolveMinRole', () => {
  it('allows owner to satisfy any minimum role', () => {
    expect(resolveMinRole('owner', 'viewer')).toBe(true);
    expect(resolveMinRole('owner', 'editor')).toBe(true);
    expect(resolveMinRole('owner', 'owner')).toBe(true);
  });

  it('blocks viewer from editor and owner requirements', () => {
    expect(resolveMinRole('viewer', 'viewer')).toBe(true);
    expect(resolveMinRole('viewer', 'editor')).toBe(false);
    expect(resolveMinRole('viewer', 'owner')).toBe(false);
  });

  it('allows editor for viewer and editor but not owner', () => {
    expect(resolveMinRole('editor', 'viewer')).toBe(true);
    expect(resolveMinRole('editor', 'editor')).toBe(true);
    expect(resolveMinRole('editor', 'owner')).toBe(false);
  });
});
