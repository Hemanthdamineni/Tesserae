import { describe, it, expect } from 'vitest';
import tool from './gitmodules-inspector.tool';

const GM_B64 =
  'W3N1Ym1vZHVsZSAibGliL3V0aWwiXQoJcGF0aCA9IGxpYi91dGlsCgl1cmwgPSBodHRwczovL2dp' +
  'dGh1Yi5jb20vZXhhbXBsZS91dGlsLmdpdApbc3VibW9kdWxlICJsaWIvdGhlbWVzIl0KCXBhdGgg' +
  'PSBsaWIvdGhlbWVzCgl1cmwgPSBodHRwczovL2dpdGh1Yi5jb20vZXhhbXBsZS90aGVtZXMuZ2l0' +
  'CglicmFuY2ggPSBtYWluCg==';

const GM_TEXT = atob(GM_B64);

const ORACLE = {
  submodules: 2,
  withPath: 2,
  withUrl: 2,
  withBranch: 1,
  issues: 0,
};

function rowsOf(t: ReturnType<typeof tool.run>): { headers: string[]; rows: string[][] } {
  const out = (t as { output?: string }).output ?? '{"rows":[]}';
  return JSON.parse(out) as { headers: string[]; rows: string[][] };
}

function summaryOf(t: ReturnType<typeof tool.run>): Map<string, string> {
  return new Map<string, string>(rowsOf(t).rows.map((r) => [r[0] ?? '', r[1] ?? '']));
}

describe('gitmodules-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects empty input synchronously', () => {
    expect(() => tool.run({ text: '', options: {} })).toThrow(/gitmodules/i);
  });

  it('reads the fixture summary', () => {
    const m = summaryOf(tool.run({ text: GM_TEXT, options: {} }));
    expect(m.get('Submodules')).toBe(String(ORACLE.submodules));
    expect(m.get('With path')).toBe(String(ORACLE.withPath));
    expect(m.get('With URL')).toBe(String(ORACLE.withUrl));
    expect(m.get('With branch')).toBe(String(ORACLE.withBranch));
    expect(m.get('Issues')).toBe(String(ORACLE.issues));
  });

  it('lists the submodules', () => {
    const t = rowsOf(tool.run({ text: GM_TEXT, options: { format: 'submodules' } }));
    expect(t.rows).toHaveLength(ORACLE.submodules);
    expect(t.rows[0]?.[1]).toBe('lib/util');
    expect(t.rows[0]?.[2]).toBe('lib/util');
    expect(t.rows[0]?.[3]).toBe('https://github.com/example/util.git');
    expect(t.rows[0]?.[4]).toBe('-');
    expect(t.rows[1]?.[2]).toBe('lib/themes');
    expect(t.rows[1]?.[4]).toBe('main');
  });

  it('flags a submodule with no url', () => {
    const bad = '[submodule "a"]\n\tpath = a\n';
    const t = rowsOf(tool.run({ text: bad, options: { format: 'issues' } }));
    const flat = t.rows.map((r) => r[2] ?? '').join('\n');
    expect(flat).toMatch(/has no url/i);
  });

  it('flags a path that does not match the section name', () => {
    const bad = '[submodule "lib/util"]\n\tpath = other\n\turl = https://x/y.git\n';
    const t = rowsOf(tool.run({ text: bad, options: { format: 'issues' } }));
    const flat = t.rows.map((r) => r[2] ?? '').join('\n');
    expect(flat).toMatch(/does not match/i);
  });

  it('flags a malformed line', () => {
    const bad = '[submodule "x"]\nnot a key value\n';
    const t = rowsOf(tool.run({ text: bad, options: { format: 'issues' } }));
    const flat = t.rows.map((r) => r[2] ?? '').join('\n');
    expect(flat).toMatch(/Malformed/i);
  });
});
