import { describe, it, expect } from 'vitest';
import tool from './asar-inspector.tool';

const ASAR_B64 =
  'eQAAAHUAAAB7ImZpbGVzIjogeyJhcHAuanMiOiB7InNpemUiOiAxOCwgIm9mZnNldCI6ICIwIn0s' +
  'ICJzdWJkaXIiOiB7ImZpbGVzIjogeyJyZWFkbWUudHh0IjogeyJzaXplIjogMTcsICJvZmZzZXQi' +
  'OiAiMTgifX19fX1jb25zb2xlLmxvZygiaGkiKTtoZWxsbyBhc2FyIHJlYWRtZQ==';

const ORACLE = {
  headerSize: 121,
  files: 2,
  app: 'app.js',
  appSize: '18 B',
  readme: 'subdir/readme.txt',
  readmeSize: '17 B',
};

function fileOf(b64: string, name = 'app.asar'): File {
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

describe('asar-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects a non-ASAR file', async () => {
    const bad = new Uint8Array(30);
    bad[0] = 0x00;
    bad[1] = 0x01;
    bad[2] = 0x02;
    bad[3] = 0x03;
    const b64 = btoa(String.fromCharCode(...bad));
    await expect(tableOf(fileOf(b64, 'bad.bin'))).rejects.toThrow(/ASAR/i);
  });

  it('reads the summary', async () => {
    const t = await tableOf(fileOf(ASAR_B64));
    const m = new Map<string, string>(t.rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('Format')).toBe('ASAR (Electron archive)');
    expect(m.get('Header size')).toBe(String(ORACLE.headerSize) + ' bytes');
    expect(m.get('Files')).toBe(String(ORACLE.files));
  });

  it('lists the files with offsets', async () => {
    const t = await tableOf(fileOf(ASAR_B64), { format: 'files' });
    expect(t.rows).toHaveLength(ORACLE.files);
    expect(t.rows[0]?.[0]).toBe(ORACLE.app);
    expect(t.rows[0]?.[1]).toBe(ORACLE.appSize);
    expect(t.rows[0]?.[2]).toBe('0');
    expect(t.rows[1]?.[0]).toBe(ORACLE.readme);
    expect(t.rows[1]?.[1]).toBe(ORACLE.readmeSize);
    expect(t.rows[1]?.[2]).toBe('18');
  });

  it('reads the header view', async () => {
    const t = await tableOf(fileOf(ASAR_B64), { format: 'header' });
    const flat = t.rows.map((r) => (r[0] ?? '') + '=' + (r[1] ?? '')).join('\n');
    expect(flat).toContain('Header size=' + String(ORACLE.headerSize));
    expect(flat).toContain('Files=' + String(ORACLE.files));
  });
});
