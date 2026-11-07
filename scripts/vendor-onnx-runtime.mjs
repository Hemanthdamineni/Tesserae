#!/usr/bin/env node
/**
 * Copies the ONNX Runtime WebAssembly assets used by the ML tools into the
 * static site so GitHub Pages never needs a third-party runtime CDN.
 *
 * Re-run this after bumping onnxruntime-web:
 *   npm run vendor:onnx
 *
 * `npm run vendor:onnx -- --check` verifies the committed copies.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = join(root, 'node_modules', 'onnxruntime-web', 'dist');
const target = join(root, 'public', 'vendor', 'onnxruntime');
const check = process.argv.includes('--check');

const FILES = ['ort-wasm-simd-threaded.asyncify.mjs', 'ort-wasm-simd-threaded.asyncify.wasm'];

function digest(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

let stale = 0;
if (!check) mkdirSync(target, { recursive: true });

for (const name of FILES) {
  const from = join(source, name);
  const to = join(target, name);
  if (!existsSync(from)) {
    console.error(`Missing ONNX Runtime source: ${from}`);
    console.error('Run `npm install` first.');
    process.exit(1);
  }
  if (check) {
    if (!existsSync(to) || digest(from) !== digest(to)) {
      console.error(
        `public/vendor/onnxruntime/${name} is out of date — run \`npm run vendor:onnx\`.`,
      );
      stale += 1;
    }
    continue;
  }
  copyFileSync(from, to);
  console.log(
    `public/vendor/onnxruntime/${name} (${(statSync(to).size / 1024 / 1024).toFixed(1)} MB)`,
  );
}

if (check) {
  if (stale) process.exit(1);
  console.log('public/vendor/onnxruntime/ matches the installed onnxruntime-web package.');
} else {
  console.log('Done. ONNX Runtime WASM assets are served from this origin.');
}
