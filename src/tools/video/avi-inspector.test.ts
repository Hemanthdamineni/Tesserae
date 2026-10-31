import { describe, it, expect } from 'vitest';
import tool from './avi-inspector.tool';

const AVI_B64 =
  'UklGRggBAABBVkkgTElTVMAAAABoZHJsYXZpaDgAAABAnAAAAPkVAAAAAAAQAAAAAQAAAAAAAAAB' +
  'AAAAAAAAAKAAAAB4AAAAAAAAAAAAAAAAAAAAAAAAAExJU1R0AAAAc3RybHN0cmg4AAAAdmlkc01K' +
  'UEcAAAAAAAAAAAAAAAABAAAAGQAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABzdHJmKAAA' +
  'ACgAAACgAAAAeAAAAAEAGABNSlBHAOEAAAAAAAAAAAAAAAAAAAAAAABMSVNUHAAAAG1vdmkwMGRj' +
  'EAAAAAAAAAAAAAAAAAAAAAAAAABpZHgxEAAAADAwZGMQAAAABAAAAAAAAAA=' +
  '';

const ORACLE = {
  size: 272,
  form: 'AVI ',
  width: 160,
  height: 120,
  fps: 25,
  totalFrames: 1,
  streamCount: 1,
  streamType: 'Video',
  codec: 'MJPG',
  bitDepth: 24,
};

function b64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function fileOf(bytes: Uint8Array, name = 'x.avi'): File {
  const copy = new Uint8Array(bytes);
  return new File([copy.buffer as ArrayBuffer], name, { type: 'video/x-msvideo' });
}

async function tableOf(
  f: File,
  options: Record<string, string | number | boolean> = {},
): Promise<{ headers: string[]; rows: string[][] }> {
  const r = await tool.run({ files: [f], options });
  return JSON.parse(r.report?.output ?? '{"rows":[]}') as { headers: string[]; rows: string[][] };
}

describe('avi-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects a non-AVI file', async () => {
    await expect(tableOf(fileOf(new Uint8Array(20), 'bad.bin'))).rejects.toThrow(/AVI/);
  });

  it('reads the summary view', async () => {
    const t = await tableOf(fileOf(b64(AVI_B64)), { view: 'summary' });
    const m = new Map<string, string>(t.rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('File size')).toBe('272 B');
    expect(m.get('Container')).toBe('RIFF / AVI');
    expect(m.get('Dimensions')).toBe('160 x 120');
    expect(m.get('Frame rate')).toBe('25.00 fps');
    expect(m.get('Total frames')).toBe('1');
    expect(m.get('Streams')).toBe('1');
    expect(m.get('Video codec')).toBe('MJPG');
  });

  it('lists the chunk tree in order', async () => {
    const t = await tableOf(fileOf(b64(AVI_B64)), { view: 'chunks' });
    const fourccs = t.rows.map((r) => r[1] ?? '');
    expect(fourccs).toContain('RIFF');
    expect(fourccs).toContain('LIST');
    expect(fourccs).toContain('avih');
    expect(fourccs).toContain('strh');
    expect(fourccs).toContain('strf');
    expect(fourccs).toContain('idx1');
    // RIFF must be the first row
    expect(t.rows[0]?.[1]).toBe('RIFF');
  });

  it('decodes the video stream details', async () => {
    const t = await tableOf(fileOf(b64(AVI_B64)), { view: 'streams' });
    expect(t.rows).toHaveLength(1);
    expect(t.rows[0]?.[1]).toBe('Video');
    expect(t.rows[0]?.[2]).toBe('MJPG');
    expect(t.rows[0]?.[4]).toContain('24-bit');
    expect(t.rows[0]?.[4]).toContain('MJPG');
  });

  it('reports stream rate from scale and rate fields', async () => {
    const t = await tableOf(fileOf(b64(AVI_B64)), { view: 'streams' });
    expect(t.rows[0]?.[3]).toBe('25.00 fps');
  });
});
