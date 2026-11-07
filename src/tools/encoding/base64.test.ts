import { describe, it, expect } from 'vitest';
import tool from './base64.tool';

type Options = Record<string, string | number | boolean>;

/** Text path: no file, only typed or pasted text. */
const enc = (text: string, options: Options = {}) =>
  tool.run({ files: [], options: { mode: 'encode', ...options }, text });
const dec = (text: string, options: Options = {}) =>
  tool.run({ files: [], options: { mode: 'decode', ...options }, text });

/** File path: a file was dropped in. */
const encFile = (file: File, options: Options = {}) =>
  tool.run({ files: [file], options: { mode: 'encode', ...options } });
const decFile = (file: File, options: Options = {}) =>
  tool.run({ files: [file], options: { mode: 'decode', ...options } });

describe('base64 — text path', () => {
  it('encodes ASCII', async () => {
    const out = (await enc('hello world')).report as { output: string };
    expect(out.output).toBe('aGVsbG8gd29ybGQ=');
  });

  it('decodes ASCII', async () => {
    const out = (await dec('aGVsbG8gd29ybGQ=')).report as { output: string };
    expect(out.output).toBe('hello world');
  });

  it('round-trips UTF-8 / emoji', async () => {
    const s = 'I ❤ Tesserae — çà et là';
    const encoded = (await enc(s)).report as { output: string };
    const decoded = (await dec(encoded.output)).report as { output: string };
    expect(decoded.output).toBe(s);
  });

  it('produces URL-safe output without padding', async () => {
    const out = (await enc('<<???>>', { urlSafe: true })).report as { output: string };
    expect(out.output).not.toMatch(/[+/=]/);
    const back = (await dec(out.output)).report as { output: string };
    expect(back.output).toBe('<<???>>');
  });

  it('accepts URL-safe input on decode', async () => {
    const std = (await enc('subjects?_d=1')).report as { output: string };
    const url = std.output.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const back = (await dec(url)).report as { output: string };
    expect(back.output).toBe('subjects?_d=1');
  });

  it('ignores whitespace / newlines when decoding', async () => {
    const out = (await dec('aGVs\nbG8g\td29ybGQ=')).report as { output: string };
    expect(out.output).toBe('hello world');
  });

  it('wraps at 76 chars when asked', async () => {
    const out = (await enc('x'.repeat(120), { wrap: true })).report as { output: string };
    expect(out.output.split('\n')[0]).toHaveLength(76);
  });

  it('combines the URL-safe alphabet with MIME wrapping', async () => {
    const out = (await enc('x'.repeat(120), { urlSafe: true, wrap: true })).report as {
      output: string;
    };
    expect(out.output).not.toMatch(/[+/=]/);
    expect(out.output.split('\n')[0]).toHaveLength(76);
  });

  it('decodes unpadded Base64 (lenient)', async () => {
    const out = (await dec('aGVsbG8')).report as { output: string };
    expect(out.output).toBe('hello');
  });

  it('throws a ToolError on invalid base64', async () => {
    await expect(dec('not*valid*base64')).rejects.toThrow(/valid Base64/i);
  });

  it('flags output that is not valid UTF-8', async () => {
    // 0xff is not a legal UTF-8 byte: it decodes to a replacement character.
    const result = await dec('/w==');
    expect(result.notes?.join(' ')).toMatch(/replacement characters/i);
  });

  it('reports the stats as notes (the file workbench shows notes, not stats)', async () => {
    const result = await enc('hello world');
    expect(result.notes?.join(' ')).toMatch(/input bytes: 11/i);
    expect(result.notes?.join(' ')).toMatch(/output chars: 16/i);
  });

  it('returns no downloadable files for the text path', async () => {
    expect((await enc('hello world')).outputs).toEqual([]);
  });
});

