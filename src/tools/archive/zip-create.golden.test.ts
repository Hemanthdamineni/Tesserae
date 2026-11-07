import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import tool from './zip-create.tool';

function file(content: string, name: string): File {
  return new File([content], name, { type: 'text/plain' });
}

/** The reference tool is the system `unzip`; skip when it is not installed. */
const hasUnzip = (() => {
  try {
    execFileSync('unzip', ['-v'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

describe('zip-create external golden output', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it.runIf(hasUnzip)('creates an archive accepted by the system unzip CLI', async () => {
    const result = await tool.run({
      files: [file('hello', 'a.txt'), file('world', 'nested/b.txt')],
      options: {},
    });
    const output = result.outputs[0];
    expect(output).toBeDefined();

    const dir = mkdtempSync(join(tmpdir(), 'tesserae-zip-golden-'));
    tempDirs.push(dir);
    const archive = join(dir, output!.filename);
    writeFileSync(archive, Buffer.from(await output!.blob.arrayBuffer()));

    const names = execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' })
      .trim()
      .split('\n')
      .sort();
    expect(names).toEqual(['a.txt', 'nested/b.txt']);

    const extracted = execFileSync('unzip', ['-p', archive, 'nested/b.txt'], {
      encoding: 'utf8',
    });
    expect(extracted).toBe('world');
    expect(readFileSync(archive).subarray(0, 2)).toEqual(Buffer.from('PK'));
  });
});
