import { describe, it, expect } from 'vitest';
import tool from './mpegts-inspector.tool';

const TS_B64 =
  'R0AAEAAAsA0AAcEAAAAB4QAxxw9n////////////////////////////////////////////////' +
  '////////////////////////////////////////////////////////////////////////////' +
  '////////////////////////////////////////////////////////////////////////////' +
  '//////////////////////9HQQAQAAKwEgABwQAA4QDwABvhAfAAb/sOfP//////////////////' +
  '////////////////////////////////////////////////////////////////////////////' +
  '////////////////////////////////////////////////////////////////////////////' +
  '/////////////////////////////////////////////0dBAREAAAHgACWAgAUAAAFliBAREhMU' +
  'FRYXGBkaGxwdHh8gISIjJCUmJygpKissLS4v////////////////////////////////////////' +
  '////////////////////////////////////////////////////////////////////////////' +
  '////////////////////////////////////////////////////////////////////RwEBEgAA' +
  'AeAAJYCABQAAAWWIEBESExQVFhcYGRobHB0eHyAhIiMkJSYnKCkqKywtLi//////////////////' +
  '////////////////////////////////////////////////////////////////////////////' +
  '////////////////////////////////////////////////////////////////////////////' +
  '//////////////9HAQETAAAB4AAlgIAFAAABZYgQERITFBUWFxgZGhscHR4fICEiIyQlJicoKSor' +
  'LC0uL///////////////////////////////////////////////////////////////////////' +
  '////////////////////////////////////////////////////////////////////////////' +
  '/////////////////////////////////////0cBARQAAAHgACWAgAUAAAFliBAREhMUFRYXGBka' +
  'GxwdHh8gISIjJCUmJygpKissLS4v////////////////////////////////////////////////' +
  '////////////////////////////////////////////////////////////////////////////' +
  '////////////////////////////////////////////////////////////RwEBFQAAAeAAJYCA' +
  'BQAAAWWIEBESExQVFhcYGRobHB0eHyAhIiMkJSYnKCkqKywtLi//////////////////////////' +
  '////////////////////////////////////////////////////////////////////////////' +
  '////////////////////////////////////////////////////////////////////////////' +
  '//////8=' +
  '';

function b64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function fileOf(bytes: Uint8Array, name = 'x.ts'): File {
  const copy = new Uint8Array(bytes);
  return new File([copy.buffer as ArrayBuffer], name, { type: 'video/mp2t' });
}

async function tableOf(
  f: File,
  options: Record<string, string | number | boolean> = {},
): Promise<{ headers: string[]; rows: string[][] }> {
  const r = await tool.run({ files: [f], options });
  return JSON.parse(r.report?.output ?? '{"rows":[]}') as { headers: string[]; rows: string[][] };
}

describe('mpegts-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects a non-TS file', async () => {
    const bad = new Uint8Array(188);
    bad[0] = 0x00;
    await expect(tableOf(fileOf(bad, 'bad.bin'))).rejects.toThrow(/0x47/);
  });

  it('reads the summary view', async () => {
    const t = await tableOf(fileOf(b64(TS_B64)), { view: 'summary' });
    const m = new Map<string, string>(t.rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('File size')).toBe('1316 B');
    expect(m.get('Packets')).toBe('7');
    expect(m.get('Distinct PIDs')).toBe('3');
    expect(m.get('PAT')).toBe('present (PID 0)');
    expect(m.get('PMT PID')).toBe('0x0100');
    expect(m.get('Elementary streams')).toBe('2');
    expect(m.get('Continuity gaps')).toBe('0');
  });

  it('lists the PIDs', async () => {
    const t = await tableOf(fileOf(b64(TS_B64)), { view: 'pids' });
    expect(t.rows).toHaveLength(3);
    const pids = t.rows.map((r) => r[0] ?? '');
    expect(pids).toContain('0x0000');
    expect(pids).toContain('0x0100');
    expect(pids).toContain('0x0101');
  });

  it('walks the packets', async () => {
    const t = await tableOf(fileOf(b64(TS_B64)), { view: 'packets' });
    expect(t.rows).toHaveLength(7);
    expect(t.rows[0]?.[1]).toBe('0x0000');
    expect(t.rows[1]?.[1]).toBe('0x0100');
    expect(t.rows[2]?.[1]).toBe('0x0101');
  });
});
