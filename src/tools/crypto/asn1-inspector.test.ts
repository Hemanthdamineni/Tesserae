import { describe, it, expect } from 'vitest';
import tool from './asn1-inspector.tool';

const META = tool.meta;

/** Base64 to bytes (jsdom provides atob). */
function b64(s: string): Uint8Array {
  const bin = atob(s.replace(/\s+/gu, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function fileOf(bytes: Uint8Array, name = 'x.der'): File {
  const copy = new Uint8Array(bytes);
  return new File([copy.buffer as ArrayBuffer], name, { type: 'application/octet-stream' });
}

async function rowsOf(
  input: { files?: File[]; text?: string },
  options: Record<string, string | number | boolean> = {},
): Promise<string[][]> {
  const r = await tool.run({ files: input.files ?? [], text: input.text ?? '', options });
  const parsed = JSON.parse(r.report?.output ?? '{"rows":[]}');
  return (parsed.rows ?? []) as string[][];
}

/** Synthetic DER exercising every common universal type plus context tags. */
const SYNTH_B64 =
  'MIGEAgEqAgL/AQoBAQEB/wEBAAUABgNVBAMGCSqGSIb3DQEBCwQE3q2+7wMEBPAPqgwGaMOpbGxvEwlQcmludGFibGUWEG5hbWVAZXhhbXBsZS5jb20XDTI1MTIzMTIzNTk1OVoYDzIwMjUxMjMxMjM1OTU5WqADAgEHgQIBAjEGAgEBAgEC';
/** A real EC P-256 private key in DER (SEC1). */
const EC_B64 =
  'MHcCAQEEIBcIsvbMKBtR+xG3GJ1Ugdtrxe70vaHkBNkaanJlBDoCoAoGCCqGSM49AwEHoUQDQgAEXlOiJ+gLWnZLQ0njpxcStdLZVQvLX7Ctzk6O6tT1mGE0YGF9aMSVId/cN9CwapCQUxAaYvZu5LsCB3gNDPhomQ==';

/**
 * Expected structure produced by `openssl asn1parse -inform DER -in <fixture>`:
 * [offset, depth, type label, constructed, header length, value length].
 * Captured from openssl 3.6.5; these are baked oracle literals.
 */
const SYNTH_STRUCT: [number, number, string, string, number, number][] = [
  [0, 0, 'SEQUENCE', 'yes', 3, 132],
  [3, 1, 'INTEGER', 'no', 2, 1],
  [6, 1, 'INTEGER', 'no', 2, 2],
  [10, 1, 'ENUMERATED', 'no', 2, 1],
  [13, 1, 'BOOLEAN', 'no', 2, 1],
  [16, 1, 'BOOLEAN', 'no', 2, 1],
  [19, 1, 'NULL', 'no', 2, 0],
  [21, 1, 'OBJECT', 'no', 2, 3],
  [26, 1, 'OBJECT', 'no', 2, 9],
  [37, 1, 'OCTET STRING', 'no', 2, 4],
  [43, 1, 'BIT STRING', 'no', 2, 4],
  [49, 1, 'UTF8STRING', 'no', 2, 6],
  [57, 1, 'PRINTABLESTRING', 'no', 2, 9],
  [68, 1, 'IA5STRING', 'no', 2, 16],
  [86, 1, 'UTCTIME', 'no', 2, 13],
  [101, 1, 'GENERALIZEDTIME', 'no', 2, 15],
  [118, 1, 'cont [ 0 ]', 'yes', 2, 3],
  [120, 2, 'INTEGER', 'no', 2, 1],
  [123, 1, 'cont [ 1 ]', 'no', 2, 2],
  [127, 1, 'SET', 'yes', 2, 6],
  [129, 2, 'INTEGER', 'no', 2, 1],
  [132, 2, 'INTEGER', 'no', 2, 1],
];

const EC_STRUCT: [number, number, string, string, number, number][] = [
  [0, 0, 'SEQUENCE', 'yes', 2, 119],
  [2, 1, 'INTEGER', 'no', 2, 1],
  [5, 1, 'OCTET STRING', 'no', 2, 32],
  [39, 1, 'cont [ 0 ]', 'yes', 2, 10],
  [41, 2, 'OBJECT', 'no', 2, 8],
  [51, 1, 'cont [ 1 ]', 'yes', 2, 68],
  [53, 2, 'BIT STRING', 'no', 2, 66],
];

describe('asn1-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(META.privacy.processing).toBe('on-device');
    expect(META.privacy.network).toBe('none');
    expect(META.privacy.offline).toBe(true);
  });

  it('matches openssl asn1parse structure for a synthetic DER across all common types', async () => {
    const rows = await rowsOf({ files: [fileOf(b64(SYNTH_B64))] });
    const got = rows.map((r) => [
      Number(r[0]),
      Number(r[1]),
      r[2],
      r[3],
      Number(r[4]),
      Number(r[5]),
    ]);
    expect(got).toEqual(SYNTH_STRUCT);
  });

  it('matches openssl asn1parse structure for a real EC private key', async () => {
    const rows = await rowsOf({ files: [fileOf(b64(EC_B64), 'key.der')] });
    const got = rows.map((r) => [
      Number(r[0]),
      Number(r[1]),
      r[2],
      r[3],
      Number(r[4]),
      Number(r[5]),
    ]);
    expect(got).toEqual(EC_STRUCT);
  });

  it('formats primitive values the way openssl does', async () => {
    const rows = await rowsOf({ files: [fileOf(b64(SYNTH_B64))] });
    const valueAt = (off: number): string =>
      rows.find((r) => Number(r[0]) === off)?.[6] ?? '<missing>';
    expect(valueAt(3)).toBe('2A');
    expect(valueAt(6)).toBe('-FF');
    expect(valueAt(10)).toBe('01');
    expect(valueAt(13)).toBe('255');
    expect(valueAt(16)).toBe('0');
    expect(valueAt(19)).toBe('');
    expect(valueAt(37)).toBe('[HEX DUMP]:DEADBEEF');
    expect(valueAt(43)).toBe('(4 unused bits), HEX F00FAA');
    expect(valueAt(49)).toBe('h\u00e9llo');
    expect(valueAt(57)).toBe('Printable');
    expect(valueAt(68)).toBe('name@example.com');
    expect(valueAt(86)).toBe('251231235959Z');
    expect(valueAt(101)).toBe('20251231235959Z');
    expect(valueAt(120)).toBe('07');
  });

  it('resolves OID names next to the dotted form', async () => {
    const rows = await rowsOf({ files: [fileOf(b64(SYNTH_B64))] });
    const valueAt = (off: number): string =>
      rows.find((r) => Number(r[0]) === off)?.[6] ?? '<missing>';
    expect(valueAt(21)).toBe('2.5.4.3 (commonName)');
    expect(valueAt(26)).toBe('1.2.840.113549.1.1.11 (sha256WithRSAEncryption)');
    const ec = await rowsOf({ files: [fileOf(b64(EC_B64), 'key.der')] });
    const ecVal = (off: number): string => ec.find((r) => Number(r[0]) === off)?.[6] ?? '<missing>';
    expect(ecVal(41)).toBe('1.2.840.10045.3.1.7 (prime256v1)');
  });

  it('accepts PEM text input and yields the same tree as the DER file', async () => {
    const pem = '-----BEGIN EC PRIVATE KEY-----\n' + EC_B64 + '\n-----END EC PRIVATE KEY-----\n';
    const rows = await rowsOf({ text: pem });
    const got = rows.map((r) => [
      Number(r[0]),
      Number(r[1]),
      r[2],
      r[3],
      Number(r[4]),
      Number(r[5]),
    ]);
    expect(got).toEqual(EC_STRUCT);
  });

  it('accepts hex text input', async () => {
    const der = b64(EC_B64);
    const hex = Array.from(der, (x) => x.toString(16).padStart(2, '0')).join('');
    const rows = await rowsOf({ text: hex });
    expect(rows.length).toBe(EC_STRUCT.length);
    expect(rows[0]?.[2]).toBe('SEQUENCE');
  });

  it('accepts raw base64 text input', async () => {
    const rows = await rowsOf({ text: EC_B64 });
    expect(rows.length).toBe(EC_STRUCT.length);
    expect(rows[3]?.[2]).toBe('cont [ 0 ]');
  });

  /** Length-prefixed TLV bytes for tests. */
  function tlv(tag: number, value: number[]): number[] {
    const n = value.length;
    if (n < 128) return [tag, n, ...value];
    const b: number[] = [];
    let v = n;
    while (v > 0) {
      b.unshift(v & 0xff);
      v >>= 8;
    }
    return [tag, 0x80 | b.length, ...b, ...value];
  }

  function bytes(xs: number[]): Uint8Array {
    return new Uint8Array(xs);
  }

  it('reports DER canonical-form violations', async () => {
    const body = [
      ...tlv(0x01, [0x01]), // BOOLEAN TRUE as 0x01 (non-canonical)
      ...tlv(0x02, [0x00, 0x7f]), // INTEGER with redundant sign octet
      ...tlv(0x03, [0x04, 0x0f]), // BIT STRING with non-zero padding bits
      0x04,
      0x81,
      0x02,
      0xaa,
      0xbb, // OCTET STRING in non-minimal long form
    ];
    const rows = await rowsOf(
      { files: [fileOf(bytes([0x30, body.length, ...body]))] },
      { view: 'findings' },
    );
    const kinds = rows.map((r) => r[1]);
    expect(kinds).toContain('boolean');
    expect(kinds).toContain('integer');
    expect(kinds).toContain('bit-string');
    expect(kinds).toContain('length');
  });

  it('flags trailing bytes after the top-level object', async () => {
    const good = b64(SYNTH_B64);
    const withTrailer = new Uint8Array(good.length + 3);
    withTrailer.set(good, 0);
    withTrailer.set([1, 2, 3], good.length);
    const rows = await rowsOf({ files: [fileOf(withTrailer)] }, { view: 'findings' });
    const trailing = rows.find((r) => r[1] === 'trailing');
    expect(trailing?.[2]).toContain('3 trailing byte');
  });

  it('reports an unparseable truncated input instead of throwing', async () => {
    const rows = await rowsOf(
      { files: [fileOf(bytes([0x30, 0x05, 0x02, 0x01]))] },
      { view: 'findings' },
    );
    expect(rows.some((r) => r[1] === 'parse')).toBe(true);
  });

  it('throws a user-facing error when nothing is provided', async () => {
    await expect(tool.run({ files: [], text: '   ', options: {} })).rejects.toThrow(/DER\/PEM/);
  });

  it('limits displayed rows with maxDepth', async () => {
    const all = await rowsOf({ files: [fileOf(b64(SYNTH_B64))] });
    const shallow = await rowsOf({ files: [fileOf(b64(SYNTH_B64))] }, { maxDepth: 1 });
    expect(all.length).toBe(22);
    expect(shallow.length).toBe(19);
  });

  it('summarises the structure in the stats view', async () => {
    const rows = await rowsOf({ files: [fileOf(b64(SYNTH_B64))] }, { view: 'stats' });
    const map = new Map<string, string>(rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(map.get('Input')).toBe('DER');
    expect(map.get('Total objects')).toBe('22');
    expect(map.get('Max depth')).toBe('3');
    expect(map.get('Size')).toBe('135 bytes');
  });

  it('names the input form for PEM in the stats view', async () => {
    const pem = '-----BEGIN EC PRIVATE KEY-----\n' + EC_B64 + '\n-----END EC PRIVATE KEY-----\n';
    const rows = await rowsOf({ text: pem }, { view: 'stats' });
    const map = new Map<string, string>(rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(map.get('Input')).toBe('PEM (base64)');
  });

  it('handles a zero-unused-bit BIT STRING', async () => {
    const rows = await rowsOf({ files: [fileOf(b64(EC_B64), 'key.der')] });
    const bit = rows.find((r) => Number(r[0]) === 53)?.[6] ?? '';
    expect(bit.startsWith('(0 unused bits), HEX ')).toBe(true);
  });

  it('survives deeply nested input without overflowing the stack', async () => {
    let inner = bytes([0x02, 0x01, 0x01]);
    for (let i = 0; i < 300; i += 1) {
      inner = bytes([...tlv(0x30, Array.from(inner))]);
    }
    const rows = await rowsOf({ files: [fileOf(inner)] }, { view: 'findings' });
    expect(rows.some((r) => r[1] === 'nesting')).toBe(true);
  });

  it('parses a large structure quickly', async () => {
    const items: number[] = [];
    for (let i = 0; i < 3000; i += 1) items.push(...tlv(0x02, [i & 0xff]));
    const der = bytes([...tlv(0x30, items)]);
    const t0 = Date.now();
    const rows = await rowsOf({ files: [fileOf(der)] });
    const ms = Date.now() - t0;
    expect(rows.length).toBe(3001);
    expect(ms).toBeLessThan(2000);
  });
});
