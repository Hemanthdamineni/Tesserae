import { describe, it, expect } from 'vitest';
import tool from './vtt-inspector.tool';

const VTT_B64 =
  'V0VCVlRUCgppbnRybwowMDowMDowMS4wMDAgLS0+IDAwOjAwOjA0LjAwMApIZWxsbyB3b3JsZAoK' +
  'MDA6MDA6MDUuNTAwIC0tPiAwMDowMDowNi4yNTAgYWxpZ246c3RhcnQgcG9zaXRpb246MCUKU2Vj' +
  'b25kIGN1ZQoKMDA6MDA6MDcuMDAwIC0tPiAwMDowMDowOS41MDAKVGhpcmQgY3VlIHdpdGgKdHdv' +
  'IGxpbmVzCg==';
function vttOf(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

const VTT = vttOf(VTT_B64);

const ORACLE = { cues: 3, runtime: '00:00:09.500', ids: 1, settings: 1, issues: 0 };

async function tableOf(
  text: string,
  options: Record<string, string | number | boolean> = {},
): Promise<{ headers: string[]; rows: string[][] }> {
  const r = await tool.run({ text, options });
  return JSON.parse(r.output ?? '{"rows":[]}') as { headers: string[]; rows: string[][] };
}

describe('vtt-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects a non-WebVTT text', async () => {
    expect(() => tool.run({ text: 'not a subtitle file', options: {} })).toThrow(/WEBVTT/i);
  });

  it('reads the summary', async () => {
    const t = await tableOf(VTT);
    const m = new Map<string, string>(t.rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('Cues')).toBe(String(ORACLE.cues));
    expect(m.get('Total runtime')).toBe(ORACLE.runtime);
    expect(m.get('Cues with identifier')).toBe(String(ORACLE.ids));
    expect(m.get('Cues with settings')).toBe(String(ORACLE.settings));
    expect(m.get('Issues')).toBe('0');
  });

  it('lists the cues', async () => {
    const t = await tableOf(VTT, { format: 'cues' });
    expect(t.rows).toHaveLength(ORACLE.cues);
    expect(t.rows[0]?.[3]).toBe('');
    expect(t.rows[1]?.[3]).toContain('align:start');
    expect(t.rows[0]?.[4]).toBe('Hello world');
  });

  it('finds an overlapping-cue issue', async () => {
    const bad = VTT + '\n00:00:03.000 --> 00:00:05.000\nOverlap\n';
    const t = await tableOf(bad, { format: 'issues' });
    const flat = t.rows.map((r) => r[0] ?? '').join('\n');
    expect(flat).toMatch(/overlap/i);
  });
});
