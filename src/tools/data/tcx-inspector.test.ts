import { describe, it, expect } from 'vitest';
import tool from './tcx-inspector.tool';

const TCX_B64 =
  'PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPFRyYWluaW5nQ2VudGVyRGF0' +
  'YWJhc2UgeG1sbnM9Imh0dHA6Ly93d3cuZ2FybWluLmNvbS94bWxzY2hlbWFzL1RyYWluaW5nQ2Vu' +
  'dGVyRGF0YWJhc2UvdjIiPgogIDxBY3Rpdml0aWVzPgogICAgPEFjdGl2aXR5IFNwb3J0PSJSdW5u' +
  'aW5nIj4KICAgICAgPElkPjIwMjYtMTEtMDdUMDY6MDA6MDBaPC9JZD4KICAgICAgPExhcCBTdGFy' +
  'dFRpbWU9IjIwMjYtMTEtMDdUMDY6MDA6MDBaIj4KICAgICAgICA8VG90YWxUaW1lU2Vjb25kcz4z' +
  'MDA8L1RvdGFsVGltZVNlY29uZHM+CiAgICAgICAgPERpc3RhbmNlTWV0ZXJzPjEwMDA8L0Rpc3Rh' +
  'bmNlTWV0ZXJzPgogICAgICAgIDxNYXhpbXVtU3BlZWQ+NS41PC9NYXhpbXVtU3BlZWQ+CiAgICAg' +
  'ICAgPENhbG9yaWVzPjYwPC9DYWxvcmllcz4KICAgICAgICA8QXZlcmFnZUhlYXJ0UmF0ZUJwbT48' +
  'VmFsdWU+MTQwPC9WYWx1ZT48L0F2ZXJhZ2VIZWFydFJhdGVCcG0+CiAgICAgICAgPE1heGltdW1I' +
  'ZWFydFJhdGVCcG0+PFZhbHVlPjE1NTwvVmFsdWU+PC9NYXhpbXVtSGVhcnRSYXRlQnBtPgogICAg' +
  'ICAgIDxJbnRlbnNpdHk+QWN0aXZlPC9JbnRlbnNpdHk+CiAgICAgICAgPFRyaWdnZXJNZXRob2Q+' +
  'TWFudWFsPC9UcmlnZ2VyTWV0aG9kPgogICAgICAgIDxUcmFjaz4KICAgICAgICAgIDxUcmFja3Bv' +
  'aW50PgogICAgICAgICAgICA8VGltZT4yMDI2LTExLTA3VDA2OjAwOjAwWjwvVGltZT4KICAgICAg' +
  'ICAgICAgPFBvc2l0aW9uPjxMYXRpdHVkZURlZ3JlZXM+NDAuNzEyODwvTGF0aXR1ZGVEZWdyZWVz' +
  'PjxMb25naXR1ZGVEZWdyZWVzPi03NC4wMDYwPC9Mb25naXR1ZGVEZWdyZWVzPjwvUG9zaXRpb24+' +
  'CiAgICAgICAgICAgIDxBbHRpdHVkZU1ldGVycz4xMC4wPC9BbHRpdHVkZU1ldGVycz4KICAgICAg' +
  'ICAgICAgPERpc3RhbmNlTWV0ZXJzPjA8L0Rpc3RhbmNlTWV0ZXJzPgogICAgICAgICAgICA8SGVh' +
  'cnRSYXRlQnBtPjxWYWx1ZT4xMzA8L1ZhbHVlPjwvSGVhcnRSYXRlQnBtPgogICAgICAgICAgICA8' +
  'Q2FkZW5jZT44MDwvQ2FkZW5jZT4KICAgICAgICAgIDwvVHJhY2twb2ludD4KICAgICAgICAgIDxU' +
  'cmFja3BvaW50PgogICAgICAgICAgICA8VGltZT4yMDI2LTExLTA3VDA2OjAyOjAwWjwvVGltZT4K' +
  'ICAgICAgICAgICAgPFBvc2l0aW9uPjxMYXRpdHVkZURlZ3JlZXM+NDAuNzEzNTwvTGF0aXR1ZGVE' +
  'ZWdyZWVzPjxMb25naXR1ZGVEZWdyZWVzPi03NC4wMDU1PC9Mb25naXR1ZGVEZWdyZWVzPjwvUG9z' +
  'aXRpb24+CiAgICAgICAgICAgIDxBbHRpdHVkZU1ldGVycz4xMi4wPC9BbHRpdHVkZU1ldGVycz4K' +
  'ICAgICAgICAgICAgPERpc3RhbmNlTWV0ZXJzPjUwMDwvRGlzdGFuY2VNZXRlcnM+CiAgICAgICAg' +
  'ICAgIDxIZWFydFJhdGVCcG0+PFZhbHVlPjE0NTwvVmFsdWU+PC9IZWFydFJhdGVCcG0+CiAgICAg' +
  'ICAgICAgIDxDYWRlbmNlPjg0PC9DYWRlbmNlPgogICAgICAgICAgPC9UcmFja3BvaW50PgogICAg' +
  'ICAgIDwvVHJhY2s+CiAgICAgIDwvTGFwPgogICAgICA8TGFwIFN0YXJ0VGltZT0iMjAyNi0xMS0w' +
  'N1QwNjowNTowMFoiPgogICAgICAgIDxUb3RhbFRpbWVTZWNvbmRzPjMwMDwvVG90YWxUaW1lU2Vj' +
  'b25kcz4KICAgICAgICA8RGlzdGFuY2VNZXRlcnM+MTAwMDwvRGlzdGFuY2VNZXRlcnM+CiAgICAg' +
  'ICAgPENhbG9yaWVzPjYyPC9DYWxvcmllcz4KICAgICAgICA8QXZlcmFnZUhlYXJ0UmF0ZUJwbT48' +
  'VmFsdWU+MTQ4PC9WYWx1ZT48L0F2ZXJhZ2VIZWFydFJhdGVCcG0+CiAgICAgICAgPEludGVuc2l0' +
  'eT5BY3RpdmU8L0ludGVuc2l0eT4KICAgICAgICA8VHJhY2s+CiAgICAgICAgICA8VHJhY2twb2lu' +
  'dD4KICAgICAgICAgICAgPFRpbWU+MjAyNi0xMS0wN1QwNjowNTowMFo8L1RpbWU+CiAgICAgICAg' +
  'ICAgIDxQb3NpdGlvbj48TGF0aXR1ZGVEZWdyZWVzPjQwLjcxNDA8L0xhdGl0dWRlRGVncmVlcz48' +
  'TG9uZ2l0dWRlRGVncmVlcz4tNzQuMDA1MDwvTG9uZ2l0dWRlRGVncmVlcz48L1Bvc2l0aW9uPgog' +
  'ICAgICAgICAgICA8QWx0aXR1ZGVNZXRlcnM+MTEuMDwvQWx0aXR1ZGVNZXRlcnM+CiAgICAgICAg' +
  'ICAgIDxEaXN0YW5jZU1ldGVycz4xMDAwPC9EaXN0YW5jZU1ldGVycz4KICAgICAgICAgICAgPEhl' +
  'YXJ0UmF0ZUJwbT48VmFsdWU+MTUwPC9WYWx1ZT48L0hlYXJ0UmF0ZUJwbT4KICAgICAgICAgICAg' +
  'PENhZGVuY2U+ODY8L0NhZGVuY2U+CiAgICAgICAgICA8L1RyYWNrcG9pbnQ+CiAgICAgICAgPC9U' +
  'cmFjaz4KICAgICAgPC9MYXA+CiAgICA8L0FjdGl2aXR5PgogIDwvQWN0aXZpdGllcz4KPC9UcmFp' +
  'bmluZ0NlbnRlckRhdGFiYXNlPgo=';

