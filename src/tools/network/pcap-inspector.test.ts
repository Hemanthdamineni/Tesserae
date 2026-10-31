import { describe, it, expect } from 'vitest';
import tool from './pcap-inspector.tool';

const PCAP_B64 =
  '1MOyoQIABAAAAAAAAAAAAP//AAABAAAAAPFTZUDiAQA2AAAANgAAAP///////wARIjNEVQgARQAAHAAAAAAAAAAAAAAAAAAAAAAAAAAAaGVsbG8tcGFja2V0LW9uZWTxU2Xx+wkAOgAAADoAAAAAESIzRFUAqrvM3e4IAEUAAB4AAAAAAAAAAAAAAAAAAAAAAAAAAHNlY29uZC1wYWNrZXQtZGF0YSEh';
const PCAP_BE_B64 =
  'obLD1AACAAQAAAAAAAAAAAAA//8AAAABZVPxAAAB4kAAAAA2AAAANv///////wARIjNEVQgARQAAHAAAAAAAAAAAAAAAAAAAAAAAAAAAaGVsbG8tcGFja2V0LW9uZWVT8WQACfvxAAAAOgAAADoAESIzRFUAqrvM3e4IAEUAAB4AAAAAAAAAAAAAAAAAAAAAAAAAAHNlY29uZC1wYWNrZXQtZGF0YSEh';

const PCAP_HEADER = { size: 168, version: '2.4', snaplen: 65535, network: 1, nrecords: 2 };
const PCAP_RECORDS: [number, number, number, number, number][] = [
  [0, 1700000000, 123456, 54, 54],
  [1, 1700000100, 654321, 58, 58],
];

const META = tool.meta;

function b64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function fileOf(bytes: Uint8Array, name = 'x.pcap'): File {
  const copy = new Uint8Array(bytes);
  return new File([copy.buffer as ArrayBuffer], name, { type: 'application/octet-stream' });
}

async function rowsOf(
  f: File,
  options: Record<string, string | number | boolean> = {},
): Promise<string[][]> {
  const r = await tool.run({ files: [f], options });
  const parsed = JSON.parse(r.report?.output ?? '{"rows":[]}');
  return (parsed.rows ?? []) as string[][];
}

describe('pcap-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(META.privacy.processing).toBe('on-device');
    expect(META.privacy.network).toBe('none');
    expect(META.privacy.offline).toBe(true);
  });

  it('reads the header and link type into the summary view', async () => {
    const rows = await rowsOf(fileOf(b64(PCAP_B64), 'cap.pcap'), { view: 'summary' });
    const m = new Map<string, string>(rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('Byte order')).toBe('little (magic 0xa1b2c3d4)');
    expect(m.get('Magic')).toBe('valid');
    expect(m.get('Version')).toBe(PCAP_HEADER.version);
    expect(m.get('Snapshot length')).toBe(String(PCAP_HEADER.snaplen));
    expect(m.get('Link type')).toBe(String(PCAP_HEADER.network) + ' (Ethernet)');
    expect(m.get('Packet records')).toBe(String(PCAP_HEADER.nrecords));
  });

  it('matches the Python-oracle packet records in order', async () => {
    const rows = await rowsOf(fileOf(b64(PCAP_B64), 'cap.pcap'), { view: 'records' });
    const got = rows.map((r) => [
      Number(r[0]),
      Number(r[2]),
      Number(r[3]),
      Number(r[4]),
      Number(r[5]),
    ]);
    expect(got).toEqual(PCAP_RECORDS);
  });

  it('detects a big-endian capture and its records', async () => {
    const rows = await rowsOf(fileOf(b64(PCAP_BE_B64), 'capbe.pcap'), { view: 'summary' });
    const m = new Map<string, string>(rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('Byte order')).toBe('big (magic 0xa1b2c3d4)');
    expect(m.get('Packet records')).toBe(String(PCAP_HEADER.nrecords));
    const rrows = await rowsOf(fileOf(b64(PCAP_BE_B64), 'capbe.pcap'), { view: 'records' });
    const got = rrows.map((r) => [
      Number(r[0]),
      Number(r[2]),
      Number(r[3]),
      Number(r[4]),
      Number(r[5]),
    ]);
    expect(got).toEqual(PCAP_RECORDS);
  });

  it('flags a bad magic', async () => {
    const rows = await rowsOf(fileOf(new Uint8Array([1, 2, 3, 4]), 'bad.pcap'), {
      view: 'findings',
    });
    expect(rows.some((r) => r[1] === 'magic')).toBe(true);
  });

  it('throws a user-facing error when no file is given', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/PCAP/);
  });
});
