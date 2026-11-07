/**
 * Generate one 1200x630 Open Graph PNG per visible tool, plus a default card.
 * Run: `node scripts/gen-og.mjs`   (after `npm run build`, so dist/ exists)
 *
 * Writes dist/og/<id>.png and dist/og/default.png. Zero dependencies beyond
 * node:zlib. Output is fully deterministic — no randomness, no timestamps.
 *
 * The tool list is derived by reading src/tools&#47;**&#47;*.meta.ts as plain text with
 * regexes (this script must not import TypeScript). Hidden tools and redirect
 * aliases are skipped, matching the registry's VISIBLE_TOOLS.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'dist', 'og');
const TOOLS_DIR = join(ROOT, 'src', 'tools');

// --- palette ---------------------------------------------------------------
function hexToRgb(hex) {
  const match = /^#([0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!match) return null;
  const value = parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

const siteText = readFileSync(join(ROOT, 'src', 'lib', 'site.ts'), 'utf8');
// Brand background comes from site.ts themeColor ('#1d1d1b'); the literal below
// is only a fallback so the script still runs if the site module is reshaped.
const themeHex = /themeColor:\s*'([^']+)'/.exec(siteText)?.[1] ?? '#1d1d1b';
const bgHex = /backgroundColor:\s*'([^']+)'/.exec(siteText)?.[1] ?? '#faf9f7';
const siteName = /^\s{2}name:\s*'([^']+)'/m.exec(siteText)?.[1] ?? 'Tesserae';

const BG = hexToRgb(themeHex) ?? [29, 29, 27];
const FG = hexToRgb(bgHex) ?? [250, 249, 247];
const MUTED = [180, 177, 169];
const ACCENT = [224, 127, 99]; // --accent from the dark theme in src/styles/global.css

// --- PNG encoding (node:zlib only) -----------------------------------------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // colour type: RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- 8x8 bitmap font -------------------------------------------------------
// Every glyph is 8 rows of 8 bits; bit 7 is the leftmost column. Covers
// A-Z a-z 0-9, space and . , : - / ( ) & ' . Anything else renders as BOX.
const glyphFromBits = (rows) => rows.map((row) => parseInt(row, 2));

const FONT = {
  A: glyphFromBits([
    '01111110',
    '10000001',
    '10000001',
    '10000001',
    '11111111',
    '10000001',
    '10000001',
    '10000001',
  ]),
  B: glyphFromBits([
    '11111100',
    '10000010',
    '10000010',
    '11111100',
    '10000010',
    '10000010',
    '10000010',
    '11111100',
  ]),
  C: glyphFromBits([
    '01111110',
    '10000001',
    '10000000',
    '10000000',
    '10000000',
    '10000000',
    '10000001',
    '01111110',
  ]),
  D: glyphFromBits([
    '11111100',
    '10000010',
    '10000001',
    '10000001',
    '10000001',
    '10000001',
    '10000010',
    '11111100',
  ]),
  E: glyphFromBits([
    '11111111',
    '10000000',
    '10000000',
    '11111000',
    '10000000',
    '10000000',
    '10000000',
    '11111111',
  ]),
  F: glyphFromBits([
    '11111111',
    '10000000',
    '10000000',
    '11111000',
    '10000000',
    '10000000',
    '10000000',
    '10000000',
  ]),
  G: glyphFromBits([
    '01111110',
    '10000001',
    '10000000',
    '10000000',
    '10001111',
    '10000001',
    '10000001',
    '01111110',
  ]),
  H: glyphFromBits([
    '10000001',
    '10000001',
    '10000001',
    '11111111',
    '10000001',
    '10000001',
    '10000001',
    '10000001',
  ]),
  I: glyphFromBits([
    '01111110',
    '00011000',
    '00011000',
    '00011000',
    '00011000',
    '00011000',
    '00011000',
    '01111110',
  ]),
  J: glyphFromBits([
    '00011111',
    '00000100',
    '00000100',
    '00000100',
    '00000100',
    '10000100',
    '10000100',
    '01111000',
  ]),
  K: glyphFromBits([
    '10000011',
    '10000110',
    '10001100',
    '10011000',
    '11110000',
    '10011000',
    '10001100',
    '10000110',
  ]),
  L: glyphFromBits([
    '10000000',
    '10000000',
    '10000000',
    '10000000',
    '10000000',
    '10000000',
    '10000000',
    '11111111',
  ]),
  M: glyphFromBits([
    '10000001',
    '11000011',
    '10100101',
    '10011001',
    '10000001',
    '10000001',
    '10000001',
    '10000001',
  ]),
  N: glyphFromBits([
    '10000001',
    '11000001',
    '10100001',
    '10010001',
    '10001001',
    '10000101',
    '10000011',
    '10000001',
  ]),
  O: glyphFromBits([
    '01111110',
    '10000001',
    '10000001',
    '10000001',
    '10000001',
    '10000001',
    '10000001',
    '01111110',
  ]),
  P: glyphFromBits([
    '11111100',
    '10000010',
    '10000010',
    '10000010',
    '11111100',
    '10000000',
    '10000000',
    '10000000',
  ]),
  Q: glyphFromBits([
    '01111110',
    '10000001',
    '10000001',
    '10000001',
    '10000001',
    '10011001',
    '10000110',
    '01111101',
  ]),
  R: glyphFromBits([
    '11111100',
    '10000010',
    '10000010',
    '10000010',
    '11111100',
    '10011000',
    '10001100',
    '10000010',
  ]),
  S: glyphFromBits([
    '01111110',
    '10000001',
    '10000000',
    '01111110',
    '00000001',
    '00000001',
    '10000001',
    '01111110',
  ]),
  T: glyphFromBits([
    '11111111',
    '00011000',
    '00011000',
    '00011000',
    '00011000',
    '00011000',
    '00011000',
    '00011000',
  ]),
  U: glyphFromBits([
    '10000001',
    '10000001',
    '10000001',
    '10000001',
    '10000001',
    '10000001',
    '10000001',
    '01111110',
  ]),
  V: glyphFromBits([
    '10000001',
    '10000001',
    '10000001',
    '10000001',
    '01000010',
    '00100100',
    '00011000',
    '00011000',
  ]),
  W: glyphFromBits([
    '10000001',
    '10000001',
    '10000001',
    '10000001',
    '10011001',
    '10100101',
    '11000011',
    '10000001',
  ]),
  X: glyphFromBits([
    '10000001',
    '10000001',
    '01000010',
    '00100100',
    '00011000',
    '00100100',
    '01000010',
    '10000001',
  ]),
  Y: glyphFromBits([
    '10000001',
    '10000001',
    '01000010',
    '00100100',
    '00011000',
    '00011000',
    '00011000',
    '00011000',
  ]),
  Z: glyphFromBits([
    '11111111',
    '00000001',
    '00000010',
    '00000100',
    '00001000',
    '00010000',
    '00100000',
    '11111111',
  ]),
  a: glyphFromBits([
    '00000000',
    '00000000',
    '01111100',
    '10000010',
    '01111110',
    '10000010',
    '10000010',
    '01111101',
  ]),
  b: glyphFromBits([
    '10000000',
    '10000000',
    '11111100',
    '10000010',
    '10000010',
    '10000010',
    '10000010',
    '11111100',
  ]),
  c: glyphFromBits([
    '00000000',
    '00000000',
    '01111100',
    '10000010',
    '10000000',
    '10000000',
    '10000010',
    '01111100',
  ]),
  d: glyphFromBits([
    '00000010',
    '00000010',
    '01111110',
    '10000010',
    '10000010',
    '10000010',
    '10000010',
    '01111101',
  ]),
  e: glyphFromBits([
    '00000000',
    '00000000',
    '01111100',
    '10000010',
    '11111110',
    '10000000',
    '10000010',
    '01111100',
  ]),
  f: glyphFromBits([
    '00011100',
    '00100010',
    '00100000',
    '11111000',
    '00100000',
    '00100000',
    '00100000',
    '00100000',
  ]),
  g: glyphFromBits([
    '00000000',
    '01111110',
    '10000010',
    '10000010',
    '10000010',
    '01111110',
    '00000010',
    '01111100',
  ]),
  h: glyphFromBits([
    '10000000',
    '10000000',
    '11111100',
    '10000010',
    '10000010',
    '10000010',
    '10000010',
    '10000010',
  ]),
  i: glyphFromBits([
    '00011000',
    '00000000',
    '00011000',
    '00011000',
    '00011000',
    '00011000',
    '00011000',
    '00001110',
  ]),
  j: glyphFromBits([
    '00000100',
    '00000000',
    '00000100',
    '00000100',
    '00000100',
    '00000100',
    '10000100',
    '01111000',
  ]),
  k: glyphFromBits([
    '10000000',
    '10000000',
    '10000110',
    '10001100',
    '10011000',
    '11110000',
    '10011000',
    '10001100',
  ]),
  l: glyphFromBits([
    '00011000',
    '00011000',
    '00011000',
    '00011000',
    '00011000',
    '00011000',
    '00011000',
    '00001110',
  ]),
  m: glyphFromBits([
    '00000000',
    '00000000',
    '11010110',
    '10101001',
    '10101001',
    '10101001',
    '10101001',
    '10101001',
  ]),
  n: glyphFromBits([
    '00000000',
    '00000000',
    '11111100',
    '10000010',
    '10000010',
    '10000010',
    '10000010',
    '10000010',
  ]),
  o: glyphFromBits([
    '00000000',
    '00000000',
    '01111100',
    '10000010',
    '10000010',
    '10000010',
    '10000010',
    '01111100',
  ]),
  p: glyphFromBits([
    '00000000',
    '00000000',
    '11111100',
    '10000010',
    '10000010',
    '10000010',
    '11111100',
    '10000000',
  ]),
  q: glyphFromBits([
    '00000000',
    '00000000',
    '01111110',
    '10000010',
    '10000010',
    '10000010',
    '01111110',
    '00000010',
  ]),
  r: glyphFromBits([
    '00000000',
    '00000000',
    '01011100',
    '01100010',
    '01000000',
    '01000000',
    '01000000',
    '01000000',
  ]),
  s: glyphFromBits([
    '00000000',
    '00000000',
    '01111100',
    '10000000',
    '01111100',
    '00000010',
    '10000010',
    '01111100',
  ]),
  t: glyphFromBits([
    '00100000',
    '00100000',
    '11111000',
    '00100000',
    '00100000',
    '00100000',
    '00100010',
    '00011100',
  ]),
  u: glyphFromBits([
    '00000000',
    '00000000',
    '10000010',
    '10000010',
    '10000010',
    '10000010',
    '10000110',
    '01111010',
  ]),
  v: glyphFromBits([
    '00000000',
    '00000000',
    '10000001',
    '10000001',
    '10000001',
    '01000010',
    '00100100',
    '00011000',
  ]),
  w: glyphFromBits([
    '00000000',
    '00000000',
    '10000001',
    '10000001',
    '10011001',
    '10100101',
    '11000011',
    '10000001',
  ]),
  x: glyphFromBits([
    '00000000',
    '00000000',
    '10000001',
    '01000010',
    '00100100',
    '00011000',
    '00100100',
    '10000001',
  ]),
  y: glyphFromBits([
    '00000000',
    '00000000',
    '10000010',
    '10000010',
    '10000010',
    '10000010',
    '01111110',
    '00000010',
  ]),
  z: glyphFromBits([
    '00000000',
    '00000000',
    '11111110',
    '00000100',
    '00001000',
    '00010000',
    '00100000',
    '11111110',
  ]),
  0: glyphFromBits([
    '01111110',
    '10000001',
    '10000011',
    '10000101',
    '10001001',
    '10010001',
    '10100001',
    '01111110',
  ]),
  1: glyphFromBits([
    '00011000',
    '00111000',
    '00011000',
    '00011000',
    '00011000',
    '00011000',
    '00011000',
    '01111110',
  ]),
  2: glyphFromBits([
    '01111110',
    '10000001',
    '00000001',
    '00000010',
    '00000100',
    '00001000',
    '00010000',
    '11111111',
  ]),
  3: glyphFromBits([
    '01111110',
    '10000001',
    '00000001',
    '00111110',
    '00000001',
    '00000001',
    '10000001',
    '01111110',
  ]),
  4: glyphFromBits([
    '00000110',
    '00001010',
    '00010010',
    '00100010',
    '01000010',
    '11111111',
    '00000010',
    '00000010',
  ]),
  5: glyphFromBits([
    '11111111',
    '10000000',
    '10000000',
    '11111110',
    '00000001',
    '00000001',
    '10000001',
    '01111110',
  ]),
  6: glyphFromBits([
    '01111110',
    '10000001',
    '10000000',
    '11111110',
    '10000001',
    '10000001',
    '10000001',
    '01111110',
  ]),
  7: glyphFromBits([
    '11111111',
    '00000001',
    '00000010',
    '00000100',
    '00001000',
    '00010000',
    '00010000',
    '00010000',
  ]),
  8: glyphFromBits([
    '01111110',
    '10000001',
    '10000001',
    '01111110',
    '10000001',
    '10000001',
    '10000001',
    '01111110',
  ]),
  9: glyphFromBits([
    '01111110',
    '10000001',
    '10000001',
    '10000001',
    '01111111',
    '00000001',
    '00000001',
    '01111110',
  ]),
  ' ': glyphFromBits([
    '00000000',
    '00000000',
    '00000000',
    '00000000',
    '00000000',
    '00000000',
    '00000000',
    '00000000',
  ]),
  '.': glyphFromBits([
    '00000000',
    '00000000',
    '00000000',
    '00000000',
    '00000000',
    '00000000',
    '00011000',
    '00011000',
  ]),
  ',': glyphFromBits([
    '00000000',
    '00000000',
    '00000000',
    '00000000',
    '00000000',
    '00011000',
    '00011000',
    '00010000',
  ]),
  ':': glyphFromBits([
    '00000000',
    '00000000',
    '00011000',
    '00011000',
    '00000000',
    '00011000',
    '00011000',
    '00000000',
  ]),
  '-': glyphFromBits([
    '00000000',
    '00000000',
    '00000000',
    '00000000',
    '11111110',
    '00000000',
    '00000000',
    '00000000',
  ]),
  '/': glyphFromBits([
    '00000001',
    '00000010',
    '00000010',
    '00000100',
    '00001000',
    '00010000',
    '00010000',
    '00100000',
  ]),
  '(': glyphFromBits([
    '00000110',
    '00001000',
    '00010000',
    '00010000',
    '00010000',
    '00010000',
    '00001000',
    '00000110',
  ]),
  ')': glyphFromBits([
    '01100000',
    '00010000',
    '00001000',
    '00001000',
    '00001000',
    '00001000',
    '00010000',
    '01100000',
  ]),
  '&': glyphFromBits([
    '00111000',
    '01000100',
    '01000100',
    '00111000',
    '01010100',
    '01001000',
    '01000100',
    '00110010',
  ]),
  "'": glyphFromBits([
    '00011000',
    '00011000',
    '00011000',
    '00000000',
    '00000000',
    '00000000',
    '00000000',
    '00000000',
  ]),
  '<': glyphFromBits([
    '00000110',
    '00011000',
    '01100000',
    '10000000',
    '01100000',
    '00011000',
    '00000110',
    '00000000',
  ]),
  '>': glyphFromBits([
    '01100000',
    '00011000',
    '00000110',
    '00000001',
    '00000110',
    '00011000',
    '01100000',
    '00000000',
  ]),
  '#': glyphFromBits([
    '00000000',
    '00100100',
    '01111110',
    '00100100',
    '01111110',
    '00100100',
    '00000000',
    '00000000',
  ]),
  '@': glyphFromBits([
    '00111100',
    '01000010',
    '01011010',
    '01011010',
    '01011110',
    '01000000',
    '00111100',
    '00000000',
  ]),
  // Placeholder for characters outside the set: a hollow box.
  BOX: glyphFromBits([
    '11111110',
    '10000010',
    '10000010',
    '10000010',
    '10000010',
    '10000010',
    '10000010',
    '11111110',
  ]),
};

// Symbols outside the glyph set are transliterated to ASCII so names still read
// (e.g. "TOML ⇄ JSON" -> "TOML <-> JSON"). Anything left over renders as BOX.
const SUBSTITUTIONS = {
  '↔': '<->',
  '⇄': '<->',
  '⇆': '<->',
  '→': '->',
  '←': '<-',
  '’': "'",
  '‘': "'",
  '–': '-',
  '—': '-',
  '·': '.',
  '•': '-',
};
const missingGlyphs = new Set();

function normalize(text) {
  let out = '';
  for (const ch of text) out += SUBSTITUTIONS[ch] ?? ch;
  return out;
}

// --- drawing helpers -------------------------------------------------------
const WIDTH = 1200;
const HEIGHT = 630;
const GLYPH_W = 8;
const TRACKING = 0.5; // extra advance per character, relative to scale
const WORD_GAP = 0.5; // extra advance for a space, relative to scale

const glyphOf = (ch) => FONT[ch] ?? FONT.BOX;
const advance = (scale) => GLYPH_W * scale + Math.max(1, Math.round(scale * TRACKING));
const lineHeight = (scale) => GLYPH_W * scale + Math.max(2, Math.round(scale * 0.6));

function textWidth(text, scale) {
  if (!text) return 0;
  const adv = advance(scale);
  const chars = [...text];
  let width = 0;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    width +=
      i < chars.length - 1
        ? adv + (ch === ' ' ? Math.round(scale * WORD_GAP) : 0)
        : GLYPH_W * scale;
  }
  return width;
}

function wrap(text, scale, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const candidate = line ? `${line} ${word}` : word;
    if (textWidth(candidate, scale) <= maxWidth || !line) {
      if (!line && textWidth(word, scale) > maxWidth) {
        // Hard-wrap a single overlong token so it never overflows.
        let chunk = '';
        for (const ch of word) {
          if (chunk && textWidth(chunk + ch, scale) > maxWidth) {
            lines.push(chunk);
            chunk = ch;
          } else {
            chunk += ch;
          }
        }
        line = chunk;
        continue;
      }
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawText(buf, text, x, y, scale, color) {
  const adv = advance(scale);
  let cx = x;
  for (const ch of text) {
    if (ch !== ' ' && !FONT[ch]) missingGlyphs.add(ch);
    const glyph = glyphOf(ch);
    for (let gy = 0; gy < GLYPH_W; gy++) {
      const row = glyph[gy];
      if (!row) continue;
      for (let gx = 0; gx < GLYPH_W; gx++) {
        if (!(row & (0x80 >> gx))) continue;
        for (let sy = 0; sy < scale; sy++) {
          const py = y + gy * scale + sy;
          if (py < 0 || py >= HEIGHT) continue;
          for (let sx = 0; sx < scale; sx++) {
            const px = cx + gx * scale + sx;
            if (px < 0 || px >= WIDTH) continue;
            const i = (py * WIDTH + px) * 4;
            buf[i] = color[0];
            buf[i + 1] = color[1];
            buf[i + 2] = color[2];
            buf[i + 3] = 255;
          }
        }
      }
    }
    cx += adv + (ch === ' ' ? Math.round(scale * WORD_GAP) : 0);
  }
}

function fill(buf, x0, y0, w, h, color) {
  for (let y = y0; y < y0 + h; y++) {
    if (y < 0 || y >= HEIGHT) continue;
    for (let x = x0; x < x0 + w; x++) {
      if (x < 0 || x >= WIDTH) continue;
      const i = (y * WIDTH + x) * 4;
      buf[i] = color[0];
      buf[i + 1] = color[1];
      buf[i + 2] = color[2];
      buf[i + 3] = 255;
    }
  }
}

// --- card layout -----------------------------------------------------------
const MARGIN = 80;
const MAX_TEXT_WIDTH = WIDTH - MARGIN * 2;
const ACCENT_HEIGHT = 8;
const TITLE_TOP = 210;
const TITLE_MIN_SCALE = 2;
const TITLE_MAX_SCALE = 8;
const FOOTER_Y = HEIGHT - 64;

/** Pick a scale + wrapped lines that fit the title area, shrinking if needed. */
function layoutTitle(name) {
  const maxHeight = HEIGHT - TITLE_TOP - 140;
  const longestWord = name
    .split(' ')
    .reduce((longest, word) => (word.length > longest.length ? word : longest), '');
  for (let scale = TITLE_MAX_SCALE; scale >= TITLE_MIN_SCALE; scale--) {
    // Skip scales where a single word would have to break mid-word.
    if (textWidth(longestWord, scale) > MAX_TEXT_WIDTH) continue;
    const lines = wrap(name, scale, MAX_TEXT_WIDTH);
    if (lines.length * lineHeight(scale) <= maxHeight) return { lines, scale };
  }
  return { lines: wrap(name, TITLE_MIN_SCALE, MAX_TEXT_WIDTH), scale: TITLE_MIN_SCALE };
}

