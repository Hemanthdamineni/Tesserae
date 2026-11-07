#!/usr/bin/env node
/**
 * Renders the OCR e2e fixtures: small PNG images with crisp, high-contrast
 * text that Tesseract can read reliably.
 *
 * The images are drawn in a real browser (Chromium) so the glyphs are
 * antialiased exactly like a screenshot would be — a hand-rolled bitmap font
 * would be a poor test of the OCR engine.
 *
 * Run: node scripts/gen-ocr-fixture.mjs
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'e2e', 'fixtures');

const FONT = '600 44px "Liberation Sans", "DejaVu Sans", Arial, sans-serif';

const FIXTURES = [
  {
    name: 'ocr-sample.png',
    lines: ['TESSERAE', 'Invoice 4711', 'Total 42.50 EUR'],
  },
  {
    name: 'ocr-sample-de.png',
    lines: ['Rechnung 4711', 'Betrag 42.50 EUR'],
  },
];

const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH || (process.platform === 'linux' ? '/usr/bin/chromium' : undefined),
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  const page = await browser.newPage();
  mkdirSync(outDir, { recursive: true });

  for (const fixture of FIXTURES) {
    const dataUrl = await page.evaluate(
      ({ lines, font }) => {
        const measure = document.createElement('canvas').getContext('2d');
        measure.font = font;
        const width = Math.ceil(Math.max(...lines.map((l) => measure.measureText(l).width))) + 80;
        const lineHeight = 64;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = 80 + lines.length * lineHeight;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#000000';
        ctx.font = font;
        ctx.textBaseline = 'top';
        lines.forEach((line, i) => ctx.fillText(line, 40, 40 + i * lineHeight));
        return canvas.toDataURL('image/png');
      },
      { lines: fixture.lines, font: FONT },
    );

    const buffer = Buffer.from(dataUrl.split(',')[1], 'base64');
    writeFileSync(join(outDir, fixture.name), buffer);
    console.log(`wrote ${fixture.name} (${buffer.length} bytes)`);
  }
} finally {
  await browser.close();
}
