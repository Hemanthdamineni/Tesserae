import { describe, it, expect } from 'vitest';
import tool from './axml-inspector.tool';

const AXML_B64 =
  'AwAIADQBAAABABwAwAAAAAQAAAAAAAAAAAAAACwAAAAAAAAAAAAAABEAAAAgAAAAPwAAAAhtAGEA' +
  'bgBpAGYAZQBzAHQAB3AAYQBjAGsAYQBnAGUAD2MAbwBtAC4AZQB4AGEAbQBwAGwAZQAuAGEAcABw' +
  'ACpoAHQAdABwADoALwAvAHMAYwBoAGUAbQBhAHMALgBhAG4AZAByAG8AaQBkAC4AYwBvAG0ALwBh' +
  'AHAAawAvAHIAZQBzAC8AYQBuAGQAcgBvAGkAZAACAQgATAAAAAEAAAD/////AwAAAAAAAAAUABQA' +
  'AgD///////8DAAAAAQAAAAIAAAAIAAMAAAAAAP////8BAAAAAgAAAAgAAwAAAAAAAwEIABgAAAAB' +
  'AAAA/////wMAAAAAAAAABQEIAAgAAAA=' +
  '';

const ORACLE = {
  size: 308,
  strings: ['manifest', 'package', 'com.example.app', 'http://schemas.android.com/apk/res/android'],
  stringCount: 4,
  elements: 1,
  attributes: 2,
};

function b64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function fileOf(bytes: Uint8Array, name = 'x.axml'): File {
  const copy = new Uint8Array(bytes);
  return new File([copy.buffer as ArrayBuffer], name, { type: 'application/xml' });
}

async function tableOf(
  f: File,
  options: Record<string, string | number | boolean> = {},
): Promise<{ headers: string[]; rows: string[][] }> {
  const r = await tool.run({ files: [f], options });
  return JSON.parse(r.report?.output ?? '{"rows":[]}') as { headers: string[]; rows: string[][] };
}

describe('axml-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects a non-AXML file', async () => {
    await expect(tableOf(fileOf(new Uint8Array(30), 'bad.bin'))).rejects.toThrow(/RES_XML_TYPE/);
  });

  it('reads the summary view', async () => {
    const t = await tableOf(fileOf(b64(AXML_B64)), { view: 'summary' });
    const m = new Map<string, string>(t.rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('File size')).toBe('308 B');
    expect(m.get('String pool count')).toBe('4');
    expect(m.get('Elements')).toBe('1');
    expect(m.get('Attributes')).toBe('2');
    expect(m.get('Namespaces')).toBe('0');
    expect(m.get('Last chunk')).toBe('present');
  });

  it('decodes the string pool', async () => {
    const t = await tableOf(fileOf(b64(AXML_B64)), { view: 'strings' });
    const got = t.rows.map((r) => r[1] ?? '');
    expect(got).toEqual(ORACLE.strings);
  });

  it('walks the element chunks', async () => {
    const t = await tableOf(fileOf(b64(AXML_B64)), { view: 'chunks' });
    expect(t.rows).toHaveLength(3);
    expect(t.rows[0]?.[1]).toBe('element start');
    expect(t.rows[0]?.[2]).toContain('manifest');
    expect(t.rows[0]?.[2]).toContain('(2 attr)');
    expect(t.rows[1]?.[1]).toBe('element end');
    expect(t.rows[2]?.[1]).toBe('XML last');
  });
});
