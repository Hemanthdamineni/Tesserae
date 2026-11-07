import { describe, it, expect } from 'vitest';
import tool from './nginx-config-auditor.tool';

const NGINX_B64 =
  'dXNlciB3d3ctZGF0YTsKd29ya2VyX3Byb2Nlc3NlcyBhdXRvOwpldmVudHMgeyB3b3JrZXJfY29u' +
  'bmVjdGlvbnMgMTAyNDsgfQpodHRwIHsKICBzZXJ2ZXJfdG9rZW5zIG9mZjsKICBzZXJ2ZXIgewog' +
  'ICAgbGlzdGVuIDgwOwogICAgc2VydmVyX25hbWUgZXhhbXBsZS5jb207CiAgICBsb2NhdGlvbiAv' +
  'IHsgcHJveHlfcGFzcyBodHRwOi8vYmFja2VuZDsgfQogIH0KICBzZXJ2ZXIgewogICAgbGlzdGVu' +
  'IDQ0MyBzc2w7CiAgICBzc2xfcHJvdG9jb2xzIFRMU3YxLjIgVExTdjEuMzsKICAgIHNzbF9jaXBo' +
  'ZXJzIEhJR0g6IWFOVUxMOiFNRDU7CiAgICBzZXJ2ZXJfbmFtZSBzZWN1cmUuZXhhbXBsZS5jb207' +
  'CiAgICBsb2NhdGlvbiAvIHsgcmV0dXJuIDIwMCAib2siOyB9CiAgfQp9Cg==';

const CONFIG_TEXT = atob(NGINX_B64);

const ORACLE = {
  serverBlocks: 2,
  listens: 2,
  sslServers: 1,
  plainServers: 1,
  serverTokensOff: 'yes',
};

function rowsOf(t: ReturnType<typeof tool.run>): { headers: string[]; rows: string[][] } {
  const out = (t as { output?: string }).output ?? '{"rows":[]}';
  return JSON.parse(out) as { headers: string[]; rows: string[][] };
}

function summaryOf(t: ReturnType<typeof tool.run>): Map<string, string> {
  const rows = rowsOf(t).rows;
  return new Map<string, string>(rows.map((r) => [r[0] ?? '', r[1] ?? '']));
}

describe('nginx-config-auditor', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects empty input synchronously', () => {
    expect(() => tool.run({ text: '', options: {} })).toThrow(/NGINX|configuration/i);
  });

  it('rejects non-config text', () => {
    expect(() =>
      tool.run({ text: 'just some prose with no directives at all', options: {} }),
    ).toThrow(/nginx|configuration/i);
  });

  it('reads the config summary', () => {
    const m = summaryOf(tool.run({ text: CONFIG_TEXT, options: {} }));
    expect(m.get('Server blocks')).toBe(String(ORACLE.serverBlocks));
    expect(m.get('Listen directives')).toBe(String(ORACLE.listens));
    expect(m.get('TLS servers')).toBe(String(ORACLE.sslServers));
    expect(m.get('Plain HTTP servers')).toBe(String(ORACLE.plainServers));
    expect(m.get('server_tokens off')).toBe(ORACLE.serverTokensOff);
    expect(m.get('Braces balanced')).toBe('yes');
  });

  it('flags the missing https redirect when http and https coexist', () => {
    const t = rowsOf(tool.run({ text: CONFIG_TEXT, options: { format: 'issues' } }));
    const flat = t.rows.map((r) => r[2] ?? '').join('\n');
    expect(flat).toMatch(/redirect/i);
    // this fixture sets server_tokens off, so that issue must NOT be reported
    expect(flat).not.toMatch(/server_tokens/i);
  });

  it('flags server_tokens when it is not off', () => {
    const bad = 'http { server { listen 80; server_name a.example; } }';
    const t = rowsOf(tool.run({ text: bad, options: { format: 'issues' } }));
    const flat = t.rows.map((r) => r[2] ?? '').join('\n');
    expect(flat).toMatch(/server_tokens/i);
  });

  it('flags an unbalanced brace', () => {
    const bad = 'http { server { listen 80; server_tokens off; }';
    const t = rowsOf(tool.run({ text: bad, options: { format: 'issues' } }));
    const flat = t.rows.map((r) => r[2] ?? '').join('\n');
    expect(flat).toMatch(/unbalanced/i);
  });

  it('lists directives', () => {
    const t = rowsOf(tool.run({ text: CONFIG_TEXT, options: { format: 'directives' } }));
    const flat = t.rows.map((r) => r[0] ?? '').join(' ');
    expect(flat).toContain('server');
    expect(flat).toContain('server_tokens');
  });
});
