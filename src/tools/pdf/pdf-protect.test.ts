import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { makeInvalidPdf, makePdf } from './pdf-test-helpers';
import { minimalEncryptedPdf } from './pdf-protect.fixtures';
import type { ProtectPlan, QpdfEngine } from './pdf-protect.core';
import { loadQpdfEngine } from './pdf-protect.qpdf';
import tool from './pdf-protect.tool';

// The one module that reaches for 1.3 MB of WebAssembly. Everything else in the
// tool runs for real; `loadQpdfEngine` is replaced so a test can stand in an
// engine that reports exactly what that test needs.
vi.mock('./pdf-protect.qpdf', () => ({ loadQpdfEngine: vi.fn() }));

const mockedLoad = vi.mocked(loadQpdfEngine);

interface EngineSpy extends QpdfEngine {
  plans: ProtectPlan[];
  inputs: Uint8Array[];
}

/** An engine that records what it was asked to do and returns `output`. */
function spyEngine(output: Uint8Array<ArrayBuffer>): EngineSpy {
  const spy: EngineSpy = {
    plans: [],
    inputs: [],
    protect(bytes, plan) {
      spy.inputs.push(bytes);
      spy.plans.push(plan);
      return output;
    },
  };
  return spy;
}

/** An engine that fails the way qpdf does when it dislikes an input. */
function refusingEngine(error: ToolError): QpdfEngine {
  return {
    protect() {
      throw error;
    },
  };
}

async function runWith(
  engine: QpdfEngine | Error,
  options: Record<string, string | number | boolean> = { userPassword: 'hunter2' },
  files?: File[],
): Promise<FileRunResult> {
  if (engine instanceof Error) mockedLoad.mockRejectedValue(engine);
  else mockedLoad.mockResolvedValue(engine);
  const input: FileRunInput = {
    files: files ?? [await makePdf(2)],
    options,
  };
  return tool.run(input);
}

beforeEach(() => {
  mockedLoad.mockReset();
});

