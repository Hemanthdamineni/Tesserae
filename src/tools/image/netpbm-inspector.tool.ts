import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './netpbm-inspector.meta';

const MAX_BYTES = 64 * 1024 * 1024;

const MAGIC_INFO: Record<string, { kind: string; binary: boolean; hasMaxval: boolean }> = {
  P1: { kind: 'PBM (bitmap)', binary: false, hasMaxval: false },
  P4: { kind: 'PBM (bitmap)', binary: true, hasMaxval: false },
  P2: { kind: 'PGM (graymap)', binary: false, hasMaxval: true },
  P5: { kind: 'PGM (graymap)', binary: true, hasMaxval: true },
  P3: { kind: 'PPM (pixmap)', binary: false, hasMaxval: true },
  P6: { kind: 'PPM (pixmap)', binary: true, hasMaxval: true },
};

type Magic = keyof typeof MAGIC_INFO;

interface Finding {
  severity: 'error' | 'warn' | 'info';
  kind: string;
  detail: string;
}

interface Model {
  magic: Magic;
  kind: string;
  binary: boolean;
  hasMaxval: boolean;
  width: number;
  height: number;
  maxval: number;
  pixelBytes: number;
  pixelTokens: number;
  comments: number;
  findings: Finding[];
}

/** Tokenise the header region: whitespace/comments separate the tokens. */
function headerTokens(data: Uint8Array, start: number): string[] {
  const out: string[] = [];
  let i = start;
  let cur = '';
  const push = () => {
    if (cur) {
      out.push(cur);
      cur = '';
    }
  };
  while (i < data.length && out.length < 3) {
    const byte = data[i]!;
    if (byte === 35 /* # */) {
      push();
      while (i < data.length && data[i] !== 10 && data[i] !== 13) i += 1;
      continue;
    }
    if (byte === 10 || byte === 13 || byte === 32 || byte === 9) {
      push();
    } else {
      cur += String.fromCharCode(byte);
    }
    i += 1;
  }
  push();
  return out;
}

function buildModel(data: Uint8Array): Model {
  const findings: Finding[] = [];
  const first = String.fromCharCode(data[0] ?? 0);
  const second = String.fromCharCode(data[1] ?? 0);
  const magic = (first + second) as Magic;

  const info = MAGIC_INFO[magic]!;
  if (!info) {
    throw new ToolError('Not a Netpbm file.', 'The first two bytes must be a P1–P6 magic number.');
  }

  const tokens = headerTokens(data, 2);
  if (tokens.length < 2) {
    throw new ToolError(
      'Netpbm header is truncated.',
      'Expected at least a width and a height after the magic number.',
    );
  }

  const width = Number(tokens[0]);
  const height = Number(tokens[1]);
  if (!Number.isInteger(width) || width <= 0) {
    findings.push({
      severity: 'error',
      kind: 'bad-width',
      detail: `Width is not a positive integer (got "${tokens[0]}").`,
    });
  }
  if (!Number.isInteger(height) || height <= 0) {
    findings.push({
      severity: 'error',
      kind: 'bad-height',
      detail: `Height is not a positive integer (got "${tokens[1]}").`,
    });
  }

  let maxval = 1;
  if (info.hasMaxval) {
    const raw = tokens[2];
    if (raw === undefined) {
      findings.push({
        severity: 'error',
        kind: 'missing-maxval',
        detail: 'A max value is required for ' + info.kind + ' but none was found.',
      });
    } else {
      maxval = Number(raw);
      if (!Number.isInteger(maxval) || maxval < 1 || maxval > 65535) {
        findings.push({
          severity: 'error',
          kind: 'bad-maxval',
          detail: `Max value must be 1–65535 (got "${raw}").`,
        });
        maxval = 1;
      }
    }
  }

  // Expected payload bytes.
  let pixelBytes: number;
  let pixelTokens = 0;
  const ok = width > 0 && height > 0;
  if (ok) {
    const pixels = width * height;
    if (magic === 'P1' || magic === 'P4') {
      pixelBytes = info.binary ? Math.ceil(pixels / 8) : 0; // P1 counts tokens instead
    } else if (magic === 'P2' || magic === 'P5') {
      const bytesPer = maxval > 255 ? 2 : 1;
      pixelBytes = info.binary ? pixels * bytesPer : 0;
    } else {
      const bytesPer = maxval > 255 ? 2 : 1;
      pixelBytes = info.binary ? pixels * 3 * bytesPer : 0;
    }
    if (!info.binary) {
      // Count ASCII pixel tokens after the header (approximate by non-space runs).
      let i = dataOffsetEnd(data);
      let count = 0;
      let inTok = false;
      for (; i < data.length; i += 1) {
        const b = data[i]!;
        const ws = b === 32 || b === 9 || b === 10 || b === 13;
        if (!ws && !inTok) {
          inTok = true;
          count += 1;
        } else if (ws) {
          inTok = false;
        }
      }
      pixelTokens = count;
    }
  } else {
    pixelBytes = 0;
  }

  return {
    magic,
    kind: info.kind,
    binary: info.binary,
    hasMaxval: info.hasMaxval,
    width,
    height,
    maxval,
    pixelBytes,
    pixelTokens,
    comments: 0,
    findings,
  };
}

