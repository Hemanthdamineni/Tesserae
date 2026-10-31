import { describe, it, expect } from 'vitest';
import tool from './wasm-inspector.tool';

const WASM_B64 =
  'AGFzbQEAAAABCAEGYAJ/fwF/AwIBAAUFAQEBAQIHBwEDYWRkAAAKCQEHACAAIAFqCwAMBG5hbWUBAQADYWRk';

const WASM_ORACLE: [number, number, string, number][] = [
  [8, 1, 'type', 8],
  [18, 3, 'function', 2],
  [22, 5, 'memory', 5],
  [29, 7, 'export', 7],
  [38, 10, 'code', 9],
  [49, 0, 'custom', 12],
];

const WASM_HEADER = { version: 1, size: 63, sections: 6 };

const META = tool.meta;

function b64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function fileOf(bytes: Uint8Array, name = 'x.wasm'): File {
  const copy = new Uint8Array(bytes);
  return new File([copy.buffer as ArrayBuffer], name, { type: 'application/wasm' });
}

async function rowsOf(
  f: File,
  options: Record<string, string | number | boolean> = {},
): Promise<string[][]> {
  const r = await tool.run({ files: [f], options });
  const parsed = JSON.parse(r.report?.output ?? '{"rows":[]}');
  return (parsed.rows ?? []) as string[][];
}

describe('wasm-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(META.privacy.processing).toBe('on-device');
    expect(META.privacy.network).toBe('none');
    expect(META.privacy.offline).toBe(true);
  });

  it('matches the Python-oracle section tree of the synthetic module', async () => {
    const rows = await rowsOf(fileOf(b64(WASM_B64), 'm.wasm'));
    const got = rows.map((r) => [Number(r[0]), Number(r[1]), r[2] ?? '', Number(r[3])]);
    expect(got).toEqual(WASM_ORACLE);
  });

  it('reads the header into the summary view', async () => {
    const rows = await rowsOf(fileOf(b64(WASM_B64), 'm.wasm'), { view: 'summary' });
    const m = new Map<string, string>(rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('Version')).toBe(String(WASM_HEADER.version));
    expect(m.get('Magic')).toBe('valid (0x00 61 73 6D)');
    expect(m.get('Sections')).toBe(String(WASM_HEADER.sections));
    expect(m.get('Custom sections')).toBe('1');
    expect(m.get('Code sections')).toBe('1');
  });

  it('decodes section details (export/code/custom)', async () => {
    const rows = await rowsOf(fileOf(b64(WASM_B64), 'm.wasm'));
    const exp = rows.find((r) => r[2] === 'export');
    expect(exp?.[4]).toBe('1 export(s)');
    const code = rows.find((r) => r[2] === 'code');
    expect(code?.[4]).toBe('1 code body(ies)');
    const custom = rows.find((r) => r[2] === 'custom');
    expect(custom?.[4]).toBe('custom: name');
  });

  it('flags a bad magic header', async () => {
    const rows = await rowsOf(fileOf(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), 'bad.wasm'), {
      view: 'findings',
    });
    expect(rows.some((r) => r[1] === 'magic')).toBe(true);
  });

  it('throws a user-facing error when no file is given', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/WebAssembly/);
  });
});
