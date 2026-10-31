import { describe, it, expect } from 'vitest';
import tool from './eml-inspector.tool';

const EML_B64 =
  'RnJvbTogc2VuZGVyQGV4YW1wbGUuY29tClRvOiByZWNpcGllbnRAZXhhbXBsZS5jb20KU3ViamVj' +
  'dDogVGVzdCBtZXNzYWdlIDQzOQpEYXRlOiBNb24sIDMxIE9jdCAyMDI2IDEwOjAwOjAwICswMDAw' +
  'Ck1JTUUtVmVyc2lvbjogMS4wCkNvbnRlbnQtVHlwZTogbXVsdGlwYXJ0L21peGVkOyBib3VuZGFy' +
  'eT0iQk9VTkQ0MzkiCgotLUJPVU5ENDM5CkNvbnRlbnQtVHlwZTogdGV4dC9wbGFpbjsgY2hhcnNl' +
  'dD11dGYtOApDb250ZW50LVRyYW5zZmVyLUVuY29kaW5nOiBiYXNlNjQKClNHVnNiRzhnVjI5eWJH' +
  'UT0KLS1CT1VORDQzOQpDb250ZW50LVR5cGU6IGFwcGxpY2F0aW9uL29jdGV0LXN0cmVhbTsgbmFt' +
  'ZT0iZGF0YS5iaW4iCkNvbnRlbnQtVHJhbnNmZXItRW5jb2Rpbmc6IGJhc2U2NApDb250ZW50LURp' +
  'c3Bvc2l0aW9uOiBhdHRhY2htZW50OyBmaWxlbmFtZT0iZGF0YS5iaW4iCgpBQUVDQXdRPQotLUJP' +
  'VU5ENDM5LS0K' +
  '';

const ORACLE = {
  size: 465,
  from: 'sender@example.com',
  to: 'recipient@example.com',
  subject: 'Test message 439',
  date: 'Mon, 31 Oct 2026 10:00:00 +0000',
  contentType: 'multipart/mixed',
  parts: 2,
  part1Type: 'text/plain',
  part2Type: 'application/octet-stream',
  part2Filename: 'data.bin',
};

function b64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function fileOf(bytes: Uint8Array, name = 'x.eml'): File {
  const copy = new Uint8Array(bytes);
  return new File([copy.buffer as ArrayBuffer], name, { type: 'message/rfc822' });
}

async function tableOf(
  f: File,
  options: Record<string, string | number | boolean> = {},
): Promise<{ headers: string[]; rows: string[][] }> {
  const r = await tool.run({ files: [f], options });
  return JSON.parse(r.report?.output ?? '{"rows":[]}') as { headers: string[]; rows: string[][] };
}

describe('eml-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('reads the overview from the fixture', async () => {
    const t = await tableOf(fileOf(b64(EML_B64)), { view: 'overview' });
    const m = new Map<string, string>(t.rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('From')).toBe(ORACLE.from);
    expect(m.get('To')).toBe(ORACLE.to);
    expect(m.get('Subject')).toBe(ORACLE.subject);
    expect(m.get('Date')).toBe(ORACLE.date);
    expect(m.get('Parts')).toBe('2');
    expect(m.get('Content type')).toBe(ORACLE.contentType);
  });

  it('lists every header', async () => {
    const t = await tableOf(fileOf(b64(EML_B64)), { view: 'headers' });
    const names = t.rows.map((r) => (r[0] ?? '').toLowerCase());
    expect(names).toContain('from');
    expect(names).toContain('to');
    expect(names).toContain('subject');
    expect(names).toContain('date');
    expect(names).toContain('content-type');
  });

  it('walks the MIME parts', async () => {
    const t = await tableOf(fileOf(b64(EML_B64)), { view: 'parts' });
    expect(t.rows).toHaveLength(ORACLE.parts);
    expect(t.rows[0]?.[1]).toBe(ORACLE.part1Type);
    expect(t.rows[0]?.[2]).toBe('base64');
    expect(t.rows[1]?.[1]).toBe(ORACLE.part2Type);
    expect(t.rows[1]?.[3]).toBe(ORACLE.part2Filename);
    expect(t.rows[1]?.[5]).toBe('yes');
  });

  it('decodes the base64 body sizes', async () => {
    const t = await tableOf(fileOf(b64(EML_B64)), { view: 'parts' });
    // "Hello World" is 11 ASCII chars, the 5-byte binary attachment
    expect(t.rows[0]?.[4]).toBe('11 B');
    expect(t.rows[1]?.[4]).toBe('5 B');
  });
});
