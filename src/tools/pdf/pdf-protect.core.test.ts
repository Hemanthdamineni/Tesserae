import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { ToolError } from '@/lib/types';
import {
  assertPdfHeader,
  assertWithinLimit,
  buildEncryptArgs,
  createQpdfEngine,
  describePermissions,
  describeQpdfFailure,
  inspectPdf,
  KEY_LENGTH,
  MAX_PASSWORD_BYTES,
  permissionFlags,
  planProtection,
  protectedFilename,
  withStderrCapture,
  type ProtectPlan,
  type QpdfLog,
  type QpdfModule,
} from './pdf-protect.core';
import { makePdf } from './pdf-test-helpers';
import { asciiBytes, minimalEncryptedPdf } from './pdf-protect.fixtures';

function plan(overrides: Partial<ProtectPlan> = {}): ProtectPlan {
  return {
    userPassword: 'open-sesame',
    ownerPassword: 'owner-key',
    allowPrint: true,
    allowCopy: true,
    allowModify: true,
    ...overrides,
  };
}

/** Shared by the fake modules so `createQpdfEngine`'s buffers are the ones filled. */
const log: QpdfLog = { stderr: [] };

interface FakeModule extends QpdfModule {
  written: Uint8Array | undefined;
  calls: string[][];
}

/** A stand-in for the Emscripten module: an in-memory FS plus a scripted exit. */
function fakeModule(options: {
  exitCode?: number;
  stderr?: string[];
  output?: Uint8Array<ArrayBuffer> | null;
  throwOnCall?: Error;
}): FakeModule {
  const files = new Map<string, Uint8Array<ArrayBuffer>>();
  const module: FakeModule = {
    written: undefined,
    calls: [],
    FS: {
      writeFile(path: string, data: Uint8Array): void {
        files.set(path, data.slice());
        module.written = data;
      },
      readFile(path: string): Uint8Array<ArrayBuffer> {
        const file = files.get(path);
        if (!file) throw new Error(`ENOENT: ${path}`);
        return file;
      },
    },
    callMain(args: string[]): number {
      module.calls.push(args);
      if (options.throwOnCall) throw options.throwOnCall;
      for (const line of options.stderr ?? []) {
        // The engine only ever reads the log the caller passed in; mirror qpdf
        // by appending to it here.
        log.stderr.push(line);
      }
      const output = options.output === undefined ? new Uint8Array([1, 2, 3]) : options.output;
      if (output) files.set(args[args.length - 1]!, output);
      return options.exitCode ?? 0;
    },
  };
  return module;
}

describe('planProtection', () => {
  it('defaults the owner password to the user password', () => {
    expect(planProtection({ userPassword: 'secret' })).toEqual({
      userPassword: 'secret',
      ownerPassword: 'secret',
      allowPrint: true,
      allowCopy: true,
      allowModify: true,
    });
  });

  it('keeps a distinct owner password', () => {
    expect(planProtection({ userPassword: 'user', ownerPassword: 'owner' }).ownerPassword).toBe(
      'owner',
    );
  });

  it('reads the permission toggles', () => {
    const resolved = planProtection({
      userPassword: 'secret',
      allowPrint: false,
      allowCopy: false,
      allowModify: false,
    });
    expect([resolved.allowPrint, resolved.allowCopy, resolved.allowModify]).toEqual([
      false,
      false,
      false,
    ]);
  });

  it('leaves spaces, quotes, backslashes, newlines, unicode and emoji intact', () => {
    const userPassword = '  pa ss "q" \\ b / ünïcødé 😀 漢  ';
    const ownerPassword = 'owner\twith\nlines 😀\\"';
    const resolved = planProtection({ userPassword, ownerPassword });
    expect(resolved.userPassword).toBe(userPassword);
    expect(resolved.ownerPassword).toBe(ownerPassword);
  });

  it('refuses an empty password', () => {
    expect(() => planProtection({ userPassword: '' })).toThrow(ToolError);
    expect(() => planProtection({})).toThrow(/Enter the password/);
  });

  it('refuses a password that is only whitespace', () => {
    expect(() => planProtection({ userPassword: '   ' })).toThrow(/only spaces/);
    expect(() => planProtection({ userPassword: '\t\n' })).toThrow(/only spaces/);
  });

  it('accepts a password of exactly 127 bytes', () => {
    const resolved = planProtection({ userPassword: 'a'.repeat(MAX_PASSWORD_BYTES) });
    expect(resolved.userPassword).toHaveLength(MAX_PASSWORD_BYTES);
  });

  it('refuses a password longer than 127 bytes, counting UTF-8 bytes', () => {
    expect(() => planProtection({ userPassword: 'a'.repeat(MAX_PASSWORD_BYTES + 1) })).toThrow(
      /too long \(128 bytes\)/,
    );
    // 64 emoji are 256 bytes even though they are only 128 characters.
    expect(() => planProtection({ userPassword: '😀'.repeat(64) })).toThrow(/too long/);
  });

  it('applies the same limit to the owner password', () => {
    expect(() => planProtection({ userPassword: 'ok', ownerPassword: 'ß'.repeat(64) })).toThrow(
      /owner password is too long/,
    );
  });
});

