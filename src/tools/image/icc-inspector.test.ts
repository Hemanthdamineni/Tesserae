import { describe, it, expect } from 'vitest';
import tool from './icc-inspector.tool';

const ICC_B64 =
  'AAAAzGxjbXMEMAAAbW50clJHQiBMYWIgB+gAAQAPAAoAHgAAYWNzcEFQUEwAAAAAQUNNRURJU1AA' +
  'AAAAAAAAAAAAAAEAAPbWAAEAAAAA0y1sY21zAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAADZGVzYwAAAKgAAAAMd3RwdAAAALQAAAAMclhZWgAAAMAAAAAMRGVt' +
  'byBEaXNwbGF5AAD21gABAAAAANMtAAFCEAAALosAAAIR';
const ORACLE = {
  size: 204,
  version: '4.3',
  className: 'Display device (monitor)',
  space: 'RGB',
  pcs: 'Lab',
  intent: 'Media-relative colorimetric',
  tags: 3,
  platform: 'APPL',
};

function fileOf(b64: string, name = 'profile.icc'): File {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new File([bytes.buffer as ArrayBuffer], name, { type: 'application/vnd.iccprofile' });
}

async function tableOf(
  f: File,
  options: Record<string, string | number | boolean> = {},
): Promise<{ headers: string[]; rows: string[][] }> {
  const r = await tool.run({ files: [f], options });
  return JSON.parse(r.report?.output ?? '{"rows":[]}') as { headers: string[]; rows: string[][] };
}

describe('icc-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects a non-ICC file', async () => {
    const bad = new Uint8Array(130);
    bad[0] = 0x00;
    bad[1] = 0x01;
    bad[2] = 0x02;
    bad[3] = 0x03;
    const b64 = btoa(String.fromCharCode(...bad));
    await expect(tableOf(fileOf(b64, 'bad.bin'))).rejects.toThrow(/acsp|ICC/i);
  });

  it('reads the summary', async () => {
    const t = await tableOf(fileOf(ICC_B64));
    const m = new Map<string, string>(t.rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('Size')).toContain(String(ORACLE.size));
    expect(m.get('Version')).toBe(ORACLE.version);
    expect(m.get('Device class')).toBe(ORACLE.className);
    expect(m.get('Data color space')).toBe(ORACLE.space);
    expect(m.get('Connection space (PCS)')).toBe(ORACLE.pcs);
    expect(m.get('Rendering intent')).toBe(ORACLE.intent);
    expect(m.get('Tags')).toBe(String(ORACLE.tags));
  });

  it('reads the header', async () => {
    const t = await tableOf(fileOf(ICC_B64), { format: 'header' });
    const flat = t.rows.map((r) => (r[0] ?? '') + '=' + (r[1] ?? '')).join('\n');
    expect(flat).toContain('acsp signature=valid');
    expect(flat).toContain('Platform=' + ORACLE.platform);
    expect(flat).toContain('Manufacturer=ACME');
    expect(flat).toContain('Device model=DISP');
  });

  it('lists the tags', async () => {
    const t = await tableOf(fileOf(ICC_B64), { format: 'tags' });
    expect(t.rows).toHaveLength(ORACLE.tags);
    expect(t.rows[0]?.[0]).toBe('desc');
    expect(t.rows[0]?.[1]).toBe('Profile description');
    expect(t.rows[1]?.[0]).toBe('wtpt');
    expect(t.rows[2]?.[0]).toBe('rXYZ');
  });
});
