import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToolError, type FileRunInput } from '@/lib/types';
import { meta } from './pdf-to-images.meta';
import tool from './pdf-to-images.tool';

/*
 * pdf.js is mocked (it needs a worker and a raster surface), and OffscreenCanvas
 * is stubbed (jsdom has no canvas backend). Together these let us exercise the
 * render loop, page selection, output bundling and the error paths without a
 * real renderer.
 */

const { getDocumentMock } = vi.hoisted(() => ({ getDocumentMock: vi.fn() }));

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: getDocumentMock,
}));

/** A fake pdf.js page with a fixed viewport. */
function fakePage(viewport: { width: number; height: number }) {
  return {
    getViewport: vi.fn(() => ({ width: viewport.width, height: viewport.height })),
    render: vi.fn(async () => ({ promise: Promise.resolve() })),
    cleanup: vi.fn(),
  };
}

/** A pdf.js document stand-in with the parts the tool touches. */
function fakeDocument(numPages = 2) {
  const pages = Array.from({ length: numPages }, () => fakePage({ width: 612, height: 792 }));
  return {
    numPages,
    getPage: vi.fn((n: number) => Promise.resolve(pages[n - 1])),
    destroy: vi.fn(async () => undefined),
  };
}

/** Minimal OffscreenCanvas that hands back a tiny JPEG-like blob. */
class FakeOffscreenCanvas {
  width: number;
  height: number;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
  getContext() {
    return {} as CanvasRenderingContext2D;
  }
  async convertToBlob(): Promise<Blob> {
    return new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' });
  }
}

function run(
  files: File[],
  options: Record<string, string | number | boolean> = {},
): Promise<Awaited<ReturnType<typeof tool.run>>> {
  return tool.run({ files, options } as FileRunInput);
}

/** A file that the tool accepts as a PDF (pdf.js itself is mocked). */
function pdfFile(name = 'render.pdf'): File {
  return new File([new TextEncoder().encode('%PDF-1.7\n')], name, { type: 'application/pdf' });
}

beforeEach(() => {
  vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas);
  getDocumentMock.mockReset();
  getDocumentMock.mockReturnValue({ promise: Promise.resolve(fakeDocument()) });
});

describe('pdf-to-images meta', () => {
  it('declares a stable on-device PDF renderer', () => {
    expect(meta.id).toBe('pdf-to-images');
    expect(meta.category).toBe('pdf');
    expect(meta.status).toBe('stable');
    expect(meta.accept).toBe('application/pdf');
    expect(meta.privacy).toEqual({ processing: 'on-device', network: 'none', offline: true });
    expect((meta.options ?? []).map((o) => o.key)).toEqual(
      expect.arrayContaining(['format', 'scale', 'pages', 'quality']),
    );
  });
});

describe('pdf-to-images run', () => {
  it('asks for a PDF when nothing was chosen', async () => {
    await expect(run([])).rejects.toThrow(/Choose a PDF file/i);
  });

  it('refuses a file that is not a valid PDF', async () => {
    getDocumentMock.mockReturnValue({
      promise: Promise.reject(new Error('Invalid PDF structure')),
    });
    await expect(run([pdfFile('broken.pdf')])).rejects.toThrow(/not a valid, readable PDF/i);
  });

  it('explains a password-protected PDF', async () => {
    getDocumentMock.mockReturnValue({ promise: Promise.reject(new Error('No password given')) });
    await expect(run([pdfFile('locked.pdf')])).rejects.toThrow(/password-protected/i);
  });

  it('refuses a page range outside the document', async () => {
    await expect(run([pdfFile()], { pages: '9-12' })).rejects.toThrow(/outside this PDF/i);
  });

  it('renders every page into a zip by default', async () => {
    const document = fakeDocument(3);
    getDocumentMock.mockReturnValue({ promise: Promise.resolve(document) });
    const result = await run([pdfFile()]);
    expect(result.outputs[0]?.filename).toBe('pdf-images.zip');
    expect(result.outputs[0]?.blob.type).toBe('application/zip');
    expect(result.stats).toMatchObject({ pages: 3 });
    expect(document.getPage).toHaveBeenCalledTimes(3);
    expect(document.destroy).toHaveBeenCalled();
  });

  it('renders selected pages and names them with the chosen format', async () => {
    const document = fakeDocument(5);
    getDocumentMock.mockReturnValue({ promise: Promise.resolve(document) });
    const result = await run([pdfFile()], { pages: '1,3-4', format: 'jpeg', quality: 85 });
    expect(result.outputs[0]?.filename).toBe('pdf-images.zip');
    expect(document.getPage).toHaveBeenCalledTimes(3); // 1, 3, 4
    expect(result.stats).toMatchObject({ pages: 3 });
  });

  it('returns a single image file when only one page is rendered', async () => {
    const document = fakeDocument(2);
    getDocumentMock.mockReturnValue({ promise: Promise.resolve(document) });
    const result = await run([pdfFile()], { pages: '2', format: 'webp' });
    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]?.filename).toMatch(/^page-002\.webp$/);
    expect(result.outputs[0]?.blob.type).toBe('image/webp');
    expect(result.stats).toMatchObject({ pages: 1 });
  });

  it('releases the pdf.js document when rendering throws', async () => {
    const document = fakeDocument(2);
    document.getPage = vi.fn(() => Promise.reject(new Error('boom')));
    getDocumentMock.mockReturnValue({ promise: Promise.resolve(document) });
    await expect(run([pdfFile()])).rejects.toThrow(ToolError);
    expect(document.destroy).toHaveBeenCalled();
  });

  it('explains a password-protected PDF that surfaces mid-render', async () => {
    const document = fakeDocument(2);
    document.getPage = vi.fn(() => Promise.reject(new Error('No password given')));
    getDocumentMock.mockReturnValue({ promise: Promise.resolve(document) });
    await expect(run([pdfFile()])).rejects.toThrow(/password-protected/i);
    expect(document.destroy).toHaveBeenCalled();
  });
});
