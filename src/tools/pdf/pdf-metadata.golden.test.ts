import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { makePdf } from './pdf-test-helpers';
import tool from './pdf-metadata.tool';

/** `qpdf` and `pdfinfo` are the reference readers; skip when either is absent. */
function hasPdfTools(): boolean {
  const probes: [string, string][] = [
    ['qpdf', '--version'],
    // poppler's pdfinfo has no --version; -v is the flag it understands.
    ['pdfinfo', '-v'],
  ];
  for (const [cli, flag] of probes) {
    try {
      execFileSync(cli, [flag], { stdio: 'ignore' });
    } catch {
      return false;
    }
  }
  return true;
}

describe('pdf-metadata external golden output', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it.runIf(hasPdfTools())('writes PDF metadata readable by qpdf and pdfinfo', async () => {
    const result = await tool.run({
      files: [await makePdf(2)],
      options: {
        title: 'Golden Test Title',
        author: 'Tesserae',
        subject: 'External verification',
        keywords: 'golden, pdf, qpdf',
      },
    });
    const output = result.outputs[0];
    expect(output).toBeDefined();

    const dir = mkdtempSync(join(tmpdir(), 'tesserae-pdf-golden-'));
    tempDirs.push(dir);
    const path = join(dir, output!.filename);
    writeFileSync(path, Buffer.from(await output!.blob.arrayBuffer()));

    // qpdf (JSON mode) exposes metadata in the objects map rather than a
    // dedicated documentinfo key in older versions; parse the raw object
    // stream so the assertion is version-tolerant.
    const qpdfOut = execFileSync('qpdf', ['--json', path], { encoding: 'utf8' });
    const metaJson = JSON.parse(qpdfOut) as {
      qpdf?: Array<Record<string, { value?: Record<string, string> }>>;
    };
    const objects = metaJson.qpdf?.find((entry) => 'obj:3 0 R' in entry);
    const infoDict = objects?.['obj:3 0 R']?.value ?? {};
    expect(infoDict['/Title']).toBe('u:Golden Test Title');
    expect(infoDict['/Author']).toBe('u:Tesserae');

    const pdfInfo = execFileSync('pdfinfo', [path], { encoding: 'utf8' });
    expect(pdfInfo).toMatch(/Title:\s+Golden Test Title/);
    expect(pdfInfo).toMatch(/Author:\s+Tesserae/);
    expect(pdfInfo).toMatch(/Subject:\s+External verification/);
    // pdfinfo renders the keyword array space-separated rather than
    // preserving the input commas, so assert on the individual terms.
    expect(pdfInfo).toMatch(/Keywords:\s+golden pdf qpdf/);
  });
});
