import { describe, it, expect } from 'vitest';
import tool from './netpbm-inspector.tool';

function fileOf(text: string, name = 'x.pnm'): File {
  return new File([text], name, { type: 'application/octet-stream' });
}

function binaryFileOf(bytes: Uint8Array, name = 'x.pnm'): File {
  const copy = new Uint8Array(bytes);
  return new File([copy.buffer as ArrayBuffer], name, { type: 'application/octet-stream' });
}

async function rowsOf(
  file: File,
  options: Record<string, string | number | boolean> = {},
): Promise<string[][]> {
  const result = await tool.run({ files: [file], options });
  const parsed = JSON.parse(result.report?.output ?? '{"rows":[]}') as { rows?: string[][] };
  return parsed.rows ?? [];
}

function value(rows: string[][], key: string): string | undefined {
  return rows.find((row) => row[0] === key)?.[1];
}

describe('netpbm-inspector', () => {
  it('reads an ASCII P3 pixmap header', async () => {
    const rows = await rowsOf(fileOf('P3\n# comment\n2 1\n255\n255 0 0 0 255 0\n'), {
      view: 'header',
    });
    expect(value(rows, 'Magic')).toContain('P3');
    expect(value(rows, 'Encoding')).toBe('ASCII');
    expect(value(rows, 'Width')).toBe('2');
    expect(value(rows, 'Height')).toBe('1');
    expect(value(rows, 'Max value')).toBe('255');
  });

  it('reads a binary P6 pixmap', async () => {
    const bytes = new Uint8Array([...new TextEncoder().encode('P6\n1 1\n255\n'), 255, 0, 0]);
    const rows = await rowsOf(binaryFileOf(bytes), { view: 'header' });
    expect(value(rows, 'Magic')).toContain('P6');
    expect(value(rows, 'Encoding')).toBe('binary (raw)');
    expect(value(rows, 'Pixel data')).toBe('3 bytes');
  });

  it('treats a P4 bitmap as having no max value', async () => {
    const rows = await rowsOf(fileOf('P4\n8 1\n'), { view: 'header' });
    expect(value(rows, 'Max value')).toBe('n/a');
    expect(value(rows, 'Pixel data')).toBe('1 bytes');
  });

  it('reports dimensions in the summary view', async () => {
    const rows = await rowsOf(fileOf('P2\n3 2\n15\n0 1 2 3 4 5\n'));
    expect(value(rows, 'Dimensions')).toBe('3 x 2');
    expect(value(rows, 'Variant')).toContain('PGM');
  });

  it('rejects a non-Netpbm file', async () => {
    await expect(tool.run({ files: [fileOf('hello world')], options: {} })).rejects.toThrow(
      /Not a Netpbm file/,
    );
  });

  it('requires a file', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/Choose a Netpbm image/);
  });
});