describe('permissionFlags', () => {
  it('emits nothing when every permission is granted', () => {
    expect(permissionFlags(plan())).toEqual([]);
  });

  it('maps each toggle to its qpdf option', () => {
    expect(permissionFlags(plan({ allowPrint: false }))).toEqual(['--print=none']);
    expect(permissionFlags(plan({ allowCopy: false }))).toEqual(['--extract=n']);
    expect(permissionFlags(plan({ allowModify: false }))).toEqual(['--modify=none']);
  });

  it('keeps extraction allowed when only editing is blocked', () => {
    // `--modify=none` already covers assembly/annotate/form; it must not be
    // accompanied by `--extract=n`, or "may copy but may not edit" is lost.
    expect(permissionFlags(plan({ allowModify: false }))).not.toContain('--extract=n');
  });

  it('covers all eight combinations in a stable order', () => {
    const combos: [boolean, boolean, boolean, string[]][] = [
      [true, true, true, []],
      [false, true, true, ['--print=none']],
      [true, false, true, ['--extract=n']],
      [true, true, false, ['--modify=none']],
      [false, false, true, ['--print=none', '--extract=n']],
      [false, true, false, ['--print=none', '--modify=none']],
      [true, false, false, ['--extract=n', '--modify=none']],
      [false, false, false, ['--print=none', '--extract=n', '--modify=none']],
    ];
    for (const [allowPrint, allowCopy, allowModify, expected] of combos) {
      expect(permissionFlags(plan({ allowPrint, allowCopy, allowModify }))).toEqual(expected);
    }
  });
});

describe('buildEncryptArgs', () => {
  it('uses the second-form syntax with a 256-bit key', () => {
    expect(buildEncryptArgs(plan({ userPassword: 'u', ownerPassword: 'o' }))).toEqual([
      '--encrypt',
      'u',
      'o',
      '256',
      '--',
      '/input.pdf',
      '/protected.pdf',
    ]);
    expect(KEY_LENGTH).toBe(256);
  });

  it('places permission flags between the key length and the terminating --', () => {
    const args = buildEncryptArgs(
      plan({ allowPrint: false, allowCopy: false, allowModify: false }),
      '/a.pdf',
      '/b.pdf',
    );
    expect(args).toEqual([
      '--encrypt',
      'open-sesame',
      'owner-key',
      '256',
      '--print=none',
      '--extract=n',
      '--modify=none',
      '--',
      '/a.pdf',
      '/b.pdf',
    ]);
  });

  it('passes a password with spaces, quotes, backslashes and emoji as one argument', () => {
    const userPassword = ' a "b\\c 😀 ';
    const ownerPassword = "o'w\n2";
    const args = buildEncryptArgs(plan({ userPassword, ownerPassword }));
    expect(args[1]).toBe(userPassword);
    expect(args[2]).toBe(ownerPassword);
    expect(args.filter((arg) => arg === userPassword)).toHaveLength(1);
  });

  it('does not use 128-bit encryption or the 128-bit-only --use-aes flag', () => {
    const args = buildEncryptArgs(plan({ allowPrint: false }));
    expect(args).not.toContain('128');
    expect(args).not.toContain('40');
    expect(args.some((arg) => arg.startsWith('--use-aes'))).toBe(false);
  });

  it('does not leak the password into the file names', () => {
    const args = buildEncryptArgs(plan({ userPassword: 'leak-me' }));
    expect(args.at(-1)).not.toContain('leak-me');
    expect(args.at(-2)).not.toContain('leak-me');
  });
});

