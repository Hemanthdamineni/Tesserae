import { describe, it, expect } from 'vitest';
import tool from './packages-lock-inspector.tool';

const PL_B64 =
  'eyJuYW1lIjoibXktYXBwIiwidmVyc2lvbiI6IjEuMC4wIiwibG9ja2ZpbGVWZXJzaW9uIjozLCJyZXF1' +
  'aXJlcyI6dHJ1ZSwicGFja2FnZXMiOnsiIjp7Im5hbWUiOiJteS1hcHAiLCJ2ZXJzaW9uIjoiMS4wLjAi' +
  'LCJsaWNlbnNlIjoiTUlUIiwiZGVwZW5kZW5jaWVzIjp7ImV4cHJlc3MiOiJeNC4xOC4wIiwibG9kYXNo' +
  'IjoiXjQuMTcuMjEifX0sIm5vZGVfbW9kdWxlcy9leHByZXNzIjp7InZlcnNpb24iOiI0LjE4LjIiLCJy' +
  'ZXNvbHZlZCI6Imh0dHBzOi8vcmVnaXN0cnkubnBtanMub3JnL2V4cHJlc3MvLS9leHByZXNzLTQuMTgu' +
  'Mi50Z3oiLCJpbnRlZ3JpdHkiOiJzaGE1MTItYWJjZGVmIiwibGljZW5zZSI6Ik1JVCIsImVuZ2luZXMi' +
  'Onsibm9kZSI6Ij49IDAuMTAuMCJ9fSwibm9kZV9tb2R1bGVzL2xvZGFzaCI6eyJ2ZXJzaW9uIjoiNC4x' +
  'Ny4yMSIsInJlc29sdmVkIjoiaHR0cHM6Ly9yZWdpc3RyeS5ucG1qcy5vcmcvbG9kYXNoLy0vbG9kYXNo' +
  'LTQuMTcuMjEudGd6IiwiaW50ZWdyaXR5Ijoic2hhNTEyLTEyMzQ1NiIsImxpY2Vuc2UiOiJNSVQifX19';

const PL_TEXT = atob(PL_B64);

const ORACLE = {
  lockfileVersion: '3',
  rootName: 'my-app',
  rootVersion: '1.0.0',
  packages: 2,
  withResolved: 2,
  withIntegrity: 2,
  dev: 0,
  rootDeps: 2,
  issues: 0,
};

function rowsOf(t: ReturnType<typeof tool.run>): { headers: string[]; rows: string[][] } {
  const out = (t as { output?: string }).output ?? '{"rows":[]}';
  return JSON.parse(out) as { headers: string[]; rows: string[][] };
}

function summaryOf(t: ReturnType<typeof tool.run>): Map<string, string> {
  return new Map<string, string>(rowsOf(t).rows.map((r) => [r[0] ?? '', r[1] ?? '']));
}

describe('packages-lock-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects empty input synchronously', () => {
    expect(() => tool.run({ text: '', options: {} })).toThrow(/lockfile/i);
  });

  it('rejects non-JSON input', () => {
    expect(() => tool.run({ text: 'nope', options: {} })).toThrow(/JSON|lock/i);
  });

  it('rejects JSON that is not a lockfile', () => {
    expect(() => tool.run({ text: '{"name":"x"}', options: {} })).toThrow(/lock/i);
  });

  it('reads the fixture summary', () => {
    const m = summaryOf(tool.run({ text: PL_TEXT, options: {} }));
    expect(m.get('lockfileVersion')).toBe(ORACLE.lockfileVersion);
    expect(m.get('Root name')).toBe(ORACLE.rootName);
    expect(m.get('Root version')).toBe(ORACLE.rootVersion);
    expect(m.get('Packages')).toBe(String(ORACLE.packages));
    expect(m.get('With resolved URL')).toBe(String(ORACLE.withResolved));
    expect(m.get('With integrity hash')).toBe(String(ORACLE.withIntegrity));
    expect(m.get('Dev packages')).toBe(String(ORACLE.dev));
    expect(m.get('Root dependencies')).toBe(String(ORACLE.rootDeps));
    expect(m.get('Issues')).toBe(String(ORACLE.issues));
  });

  it('lists the packages', () => {
    const t = rowsOf(tool.run({ text: PL_TEXT, options: { format: 'packages' } }));
    expect(t.rows).toHaveLength(ORACLE.packages);
    expect(t.rows[0]?.[1]).toBe('express');
    expect(t.rows[0]?.[2]).toBe('4.18.2');
    expect(t.rows[0]?.[3]).toBe('yes');
    expect(t.rows[0]?.[4]).toBe('yes');
    expect(t.rows[1]?.[1]).toBe('lodash');
    expect(t.rows[1]?.[2]).toBe('4.17.21');
  });

  it('flags a package missing resolved and integrity', () => {
    const bad = JSON.stringify({
      name: 'x',
      version: '1.0.0',
      lockfileVersion: 3,
      packages: { '': { name: 'x', version: '1.0.0' }, 'node_modules/a': { version: '1.0.0' } },
    });
    const t = rowsOf(tool.run({ text: bad, options: { format: 'issues' } }));
    const flat = t.rows.map((r) => r[2] ?? '').join('\n');
    expect(flat).toMatch(/no resolved URL/i);
    expect(flat).toMatch(/no integrity hash/i);
  });

  it('accepts a v1 dependencies tree', () => {
    const v1 = JSON.stringify({
      name: 'y',
      version: '2.0.0',
      lockfileVersion: 1,
      dependencies: {
        aa: { version: '1.0.0', resolved: 'https://r/aa.tgz', integrity: 'sha512-x' },
        bb: {
          version: '2.0.0',
          resolved: 'https://r/bb.tgz',
          integrity: 'sha512-y',
          dependencies: {
            cc: { version: '3.0.0', resolved: 'https://r/cc.tgz', integrity: 'sha512-z' },
          },
        },
      },
    });
    const m = summaryOf(tool.run({ text: v1, options: {} }));
    expect(m.get('Packages')).toBe('3');
    expect(m.get('Issues')).toBe('0');
  });
});
