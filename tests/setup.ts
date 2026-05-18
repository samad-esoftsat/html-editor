import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});

// jsdom does not implement DataTransfer; provide a minimal polyfill for tests.
if (typeof DataTransfer === 'undefined') {
  class DataTransferPolyfill {
    private _data: Record<string, string> = {};
    setData(format: string, data: string) { this._data[format] = data; }
    getData(format: string) { return this._data[format] ?? ''; }
    clearData(format?: string) {
      if (format) { delete this._data[format]; } else { this._data = {}; }
    }
  }
  (globalThis as unknown as Record<string, unknown>).DataTransfer = DataTransferPolyfill;
}
