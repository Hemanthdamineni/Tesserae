import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const decoded = {
  channels: [
    Float32Array.from({ length: 800 }, (_, i) => Math.sin((2 * Math.PI * 440 * i) / 8000)),
  ],
  sampleRate: 8000,
  byteSize: 1644,
  mimeType: 'audio/wav',
};

vi.mock('./lib', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib')>();
  return { ...actual, decodeFile: vi.fn(async () => decoded) };
});

import tool from './audio-convert.tool';

/** The reference tool is the system `ffprobe`; skip when it is not installed. */
const hasFfprobe = (() => {
  try {
    execFileSync('ffprobe', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

describe('audio-convert external golden output', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it.runIf(hasFfprobe)(
    'produces a WAV stream accepted by ffprobe with the requested format',
    async () => {
      const result = await tool.run({
        files: [new File(['placeholder'], 'tone.input')],
        options: { format: 'wav', sampleRate: '16000', channels: 'stereo' },
      });
      const output = result.outputs[0];
      expect(output).toBeDefined();

      const dir = mkdtempSync(join(tmpdir(), 'tesserae-audio-golden-'));
      tempDirs.push(dir);
      const path = join(dir, output!.filename);
      writeFileSync(path, Buffer.from(await output!.blob.arrayBuffer()));

      const probe = JSON.parse(
        execFileSync(
          'ffprobe',
          [
            '-v',
            'error',
            '-show_entries',
            'stream=codec_name,sample_rate,channels,duration',
            '-of',
            'json',
            path,
          ],
          { encoding: 'utf8' },
        ),
      ) as { streams?: Array<Record<string, string>> };
      const stream = probe.streams?.[0];

      expect(stream).toMatchObject({
        codec_name: 'pcm_s16le',
        sample_rate: '16000',
        channels: 2,
      });
      expect(Number(stream?.duration)).toBeCloseTo(0.1, 3);
    },
  );
});
