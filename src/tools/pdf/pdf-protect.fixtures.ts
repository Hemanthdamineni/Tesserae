/**
 * Fixtures shared by the `pdf-protect` tests.
 *
 * `minimalEncryptedPdf` is the smallest document pdf-lib recognises as
 * encrypted: a one-page catalog whose trailer points at an `/Encrypt`
 * dictionary. It is not a working encrypted file — it exists so the tests can
 * exercise "this PDF is already protected" and "the result really is encrypted"
 * without shipping a binary fixture or a PDF encryption implementation.
 *
 * `createCliEngine` runs the same argument list through the `qpdf` command-line
 * tool (the reference implementation of the wasm build this tool ships with),
 * which lets the golden tests check the *semantics* of the arguments — AES-256
 * and the permission bits — against a real qpdf. It is test-only code: nothing
 * in `src/` imports it.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildEncryptArgs, type QpdfEngine, type ProtectPlan } from './pdf-protect.core';

export function minimalEncryptedPdf(): Uint8Array<ArrayBuffer> {
  return asciiBytes(
    [
      '%PDF-1.4',
      '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
      '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
      '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 300]>>endobj',
      '9 0 obj<</Filter/Standard/V 5/R 6>>endobj',
      'trailer<</Root 1 0 R/Encrypt 9 0 R/Size 10>>',
      'startxref',
      '0',
      '%%EOF',
      '',
    ].join('\n'),
  );
}

/**
 * ASCII to bytes by hand. `TextEncoder` in the jsdom test environment hands back
 * a `Uint8Array` from another realm, which pdf-lib's `instanceof` checks reject;
 * bytes built here are always the same realm as the code under test.
 */
export function asciiBytes(text: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i) & 0xff;
  return bytes;
}

/** `qpdf` is the reference reader for everything this tool writes. */
export function hasQpdfTool(): boolean {
  try {
    execFileSync('qpdf', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/** Run `qpdf` with `args`, returning stdout; stderr is available to the caller. */
export function runQpdf(args: string[]): string {
  return execFileSync('qpdf', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/** An engine backed by the `qpdf` CLI, so the golden tests encrypt for real. */
export function createCliEngine(): QpdfEngine {
  return {
    protect(bytes: Uint8Array, plan: ProtectPlan): Uint8Array<ArrayBuffer> {
      const dir = mkdtempSync(join(tmpdir(), 'tesserae-protect-'));
      const input = join(dir, 'input.pdf');
      const output = join(dir, 'output.pdf');
      try {
        writeFileSync(input, bytes);
        const args = buildEncryptArgs(plan, input, output);
        execFileSync('qpdf', args, { stdio: ['ignore', 'pipe', 'pipe'] });
        return new Uint8Array(readFileSync(output));
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  };
}

/** Write bytes to a temporary file and return its path; the caller removes the directory. */
export function writeTempPdf(bytes: Uint8Array, name = 'file.pdf'): { dir: string; path: string } {
  const dir = mkdtempSync(join(tmpdir(), 'tesserae-protect-'));
  const path = join(dir, name);
  writeFileSync(path, bytes);
  return { dir, path };
}