/** Render one 1200x630 card: brand field, accent rule, name, category + site. */
function renderCard({ name, category }) {
  const title = normalize(name);
  const label = normalize(categoryNames.get(category) ?? category);
  const buf = Buffer.alloc(WIDTH * HEIGHT * 4);
  fill(buf, 0, 0, WIDTH, HEIGHT, BG);
  fill(buf, 0, 0, WIDTH, ACCENT_HEIGHT, ACCENT); // thin accent rule

  drawText(buf, siteName, MARGIN, 56, 2, MUTED); // wordmark
  drawText(buf, label, MARGIN, 150, 2, ACCENT); // category label

  const { lines, scale } = layoutTitle(title);
  const step = lineHeight(scale);
  const bandHeight = HEIGHT - TITLE_TOP - 140;
  const blockTop = TITLE_TOP + Math.max(0, Math.round((bandHeight - lines.length * step) / 2));
  lines.forEach((line, index) => {
    drawText(buf, line, MARGIN, blockTop + index * step, scale, FG);
  });

  drawText(buf, siteName, MARGIN, FOOTER_Y, 2, MUTED);
  return encodePng(WIDTH, HEIGHT, buf);
}

// --- tool discovery (text-only; never imports TypeScript) ------------------
function collectMetaFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) files.push(...collectMetaFiles(path));
    else if (entry.endsWith('.meta.ts')) files.push(path);
  }
  return files;
}

