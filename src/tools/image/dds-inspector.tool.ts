import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './dds-inspector.meta';

const MAX_BYTES = 256 * 1024 * 1024;

const FOURCC_NAMES: Record<number, string> = {
  0x31545844: 'DXT1 (BC1)',
  0x33545844: 'DXT3 (BC2)',
  0x35545844: 'DXT5 (BC3)',
  0x31425441: 'ATI1 (BC4U)',
  0x32425441: 'ATI2 (BC5S)',
  0x44343142: 'BC4U',
  0x44353142: 'BC5S',
  0x44583532: 'DX10',
};

function fourccName(v: number): string {
  return FOURCC_NAMES[v] ?? 'unknown';
}

interface Finding {
  severity: 'error' | 'warn' | 'info';
  kind: string;
  detail: string;
}

interface Model {
  size: number;
  magicOk: boolean;
  headerSize: number;
  flags: number;
  height: number;
  width: number;
  pitch: number;
  depth: number;
  mipcount: number;
  ddspfFlags: number;
  fourCC: number;
  fourCCName: string;
  rgbBitCount: number;
  rMask: number;
  gMask: number;
  bMask: number;
  aMask: number;
  caps: number;
  findings: Finding[];
}

function u32(b: Uint8Array, o: number): number {
  return (
    ((b[o + 3] ?? 0) * 16777216 + (b[o + 2] ?? 0) * 65536 + (b[o + 1] ?? 0) * 256 + (b[o] ?? 0)) >>>
    0
  );
}

function ascii4(b: Uint8Array, off: number): string {
  let s = '';
  for (let i = 0; i < 4; i += 1) {
    const c = b[off + i] ?? 0;
    s += c >= 32 && c < 127 ? String.fromCharCode(c) : '.';
  }
  return s;
}

function buildModel(data: Uint8Array): Model {
  const findings: Finding[] = [];
  const size = data.length;
  let magicOk = false;
  const headerSize = size >= 128 ? u32(data, 4) : 0;
  const flags = size >= 128 ? u32(data, 8) : 0;
  const height = size >= 128 ? u32(data, 12) : 0;
  const width = size >= 128 ? u32(data, 16) : 0;
  const pitch = size >= 128 ? u32(data, 20) : 0;
  const depth = size >= 128 ? u32(data, 24) : 0;
  const mipcount = size >= 128 ? u32(data, 28) : 0;
  const ddspfFlags = size >= 128 ? u32(data, 80) : 0;
  const fourCC = size >= 128 ? u32(data, 84) : 0;
  const rgbBitCount = size >= 128 ? u32(data, 88) : 0;
  const rMask = size >= 128 ? u32(data, 92) : 0;
  const gMask = size >= 128 ? u32(data, 96) : 0;
  const bMask = size >= 128 ? u32(data, 100) : 0;
  const aMask = size >= 128 ? u32(data, 104) : 0;
  const caps = size >= 128 ? u32(data, 108) : 0;
  if (size >= 4 && ascii4(data, 0) === 'DDS ') {
    magicOk = true;
    if (size < 128) {
      findings.push({
        severity: 'error',
        kind: 'header',
        detail: 'The file is too short to contain a full DDS header.',
      });
    } else if (headerSize !== 124) {
      findings.push({
        severity: 'warn',
        kind: 'header',
        detail: 'Unusual DDS header size ' + headerSize + ' (expected 124).',
      });
    }
    const pf = size >= 128 ? u32(data, 76) : 0;
    if (size >= 128 && pf !== 32) {
      findings.push({
        severity: 'warn',
        kind: 'pixel',
        detail: 'Unusual pixel format size ' + pf + ' (expected 32).',
      });
    }
    const compressed = (ddspfFlags & 0x04) !== 0;
    if (compressed && fourCC !== 0) {
      if (fourccName(fourCC) === 'unknown') {
        findings.push({
          severity: 'warn',
          kind: 'fourcc',
          detail: 'Unrecognized compressed fourCC 0x' + fourCC.toString(16) + '.',
        });
      }
      const fmt = FOURCC_NAMES[fourCC];
      if (fmt !== undefined && fmt.startsWith('DXT1')) {
        const expected = Math.max(1, Math.ceil(width / 4)) * Math.max(1, Math.ceil(height / 4)) * 8;
        const total = size - 128;
        if (total < expected) {
          findings.push({
            severity: 'warn',
            kind: 'payload',
            detail:
              'A ' +
              width +
              'x' +
              height +
              ' DXT1 surface needs at least ' +
              expected +
              ' payload bytes; found ' +
              total +
              '.',
          });
        }
      }
    } else if (!compressed && rgbBitCount !== 0) {
      // raw RGB/RGBA surface; no payload check beyond presence
    }
  } else {
    findings.push({
      severity: 'error',
      kind: 'magic',
      detail: 'The file does not begin with a DDS magic (DDS ).',
    });
  }
  if (findings.length === 0) {
    findings.push({ severity: 'info', kind: 'ok', detail: 'The DDS header looks well-formed.' });
  }
  return {
    size,
    magicOk,
    headerSize,
    flags,
    height,
    width,
    pitch,
    depth,
    mipcount,
    ddspfFlags,
    fourCC,
    fourCCName: fourccName(fourCC),
    rgbBitCount,
    rMask,
    gMask,
    bMask,
    aMask,
    caps,
    findings,
  };
}

