import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import {
  MAX_OCR_SCALE,
  buildOcrPlan,
  buildTextLayer,
  describePlan,
  drawInvisibleTextLayer,
  encodableText,
  flattenTesseractWords,
  mountPdfOcrPanel,
  outputNameFor,
  pageOrder,
  resolveScale,
  wordBoxToPdf,
  type InvisibleTextItem,
  type OcrWord,
} from './pdf-ocr-panel';
import { runToolById } from '@/lib/worker/client';

const runToolByIdMock = vi.mocked(runToolById);

/* -------------------------------------------------------------------------- */
/*  Mocks                                                                      */
/* -------------------------------------------------------------------------- */

/** A three-page document, enough for the panel to plan against. */
const { fakePdf } = vi.hoisted(() => ({
  fakePdf: { numPages: 3, destroy: async () => undefined },
}));

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: () => ({ promise: Promise.resolve(fakePdf) }),
}));

// The panel never talks to a real worker in a unit test.
vi.mock('@/lib/worker/client', () => ({
  runToolById: vi.fn(),
}));

/* -------------------------------------------------------------------------- */
/*  Fixtures                                                                   */
/* -------------------------------------------------------------------------- */

/** A word box in raster pixels, with a confidence. */
function word(
  text: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  confidence = 90,
): OcrWord {
  return { text, x0, y0, x1, y1, confidence };
}

/** The markup PdfOcrPanel.astro renders (the parts the panel uses). */
function fixture(): HTMLElement {
  const root = document.createElement('section');
  root.dataset.fileWorkbench = '';
  root.dataset.pdfOcrWorkbench = '';
  root.dataset.toolId = 'pdf-ocr';
  root.innerHTML = `
    <div data-drop></div>
    <ul data-file-list></ul>
    <select data-language>
      <option value="eng" selected>English</option>
      <option value="deu">German</option>
    </select>
    <select data-mode>
      <option value="auto" selected>Automatic</option>
      <option value="block">One block</option>
    </select>
    <input data-pages type="text" value="all" />
    <input data-scale type="range" min="1" max="4" value="2" />
    <span data-scale-value>2×</span>
    <p data-plan-status role="status" aria-live="polite"></p>
    <button type="button" data-run disabled>Run</button>
    <button type="button" data-cancel hidden>Cancel</button>
    <button type="button" data-reset hidden>Reset</button>
    <div data-progress-wrap hidden><div data-progress-bar></div><p data-progress-msg></p></div>
    <div data-error hidden></div>
    <div data-result-wrap hidden><ul data-outputs></ul><ul data-notes></ul><ul data-stats></ul></div>
  `;
  document.body.append(root);
  return root;
}

/** A file that starts with the `%PDF-` header. */
function pdfFile(name = 'scan.pdf'): File {
  return new File([new TextEncoder().encode('%PDF-1.7\n1 0 obj\n<< >>\nendobj\n')], name, {
    type: 'application/pdf',
  });
}

/** Hand a file to the panel the way the drop zone does. */
async function chooseFile(root: HTMLElement, file: File): Promise<void> {
  const input = root.querySelector<HTMLInputElement>('[data-drop] input[type="file"]')!;
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await vi.waitFor(() => {
    expect(root.querySelector<HTMLElement>('[data-plan-status]')!.textContent).toMatch(/Ready:/);
  });
}

/* -------------------------------------------------------------------------- */
/*  Tests                                                                      */
/* -------------------------------------------------------------------------- */