/** Category id -> display name, parsed from src/lib/categories.ts. */
function readCategoryNames() {
  const source = readFileSync(join(ROOT, 'src', 'lib', 'categories.ts'), 'utf8');
  const names = new Map();
  const re = /^\s{2}(\w+):\s*\{\s*id:\s*'([^']+)',\s*name:\s*'([^']*)'/gm;
  let match;
  while ((match = re.exec(source))) names.set(match[2], match[3]);
  return names;
}

const categoryNames = readCategoryNames();

function parseMeta(path) {
  const source = readFileSync(path, 'utf8');
  if (/\bredirectTo\s*:/.test(source)) return null; // alias of a merged tool
  if (/\bhidden\s*:\s*true/.test(source)) return null; // routable but not listed
  const id = /^\s*id:\s*'([^']+)'/m.exec(source)?.[1];
  const name = /^\s*name:\s*'([^']+)'/m.exec(source)?.[1];
  const category = /^\s*category:\s*'([^']+)'/m.exec(source)?.[1];
  if (!id || !name || !category) return null; // skip anything malformed
  return { id, name, category };
}

mkdirSync(OUT_DIR, { recursive: true });

const tools = collectMetaFiles(TOOLS_DIR)
  .map(parseMeta)
  .filter(Boolean)
  .sort((a, b) => a.id.localeCompare(b.id));

for (const tool of tools) {
  writeFileSync(
    join(OUT_DIR, `${tool.id}.png`),
    renderCard({ name: tool.name, category: tool.category }),
  );
}

writeFileSync(
  join(OUT_DIR, 'default.png'),
  renderCard({ name: siteName, category: `${tools.length} private browser tools` }),
);

console.log(
  `gen-og: wrote ${tools.length + 1} cards (${tools.length} tools + default.png) to dist/og/`,
);
if (missingGlyphs.size > 0) {
  console.warn(`gen-og: no glyph for ${[...missingGlyphs].join(' ')} — drawn as a box`);
}
