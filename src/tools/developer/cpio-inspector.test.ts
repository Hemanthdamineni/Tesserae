import { describe, it, expect } from 'vitest';
import tool from './cpio-inspector.tool';

const CPIO_B64 =
  'MDcwNzAxMDAwMDAwMDEwMDAwODFhNDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMTY1NTNmMTAwMDAw' +
  'MDAwMGIwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDBhMDAwMDAwMDBoZWxs' +
  'by50eHQAAABIZWxsbyBjcGlvCgAwNzA3MDEwMDAwMDAwMjAwMDA0MWVkMDAwMDAwMDAwMDAwMDAw' +
  'MDAwMDAwMDAxNjU1M2YxMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAw' +
  'MDAwMDAwMDUwMDAwMDAwMGRpci8AAAAAMDcwNzAxMDAwMDAwMDMwMDAwODFhNDAwMDAwMDAwMDAw' +
  'MDAwMDAwMDAwMDAwMTY1NTNmMTAwMDAwMDAwMDgwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAw' +
  'MDAwMDAwMDAwMDBkMDAwMDAwMDBkaXIvZGF0YS5iaW4AAAAAAAECAwQFBgcwNzA3MDEwMDAwMDAw' +
  'MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAw' +
  'MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMGIwMDAwMDAwMFRSQUlMRVIhISEAAA==';

const ORACLE = {
  format: 'cpio (newc (SVR4))',
  magic: '070701',
  entries: 3,
  hello: 'hello.txt',
  dir: 'dir/',
  data: 'dir/data.bin',
};

function fileOf(b64: string, name = 'archive.cpio'): File {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new File([bytes.buffer as ArrayBuffer], name, { type: 'application/octet-stream' });
}

async function tableOf(
  f: File,
  options: Record<string, string | number | boolean> = {},
): Promise<{ headers: string[]; rows: string[][] }> {
  const r = await tool.run({ files: [f], options });
  return JSON.parse(r.report?.output ?? '{"rows":[]}') as { headers: string[]; rows: string[][] };
}

describe('cpio-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects a non-cpio file', async () => {
    const bad = new Uint8Array(30);
    bad[0] = 0x00;
    bad[1] = 0x01;
    bad[2] = 0x02;
    bad[3] = 0x03;
    const b64 = btoa(String.fromCharCode(...bad));
    await expect(tableOf(fileOf(b64, 'bad.bin'))).rejects.toThrow(/cpio archive/i);
  });

  it('reads the summary', async () => {
    const t = await tableOf(fileOf(CPIO_B64));
    const m = new Map<string, string>(t.rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('Format')).toBe(ORACLE.format);
    expect(m.get('Magic')).toBe(ORACLE.magic);
    expect(m.get('Entries')).toBe(String(ORACLE.entries));
    expect(m.get('Trailer')).toBe('present');
  });

  it('lists the entries', async () => {
    const t = await tableOf(fileOf(CPIO_B64), { format: 'entries' });
    expect(t.rows).toHaveLength(ORACLE.entries);
    expect(t.rows[0]?.[0]).toBe(ORACLE.hello);
    expect(t.rows[1]?.[0]).toBe(ORACLE.dir);
    expect(t.rows[2]?.[0]).toBe(ORACLE.data);
  });

  it('shows entry types', async () => {
    const t = await tableOf(fileOf(CPIO_B64), { format: 'entries' });
    expect(t.rows[0]?.[1]).toBe('Regular file');
    expect(t.rows[1]?.[1]).toBe('Directory');
  });
});
