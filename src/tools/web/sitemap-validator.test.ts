import { describe, it, expect } from 'vitest';
import tool from './sitemap-validator.tool';

const SITEMAP_B64 =
  'PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHVybHNldCB4bWxucz0iaHR0' +
  'cDovL3d3dy5zaXRlbWFwcy5vcmcvc2NoZW1hcy9zaXRlbWFwLzAuOSI+CiAgPHVybD4KICAgIDxs' +
  'b2M+aHR0cHM6Ly9leGFtcGxlLmNvbS88L2xvYz4KICAgIDxsYXN0bW9kPjIwMjYtMTEtMDc8L2xh' +
  'c3Rtb2Q+CiAgICA8Y2hhbmdlZnJlcT5kYWlseTwvY2hhbmdlZnJlcT4KICAgIDxwcmlvcml0eT4x' +
  'LjA8L3ByaW9yaXR5PgogIDwvdXJsPgogIDx1cmw+CiAgICA8bG9jPmh0dHBzOi8vZXhhbXBsZS5j' +
  'b20vYWJvdXQ8L2xvYz4KICAgIDxsYXN0bW9kPjIwMjYtMTEtMDFUMTA6MzA6MDArMDA6MDA8L2xh' +
  'c3Rtb2Q+CiAgICA8Y2hhbmdlZnJlcT5tb250aGx5PC9jaGFuZ2VmcmVxPgogICAgPHByaW9yaXR5' +
  'PjAuODwvcHJpb3JpdHk+CiAgPC91cmw+CiAgPHVybD4KICAgIDxsb2M+aHR0cHM6Ly9leGFtcGxl' +
  'LmNvbS9ibG9nL3Bvc3QtMTwvbG9jPgogICAgPGNoYW5nZWZyZXE+d2Vla2x5PC9jaGFuZ2VmcmVx' +
  'PgogICAgPHByaW9yaXR5PjAuNTwvcHJpb3JpdHk+CiAgPC91cmw+CjwvdXJsc2V0Pgo=';

const SITEMAP_TEXT = atob(SITEMAP_B64);

const ORACLE = {
  urls: 3,
  withLastmod: 2,
  withPriority: 3,
  issues: 0,
};

function rowsOf(t: ReturnType<typeof tool.run>): { headers: string[]; rows: string[][] } {
  const out = (t as { output?: string }).output ?? '{"rows":[]}';
  return JSON.parse(out) as { headers: string[]; rows: string[][] };
}

describe('sitemap-validator', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects empty input synchronously', () => {
    expect(() => tool.run({ text: '', options: {} })).toThrow(/sitemap/i);
  });

  it('rejects a non-sitemap document', () => {
    expect(() => tool.run({ text: '<html><body/></html>', options: {} })).toThrow(/sitemap/i);
  });

  it('reads a valid sitemap', () => {
    const t = rowsOf(tool.run({ text: SITEMAP_TEXT, options: {} }));
    const m = new Map<string, string>(t.rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('Format')).toBe('XML sitemap');
    expect(m.get('urlset root')).toBe('yes');
    expect(m.get('Namespace')).toBe('present');
    expect(m.get('URLs')).toBe(String(ORACLE.urls));
    expect(m.get('With lastmod')).toBe(String(ORACLE.withLastmod));
    expect(m.get('With priority')).toBe(String(ORACLE.withPriority));
    expect(m.get('Issues')).toBe(String(ORACLE.issues));
  });

  it('lists the URLs', () => {
    const t = rowsOf(tool.run({ text: SITEMAP_TEXT, options: { format: 'urls' } }));
    expect(t.rows).toHaveLength(ORACLE.urls);
    expect(t.rows[0]?.[1]).toBe('https://example.com/');
    expect(t.rows[0]?.[4]).toBe('1.0');
    expect(t.rows[2]?.[1]).toBe('https://example.com/blog/post-1');
  });

  it('flags a relative loc, a bad priority and a bad changefreq', () => {
    const bad =
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url>' +
      '<loc>/relative/path</loc><priority>1.5</priority><changefreq>sometimes</changefreq>' +
      '</url></urlset>';
    const t = rowsOf(tool.run({ text: bad, options: { format: 'issues' } }));
    const flat = t.rows.map((r) => r[2] ?? '').join('\n');
    expect(flat).toMatch(/absolute/i);
    expect(flat).toMatch(/priority/i);
    expect(flat).toMatch(/changefreq/i);
  });
});
