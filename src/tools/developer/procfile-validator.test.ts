import { describe, it, expect } from 'vitest';
import tool from './procfile-validator.tool';

const PF_B64 =
  'd2ViOiBub2RlIHNlcnZlci5qcwp3b3JrZXI6IG5vZGUgd29ya2VyLmpzCmNsb2NrOiBub2RlIGNs' + 'b2NrLmpzCg==';

const PF_TEXT = atob(PF_B64);

const ORACLE = {
  processes: 3,
  distinct: 3,
  withCommand: 3,
  issues: 0,
};

function rowsOf(t: ReturnType<typeof tool.run>): { headers: string[]; rows: string[][] } {
  const out = (t as { output?: string }).output ?? '{"rows":[]}';
  return JSON.parse(out) as { headers: string[]; rows: string[][] };
}

function summaryOf(t: ReturnType<typeof tool.run>): Map<string, string> {
  return new Map<string, string>(rowsOf(t).rows.map((r) => [r[0] ?? '', r[1] ?? '']));
}

describe('procfile-validator', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects empty input synchronously', () => {
    expect(() => tool.run({ text: '', options: {} })).toThrow(/Procfile/i);
  });

  it('reads the fixture summary', () => {
    const m = summaryOf(tool.run({ text: PF_TEXT, options: {} }));
    expect(m.get('Processes')).toBe(String(ORACLE.processes));
    expect(m.get('Distinct types')).toBe(String(ORACLE.distinct));
    expect(m.get('With command')).toBe(String(ORACLE.withCommand));
    expect(m.get('Issues')).toBe(String(ORACLE.issues));
  });

  it('lists the processes', () => {
    const t = rowsOf(tool.run({ text: PF_TEXT, options: { format: 'processes' } }));
    expect(t.rows).toHaveLength(ORACLE.processes);
    expect(t.rows[0]?.[2]).toBe('web');
    expect(t.rows[0]?.[3]).toBe('node server.js');
    expect(t.rows[1]?.[2]).toBe('worker');
    expect(t.rows[2]?.[2]).toBe('clock');
  });

  it('flags a line with no colon and an empty command', () => {
    const bad = 'web: node server.js\njust-a-command\nworker:\n';
    const t = rowsOf(tool.run({ text: bad, options: { format: 'issues' } }));
    const flat = t.rows.map((r) => r[2] ?? '').join('\n');
    expect(flat).toMatch(/no colon/i);
    expect(flat).toMatch(/empty command/i);
  });

  it('flags a duplicate process type', () => {
    const bad = 'web: node a.js\nweb: node b.js\n';
    const t = rowsOf(tool.run({ text: bad, options: { format: 'issues' } }));
    const flat = t.rows.map((r) => r[2] ?? '').join('\n');
    expect(flat).toMatch(/more than once/i);
  });

  it('flags an invalid process type character', () => {
    const bad = 'we b: node a.js\n';
    const t = rowsOf(tool.run({ text: bad, options: { format: 'issues' } }));
    const flat = t.rows.map((r) => r[2] ?? '').join('\n');
    expect(flat).toMatch(/invalid characters/i);
  });
});
