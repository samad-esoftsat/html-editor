const REQUEST_KEY_RE = /^[A-Za-z0-9._-]{8,200}$/;

export function validateRequestKey(requestKey: string): string {
  const normalized = requestKey.trim();
  if (!REQUEST_KEY_RE.test(normalized)) {
    throw new Error('invalid_request_key');
  }
  return normalized;
}

export function createRequestKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `img_${crypto.randomUUID()}`;
  }
  return `img_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}
