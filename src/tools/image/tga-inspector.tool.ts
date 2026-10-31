import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './tga-inspector.meta';

const MAX_BYTES = 128 * 1024 * 1024;

const TYPE_NAMES: Record<number, string> = {
  1: 'uncompressed colormapped',
  2: 'uncompressed truecolor',
  3: 'uncompressed grayscale',
  9: 'RLE colormapped',
  10: 'RLE truecolor',
  11: 'RLE grayscale',
};

interface Finding {
  severity: 'error' | 'warn' | 'info';
  kind: string;
  detail: string;
}

interface Model {
  size: number;
  idlen: number;
  cmtype: number;
  imgtype: number;
  typeName: string;
  cmFirst: number;
  cmCount: number;
  cmBpp: number;
  xoff: number;
  yoff: number;
  width: number;
  height: number;
  pixdepth: number;
  alphaBits: number;
  origin: number;
  dataOffset: number;
  hasFooter: boolean;
  findings: Finding[];
}

function ascii(b: Uint8Array, off: number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i += 1) {
    const c = b[off + i] ?? 0;
    s += c >= 32 && c < 127 ? String.fromCharCode(c) : '.';
  }
  return s;
}

function buildModel(data: Uint8Array): Model {
  const findings: Finding[] = [];
  const size = data.length;
  let idlen = 0;
  let cmtype = 0;
  let imgtype = 0;
  let cmFirst = 0;
  let cmCount = 0;
  let cmBpp = 0;
  let xoff = 0;
  let yoff = 0;
  let width = 0;
  let height = 0;
  let pixdepth = 0;
  let alphaBits = 0;
  let origin = 0;
  let hasFooter = false;
  if (size < 18) {
    findings.push({
      severity: 'error',
      kind: 'header',
      detail: 'The file is too short to contain an 18-byte TGA header.',
    });
    return {
      size,
      idlen,
      cmtype,
      imgtype,
      typeName: 'unknown',
      cmFirst,
      cmCount,
      cmBpp,
      xoff,
      yoff,
      width,
      height,
      pixdepth,
      alphaBits,
      origin,
      dataOffset: 0,
      hasFooter,
      findings,
    };
  }
  idlen = data[0] ?? 0;
  cmtype = data[1] ?? 0;
  imgtype = data[2] ?? 0;
  cmFirst = ((data[4] ?? 0) * 256 + (data[3] ?? 0)) >>> 0;
  cmCount = ((data[6] ?? 0) * 256 + (data[5] ?? 0)) >>> 0;
  cmBpp = data[7] ?? 0;
  xoff = ((data[9] ?? 0) * 256 + (data[8] ?? 0)) >>> 0;
  yoff = ((data[11] ?? 0) * 256 + (data[10] ?? 0)) >>> 0;
  width = ((data[13] ?? 0) * 256 + (data[12] ?? 0)) >>> 0;
  height = ((data[15] ?? 0) * 256 + (data[14] ?? 0)) >>> 0;
  pixdepth = data[16] ?? 0;
  const imdesc = data[17] ?? 0;
  alphaBits = imdesc & 0x0f;
  origin = (imdesc >> 4) & 0x03;
  const typeName = TYPE_NAMES[imgtype] ?? 'unknown';
  if (TYPE_NAMES[imgtype] === undefined) {
    findings.push({
      severity: 'warn',
      kind: 'type',
      detail: 'Image type ' + imgtype + ' is not a standard TGA type.',
    });
  }
  const cmapBytes = cmtype ? cmCount * (cmBpp >> 3) : 0;
  const dataOffset = 18 + idlen + cmapBytes;
  if (dataOffset > size) {
    findings.push({
      severity: 'error',
      kind: 'color',
      detail: 'The color map spec points ' + dataOffset + ' bytes into a ' + size + '-byte file.',
    });
  }
  const fStart = size - 18;
  const sig = 'TRUEVISION-XFILE.';
  hasFooter = size >= 26 && ascii(data, fStart, 17) === sig && (data[size - 1] ?? 0) === 0;
  if (findings.length === 0) {
    findings.push({ severity: 'info', kind: 'ok', detail: 'The TGA header looks well-formed.' });
  }
  return {
    size,
    idlen,
    cmtype,
    imgtype,
    typeName,
    cmFirst,
    cmCount,
    cmBpp,
    xoff,
    yoff,
    width,
    height,
    pixdepth,
    alphaBits,
    origin,
    dataOffset,
    hasFooter,
    findings,
  };
}

const tool: FileToolModule = {
  meta,
  async run(input: FileRunInput): Promise<FileRunResult> {
    const options = resolveOptions(meta, input.options);
    const file = (input.files ?? [])[0];
    if (file === undefined)
      throw new ToolError('Choose a TGA image to inspect.', 'Drop a .tga file onto the tool.');
    if (file.size > MAX_BYTES)
      throw new ToolError('That TGA image is too large.', 'Use a file under 128 MB.');
    const data = new Uint8Array(await file.arrayBuffer());
    const m = buildModel(data);
    const view = String(options.view ?? 'summary');
    let headers: string[];
    let rows: string[][];
    if (view === 'header') {
      headers = ['Field', 'Value'];
      rows = [
        ['Image ID length', String(m.idlen)],
        ['Color map type', String(m.cmtype)],
        ['Image type', String(m.imgtype) + ' (' + m.typeName + ')'],
        ['Color map first entry', String(m.cmFirst)],
        ['Color map length', String(m.cmCount)],
        ['Color map bits/entry', String(m.cmBpp)],
        ['X origin', String(m.xoff)],
        ['Y origin', String(m.yoff)],
        ['Width', String(m.width)],
        ['Height', String(m.height)],
        ['Pixel depth', String(m.pixdepth)],
        ['Alpha bits', String(m.alphaBits)],
        ['Origin', m.origin === 0 ? 'bottom-left' : m.origin === 2 ? 'top-left' : String(m.origin)],
        ['Data offset', String(m.dataOffset)],
        ['TRUEVISION footer', m.hasFooter ? 'present' : 'none'],
      ];
    } else if (view === 'findings') {
      headers = ['Severity', 'Kind', 'Detail'];
      rows = m.findings.map((f) => [f.severity, f.kind, f.detail]);
      if (rows.length === 0) rows.push(['info', 'ok', 'No problems found.']);
    } else {
      headers = ['Property', 'Value'];
      rows = [
        ['File size', String(m.size) + ' B'],
        ['Image type', m.typeName],
        ['Width', String(m.width)],
        ['Height', String(m.height)],
        ['Pixel depth', String(m.pixdepth) + ' bit'],
        ['Origin', m.origin === 0 ? 'bottom-left' : m.origin === 2 ? 'top-left' : String(m.origin)],
        ['Alpha bits', String(m.alphaBits)],
        ['TRUEVISION footer', m.hasFooter ? 'present' : 'none'],
      ];
    }
    const report = { output: JSON.stringify({ headers, rows }), render: 'table' as const };
    const notes: string[] = [];
    notes.push(m.width + ' x ' + m.height + ' ' + m.pixdepth + '-bit ' + m.typeName + '.');
    return { outputs: [], report, notes, warnings: [] };
  },
};

export default tool;
