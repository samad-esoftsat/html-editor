import { describe, expect, it } from 'vitest';
import { resolveDuplicateName } from '@/lib/api/duplicate-name';

describe('resolveDuplicateName', () => {
  it('uses the trimmed requested name when non-empty', () => {
    expect(resolveDuplicateName('  Hello  ', 'Original')).toBe('Hello');
  });

  it('falls back to "<source> (copy)" when name is missing', () => {
    expect(resolveDuplicateName(undefined, 'Original')).toBe('Original (copy)');
  });

  it('falls back when name is an empty or whitespace string', () => {
    expect(resolveDuplicateName('', 'Original')).toBe('Original (copy)');
    expect(resolveDuplicateName('   ', 'Original')).toBe('Original (copy)');
  });

  it('falls back when name is a non-string value', () => {
    expect(resolveDuplicateName(123 as unknown, 'Original')).toBe('Original (copy)');
    expect(resolveDuplicateName(null, 'Original')).toBe('Original (copy)');
  });

  it('caps the requested name at 200 characters', () => {
    expect(resolveDuplicateName('a'.repeat(250), 'Original').length).toBe(200);
  });
});