describe('describeQpdfFailure', () => {
  it('explains an already-encrypted input', () => {
    const failure = describeQpdfFailure(['this.program: /enc.pdf: invalid password'], 2);
    expect(failure.message).toMatch(/already password-protected/);
    expect(failure.hint).toMatch(/current password/);
  });

  it('explains a file without a PDF structure', () => {
    const failure = describeQpdfFailure(
      ["WARNING: /bad.pdf: can't find PDF header", "this.program: /bad.pdf: can't find startxref"],
      2,
    );
    expect(failure.message).toMatch(/not a PDF/);
    expect(failure.hint).toMatch(/PDF header/);
  });

  it('explains a damaged cross-reference table', () => {
    const failure = describeQpdfFailure(["this.program: /x.pdf: can't find startxref"], 2);
    expect(failure.message).toMatch(/damaged/);
    expect(failure.hint).toContain("can't find startxref");
  });

  it('falls back to qpdf’s own first line', () => {
    const failure = describeQpdfFailure(['this.program: something new went wrong'], 3);
    expect(failure.message).toMatch(/exit code 3/);
    expect(failure.hint).toBe('something new went wrong');
  });

  it('copes with empty stderr', () => {
    const failure = describeQpdfFailure([], 1);
    expect(failure.message).toMatch(/exit code 1/);
    expect(failure.hint).toBeUndefined();
  });
});

describe('createQpdfEngine', () => {
  it('writes the input, runs the CLI once and returns the produced file', () => {
    const output = new Uint8Array([9, 9, 9]);
    const module = fakeModule({ output });
    const engine = createQpdfEngine(module, log);
    const bytes = new Uint8Array([1, 2, 3]);
    expect(engine.protect(bytes, plan())).toEqual(output);
    expect(module.written).toEqual(bytes);
    expect(module.calls).toEqual([buildEncryptArgs(plan())]);
  });

  it('rethrows qpdf’s refusal as a ToolError and returns nothing', () => {
    const module = fakeModule({
      exitCode: 2,
      stderr: ['this.program: /input.pdf: invalid password'],
    });
    const engine = createQpdfEngine(module, log);
    expect(() => engine.protect(new Uint8Array([1]), plan())).toThrow(/already password-protected/);
  });

  it('keeps the passwords out of the message it reports', () => {
    const module = fakeModule({
      exitCode: 2,
      stderr: ['this.program: could not read the file with password hunter2'],
    });
    const engine = createQpdfEngine(module, log);
    let message = '';
    try {
      engine.protect(new Uint8Array([1]), plan({ userPassword: 'hunter2' }));
    } catch (error) {
      message = (error as ToolError).message + ' ' + ((error as ToolError).hint ?? '');
    }
    expect(message).not.toContain('hunter2');
    expect(message).toContain('[password]');
  });

  it('fails loudly when the engine writes nothing', () => {
    const engine = createQpdfEngine(fakeModule({ output: null }), log);
    expect(() => engine.protect(new Uint8Array([1]), plan())).toThrow(/produced no output/);
  });

  it('fails loudly when the engine writes an empty file', () => {
    const engine = createQpdfEngine(fakeModule({ output: new Uint8Array(0) }), log);
    expect(() => engine.protect(new Uint8Array([1]), plan())).toThrow(/empty file/);
  });

  it('turns an engine abort into a ToolError', () => {
    const engine = createQpdfEngine(fakeModule({ throwOnCall: new Error('Aborted(OOM)') }), log);
    expect(() => engine.protect(new Uint8Array([1]), plan())).toThrow(
      /engine stopped unexpectedly/,
    );
  });

  it('clears the captured log between runs', () => {
    const module = fakeModule({ output: new Uint8Array([1]) });
    const engine = createQpdfEngine(module, log);
    engine.protect(new Uint8Array([1]), plan());
    expect(log.stderr).toEqual([]);
  });
});

