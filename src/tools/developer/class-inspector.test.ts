import { describe, it, expect } from 'vitest';
import tool from './class-inspector.tool';

const CLASS_B64 = 'yv66vgAAADQABwoABQAGCAADAQAFSGVsbG8BAARDb2RlBwADDAADAAQAIQAFAAAAAAAAAAA=';

const CLASS_HEADER = {
  size: 53,
  minor: 0,
  major: 52,
  cp_count: 7,
  access: 33,
  this_idx: 5,
  super_idx: 0,
  iface_count: 0,
};
const CLASS_CP: [number, string, string][] = [
  [1, 'Methodref', '#5.#6'],
  [2, 'String', '#3'],
  [3, 'Utf8', 'Hello'],
  [4, 'Utf8', 'Code'],
  [5, 'Class', '#3'],
  [6, 'NameAndType', '#3.#4'],
];

const META = tool.meta;

function b64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function fileOf(bytes: Uint8Array, name = 'x.class'): File {
  const copy = new Uint8Array(bytes);
  return new File([copy.buffer as ArrayBuffer], name, { type: 'application/java-vm' });
}

async function rowsOf(
  f: File,
  options: Record<string, string | number | boolean> = {},
): Promise<string[][]> {
  const r = await tool.run({ files: [f], options });
  const parsed = JSON.parse(r.report?.output ?? '{"rows":[]}');
  return (parsed.rows ?? []) as string[][];
}

describe('class-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(META.privacy.processing).toBe('on-device');
    expect(META.privacy.network).toBe('none');
    expect(META.privacy.offline).toBe(true);
  });

  it('reads the header into the summary view', async () => {
    const rows = await rowsOf(fileOf(b64(CLASS_B64), 'Demo.class'), { view: 'summary' });
    const m = new Map<string, string>(rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('File size')).toBe(String(CLASS_HEADER.size) + ' B');
    expect(m.get('Magic')).toBe('CAFEBABE (valid)');
    expect(m.get('Version')).toBe(String(CLASS_HEADER.major) + '.' + String(CLASS_HEADER.minor));
    expect(m.get('Constant-pool count')).toBe(String(CLASS_HEADER.cp_count));
    expect(m.get('This class')).toBe('#' + String(CLASS_HEADER.this_idx));
    expect(m.get('Super class')).toBe('#' + String(CLASS_HEADER.super_idx));
  });

  it('matches the Python-oracle constant pool in order', async () => {
    const rows = await rowsOf(fileOf(b64(CLASS_B64), 'Demo.class'), { view: 'constant-pool' });
    const got = rows.map((r) => [Number(r[0]), r[1], r[2]]);
    expect(got).toEqual(CLASS_CP);
  });

  it('decodes access flags', async () => {
    const rows = await rowsOf(fileOf(b64(CLASS_B64), 'Demo.class'), { view: 'summary' });
    const m = new Map<string, string>(rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('Access flags')).toBe('public, super');
  });

  it('flags a bad magic', async () => {
    const rows = await rowsOf(fileOf(new Uint8Array([1, 2, 3, 4]), 'bad.class'), {
      view: 'findings',
    });
    expect(rows.some((r) => r[1] === 'magic')).toBe(true);
  });

  it('throws a user-facing error when no file is given', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/class/);
  });
});