describe('base64 — file path', () => {
  it('encodes binary file bytes and provides a downloadable text file', async () => {
    const file = new File([new Uint8Array([0, 1, 255])], 'data.bin');
    const result = await encFile(file);
    expect(result.report?.output).toBe('AAH/');
    expect(await result.outputs[0]!.blob.text()).toBe('AAH/');
    expect(result.outputs[0]!.filename).toBe('data.bin.base64.txt');
  });

  it('decodes Base64 and data URIs to bytes using a safe output name', async () => {
    const file = new File(['data:application/octet-stream;base64,AAH/'], 'encoded.txt');
    const result = await decFile(file, { outputName: '../payload.bin' });
    expect(result.outputs[0]!.filename).toBe('.._payload.bin');
    expect([...new Uint8Array(await result.outputs[0]!.blob.arrayBuffer())]).toEqual([0, 1, 255]);
  });

  it('uses the default output name when none is given', async () => {
    const file = new File(['AAH/'], 'encoded.txt');
    const result = await decFile(file);
    expect(result.outputs[0]!.filename).toBe('decoded.bin');
  });

  it('sanitises path separators out of the output name', async () => {
    const file = new File(['AAH/'], 'encoded.txt');
    const result = await decFile(file, { outputName: 'a\\b/c\0d.bin' });
    expect(result.outputs[0]!.filename).toBe('a_b_c_d.bin');
  });

  it('rejects invalid Base64 and missing files', async () => {
    await expect(decFile(new File(['a?'], 'bad.txt'))).rejects.toThrow(/invalid base64/i);
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/choose a file/i);
  });

  it('is strict about truncated Base64 (the text path is lenient)', async () => {
    await expect(decFile(new File(['aGVsbG8'], 'short.txt'))).rejects.toThrow(/invalid base64/i);
  });

  it('encodes an empty file to an empty Base64 string', async () => {
    const result = await encFile(new File([], 'empty.bin'));
    expect(result.report?.output).toBe('');
    expect(await result.outputs[0]!.blob.text()).toBe('');
    expect(result.outputs[0]!.filename).toBe('empty.bin.base64.txt');
  });

  it('rejects an empty file when decoding', async () => {
    await expect(decFile(new File([], 'empty.txt'))).rejects.toThrow(/invalid base64/i);
  });
});

describe('base64 — merged behaviour', () => {
  it('throws a clear error when there is no input at all', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/choose a file/i);
    await expect(tool.run({ files: [], options: {}, text: '' })).rejects.toThrow(/choose a file/i);
  });

  it('lets the file win over pasted text and says so', async () => {
    const file = new File([new Uint8Array([0, 1, 255])], 'data.bin');
    const result = await tool.run({
      files: [file],
      options: { mode: 'encode' },
      text: 'hello world',
    });
    expect(result.report?.output).toBe('AAH/');
    expect(result.notes?.join(' ')).toMatch(/pasted text was ignored/i);
  });

  it('encodes the pasted text when no file is chosen', async () => {
    const result = await tool.run({ files: [], options: { mode: 'encode' }, text: 'hello world' });
    expect(result.report?.output).toBe('aGVsbG8gd29ybGQ=');
    expect(result.notes?.join(' ')).not.toMatch(/ignored/i);
  });

  it('round-trips Unicode through a file', async () => {
    const s = 'I ❤ Tesserae — çà et là';
    const encoded = await encFile(new File([s], 'text.txt'));
    const decoded = await decFile(new File([encoded.report!.output], 'encoded.txt'));
    expect(await decoded.outputs[0]!.blob.text()).toBe(s);
  });

  it('keeps the merged metadata', () => {
    expect(tool.meta.id).toBe('base64');
    expect(tool.meta.input).toBe('file');
    expect(tool.meta.acceptsText).toBe(true);
    expect(tool.meta.category).toBe('encoding');
  });

  it('exposes every option with a default', () => {
    expect(tool.meta.options?.map((o) => o.key)).toEqual(['mode', 'urlSafe', 'wrap', 'outputName']);
    for (const option of tool.meta.options ?? []) {
      expect(option).toHaveProperty('default');
    }
  });
});
