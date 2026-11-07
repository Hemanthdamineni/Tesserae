import { describe, it, expect } from 'vitest';
import tool from './crx-inspector.tool';

const CRX_B64 =
  'Q3IyNAMAAAA7AAAAQ1JYMzYKNAoQn0+2jz4drIIgL5qlgc4LvxIgH8xZS3BsmUdt+g2MeHW7YANZ' +
  'qPv7F+wxChoRhVhp14VQSwMEFAAAAAgAj6VkXY9vRc5GAAAAVQAAAA0AAABtYW5pZmVzdC5qc29u' +
  'q1bKTczLTEstLokvSy0qzszPU7Iy0lHKS8xNVbJScknNzVdwrShJzQPL6CjB1SgZ6hnoGQBFUlKL' +
  'k4syC0ogoilADUq1AFBLAwQUAAAACACPpWRdZxbnrgwAAAAYAAAACgAAAGljb24xNi5wbmfrDPBz' +
  '5+WS4jJAAwBQSwECFAMUAAAACACPpWRdj29FzkYAAABVAAAADQAAAAAAAAAAAAAAgAEAAAAAbWFu' +
  'aWZlc3QuanNvblBLAQIUAxQAAAAIAI+lZF1nFueuDAAAABgAAAAKAAAAAAAAAAAAAACAAXEAAABp' +
  'Y29uMTYucG5nUEsFBgAAAAACAAIAcwAAAKUAAAAAAA==';
const ORACLE = {
  size: 373,
  version: 3,
  files: 2,
  hasManifest: true,
  manifestName: 'manifest.json',
  icon: 'icon16.png',
};

function fileOf(b64: string, name = 'ext.crx'): File {
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

describe('crx-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects a non-CRX file', async () => {
    const bad = new Uint8Array(30);
    bad[0] = 0x00;
    bad[1] = 0x01;
    bad[2] = 0x02;
    bad[3] = 0x03;
    const b64 = btoa(String.fromCharCode(...bad));
    await expect(tableOf(fileOf(b64, 'bad.bin'))).rejects.toThrow(/Chrome extension/i);
  });

  it('reads the summary', async () => {
    const t = await tableOf(fileOf(CRX_B64));
    const m = new Map<string, string>(t.rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('CRX version')).toBe(String(ORACLE.version));
    expect(m.get('CRX3 header')).toBe('valid');
    expect(m.get('ZIP payload')).toBe('intact');
    expect(m.get('Files')).toBe(String(ORACLE.files));
    expect(m.get('manifest.json')).toBe('present');
  });

  it('reads the header', async () => {
    const t = await tableOf(fileOf(CRX_B64), { format: 'header' });
    const flat = t.rows.map((r) => (r[0] ?? '') + '=' + (r[1] ?? '')).join('\n');
    expect(flat).toContain('Magic=Cr24 (valid)');
    expect(flat).toContain('Version=3');
    expect(flat).toContain('CRX3 magic=CRX3 (valid)');
    expect(flat).toContain('ZIP signature=PK (valid)');
  });

  it('lists the files inside', async () => {
    const t = await tableOf(fileOf(CRX_B64), { format: 'files' });
    expect(t.rows).toHaveLength(ORACLE.files);
    expect(t.rows[0]?.[0]).toBe(ORACLE.manifestName);
    expect(t.rows[1]?.[0]).toBe(ORACLE.icon);
  });
});
