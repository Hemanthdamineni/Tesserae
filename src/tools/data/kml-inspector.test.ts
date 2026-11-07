import { describe, it, expect } from 'vitest';
import tool from './kml-inspector.tool';

const KML_B64 =
  'PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPGttbCB4bWxucz0iaHR0cDov' +
  'L3d3dy5vcGVuZ2lzLm5ldC9rbWwvMi4yIj4KICA8RG9jdW1lbnQ+CiAgICA8bmFtZT5TYW1wbGUg' +
  'S01MPC9uYW1lPgogICAgPFN0eWxlIGlkPSJzMSI+CiAgICAgIDxMaW5lU3R5bGU+PGNvbG9yPmZm' +
  'MDAwMGZmPC9jb2xvcj48d2lkdGg+Mzwvd2lkdGg+PC9MaW5lU3R5bGU+CiAgICA8L1N0eWxlPgog' +
  'ICAgPEZvbGRlcj4KICAgICAgPG5hbWU+UGxhY2VzPC9uYW1lPgogICAgICA8UGxhY2VtYXJrPgog' +
  'ICAgICAgIDxuYW1lPlBvaW50IEE8L25hbWU+CiAgICAgICAgPFBvaW50PgogICAgICAgICAgPGNv' +
  'b3JkaW5hdGVzPi03NC4wMDYwLDQwLjcxMjgsMDwvY29vcmRpbmF0ZXM+CiAgICAgICAgPC9Qb2lu' +
  'dD4KICAgICAgPC9QbGFjZW1hcms+CiAgICAgIDxQbGFjZW1hcms+CiAgICAgICAgPG5hbWU+TGlu' +
  'ZSBBPC9uYW1lPgogICAgICAgIDxMaW5lU3RyaW5nPgogICAgICAgICAgPGNvb3JkaW5hdGVzPi03' +
  'NC4wMDYwLDQwLjcxMjgsMCAtNzMuOTg2MCw0MC43Mjg4LDA8L2Nvb3JkaW5hdGVzPgogICAgICAg' +
  'IDwvTGluZVN0cmluZz4KICAgICAgPC9QbGFjZW1hcms+CiAgICAgIDxQbGFjZW1hcms+CiAgICAg' +
  'ICAgPG5hbWU+QXJlYSBBPC9uYW1lPgogICAgICAgIDxQb2x5Z29uPgogICAgICAgICAgPG91dGVy' +
  'Qm91bmRhcnlJcz4KICAgICAgICAgICAgPExpbmVhclJpbmc+CiAgICAgICAgICAgICAgPGNvb3Jk' +
  'aW5hdGVzPi03NC4wMDYwLDQwLjcxMjgsMCAtNzMuOTg2MCw0MC43MTI4LDAgLTczLjk4NjAsNDAu' +
  'NzI4OCwwIC03NC4wMDYwLDQwLjcyODgsMCAtNzQuMDA2MCw0MC43MTI4LDA8L2Nvb3JkaW5hdGVz' +
  'PgogICAgICAgICAgICA8L0xpbmVhclJpbmc+CiAgICAgICAgICA8L291dGVyQm91bmRhcnlJcz4K' +
  'ICAgICAgICA8L1BvbHlnb24+CiAgICAgIDwvUGxhY2VtYXJrPgogICAgPC9Gb2xkZXI+CiAgPC9E' +
  'b2N1bWVudD4KPC9rbWw+Cg==';

const KML_TEXT = atob(KML_B64);

const ORACLE = {
  placemarks: 3,
  points: 1,
  lineStrings: 1,
  polygons: 1,
  folders: 1,
  styles: 1,
  coordinateTuples: 8,
};

function rowsOf(t: ReturnType<typeof tool.run>): { headers: string[]; rows: string[][] } {
  const out = (t as { output?: string }).output ?? '{"rows":[]}';
  return JSON.parse(out) as { headers: string[]; rows: string[][] };
}

describe('kml-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects empty input synchronously', () => {
    expect(() => tool.run({ text: '', options: {} })).toThrow(/KML/i);
  });

  it('rejects a non-KML document', () => {
    expect(() => tool.run({ text: '<root><other/></root>', options: {} })).toThrow(/KML/i);
  });

  it('reads the summary', () => {
    const t = rowsOf(tool.run({ text: KML_TEXT, options: {} }));
    const m = new Map<string, string>(t.rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('Format')).toBe('KML');
    expect(m.get('Placemarks')).toBe(String(ORACLE.placemarks));
    expect(m.get('Points')).toBe(String(ORACLE.points));
    expect(m.get('Line strings')).toBe(String(ORACLE.lineStrings));
    expect(m.get('Polygons')).toBe(String(ORACLE.polygons));
    expect(m.get('Folders')).toBe(String(ORACLE.folders));
    expect(m.get('Styles')).toBe(String(ORACLE.styles));
    expect(m.get('Coordinate tuples')).toBe(String(ORACLE.coordinateTuples));
  });

  it('lists the placemarks with geometry types', () => {
    const t = rowsOf(tool.run({ text: KML_TEXT, options: { format: 'placemarks' } }));
    expect(t.rows).toHaveLength(ORACLE.placemarks);
    expect(t.rows[0]?.[1]).toBe('Point A');
    expect(t.rows[0]?.[2]).toBe('Point');
    expect(t.rows[1]?.[1]).toBe('Line A');
    expect(t.rows[1]?.[2]).toBe('LineString');
    expect(t.rows[2]?.[1]).toBe('Area A');
    expect(t.rows[2]?.[2]).toBe('Polygon');
  });
});
