import { describe, it, expect } from 'vitest';
import tool from './jwk-inspector.tool';

const JWKS_B64 =
  'eyJrZXlzIjpbeyJrdHkiOiJSU0EiLCJ1c2UiOiJzaWciLCJhbGciOiJSUzI1NiIsImtpZCI6Imtl' +
  'eS0xIiwibiI6Inc0NV80clFqSzliMXhWdFBwN2syV25DMGVNNmhMOGRGc0EzdUc1eUoxelRxVmJO' +
  'Y1hlWSIsImUiOiJBUUFCIn0seyJrdHkiOiJFQyIsImNydiI6IlAtMjU2IiwieCI6Im5ZYlprenEw' +
  'alkzcWsyeE1wRDd0RjhiVmNYZTJhSDRnTDZtUjFzVXciLCJ5IjoicTBqWTNxazJ4TXBEN3RGOGJW' +
  'Y1hlMmFINGdMNm1SMXNVdzV5QThjRSIsInVzZSI6ImVuYyIsImFsZyI6IkVDREgtRVMiLCJraWQi' +
  'OiJrZXktMiJ9XX0=';

const JWKS_TEXT = atob(JWKS_B64);

const ORACLE = {
  keys: 2,
  rsa: 1,
  ec: 1,
  privateKeys: 0,
  ecBits: 256,
};

function rowsOf(t: ReturnType<typeof tool.run>): { headers: string[]; rows: string[][] } {
  const out = (t as { output?: string }).output ?? '{"rows":[]}';
  return JSON.parse(out) as { headers: string[]; rows: string[][] };
}

describe('jwk-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects empty input synchronously', () => {
    expect(() => tool.run({ text: '', options: {} })).toThrow(/JWK|JWKS/i);
  });

  it('rejects non-JSON input', () => {
    expect(() => tool.run({ text: 'not json at all', options: {} })).toThrow(/JSON/i);
  });

  it('rejects JSON that is not a key', () => {
    expect(() => tool.run({ text: '{"hello":"world"}', options: {} })).toThrow(/JWK|JWKS/i);
  });

  it('reads the key set summary', () => {
    const t = rowsOf(tool.run({ text: JWKS_TEXT, options: {} }));
    const m = new Map<string, string>(t.rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('Format')).toBe('JWKS key set');
    expect(m.get('Keys')).toBe(String(ORACLE.keys));
    expect(m.get('RSA keys')).toBe(String(ORACLE.rsa));
    expect(m.get('EC keys')).toBe(String(ORACLE.ec));
    expect(m.get('Private keys')).toBe(String(ORACLE.privateKeys));
    expect(m.get('Issues')).toBe('0');
  });

  it('lists the keys with type, kid and use', () => {
    const t = rowsOf(tool.run({ text: JWKS_TEXT, options: { format: 'keys' } }));
    expect(t.rows).toHaveLength(ORACLE.keys);
    expect(t.rows[0]?.[1]).toBe('RSA');
    expect(t.rows[0]?.[5]).toBe('key-1');
    expect(t.rows[0]?.[7]).toBe('no');
    expect(t.rows[1]?.[1]).toBe('EC');
    expect(t.rows[1]?.[2]).toBe('P-256');
    expect(t.rows[1]?.[5]).toBe('key-2');
  });

  it('accepts a bare single JWK', () => {
    const single = '{"kty":"EC","crv":"P-256","x":"abc","y":"def","kid":"solo"}';
    const t = rowsOf(tool.run({ text: single, options: {} }));
    const m = new Map<string, string>(t.rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('Format')).toBe('JWK');
    expect(m.get('Keys')).toBe('1');
  });

  it('flags an unknown key type and a missing member', () => {
    const bad = '{"keys":[{"kty":"XYZ","kid":"a"},{"kty":"RSA","kid":"b","n":"abc"}]}';
    const t = rowsOf(tool.run({ text: bad, options: { format: 'issues' } }));
    const flat = t.rows.map((r) => r[2] ?? '').join('\n');
    expect(flat).toMatch(/Unknown key type/i);
    expect(flat).toMatch(/Missing required member/i);
  });
});