/** Byte offset just past the header, where the pixel data begins. */
function dataOffsetEnd(data: Uint8Array): number {
  // Re-walk to the third header token then skip its trailing whitespace.
  const magic = String.fromCharCode(data[0] ?? 0) + String.fromCharCode(data[1] ?? 0);
  const want = (MAGIC_INFO[magic as Magic] ?? {}).hasMaxval ? 3 : 2;
  let i = 2;
  let seen = 0;
  let cur = '';
  while (i < data.length && seen < want) {
    const byte = data[i]!;
    if (byte === 35) {
      while (i < data.length && data[i] !== 10 && data[i] !== 13) i += 1;
      continue;
    }
    if (byte === 10 || byte === 13 || byte === 32 || byte === 9) {
      if (cur) {
        seen += 1;
        cur = '';
      }
    } else {
      cur += String.fromCharCode(byte);
    }
    i += 1;
  }
  return i;
}

const tool: FileToolModule = {
  meta,
  async run(input: FileRunInput): Promise<FileRunResult> {
    const options = resolveOptions(meta, input.options);
    const file = (input.files ?? [])[0];
    if (file === undefined)
      throw new ToolError(
        'Choose a Netpbm image to inspect.',
        'Drop a .pbm, .pgm, .ppm or .pnm file.',
      );
    if (file.size > MAX_BYTES)
      throw new ToolError('That Netpbm image is too large.', 'Use a file under 64 MB.');
    const data = new Uint8Array(await file.arrayBuffer());
    const m = buildModel(data);
    const view = String(options.view ?? 'summary');

    let headers: string[];
    let rows: string[][];
    if (view === 'header') {
      headers = ['Field', 'Value'];
      rows = [
        ['Magic', m.magic + ' (' + m.kind + ')'],
        ['Encoding', m.binary ? 'binary (raw)' : 'ASCII'],
        ['Width', String(m.width)],
        ['Height', String(m.height)],
        ['Max value', m.hasMaxval ? String(m.maxval) : 'n/a'],
        [
          'Pixel data',
          m.binary ? String(m.pixelBytes) + ' bytes' : String(m.pixelTokens) + ' tokens',
        ],
      ];
    } else if (view === 'pixels') {
      headers = ['Property', 'Value'];
      rows = [
        ['Pixels total', String(m.width * m.height)],
        ['Pixel data bytes', String(m.pixelBytes)],
        ['Pixel tokens (ASCII)', String(m.pixelTokens)],
      ];
    } else {
      headers = ['Property', 'Value'];
      rows = [
        ['Variant', m.kind],
        ['Encoding', m.binary ? 'raw binary' : 'ASCII text'],
        ['Dimensions', String(m.width) + ' x ' + String(m.height)],
        ['Max value', m.hasMaxval ? String(m.maxval) : 'n/a'],
      ];
    }
    const report = { output: JSON.stringify({ headers, rows }), render: 'table' as const };
    const notes: string[] = [m.width + ' x ' + m.height + ' ' + m.kind + '.'];
    if (m.findings.some((f) => f.severity === 'error'))
      notes.push('Header problems were found; see the findings.');
    return { outputs: [], report, notes, warnings: [] };
  },
};

export default tool;
