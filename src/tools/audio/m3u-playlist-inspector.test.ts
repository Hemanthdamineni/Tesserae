import { describe, it, expect } from 'vitest';
import tool from './m3u-playlist-inspector.tool';

const M3U_B64 =
  'I0VYVE0zVQojRVhUSU5GOjEyMyxBcnRpc3QgQSAtIFNvbmcgT25lCi9tZWRpYS8wMS5tcDMKI0VY' +
  'VElORjotMSxBcnRpc3QgQiAtIExpdmUgU2Vzc2lvbgovbWVkaWEvMDIubXAzCiNFWFRJTkY6NDUs' +
  'QXJ0aXN0IEMgLSBDbGlwCi9tZWRpYS8wMy5mbGFjCi9tZWRpYS8wNC5vZ2cKI0VYVElORjo5OSxB' +
  'cnRpc3QgRCAtIExvbmcgRm9ybQovbWVkaWEvMDUud2F2Cg==';

const M3U_TEXT = atob(M3U_B64);

const ORACLE = {
  entries: 4,
  entriesWithUri: 4,
  distinctUris: 4,
  bareUris: 1,
  header: 'yes',
};

function rowsOf(t: ReturnType<typeof tool.run>): { headers: string[]; rows: string[][] } {
  const out = (t as { output?: string }).output ?? '{"rows":[]}';
  return JSON.parse(out) as { headers: string[]; rows: string[][] };
}

function summaryOf(t: ReturnType<typeof tool.run>): Map<string, string> {
  return new Map<string, string>(rowsOf(t).rows.map((r) => [r[0] ?? '', r[1] ?? '']));
}

describe('m3u-playlist-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects empty input synchronously', () => {
    expect(() => tool.run({ text: '', options: {} })).toThrow(/playlist/i);
  });

  it('reads the fixture summary', () => {
    const m = summaryOf(tool.run({ text: M3U_TEXT, options: {} }));
    expect(m.get('EXTINF header')).toBe(ORACLE.header);
    expect(m.get('Entries')).toBe(String(ORACLE.entries));
    expect(m.get('Entries with URI')).toBe(String(ORACLE.entriesWithUri));
    expect(m.get('Distinct URIs')).toBe(String(ORACLE.distinctUris));
    expect(m.get('Bare URIs')).toBe(String(ORACLE.bareUris));
  });

  it('lists the entries with durations', () => {
    const t = rowsOf(tool.run({ text: M3U_TEXT, options: { format: 'entries' } }));
    expect(t.rows).toHaveLength(ORACLE.entries);
    expect(t.rows[0]?.[2]).toBe('123');
    expect(t.rows[0]?.[3]).toBe('Artist A - Song One');
    expect(t.rows[0]?.[4]).toBe('/media/01.mp3');
    expect(t.rows[1]?.[2]).toBe('-1');
    expect(t.rows[3]?.[2]).toBe('99');
  });

  it('flags the bare URI', () => {
    const t = rowsOf(tool.run({ text: M3U_TEXT, options: { format: 'issues' } }));
    const flat = t.rows.map((r) => r[2] ?? '').join('\n');
    expect(flat).toMatch(/no EXTINF metadata/i);
  });

  it('flags a missing header and a non-numeric duration', () => {
    const bad = '/a.mp3\n#EXTINF:abc,Title\n/b.mp3\n';
    const t = rowsOf(tool.run({ text: bad, options: { format: 'issues' } }));
    const flat = t.rows.map((r) => r[2] ?? '').join('\n');
    expect(flat).toMatch(/does not start with #EXTM3U/i);
    expect(flat).toMatch(/not numeric/i);
  });

  it('flags an EXTINF with no following URI', () => {
    const bad = '#EXTM3U\n#EXTINF:10,Lonely\n';
    const t = rowsOf(tool.run({ text: bad, options: { format: 'issues' } }));
    const flat = t.rows.map((r) => r[2] ?? '').join('\n');
    expect(flat).toMatch(/no following URI/i);
  });
});
