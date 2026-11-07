import { describe, expect, it } from 'vitest';
import { MAX_FILE_COUNT, readAsText, sanitizeZipEntryNames, validateFileSelection } from './files';

describe('sanitizeZipEntryNames', () => {
  it('normalizes unsafe names and preserves duplicate entries', () => {
    expect(
      sanitizeZipEntryNames([
        '../secret.txt',
        '/absolute.txt',
        'folder/../safe.txt',
        'safe.txt',
        'safe.txt',
      ]),
    ).toEqual(['secret.txt', 'absolute.txt', 'safe.txt', 'safe-2.txt', 'safe-3.txt']);
  });
});

describe('validateFileSelection', () => {
  it('rejects too many files', () => {
    const tooMany = Array.from(
      { length: MAX_FILE_COUNT + 1 },
      (_, i) => new File(['x'], `file-${i}.txt`),
    );
    expect(validateFileSelection(tooMany)).toMatch(/at most/i);
  });

  it('does not impose a shared total-byte ceiling', () => {
    const large = new File(['x'], 'large.bin');
    Object.defineProperty(large, 'size', { value: 200 * 1024 * 1024 });
    expect(validateFileSelection([large])).toBeNull();
  });

  it('accepts a normal selection', () => {
    expect(validateFileSelection([new File(['ok'], 'ok.txt')])).toBeNull();
  });
});

describe('abortable file readers', () => {
  it('rejects immediately when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(readAsText(new Blob(['text']), 'utf-8', controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});