const TCX_TEXT = atob(TCX_B64);

const ORACLE = {
  activities: 1,
  laps: 2,
  trackpoints: 3,
  hrMin: 130,
  hrMax: 150,
  hrAvg: 141.67,
  cadenceMax: 86,
  totalDistance: 2000,
  totalDuration: 600,
};

function rowsOf(t: ReturnType<typeof tool.run>): { headers: string[]; rows: string[][] } {
  const out = (t as { output?: string }).output ?? '{"rows":[]}';
  return JSON.parse(out) as { headers: string[]; rows: string[][] };
}

describe('tcx-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects empty input synchronously', () => {
    expect(() => tool.run({ text: '', options: {} })).toThrow(/TCX/i);
  });

  it('rejects a non-TCX document', () => {
    expect(() => tool.run({ text: '<root><other/></root>', options: {} })).toThrow(/TCX/i);
  });

  it('reads the summary', () => {
    const t = rowsOf(tool.run({ text: TCX_TEXT, options: {} }));
    const m = new Map<string, string>(t.rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('Format')).toBe('TCX');
    expect(m.get('Activities')).toBe(String(ORACLE.activities));
    expect(m.get('Laps')).toBe(String(ORACLE.laps));
    expect(m.get('Trackpoints')).toBe(String(ORACLE.trackpoints));
    expect(m.get('Heart rate min')).toBe(String(ORACLE.hrMin));
    expect(m.get('Heart rate max')).toBe(String(ORACLE.hrMax));
    expect(m.get('Heart rate avg')).toBe(String(ORACLE.hrAvg));
    expect(m.get('Cadence max')).toBe(String(ORACLE.cadenceMax));
    expect(m.get('Total distance (m)')).toBe(String(ORACLE.totalDistance));
    expect(m.get('Total duration (s)')).toBe(String(ORACLE.totalDuration));
  });

  it('lists the laps', () => {
    const t = rowsOf(tool.run({ text: TCX_TEXT, options: { format: 'laps' } }));
    expect(t.rows).toHaveLength(ORACLE.laps);
    expect(t.rows[0]?.[0]).toBe('1');
    expect(t.rows[0]?.[1]).toBe('300');
    expect(t.rows[0]?.[2]).toBe('1000');
    expect(t.rows[0]?.[3]).toBe('140');
    expect(t.rows[0]?.[4]).toBe('155');
    expect(t.rows[1]?.[3]).toBe('148');
  });
});
