import { describe, it, expect } from 'vitest';
import tool from './har-inspector.tool';

const HAR_B64 =
  'eyJsb2ciOnsidmVyc2lvbiI6IjEuMiIsImNyZWF0b3IiOnsibmFtZSI6IkZpcmVidWciLCJ2ZXJz' +
  'aW9uIjoiMS42In0sInBhZ2VzIjpbXSwiZW50cmllcyI6W3sic3RhcnRlZERhdGVUaW1lIjoiMjAy' +
  'Ni0xMS0wN1QxMDowMDowMC4wMDBaIiwidGltZSI6MTIwLCJyZXF1ZXN0Ijp7Im1ldGhvZCI6IkdF' +
  'VCIsInVybCI6Imh0dHBzOi8vZXhhbXBsZS5jb20vYXBpL2RhdGEiLCJodHRwVmVyc2lvbiI6IkhU' +
  'VFAvMS4xIiwiaGVhZGVycyI6W3sibmFtZSI6IkFjY2VwdCIsInZhbHVlIjoiYXBwbGljYXRpb24v' +
  'anNvbiJ9XSwicXVlcnlTdHJpbmciOltdLCJjb29raWVzIjpbXSwiaGVhZGVyc1NpemUiOjQwLCJi' +
  'b2R5U2l6ZSI6MH0sInJlc3BvbnNlIjp7InN0YXR1cyI6MjAwLCJzdGF0dXNUZXh0IjoiT0siLCJo' +
  'dHRwVmVyc2lvbiI6IkhUVFAvMS4xIiwiaGVhZGVycyI6W3sibmFtZSI6IkNvbnRlbnQtVHlwZSIs' +
  'InZhbHVlIjoiYXBwbGljYXRpb24vanNvbiJ9XSwiY29va2llcyI6W10sImNvbnRlbnQiOnsic2l6' +
  'ZSI6NDgsIm1pbWVUeXBlIjoiYXBwbGljYXRpb24vanNvbiJ9LCJyZWRpcmVjdFVSTCI6IiIsImhl' +
  'YWRlcnNTaXplIjo2MCwiYm9keVNpemUiOjQ4fSwiY2FjaGUiOnt9LCJ0aW1pbmdzIjp7ImJsb2Nr' +
  'ZWQiOjEwLCJkbnMiOjUsImNvbm5lY3QiOjE1LCJzZW5kIjo1LCJ3YWl0Ijo3NSwicmVjZWl2ZSI6' +
  'MTB9fSx7InN0YXJ0ZWREYXRlVGltZSI6IjIwMjYtMTEtMDdUMTA6MDA6MDEuMDAwWiIsInRpbWUi' +
  'OjQwLCJyZXF1ZXN0Ijp7Im1ldGhvZCI6IlBPU1QiLCJ1cmwiOiJodHRwczovL2V4YW1wbGUuY29t' +
  'L21pc3NpbmciLCJodHRwVmVyc2lvbiI6IkhUVFAvMS4xIiwiaGVhZGVycyI6W3sibmFtZSI6IkNv' +
  'bnRlbnQtVHlwZSIsInZhbHVlIjoiYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkIn1d' +
  'LCJxdWVyeVN0cmluZyI6W10sImNvb2tpZXMiOltdLCJoZWFkZXJzU2l6ZSI6NjAsImJvZHlTaXpl' +
  'IjoxMiwicG9zdERhdGEiOnsibWltZVR5cGUiOiJhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVu' +
  'Y29kZWQiLCJ0ZXh0IjoiaWQ9MSJ9fSwicmVzcG9uc2UiOnsic3RhdHVzIjo0MDQsInN0YXR1c1Rl' +
  'eHQiOiJOb3QgRm91bmQiLCJodHRwVmVyc2lvbiI6IkhUVFAvMS4xIiwiaGVhZGVycyI6W10sImNv' +
  'b2tpZXMiOltdLCJjb250ZW50Ijp7InNpemUiOjAsIm1pbWVUeXBlIjoidGV4dC9wbGFpbiJ9LCJy' +
  'ZWRpcmVjdFVSTCI6IiIsImhlYWRlcnNTaXplIjo1MCwiYm9keVNpemUiOjB9LCJjYWNoZSI6e30s' +
  'InRpbWluZ3MiOnsiYmxvY2tlZCI6NSwiZG5zIjoyLCJjb25uZWN0Ijo4LCJzZW5kIjozLCJ3YWl0' +
  'IjoyMCwicmVjZWl2ZSI6Mn19XX19';

const HAR_TEXT = atob(HAR_B64);

const ORACLE = {
  version: '1.2',
  entries: 2,
  ok: 1,
  failed: 1,
  distinct: 2,
  totalTime: 160,
  slowest: 120,
  totalSize: 48,
};

function rowsOf(t: ReturnType<typeof tool.run>): { headers: string[]; rows: string[][] } {
  const out = (t as { output?: string }).output ?? '{"rows":[]}';
  return JSON.parse(out) as { headers: string[]; rows: string[][] };
}

function summaryOf(t: ReturnType<typeof tool.run>): Map<string, string> {
  return new Map<string, string>(rowsOf(t).rows.map((r) => [r[0] ?? '', r[1] ?? '']));
}

describe('har-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects empty input synchronously', () => {
    expect(() => tool.run({ text: '', options: {} })).toThrow(/HAR/i);
  });

  it('rejects non-JSON input', () => {
    expect(() => tool.run({ text: 'not a har', options: {} })).toThrow(/JSON|HAR/i);
  });

  it('rejects JSON without a log object', () => {
    expect(() => tool.run({ text: '{"foo":1}', options: {} })).toThrow(/HAR|log/i);
  });

  it('reads the fixture summary', () => {
    const m = summaryOf(tool.run({ text: HAR_TEXT, options: {} }));
    expect(m.get('HAR version')).toBe(ORACLE.version);
    expect(m.get('Entries')).toBe(String(ORACLE.entries));
    expect(m.get('Successful')).toBe(String(ORACLE.ok));
    expect(m.get('Failed')).toBe(String(ORACLE.failed));
    expect(m.get('Distinct URLs')).toBe(String(ORACLE.distinct));
    expect(m.get('Total time (ms)')).toBe(String(ORACLE.totalTime));
    expect(m.get('Slowest request (ms)')).toBe(String(ORACLE.slowest));
    expect(m.get('Total content size (bytes)')).toBe(String(ORACLE.totalSize));
  });

  it('lists the requests', () => {
    const t = rowsOf(tool.run({ text: HAR_TEXT, options: { format: 'requests' } }));
    expect(t.rows).toHaveLength(ORACLE.entries);
    expect(t.rows[0]?.[1]).toBe('GET');
    expect(t.rows[0]?.[2]).toBe('200');
    expect(t.rows[0]?.[5]).toBe('https://example.com/api/data');
    expect(t.rows[1]?.[1]).toBe('POST');
    expect(t.rows[1]?.[2]).toBe('404');
  });

  it('flags the failed request', () => {
    const t = rowsOf(tool.run({ text: HAR_TEXT, options: { format: 'issues' } }));
    const flat = t.rows.map((r) => r[2] ?? '').join('\n');
    expect(flat).toMatch(/failed with status 404/i);
  });
});
