export class ProviderError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 502, code = 'provider_error') {
    super(message);
    this.name = 'ProviderError';
    this.status = status;
    this.code = code;
  }
}

export function asProviderError(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  if (error instanceof Error) return new ProviderError(error.message);
  return new ProviderError('Provider unavailable.');
}