beforeEach(() => {
  runToolByIdMock.mockReset();
  runToolByIdMock.mockResolvedValue({ outputs: [] } as never);
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('render scale', () => {
  it('clamps to the supported range', () => {
    expect(resolveScale(2)).toBe(2);
    expect(resolveScale('3')).toBe(3);
    expect(resolveScale(0)).toBe(1);
    expect(resolveScale(99)).toBe(MAX_OCR_SCALE);
    expect(resolveScale(-4)).toBe(1);
  });

  it('falls back to the default for a missing or unreadable value', () => {
    expect(resolveScale(undefined)).toBe(2);
    expect(resolveScale('')).toBe(2);
    expect(resolveScale('big')).toBe(2);
  });
});

describe('page order', () => {
  it('returns every page for a blank value or "all"', () => {
    expect(pageOrder('all', 3)).toEqual([1, 2, 3]);
    expect(pageOrder('', 3)).toEqual([1, 2, 3]);
    expect(pageOrder('ALL', 2)).toEqual([1, 2]);
  });

  it('keeps the order the user typed and drops repeats', () => {
    expect(pageOrder('3,1,3-4', 5)).toEqual([3, 1, 4]);
    expect(pageOrder('2-4,1', 4)).toEqual([2, 3, 4, 1]);
  });

  it('refuses a page outside the document', () => {
    expect(() => pageOrder('9-12', 3)).toThrow(/outside this PDF/);
    expect(() => pageOrder('nonsense', 3)).toThrow(/list or ranges/);
  });
});

describe('the plan', () => {
  it('resolves the language, scale, layout and pages', () => {
    const plan = buildOcrPlan({ language: 'deu', scale: 3, mode: 'block', pages: '2-3' }, 4);
    expect(plan).toEqual({ pages: [2, 3], scale: 3, language: 'deu', mode: 'block' });
  });

  it('defaults the language and layout when nothing is chosen', () => {
    const plan = buildOcrPlan({}, 2);
    expect(plan.language).toBe('eng');
    expect(plan.mode).toBe('auto');
    expect(plan.scale).toBe(2);
    expect(plan.pages).toEqual([1, 2]);
  });

  it('refuses a language with no vendored model', () => {
    expect(() => buildOcrPlan({ language: 'jpn' }, 1)).toThrow(/not a language/);
  });

  it('summarises itself for the live region', () => {
    const plan = buildOcrPlan({ language: 'eng', scale: 2 }, 3);
    expect(describePlan(plan, 3)).toBe('all 3 pages · English · 2× render scale');
    const partial = buildOcrPlan({ language: 'eng', scale: 2, pages: '1' }, 3);
    expect(describePlan(partial, 3)).toBe('1 of 3 pages · English · 2× render scale');
  });
});

describe('word boxes to PDF coordinates', () => {
  const page = { width: 600, height: 800 };

  it('maps a box at a known scale, flipping the y axis', () => {
    const box = wordBoxToPdf(word('Hello', 100, 50, 300, 80), 2, page);
    expect(box).toEqual({ x: 50, y: 760, width: 100, height: 15 });
  });

  it('is a plain division by the scale at scale 1', () => {
    expect(wordBoxToPdf(word('x', 10, 20, 30, 40), 1, page)).toEqual({
      x: 10,
      y: 760,
      width: 20,
      height: 20,
    });
  });

  it('treats an inverted box as its bounding rectangle', () => {
    expect(wordBoxToPdf(word('x', 300, 80, 100, 50), 2, page)).toEqual({
      x: 50,
      y: 760,
      width: 100,
      height: 15,
    });
  });

  it('never divides by zero', () => {
    expect(wordBoxToPdf(word('x', 10, 10, 30, 30), 0, page)).toEqual({
      x: 10,
      y: 770,
      width: 20,
      height: 20,
    });
  });
});

describe('the searchable text layer', () => {
  const page = { width: 600, height: 800 };

  it('creates an invisible text object per recognised word', () => {
    const items = buildTextLayer([word('Hello', 100, 50, 190, 80, 95)], 2, page);
    expect(items).toEqual([{ text: 'Hello', x: 50, y: 760, size: 15, renderingMode: 3 }]);
  });

  it('orders the words in reading order, top to bottom then left to right', () => {
    const items = buildTextLayer(
      [
        word('world', 200, 60, 300, 80),
        word('Hello', 100, 50, 190, 80),
        word('below', 100, 200, 190, 230),
      ],
      2,
      page,
    );
    expect(items.map((item) => item.text)).toEqual(['Hello', 'world', 'below']);
  });

  it('drops blank words, empty boxes and words the font cannot encode', () => {
    const items = buildTextLayer(
      [
        word('   ', 10, 10, 40, 40),
        word('kept', 100, 50, 190, 80),
        word('\u4e2d\u6587', 100, 100, 190, 130),
        word('flat', 100, 10, 100, 40),
      ],
      2,
      page,
    );
    expect(items.map((item) => item.text)).toEqual(['kept']);
  });

  it('drops low-confidence words when a floor is given', () => {
    const words = [word('sure', 100, 50, 190, 80, 90), word('maybe', 100, 100, 190, 130, 30)];
    expect(buildTextLayer(words, 2, page, { minConfidence: 50 }).map((i) => i.text)).toEqual([
      'sure',
    ]);
  });
});

describe('drawing the layer', () => {
  it('writes an invisible Text object and restores the fill mode', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([300, 200]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const pushOperators = vi.spyOn(page, 'pushOperators');
    const drawText = vi.spyOn(page, 'drawText');
    const items: InvisibleTextItem[] = [
      { text: 'Hello', x: 20, y: 150, size: 12, renderingMode: 3 },
      { text: 'world', x: 80, y: 150, size: 12, renderingMode: 3 },
    ];

    const drawn = drawInvisibleTextLayer(page, font, items);

    expect(drawn).toBe(2);
    expect(drawText).toHaveBeenCalledWith('Hello', { x: 20, y: 150, size: 12, font });
    expect(drawText).toHaveBeenCalledWith('world', { x: 80, y: 150, size: 12, font });
    const operators = pushOperators.mock.calls.map((call) => String(call[0]));
    expect(operators[0]).toBe('3 Tr');
    expect(operators.at(-1)).toBe('0 Tr');
  });

  it('does nothing for an empty layer', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([300, 200]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const pushOperators = vi.spyOn(page, 'pushOperators');
    expect(drawInvisibleTextLayer(page, font, [])).toBe(0);
    expect(pushOperators).not.toHaveBeenCalled();
  });
});

describe('tesseract words', () => {
  it('flattens the nested blocks into a flat list', () => {
    const blocks = [
      {
        paragraphs: [
          {
            lines: [
              {
                words: [
                  { text: 'a', bbox: { x0: 1, y0: 2, x1: 3, y1: 4 }, confidence: 90 },
                  { text: 'b', bbox: { x0: 5, y0: 6, x1: 7, y1: 8 }, confidence: 90 },
                ],
              },
              { words: [{ text: 'c', bbox: { x0: 9, y0: 10, x1: 11, y1: 12 }, confidence: 90 }] },
            ],
          },
        ],
      },
    ];
    expect(flattenTesseractWords(blocks).map((w) => w.text)).toEqual(['a', 'b', 'c']);
  });

  it('returns nothing for missing or malformed input', () => {
    expect(flattenTesseractWords(null)).toEqual([]);
    expect(flattenTesseractWords(undefined)).toEqual([]);
    expect(flattenTesseractWords([{ paragraphs: 'nope' }])).toEqual([]);
    expect(
      flattenTesseractWords([{ paragraphs: [{ lines: [{ words: [{ text: 'x' }] }] }] }]),
    ).toEqual([]);
  });

  it('defaults a missing confidence to zero', () => {
    const blocks = [
      {
        paragraphs: [{ lines: [{ words: [{ text: 'x', bbox: { x0: 1, y0: 2, x1: 3, y1: 4 } }] }] }],
      },
    ];
    expect(flattenTesseractWords(blocks)[0]!.confidence).toBe(0);
  });
});

describe('encodable text', () => {
  it('folds typographic punctuation to ASCII', () => {
    expect(encodableText('\u201chello\u201d \u2014 it\u2019s\u2026')).toBe('"hello" - it\'s...');
  });

  it('drops characters a standard PDF font cannot write', () => {
    expect(encodableText('caf\u00e9 \u4e2d\u6587')).toBe('caf');
  });

  it('keeps the WinAnsi punctuation it can write', () => {
    expect(encodableText('20\u00b0')).toBe('20\u00b0');
  });
});

describe('output name', () => {
  it('marks the file as searchable', () => {
    expect(outputNameFor('scan.pdf')).toBe('scan-searchable.pdf');
    expect(outputNameFor('Report.PDF')).toBe('Report-searchable.pdf');
    expect(outputNameFor('')).toBe('document-searchable.pdf');
  });

  it('does not let a path escape the download folder', () => {
    expect(outputNameFor('a/b.pdf')).toBe('a_b-searchable.pdf');
  });
});

describe('mountPdfOcrPanel', () => {
  it('refuses a file that is not a PDF', async () => {
    const root = fixture();
    await mountPdfOcrPanel(root);

    const input = root.querySelector<HTMLInputElement>('[data-drop] input[type="file"]')!;
    Object.defineProperty(input, 'files', {
      value: [new File(['hello'], 'notes.txt', { type: 'text/plain' })],
      configurable: true,
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));

    await vi.waitFor(() => {
      expect(root.querySelector<HTMLElement>('[data-error]')!.hidden).toBe(false);
    });
    expect(root.querySelector<HTMLElement>('[data-error]')!.textContent).toMatch(/not a PDF/);
    expect(root.querySelector<HTMLButtonElement>('[data-run]')!.disabled).toBe(true);
    expect(root.querySelectorAll('[data-file-list] > li')).toHaveLength(0);
  });

  it('plans the pages once a PDF is chosen', async () => {
    const root = fixture();
    await mountPdfOcrPanel(root);
    await chooseFile(root, pdfFile('scan.pdf'));

    expect(root.querySelector<HTMLElement>('[data-plan-status]')!.textContent).toBe(
      'Ready: all 3 pages · English · 2× render scale.',
    );
    expect(root.querySelector<HTMLButtonElement>('[data-run]')!.disabled).toBe(false);
    expect(root.querySelector<HTMLElement>('[data-file-list]')!.textContent).toMatch(/3 pages/);
  });

  it('updates the plan when the options change', async () => {
    const root = fixture();
    await mountPdfOcrPanel(root);
    await chooseFile(root, pdfFile());

    root.querySelector<HTMLSelectElement>('[data-language]')!.value = 'deu';
    root.querySelector<HTMLSelectElement>('[data-language]')!.dispatchEvent(new Event('change'));
    root.querySelector<HTMLInputElement>('[data-scale]')!.value = '4';
    root.querySelector<HTMLInputElement>('[data-scale]')!.dispatchEvent(new Event('input'));
    root.querySelector<HTMLInputElement>('[data-pages]')!.value = '1-2';
    root.querySelector<HTMLInputElement>('[data-pages]')!.dispatchEvent(new Event('input'));

    const status = root.querySelector<HTMLElement>('[data-plan-status]')!.textContent ?? '';
    expect(status).toBe('Ready: 2 of 3 pages · German · 4× render scale.');
    expect(root.querySelector<HTMLElement>('[data-scale-value]')!.textContent).toBe('4×');
  });

  it('shows an error for a page range outside the document and blocks the run', async () => {
    const root = fixture();
    await mountPdfOcrPanel(root);
    await chooseFile(root, pdfFile());

    root.querySelector<HTMLInputElement>('[data-pages]')!.value = '9-12';
    root.querySelector<HTMLInputElement>('[data-pages]')!.dispatchEvent(new Event('input'));

    expect(root.querySelector<HTMLElement>('[data-error]')!.hidden).toBe(false);
    expect(root.querySelector<HTMLElement>('[data-error]')!.textContent).toMatch(
      /outside this PDF/,
    );
    root.querySelector<HTMLButtonElement>('[data-run]')!.click();
    expect(runToolByIdMock).not.toHaveBeenCalled();
  });

  it('hands the file and the chosen options to the tool', async () => {
    const root = fixture();
    await mountPdfOcrPanel(root);
    await chooseFile(root, pdfFile('scan.pdf'));

    root.querySelector<HTMLSelectElement>('[data-language]')!.value = 'deu';
    root.querySelector<HTMLInputElement>('[data-scale]')!.value = '3';
    root.querySelector<HTMLSelectElement>('[data-mode]')!.value = 'block';
    root.querySelector<HTMLInputElement>('[data-pages]')!.value = '1,3';

    root.querySelector<HTMLButtonElement>('[data-run]')!.click();
    await vi.waitFor(() => {
      expect(runToolByIdMock).toHaveBeenCalledTimes(1);
    });

    const [toolId, payload] = runToolByIdMock.mock.calls[0]!;
    expect(toolId).toBe('pdf-ocr');
    expect(payload.files).toHaveLength(1);
    expect(payload.options).toEqual({ language: 'deu', scale: 3, mode: 'block', pages: '1,3' });
  });

  it('shows the error the tool reported and never shows a result', async () => {
    runToolByIdMock.mockRejectedValue(
      Object.assign(new Error('This PDF is password-protected — unlock it first.'), {
        name: 'Error',
        hint: 'Remove the password first.',
      }),
    );
    const root = fixture();
    await mountPdfOcrPanel(root);
    await chooseFile(root, pdfFile());

    root.querySelector<HTMLButtonElement>('[data-run]')!.click();
    await vi.waitFor(() => {
      const error = root.querySelector<HTMLElement>('[data-error]')!;
      expect(error.hidden).toBe(false);
      expect(error.textContent).toMatch(/password-protected/);
      expect(error.textContent).toMatch(/Remove the password/);
    });
    expect(root.querySelector<HTMLElement>('[data-result-wrap]')!.hidden).toBe(true);
  });

  it('clears everything on reset', async () => {
    const root = fixture();
    await mountPdfOcrPanel(root);
    await chooseFile(root, pdfFile());

    root.querySelector<HTMLButtonElement>('[data-reset]')!.click();
    await vi.waitFor(() => {
      expect(root.querySelectorAll('[data-file-list] > li')).toHaveLength(0);
    });
    expect(root.querySelector<HTMLButtonElement>('[data-run]')!.disabled).toBe(true);
    expect(root.querySelector<HTMLElement>('[data-error]')!.hidden).toBe(true);
  });
});