describe('pdf-protect run()', () => {
  it('returns the protected file under a new name', async () => {
    const engine = spyEngine(minimalEncryptedPdf());
    const result = await runWith(engine);

    expect(result.outputs).toHaveLength(1);
    const output = result.outputs[0]!;
    expect(output.filename).toBe('sample-protected.pdf');
    expect(output.blob.type).toBe('application/pdf');
    expect(await output.blob.text()).toContain('%PDF-');
  });

  it('defaults the owner password to the user password', async () => {
    const engine = spyEngine(minimalEncryptedPdf());
    await runWith(engine);
    expect(engine.plans).toEqual([
      {
        userPassword: 'hunter2',
        ownerPassword: 'hunter2',
        allowPrint: true,
        allowCopy: true,
        allowModify: true,
      },
    ]);
  });

  it('hands the engine the bytes of the chosen file, unchanged', async () => {
    const file = await makePdf(3);
    const expected = new Uint8Array(await file.arrayBuffer());
    const engine = spyEngine(minimalEncryptedPdf());
    await runWith(engine, { userPassword: 'pw' }, [file]);
    expect(Array.from(engine.inputs[0]!)).toEqual(Array.from(expected));
  });

  it('passes a distinct owner password and the permission toggles through', async () => {
    const engine = spyEngine(minimalEncryptedPdf());
    await runWith(engine, {
      userPassword: 'open',
      ownerPassword: 'owner',
      allowPrint: false,
      allowCopy: true,
      allowModify: false,
    });
    expect(engine.plans[0]).toEqual({
      userPassword: 'open',
      ownerPassword: 'owner',
      allowPrint: false,
      allowCopy: true,
      allowModify: false,
    });
  });

  it('reports the encryption, the page count and the sizes', async () => {
    const result = await runWith(spyEngine(minimalEncryptedPdf()));
    expect(result.stats).toMatchObject({ encryption: 'AES-256 (revision 6)', pages: 2 });
    expect(String(result.stats?.input)).toMatch(/B$/);
    expect(String(result.stats?.output)).toMatch(/B$/);
    expect(result.notes?.join(' ')).toMatch(/AES-256/);
    expect(result.notes?.join(' ')).toMatch(/no recovery/);
  });

  it('says which permissions stay allowed when none were blocked', async () => {
    const result = await runWith(spyEngine(minimalEncryptedPdf()));
    expect(result.notes?.join(' ')).toMatch(/stay allowed/);
  });

  it('lists exactly the restrictions that were asked for', async () => {
    const result = await runWith(spyEngine(minimalEncryptedPdf()), {
      userPassword: 'pw',
      allowPrint: false,
      allowCopy: false,
      allowModify: false,
    });
    expect(result.notes?.join(' ')).toMatch(/printing, copying text and images, editing/);
  });

  it('shows the wasm download as a progress step of its own', async () => {
    const fractions: number[] = [];
    const messages: string[] = [];
    mockedLoad.mockResolvedValue(spyEngine(minimalEncryptedPdf()));
    await tool.run({
      files: [await makePdf(1)],
      options: { userPassword: 'pw' },
      onProgress: (fraction, message) => {
        fractions.push(fraction);
        if (message) messages.push(message);
      },
    });

    expect(messages).toContain('Loading the encryption engine');
    expect(messages.at(-1)).toBe('Done');
    expect(fractions.at(-1)).toBe(1);
    expect(fractions.every((fraction, i) => i === 0 || fraction >= fractions[i - 1]!)).toBe(true);
    expect(Math.min(...fractions)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...fractions)).toBeLessThanOrEqual(1);
  });

  it('hands a header-only PDF to the engine, where qpdf judges its structure', async () => {
    // The cheap checks here only look for `%PDF-`; "the structure is damaged"
    // is qpdf's verdict (see describeQpdfFailure and the golden tests).
    const headerOnly = new File(['%PDF-1.7\nnothing else'], 'broken.pdf', {
      type: 'application/pdf',
    });
    const engine = spyEngine(minimalEncryptedPdf());
    await expect(runWith(engine, { userPassword: 'pw' }, [headerOnly])).resolves.toBeDefined();
    expect(engine.plans).toHaveLength(1);
  });

  it('refuses an empty password before loading the engine', async () => {
    await expect(runWith(spyEngine(minimalEncryptedPdf()), { userPassword: '' })).rejects.toThrow(
      /Enter the password/,
    );
    expect(mockedLoad).not.toHaveBeenCalled();
  });

  it('refuses a whitespace-only password', async () => {
    await expect(
      runWith(spyEngine(minimalEncryptedPdf()), { userPassword: '   ' }),
    ).rejects.toThrow(/only spaces/);
  });

  it('refuses a password longer than the PDF standard can read', async () => {
    await expect(
      runWith(spyEngine(minimalEncryptedPdf()), { userPassword: 'a'.repeat(128) }),
    ).rejects.toThrow(/too long/);
    expect(mockedLoad).not.toHaveBeenCalled();
  });

  it('refuses a file that is not a PDF', async () => {
    await expect(
      runWith(spyEngine(minimalEncryptedPdf()), { userPassword: 'pw' }, [makeInvalidPdf()]),
    ).rejects.toThrow(/not a PDF/);
    expect(mockedLoad).not.toHaveBeenCalled();
  });

  it('refuses an empty file', async () => {
    const empty = new File([], 'empty.pdf', { type: 'application/pdf' });
    await expect(
      runWith(spyEngine(minimalEncryptedPdf()), { userPassword: 'pw' }, [empty]),
    ).rejects.toThrow(/empty/);
  });

  it('refuses an already-encrypted PDF instead of re-encrypting it', async () => {
    const encrypted = new File([minimalEncryptedPdf()], 'locked.pdf', { type: 'application/pdf' });
    await expect(
      runWith(spyEngine(minimalEncryptedPdf()), { userPassword: 'pw' }, [encrypted]),
    ).rejects.toThrow(/already password-protected/);
    expect(mockedLoad).not.toHaveBeenCalled();
  });

  it('refuses a PDF that is too large to encrypt in a tab', async () => {
    // A 100 MB + 1 byte stand-in: the check runs before a single byte is read.
    const huge = {
      name: 'huge.pdf',
      size: 100 * 1024 * 1024 + 1,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    } as unknown as File;
    await expect(
      runWith(spyEngine(minimalEncryptedPdf()), { userPassword: 'pw' }, [huge]),
    ).rejects.toThrow(/too large/);
  });

  it('asks for a file when none was chosen', async () => {
    await expect(
      runWith(spyEngine(minimalEncryptedPdf()), { userPassword: 'pw' }, []),
    ).rejects.toThrow(/Choose a PDF file/);
  });

  it('surfaces what the engine refused with', async () => {
    const engine = refusingEngine(
      new ToolError('This PDF is damaged and cannot be encrypted.', 'xref missing'),
    );
    await expect(runWith(engine)).rejects.toThrow(/damaged/);
  });

  it('surfaces a failure to load the engine', async () => {
    await expect(runWith(new Error('failed to fetch qpdf.wasm'))).rejects.toThrow(
      /failed to fetch/,
    );
  });

  it('does not report success when the result is not encrypted', async () => {
    const plain = new Uint8Array(await (await makePdf(1)).arrayBuffer());
    await expect(runWith(spyEngine(plain))).rejects.toThrow(/is not encrypted/);
  });

  it('honours an abort signal before the engine is loaded', async () => {
    const controller = new AbortController();
    controller.abort();
    mockedLoad.mockResolvedValue(spyEngine(minimalEncryptedPdf()));
    await expect(
      tool.run({
        files: [await makePdf(1)],
        options: { userPassword: 'pw' },
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(mockedLoad).not.toHaveBeenCalled();
  });
});
