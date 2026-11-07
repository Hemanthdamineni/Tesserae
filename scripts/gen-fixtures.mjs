#!/usr/bin/env node
/**
 * Generate tiny binary fixtures for the Batch C e2e spec (E4-S8).
 * Node-only, committed, no browser required:
 *   - e2e/fixtures/tiny.png        — 2×2 PNG (hand-built PNG with a zlib stream)
 *   - e2e/fixtures/tone.wav        — 0.1s mono 440 Hz sine WAV
 *   - e2e/fixtures/one-page.pdf    — 1-page PDF (pdf-lib not required: minimal valid PDF)
 *   - e2e/fixtures/sample.docx     — small Word document (zip of XML, STORE-method ZIP)
 *
 * Run: node scripts/gen-fixtures.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, crc32 as zlibCrc32 } from 'node:zlib';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'e2e', 'fixtures');

/* ------------------------------- PNG (2×2) ------------------------------- */

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crcVal = zlibCrc32(body);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crcVal);
  return Buffer.concat([len, body, crc]);
}

function buildPng(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  // scanlines: 1 filter byte + raw bytes each
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0; // filter: none
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      raw[y * (1 + w * 4) + 1 + x * 4] = rgba[i];
      raw[y * (1 + w * 4) + 1 + x * 4 + 1] = rgba[i + 1];
      raw[y * (1 + w * 4) + 1 + x * 4 + 2] = rgba[i + 2];
      raw[y * (1 + w * 4) + 1 + x * 4 + 3] = rgba[i + 3];
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const png = buildPng(2, 2, [255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]);

/* ----------------------------- WAV (0.1 s) ------------------------------ */

function buildWav(sampleRate, seconds, toneHz) {
  const n = Math.floor(sampleRate * seconds);
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const v = Math.round(Math.sin((2 * Math.PI * toneHz * i) / sampleRate) * 32767);
    data.writeInt16LE(v, i * 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0, 'ascii');
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVE', 8, 'ascii');
  h.write('fmt ', 12, 'ascii');
  h.writeUInt32LE(16, 16); // fmt chunk size
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(sampleRate * 2, 28); // byte rate
  h.writeUInt16LE(2, 32); // block align
  h.writeUInt16LE(16, 34); // bits per sample
  h.write('data', 36, 'ascii');
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

const wav = buildWav(8000, 0.1, 440);

/* ------------------------------ 1-page PDF ------------------------------ */

// Minimal valid 1-page PDF with the text "Hello Tesserae".
function buildPdf() {
  const objects = [];
  const add = (body) => {
    objects.push(body);
    return objects.length;
  };
  // The page's /Parent must point at the page tree (object 3), not at the
  // catalog. pdf-lib walks /Parent to read inherited attributes such as
  // /MediaBox, and a catalog there makes every page-geometry call throw.
  add(
    '<< /Type /Page /Parent 3 0 R /MediaBox [0 0 200 200] /Contents 5 0 R /Resources << /Font << /F1 4 0 R >> >> >>',
  );
  const catalog = add('<< /Type /Catalog /Pages 3 0 R >>');
  add('<< /Type /Pages /Kids [1 0 R] /Count 1 >>');
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const stream = 'BT /F1 12 Tf 20 100 Td (Hello Tesserae) Tj ET';
  const streamObj = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);

  let out = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, 'latin1'));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objects.length + 1}\n`;
  out += '0000000000 65535 f \n';
  for (let i = 0; i < objects.length; i++) {
    out += `${String(offsets[i + 1]).padStart(10, '0')} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\n`;
  out += `startxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

const pdf = buildPdf();

/* ------------------------------ sample DOCX ----------------------------- */

/** Minimal STORE-method ZIP writer (no dependency) so the .docx fixture is real. */
function buildZip(entries) {
  const chunks = [];
  const central = [];
  let offset = 0;
  const dosTime = 0;
  const dosDate = (1 << 5) | 1; // 1980-01-01
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = zlibCrc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, nameBuf, data);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(0, 10);
    cd.writeUInt16LE(dosTime, 12);
    cd.writeUInt16LE(dosDate, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(data.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, nameBuf);
    offset += local.length + nameBuf.length + data.length;
  }
  const cdBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...chunks, cdBuf, eocd]);
}

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function buildDocx() {
  const parts = {
    '[Content_Types].xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '</Types>',
    '_rels/.rels':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '</Relationships>',
    'word/_rels/document.xml.rels':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://tesserae.example/" TargetMode="External"/>' +
      '</Relationships>',
    'word/styles.xml':
      `<w:styles xmlns:w="${W}">` +
      '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/></w:style>' +
      '</w:styles>',
    'word/numbering.xml':
      `<w:numbering xmlns:w="${W}">` +
      '<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/></w:lvl></w:abstractNum>' +
      '<w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/></w:lvl></w:abstractNum>' +
      '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>' +
      '<w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>' +
      '</w:numbering>',
    'word/document.xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      `<w:document xmlns:w="${W}" xmlns:r="${R}"><w:body>` +
      '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Fixture Document</w:t></w:r></w:p>' +
      '<w:p><w:r><w:t xml:space="preserve">Hello </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>world</w:t></w:r><w:r><w:t>.</w:t></w:r></w:p>' +
      '<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr></w:pPr><w:r><w:t>Bullet item</w:t></w:r></w:p>' +
      '<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Numbered item</w:t></w:r></w:p>' +
      '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Name</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Value</w:t></w:r></w:p></w:tc></w:tr>' +
      '<w:tr><w:tc><w:p><w:r><w:t>alpha</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>1</w:t></w:r></w:p></w:tc></w:tr></w:tbl>' +
      `<w:p><w:hyperlink r:id="rId9"><w:r><w:t>Tesserae</w:t></w:r></w:hyperlink></w:p>` +
      '</w:body></w:document>',
  };
  return buildZip(
    Object.entries(parts).map(([name, body]) => ({ name, data: Buffer.from(body, 'utf8') })),
  );
}

const docx = buildDocx();

/* ---------------------------------- write --------------------------------- */

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'tiny.png'), png);
writeFileSync(join(outDir, 'tone.wav'), wav);
writeFileSync(join(outDir, 'one-page.pdf'), pdf);
writeFileSync(join(outDir, 'sample.docx'), docx);
console.log(
  `wrote ${outDir}: tiny.png (${png.length}B), tone.wav (${wav.length}B), one-page.pdf (${pdf.length}B), sample.docx (${docx.length}B)`,
);
