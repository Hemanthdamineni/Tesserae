/**
 * Vitest global setup. jsdom + Node 20 provide most Web APIs the pure `run()`
 * functions need; we patch the gaps.
 */
import { webcrypto } from 'node:crypto';
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer';

if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

if (typeof globalThis.structuredClone !== 'function') {
  globalThis.structuredClone = (v: unknown) => JSON.parse(JSON.stringify(v));
}

// jsdom's Blob/File lack arrayBuffer()/text()/stream() in this version. Node's
// native implementations (stable in 20) have them and match the browser.
globalThis.Blob = NodeBlob as unknown as typeof Blob;
if (NodeFile) globalThis.File = NodeFile as unknown as typeof File;

if (typeof window !== 'undefined') {
  // jsdom has no canvas backend, and Vitest 5 turns jsdom's "not implemented"
  // console error into a failed run. The panels only paint thumbnails, so a
  // minimal no-op 2D context is enough here.
  if (typeof HTMLCanvasElement !== 'undefined') {
    const noopContext = {
      fillStyle: '#000',
      clearRect: () => {},
      fillRect: () => {},
      drawImage: () => {},
    };
    HTMLCanvasElement.prototype.getContext = function getContext() {
      return noopContext as unknown as CanvasRenderingContext2D;
    } as unknown as typeof HTMLCanvasElement.prototype.getContext;
  }

  window.matchMedia ||= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}
