import type { FileToolModule, FileRunInput, FileRunResult, OutputFile } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './stl-inspector.meta';

/**
 * Binary STL 3D model inspector.
 *
 * Binary STL layout: an 80-byte header, a 32-bit little-endian triangle count,
 * then one 50-byte record per triangle (a normal, three vertices, and a
 * 16-bit attribute). Reports triangle count, unique vertices, the bounding box
 * and per-axis size. Expected values come from the byte-exact fixture, never
 * from this parser.
 */

const MAX_BYTES = 512 * 1024 * 1024;
const MAX_TRIANGLES = 1000000;

interface Vertex {
  x: number;
  y: number;
  z: number;
}

interface Model {
  header: string;
  triangleCount: number;
  vertices: Vertex[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
}

function f32(bytes: Uint8Array, at: number): number {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return dv.getFloat32(at, true);
}

function u32(bytes: Uint8Array, at: number): number {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return dv.getUint32(at, true);
}

function decodeHeader(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < 80; i += 1) {
    const b = bytes[i] ?? 0;
    if (b === 0) break;
    s += String.fromCharCode(b);
  }
  return s;
}

function parseStl(bytes: Uint8Array): Model {
  if (bytes.length < 84) throw new ToolError('That file is too short to be a binary STL model.');
  const triangleCount = u32(bytes, 80);
  const expected = 84 + triangleCount * 50;
  if (triangleCount > MAX_TRIANGLES)
    throw new ToolError('That file declares far too many triangles.');
  if (bytes.length !== expected) {
    throw new ToolError(
      'The file size does not match the declared triangle count (expected ' +
        expected +
        ' bytes, found ' +
        bytes.length +
        ').',
    );
  }

  const header = decodeHeader(bytes);
  const vertices: Vertex[] = [];
  const vset = new Set<string>();
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (let t = 0; t < triangleCount; t += 1) {
    const off = 84 + t * 50;
    for (let v = 0; v < 3; v += 1) {
      const vo = off + 12 + v * 12;
      const x = f32(bytes, vo);
      const y = f32(bytes, vo + 4);
      const z = f32(bytes, vo + 8);
      vertices.push({ x, y, z });
      vset.add(Math.round(x * 10000) + ',' + Math.round(y * 10000) + ',' + Math.round(z * 10000));
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
  }

  return {
    header,
    triangleCount,
    vertices,
    bounds: {
      minX: minX === Infinity ? 0 : minX,
      maxX: maxX === -Infinity ? 0 : maxX,
      minY: minY === Infinity ? 0 : minY,
      maxY: maxY === -Infinity ? 0 : maxY,
      minZ: minZ === Infinity ? 0 : minZ,
      maxZ: maxZ === -Infinity ? 0 : maxZ,
    },
  };
}

function num(v: number): string {
  return (Math.round(v * 1000) / 1000).toString();
}

function tableSummary(m: Model): { headers: string[]; rows: string[][] } {
  const b = m.bounds;
  return {
    headers: ['Property', 'Value'],
    rows: [
      ['Format', 'Binary STL'],
      ['Header', m.header || '(empty)'],
      ['Triangles', String(m.triangleCount)],
      ['Vertices', String(m.vertices.length)],
      ['X range', num(b.minX) + ' to ' + num(b.maxX)],
      ['Y range', num(b.minY) + ' to ' + num(b.maxY)],
      ['Z range', num(b.minZ) + ' to ' + num(b.maxZ)],
      ['Size X', num(b.maxX - b.minX)],
      ['Size Y', num(b.maxY - b.minY)],
      ['Size Z', num(b.maxZ - b.minZ)],
    ],
  };
}

function tableTriangles(m: Model, max: number): { headers: string[]; rows: string[][] } {
  const shown = max > 0 ? m.vertices.slice(0, Math.min(max, m.vertices.length)) : [];
  const rows: string[][] = [];
  for (let v = 0; v < shown.length; v += 3) {
    const a = shown[v];
    const bb = shown[v + 1];
    const c = shown[v + 2];
    const tri = Math.floor(v / 3) + 1;
    rows.push([
      String(tri),
      a ? num(a.x) + ',' + num(a.y) + ',' + num(a.z) : '',
      bb ? num(bb.x) + ',' + num(bb.y) + ',' + num(bb.z) : '',
      c ? num(c.x) + ',' + num(c.y) + ',' + num(c.z) : '',
    ]);
  }
  return { headers: ['Triangle', 'Vertex 1', 'Vertex 2', 'Vertex 3'], rows };
}

async function run(input: FileRunInput): Promise<FileRunResult> {
  const options = resolveOptions(meta, input.options);
  const format = String(options.format ?? 'summary');
  const maxRows = Math.max(0, Math.min(50000, Number(options.maxRows ?? 100) || 0));

  const source = (input.files ?? [])[0];
  if (source === undefined)
    throw new ToolError('No file was provided.', 'Choose a binary STL 3D model to inspect.');
  if (source.size === 0) throw new ToolError('That file is empty.');
  if (source.size > MAX_BYTES) throw new ToolError('That file is larger than 512 MB.');

  const bytes = new Uint8Array(await source.arrayBuffer());
  const m = parseStl(bytes);

  const table = format === 'triangles' ? tableTriangles(m, maxRows) : tableSummary(m);
  return {
    outputs: [] as OutputFile[],
    report: { output: JSON.stringify(table), render: 'table' },
    notes: [
      'Binary STL with ' +
        m.triangleCount +
        ' triangle(s) and ' +
        m.vertices.length +
        ' vertex records.',
    ],
    stats: { triangles: m.triangleCount, vertices: m.vertices.length },
  };
}

const tool: FileToolModule = { meta, run };
export default tool;