const tool: FileToolModule = {
  meta,
  async run(input: FileRunInput): Promise<FileRunResult> {
    const options = resolveOptions(meta, input.options);
    const file = (input.files ?? [])[0];
    if (file === undefined)
      throw new ToolError('Choose a DDS texture to inspect.', 'Drop a .dds file onto the tool.');
    if (file.size > MAX_BYTES)
      throw new ToolError('That DDS texture is too large.', 'Use a file under 256 MB.');
    const data = new Uint8Array(await file.arrayBuffer());
    const m = buildModel(data);
    const view = String(options.view ?? 'summary');
    let headers: string[];
    let rows: string[][];
    if (view === 'header') {
      headers = ['Field', 'Value'];
      rows = [
        ['Header size', String(m.headerSize)],
        ['Flags', '0x' + m.flags.toString(16)],
        ['Width', String(m.width)],
        ['Height', String(m.height)],
        ['Pitch / linear size', String(m.pitch)],
        ['Depth', String(m.depth)],
        ['Mipmap count', String(m.mipcount)],
        [
          'Pixel format size',
          String(m.ddspfFlags !== 0 || m.fourCC !== 0 ? m.headerSize : m.headerSize),
        ],
        ['Pixel format flags', '0x' + m.ddspfFlags.toString(16)],
        ['fourCC', m.fourCC !== 0 ? m.fourCCName + ' (0x' + m.fourCC.toString(16) + ')' : 'none'],
        ['RGB bit count', String(m.rgbBitCount)],
        ['Red mask', '0x' + m.rMask.toString(16)],
        ['Green mask', '0x' + m.gMask.toString(16)],
        ['Blue mask', '0x' + m.bMask.toString(16)],
        ['Alpha mask', '0x' + m.aMask.toString(16)],
        ['Caps', '0x' + m.caps.toString(16)],
      ];
    } else if (view === 'findings') {
      headers = ['Severity', 'Kind', 'Detail'];
      rows = m.findings.map((f) => [f.severity, f.kind, f.detail]);
      if (rows.length === 0) rows.push(['info', 'ok', 'No problems found.']);
    } else {
      headers = ['Property', 'Value'];
      rows = [
        ['File size', String(m.size) + ' B'],
        ['Magic', m.magicOk ? 'DDS (valid)' : 'INVALID'],
        ['Dimensions', String(m.width) + ' x ' + String(m.height)],
        ['Format', m.fourCC !== 0 ? m.fourCCName : String(m.rgbBitCount) + '-bit raw'],
        ['Mipmap levels', String(m.mipcount)],
        ['Pixel format flags', '0x' + m.ddspfFlags.toString(16)],
        ['Caps', '0x' + m.caps.toString(16)],
      ];
    }
    const report = { output: JSON.stringify({ headers, rows }), render: 'table' as const };
    const notes: string[] = [];
    notes.push(
      String(m.width) +
        ' x ' +
        String(m.height) +
        ' ' +
        (m.fourCC !== 0 ? m.fourCCName : String(m.rgbBitCount) + '-bit') +
        ' texture.',
    );
    return { outputs: [], report, notes, warnings: [] };
  },
};

export default tool;
