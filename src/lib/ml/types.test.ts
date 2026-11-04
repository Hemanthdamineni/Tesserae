import { describe, expect, it } from 'vitest';
import { createAbortError, isAbortError, throwIfAborted } from './types';

describe('abort helpers', () => {
  it('creates a DOM AbortError', () => {
    const error = createAbortError('stopped');
    expect(error.name).toBe('AbortError');
    expect(error.message).toBe('stopped');
    expect(isAbortError(error)).toBe(true);
  });

  it('falls back to a named Error when DOMException is unavailable', () => {
    const original = globalThis.DOMException;
    // @ts-expect-error — deliberately remove the global to exercise the fallback.
    delete globalThis.DOMException;
    try {
      const error = createAbortError();
      expect(error.name).toBe('AbortError');
      expect(error).toBeInstanceOf(Error);
      expect(isAbortError(error)).toBe(true);
    } finally {
      globalThis.DOMException = original;
    }
  });

  it('does not classify unrelated errors as aborts', () => {
    expect(isAbortError(new Error('nope'))).toBe(false);
    expect(isAbortError(null)).toBe(false);
    expect(isAbortError('AbortError')).toBe(false);
  });

  it('throws only for an aborted signal', () => {
    expect(() => throwIfAborted(undefined)).not.toThrow();
    expect(() => throwIfAborted(new AbortController().signal)).not.toThrow();

    const controller = new AbortController();
    controller.abort();
    expect(() => throwIfAborted(controller.signal)).toThrow(
      expect.objectContaining({ name: 'AbortError' }),
    );
  });
});
