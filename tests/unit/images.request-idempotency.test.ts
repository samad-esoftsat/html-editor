import { describe, expect, it } from 'vitest';
import { createRequestKey, validateRequestKey } from '@/lib/images/request-key';

describe('request key helpers', () => {
  it('creates prefixed request keys', () => {
    expect(createRequestKey()).toMatch(/^img_/);
  });

  it('accepts normalized safe request keys', () => {
    expect(validateRequestKey('img_abc12345')).toBe('img_abc12345');
    expect(validateRequestKey(' request-key_123456 ')).toBe('request-key_123456');
  });

  it('rejects invalid request keys', () => {
    expect(() => validateRequestKey('short')).toThrow('invalid_request_key');
    expect(() => validateRequestKey('contains space')).toThrow('invalid_request_key');
  });
});