describe('withStderrCapture', () => {
  it('collects console.warn output while it runs', async () => {
    const buffer: QpdfLog = { stderr: [] };
    await withStderrCapture(buffer, async () => {
      console.warn('this.program: /input.pdf: invalid password');
      console.warn('WARNING:', 'two', 'parts');
    });
    expect(buffer.stderr).toEqual([
      'this.program: /input.pdf: invalid password',
      'WARNING: two parts',
    ]);
  });

  it('puts the console back afterwards', async () => {
    const realWarn = console.warn;
    await withStderrCapture({ stderr: [] }, async () => undefined);
    expect(console.warn).toBe(realWarn);
  });

  it('puts the console back when initialisation throws', async () => {
    const realWarn = console.warn;
    const buffer: QpdfLog = { stderr: [] };
    await expect(
      withStderrCapture(buffer, async () => {
        console.warn('aborted while downloading');
        throw new Error('qpdf.wasm missing');
      }),
    ).rejects.toThrow(/qpdf\.wasm missing/);
    expect(console.warn).toBe(realWarn);
    expect(buffer.stderr).toEqual(['aborted while downloading']);
  });
});

describe('assertPdfHeader', () => {
  it('accepts a normal PDF', async () => {
    const bytes = new Uint8Array(await (await makePdf()).arrayBuffer());
    expect(() => assertPdfHeader(bytes)).not.toThrow();
  });

  it('accepts a header after some leading junk, as the standard allows', () => {
    const bytes = asciiBytes('junk'.repeat(20) + '%PDF-1.7\n');
    expect(() => assertPdfHeader(bytes)).not.toThrow();
  });

  it('refuses an empty file', () => {
    expect(() => assertPdfHeader(new Uint8Array(0))).toThrow(/empty/);
  });

  it('refuses a file with no PDF header', () => {
    expect(() => assertPdfHeader(asciiBytes('not a pdf'))).toThrow(/not a PDF/);
  });

  it('refuses a file whose header sits past 1024 bytes', () => {
    const bytes = asciiBytes('x'.repeat(2048) + '%PDF-1.7');
    expect(() => assertPdfHeader(bytes)).toThrow(/not a PDF/);
  });
});

describe('assertWithinLimit', () => {
  it('accepts a file exactly at the limit', () => {
    expect(() => assertWithinLimit(10, 10)).not.toThrow();
  });

  it('refuses anything larger, naming the size', () => {
    expect(() => assertWithinLimit(11, 10)).toThrow(/11 B/);
  });
});

describe('inspectPdf', () => {
  it('reports an unencrypted PDF with its page count', async () => {
    const bytes = new Uint8Array(await (await makePdf(3)).arrayBuffer());
    await expect(inspectPdf(bytes)).resolves.toEqual({ encrypted: false, pages: 3 });
  });

  it('detects the /Encrypt dictionary in the trailer', async () => {
    await expect(inspectPdf(minimalEncryptedPdf())).resolves.toEqual({ encrypted: true, pages: 0 });
  });

  it('does not claim a garbage file is encrypted', async () => {
    await expect(inspectPdf(asciiBytes('not a pdf'))).resolves.toEqual({
      encrypted: false,
      pages: 0,
    });
    await expect(inspectPdf(new Uint8Array(0))).resolves.toEqual({ encrypted: false, pages: 0 });
  });

  it('walks the whole document so pages are counted, not estimated', async () => {
    const doc = await PDFDocument.create();
    for (let i = 0; i < 5; i++) doc.addPage([100, 100]);
    const bytes = await doc.save();
    await expect(inspectPdf(bytes)).resolves.toMatchObject({ pages: 5 });
  });
});

describe('protectedFilename', () => {
  it('adds the suffix before the extension', () => {
    expect(protectedFilename('report.pdf')).toBe('report-protected.pdf');
    expect(protectedFilename('REPORT.PDF')).toBe('REPORT-protected.pdf');
    expect(protectedFilename('a.b.pdf')).toBe('a.b-protected.pdf');
  });

  it('falls back to a placeholder for an unnamed file', () => {
    expect(protectedFilename('.pdf')).toBe('document-protected.pdf');
    expect(protectedFilename('')).toBe('document-protected.pdf');
  });
});

describe('describePermissions', () => {
  it('says so when nothing is restricted', () => {
    expect(describePermissions(plan())).toMatch(/stay allowed/);
  });

  it('lists exactly the blocked permissions', () => {
    expect(describePermissions(plan({ allowPrint: false }))).toMatch(/printing\.$/);
    expect(describePermissions(plan({ allowCopy: false, allowModify: false }))).toMatch(
      /copying text and images, editing\.$/,
    );
  });
});
