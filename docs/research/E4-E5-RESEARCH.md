# E4-E5 Tool Categories Research: Market & Feasibility

## Executive Summary

The E4-E5 categories (Image, PDF, Archive, Audio, Misc) represent high-value utility for Toolbench. Client-side processing is the key differentiator, offering privacy (no uploads) and offline capability. While server-based competitors like TinyPDF and iLovePDF dominate search volume, a privacy-first toolbench can capture users concerned with data sovereignty.

Feasibility is high for all categories using standard Web APIs and the allowed library set, though **Audio** and **Large PDF** processing require careful memory management to avoid mobile tab crashes.

---

## 1. Image Tools

_Resize, Compress, Convert, Crop, Rotate, Metadata, Palette, SVG-to-PNG_

### Competitor Landscape

- **TinyPNG/Compressor.io**: Server-based, gold standard for compression quality.
- **Squoosh**: Client-side (Chrome team), excellent but complex UI.
- **iLoveIMG**: Batch processing, but requires signup and uploads.
- **QuickImg/ClientSide**: Privacy-focused, browser-based using Canvas API.

### Technical Approach

- **APIs**: `Canvas`, `OffscreenCanvas` (for workers), `createImageBitmap`.
- **Feasibility**: High. Most operations (resize, crop, rotate) are natively supported by Canvas.
- **SVG-to-PNG**: Use `createImageBitmap` with SVG `Blob` or render to Canvas.
- **Metadata**: `exif-js` (or similar, though not in allowed list) or manual parsing. _Note: Native browser support for EXIF writing is limited._

### Mobile Limitations

- **Memory**: A 12MP image (4000x3000) takes ~48MB of RAM as a bitmap. Processing batches requires sequential execution and aggressive `URL.revokeObjectURL` / canvas clearing.
- **Limit**: Recommended max input size: 30MP.

### SEO Opportunities

- "Image resizer", "PNG to JPG", "HEIC to JPG" are high volume.
- **Golden Keywords**: "Resize image to exact size", "Compress image reduce size".

---

## 2. PDF Tools

_Merge, Split, Compress, Page Numbers, Watermark, Rotate, Extract Text, Protect_

### Competitor Landscape

- **SmallPDF/iLovePDF**: Dominant market share, server-side.
- **PDFLince/FreeLabTools**: Client-side leaders.
- **ClientPDF**: OSS, browser-based using `pdf-lib`.

### Technical Approach

- **Libraries**: `pdf-lib` (manipulation/metadata), `pdfjs-dist` (rendering/OCR).
- **Compress**: Re-encode images inside PDF using `OffscreenCanvas`. "Lossy" compression is most effective. Text stays selectable (unlike "print to PDF" methods).
- **Watermark/Page Numbers**: `pdf-lib` `drawText`.

### Performance & Limits

- **Memory**: PDFs are complex. A 50MB PDF can require 200-300MB RAM to process.
- **Strategy**: Use Web Workers and process pages sequentially.
- **Limit**: Safe limit ~100MB on desktop, ~50MB on mobile.

### SEO Opportunities

- "PDF Merge", "PDF Split", "PDF Compress" are the "Head Terms" (very high difficulty).

---

## 3. Archive Tools

_Zip, Unzip, Compress, Decompress_

### Competitor Landscape

- **Online-Convert/CloudConvert**: Server-based.
- **7-Zip**: Desktop gold standard.
- **Zip.js/JSZip**: Client-side leaders.

### Technical Approach

- **Libraries**: `fflate` (fastest, smallest) for in-memory compression. `zip.js` for streaming large files.
- **Compress**: Use `Compression Streams` API (native) where available for zero-dependency speed.
- **Decompress**: `fflate` is excellent for extracting multiple small files.

### Mobile Limitations

- **File Size**: Mobile Safari/Chrome have hard limits on Blob creation.
- **Limit**: Keep archives under 100MB for mobile stability.

---

## 4. Audio Tools

_Convert, Trim, Volume, Metadata, Waveform_

### Competitor Landscape

- **Audacity**: Desktop.
- **Rev/HappyScribe**: Server-based.
- **Zalt.me**: Client-side using Web Audio API.

### Technical Approach

- **APIs**: `Web Audio API` for decoding, `AudioWorklet` for processing (volume/waveform).
- **Encoding**: `lamejs` (MP3) or `Opus` via browser native support.
- **Waveform**: Extract PCM data from `AudioBuffer`.

### Mobile Limitations

- **Unreliable**: Heavy transcode can kill mobile tabs.
- **Workaround**: Limit to files < 50MB.

---

## 5. Misc Tools

_BMI, Aspect Ratio, Data Size, Loan Calculator, Tip Calculator, Password Strength_

### Competitor Landscape

- **Calculator.net**: Broadest range.
- **Bankrate/NerdWallet**: Finance-heavy.

### Technical Approach

- **Implementation**: Pure JavaScript/TypeScript. No libraries required.
- **Password Strength**: Implement `zxcvbn`-style logic (entropy/pattern matching).

### SEO Opportunities

- **Golden Keywords**: "Loan calculator simple interest", "BMI calculator kg/cm", "Password strength checker".

---

## Recommended Implementation Order

1.  **Misc Tools** (Lowest effort, high SEO value, no complex deps).
2.  **Image Tools** (Core browser capability, high search volume).
3.  **Archive Tools** (Leverages `fflate` already in use).
4.  **PDF Tools** (High complexity, but high retention/return usage).
5.  **Audio Tools** (Highest technical risk on mobile).

---

## Libraries to Use (Allowed List)

- **Image/PDF**: Native Canvas + `pdf-lib`, `pdfjs-dist`.
- **Archive**: `fflate`.
- **Misc**: None (Pure JS).

---

## Risk Register

| Category      | Risk                            | Impact | Mitigation                                                                  |
| :------------ | :------------------------------ | :----- | :-------------------------------------------------------------------------- |
| **Image/PDF** | Mobile tab crash on large files | High   | Implement `deviceMemory` detection; warn/limit inputs > 50MB on mobile.     |
| **PDF**       | Loss of text selectability      | Medium | Prioritize in-place image recompression over full-page rasterization.       |
| **Audio**     | Encoding performance            | High   | Use `AudioWorklet`; fallback to smaller duration limits on low-end devices. |
| **Archive**   | ZIP64 compatibility             | Low    | Use `fflate`'s built-in ZIP64 support.                                      |
