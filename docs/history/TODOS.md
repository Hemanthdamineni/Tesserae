# Todos — pending work for this round

Line order is priority: top first. This file is written by a human (via review) at the start of each round. **Agents never add, remove, reorder, or reword lines.** They only change the checkbox and append the status markers below to the end of a line.

## Status markers (same for BACKLOG.md)

- **Todo:** `- [ ] **id** · category — notes`
- **In progress:** append ` ⏳ <RUN_ID> @ <ISO-8601 UTC>`. A claim older than 3h is stale and may be reclaimed.
- **Failed attempt:** remove the ⏳ marker and append ` ⚠️ <reason>`. Two ⚠️ markers mean the item is blocked.
- **Done:** change `[ ]` to `[x]`, remove the ⏳ marker, and append ` ✅ <short merge sha>`.
- **Blocked:** remove the ⏳ marker and append ` ⛔ <reason>`. A human resolves it in the next round's review.
- **Already exists:** change `[ ]` to `[x]` and append ` ✅ already exists as <id>`.
- **Dependencies:** `after: a, b` means the item is eligible only when every listed item is `[x]`, wherever it lives (this file or BACKLOG.md).

## Foundations

- [x] **video-foundation** · core — Registers the `video` category. Shared lazy-loaded video engine: prefer WebCodecs + Mediabunny (MPL-2.0). ffmpeg.wasm core is GPL-2.0 (x264), so if it seems needed, report BLOCKED-DECISION instead of using it. Provide progress events, cancel, and worker execution. ⚠️ run died ✅ 14f0fc6
- [x] **ml-runtime-foundation** · core — Shared loader for transformers.js / onnxruntime-web. Use WebGPU when available, falling back to WASM. Cache models in Cache Storage and show download-size and progress UI. Default model source is the HF Hub; only models with permissive licenses are allowed. ⚠️ run died ✅ af99d71

## Tools

- [x] **pdf-compress** · pdf — Re-encode or downsample embedded images and clean up streams. Quality presets; show before/after size. ⚠️ run died ✅ d7aa8b6
- [x] **barcode-generator** · generators — bwip-js or JsBarcode. Code128, EAN-13, UPC-A, Code39, ITF, DataMatrix. SVG and PNG export. ✅ already exists as barcode
- [x] **qr-scanner** · generators — Camera (getUserMedia) plus image upload. Native BarcodeDetector with jsQR or zxing-wasm fallback. Actions for detected URL, Wi-Fi, or vCard content. ⚠️ run died ✅ efe0e63
- [x] **heic-to-jpg** · image — libheif-js / heic2any. Batch mode; JPEG, PNG, and WebP output. ⚠️ run died ✅ dec427e
- [x] **image-strip-metadata** · image — Strip EXIF, GPS, and XMP. Prefer lossless JPEG segment removal; show what was removed. Batch mode. ⚠️ run died ✅ 4c3fe6b
- [x] **video-to-gif** · video · after: video-foundation — Time range, fps, width, palette quality. Preview before export. ✅ bc08c91
- [x] **pdf-sign** · pdf — Draw, type, or upload a signature. Place and resize on the page, then flatten with pdf-lib. ⚠️ run died ✅ 75d7414
- [x] **code-beautify** · developer — Prettier standalone for JS/TS/CSS/SCSS/HTML/JSON/Markdown/YAML. Lazy-load parsers per language. ⚠️ run died ✅ already exists as code-beautify
- [x] **code-minify** · developer — terser, lightningcss-wasm or csso, html-minifier-terser. Show bytes saved. ⚠️ run died ⚠️ run died ✅ already on master
- [x] **video-compress** · video · after: video-foundation — Presets by target size or quality. Warn on memory limits for long files. ⚠️ run died ✅ already exists as video-compress
- [x] **image-ocr** · image — tesseract.js with a language picker and self-hosted traineddata. Copy or download the text. ⚠️ run died ⏳ run-20261021-1531-369a @ 2026-10-21T15:41:05Z ✅ 8784cc2
- [x] **background-remover** · image · after: ml-runtime-foundation — Use a permissively licensed model (e.g. MODNet); RMBG-1.4 is non-commercial, so don't use it. Output transparent PNG or a solid-colour background. ⚠️ run died ⏳ run-20261023-2100-7541 @ 2026-10-23T21:16:07Z ✅ 041bfa8
- [x] **screen-recorder** · video — getDisplayMedia + MediaRecorder with a mic toggle. WebM output, plus MP4 where the browser supports it. ⚠️ run died ⚠️ run died ✅ 041bfa8
- [x] **webcam-recorder** · video — getUserMedia + MediaRecorder. Share the recording code with screen-recorder. ⏳ run-20261021-1731-c91e @ 2026-10-21T17:37:32Z ✅ f6cb8ad
- [x] **pdf-organize** · pdf — Thumbnail grid with drag-to-reorder, rotate, delete, and insert blank page. ⚠️ run died ⏳ run-20261021-1604-7f47 @ 2026-10-21T17:30:00Z ✅ a0f7e7e
- [x] **password-strength** · security — zxcvbn-ts. Show estimated crack time and feedback. The password is never stored or logged. ⚠️ run died ✅ already exists as password-strength
- [x] **markdown-preview** · developer — Split-pane live editor: GFM, code highlighting, export to HTML, print to PDF. ⚠️ run died ⚠️ run died ✅ 041bfa8
- [x] **percentage-calculator** · misc — X% of Y; X is what % of Y; % change; increase/decrease by %. ⚠️ run died ✅ already exists as percentage-calculator
- [x] **gst-calculator** · misc — Add or remove GST; CGST/SGST/IGST split. Verify current slab rates against an official source before shipping. ⚠️ run died ⚠️ run died ✅ already on master
- [x] **sip-calculator** · misc — SIP, step-up SIP, and lumpsum, with a growth chart. Add a "not financial advice" note. ⚠️ run died ⚠️ run died ✅ already on master
- [x] **compound-interest** · misc — Compounding frequency, periodic contributions, and a yearly schedule table. ✅ already exists as compound-interest-calculator
- [x] **webcam-test** · device — Registers the `device` category. Device picker, resolution and fps readout, snapshot. Nothing leaves the device. ⚠️ run died ⏳ run-20261023-2100-7541 @ 2026-10-23T21:16:07Z ✅ 041bfa8
- [x] **mic-test** · device — Level meter, waveform, record and play back. ⚠️ run died ⏳ run-20261023-2100-7541 @ 2026-10-23T21:16:07Z ✅ 041bfa8
- [x] **keyboard-tester** · device — On-screen layout that lights up per key; key/code readout; ghosting test. ✅ c25e5c6
- [x] **video-trim** · video · after: video-foundation — Stream copy when cut points allow, re-encode otherwise. Scrubber preview. ✅ 138c2bf
- [x] **video-extract-audio** · video · after: video-foundation — MP3, AAC, and WAV output. ✅ a9067f7
- [x] **video-convert** · video · after: video-foundation — MP4, WebM, MOV, and MKV. Remux when possible, transcode when needed. ✅ 5936034
- [x] **image-watermark** · image — Text or logo watermark; opacity, position, or tiled. Batch mode. ✅ 3110270
- [x] **image-add-text** · image — Captions and meme-style text: fonts, stroke, shadow, drag to position. ✅ 906dd6a
- [x] **image-blur-redact** · image — Draw regions to blur, pixelate, or black out. Strip metadata on export. ✅ 8cb89f1
- [x] **pdf-protect** · pdf — Add a password via qpdf-wasm (Apache-2.0). AES-256. ✅ 777c090
- [x] **pdf-unlock** · pdf — Remove a password the user already knows (qpdf-wasm). No cracking. ✅ 041bfa8
- [x] **pdf-fill-form** · pdf — Fill AcroForm fields with pdf-lib; option to flatten. ✅ 041bfa8
- [x] **speech-to-text** · audio · after: ml-runtime-foundation — Whisper tiny/base. Timestamps; export TXT, SRT, and VTT. File input and mic input. ✅ 041bfa8
- [x] **text-to-speech** · audio — Web Speech API with voice, rate, and pitch controls. ✅ 041bfa8
- [x] **voice-recorder** · audio — MediaRecorder with WAV or WebM output. Link to audio-trim. ✅ 041bfa8
- [x] **audio-convert** · audio — Generalise audio-to-wav into `audio-convert`: WAV, MP3 (separate-file LGPL encoder is ok), and Opus/OGG. `audio-to-wav` becomes an alias. ✅ 041bfa8
- [x] **file-encrypt** · security — AES-256-GCM, reusing the text-encrypt KDF. Streaming or chunked for large files; versioned file header. ✅ 041bfa8
- [x] **totp-generator** · security — Live 6/8-digit codes from a secret or otpauth URI, with a countdown. Pairs with otp-uri. ✅ already exists as totp-authenticator
- [x] **sqlite-viewer** · developer — sql.js. Browse tables, run queries, export CSV or JSON. ✅ 041bfa8
- [x] **spreadsheet-viewer** · data — SheetJS installed from the cdn.sheetjs.com tarball (the npm version is stale). Open xlsx/xls/ods/csv; switch sheets; convert to CSV, JSON, or XLSX. ✅ 041bfa8
- [x] **xml-json** · data — XML ↔ JSON in both directions, with attribute and array handling options. ✅ already exists as xml-json-convert
- [x] **toml-json** · data — TOML ↔ JSON, plus an INI ↔ JSON mode. ✅ already exists as toml-convert
- [x] **jsonpath-tester** · data — JSONPath and JMESPath; highlight matches in the source. ✅ already exists as jsonpath
- [x] **mermaid-renderer** · developer — Live Mermaid editor; export SVG or PNG. ✅ 041bfa8
- [x] **code-to-image** · developer — Shiki highlighting; themes, padding, background, window chrome. PNG or SVG export. ✅ 041bfa8
- [x] **stopwatch** · datetime — Laps and keyboard shortcuts. Compute from timestamps rather than counting intervals, so it stays accurate when the tab sleeps. ✅ 041bfa8
- [x] **countdown-timer** · datetime — Multiple timers; sound and notification on finish. ✅ 041bfa8
- [x] **pomodoro-timer** · datetime — Configurable work/break cycles; notifications. ✅ 041bfa8
- [x] **typing-test** · text — WPM and accuracy, time modes, local history. ✅ 041bfa8
- [x] **signature-maker** · generators — Draw or type a signature; transparent PNG or SVG. Share the signature component with pdf-sign. ✅ 041bfa8
- [x] **invoice-generator** · generators — Form to PDF with pdf-lib: line items, taxes, logo. Drafts saved locally. ✅ 041bfa8
- [x] **image-filters** · image — Brightness, contrast, saturation, grayscale, sepia, sharpen, with live preview. ✅ 041bfa8
- [x] **gif-maker** · image — Images to animated GIF with gifenc; frame delay and loop settings. ✅ 041bfa8
- [x] **image-collage** · image — Grid layouts, spacing, background; export. ✅ 041bfa8
- [x] **svg-optimizer** · image — SVGO browser build; preset toggles; before/after size and preview. ✅ already on master
- [x] **x509-decoder** · security — Decode PEM/DER certificates and CSRs with @peculiar/x509: validity, SANs, issuer fields, fingerprints. ✅ already exists as x509-certificate-inspector
- [x] **keypair-generator** · security — RSA, ECDSA, and Ed25519 via WebCrypto. PEM and OpenSSH formats. ✅ already exists as keypair-generator
- [x] **bcrypt** · security — Hash and verify with a cost factor; bcryptjs in a worker. ✅ 041bfa8
- [x] **pgp-tool** · security — openpgp.js (LGPL, separate chunk): keygen, encrypt/decrypt, sign/verify. ✅ 041bfa8
- [x] **tuner** · audio — Mic pitch detection (YIN or autocorrelation); show note and cents. ✅ 041bfa8
- [x] **spectrogram** · audio — From a file or the mic; FFT; PNG export. ✅ 041bfa8
- [x] **bpm-detector** · audio — Tempo detection from a file via Web Audio. ✅ 041bfa8
- [x] **speaker-test** · device — Left/right/both channels and a frequency sweep. Reuse tone-generator code. ✅ 041bfa8
- [x] **dead-pixel-test** · device — Fullscreen solid colours with cycling. ✅ 041bfa8
- [x] **fancy-text** · text — Unicode styled letters (bold, script, fraktur, etc.). Note that screen readers handle these poorly. ✅ 041bfa8
- [x] **upgrade-text-stats** · text — Add platform limits (X, LinkedIn, Instagram, meta description) and readability scores. ✅ 041bfa8
- [x] **gpa-calculator** · misc — 10-point CGPA and 4.0 scales; CGPA ↔ % conversion with a configurable formula. ✅ 041bfa8
- [x] **upgrade-calculator-scientific** · misc — Add a keypad UI to `calculator`: trig, log, constants, history. ✅ 041bfa8
- [x] **html-playground** · developer — HTML/CSS/JS live preview in a sandboxed iframe without allow-same-origin. ✅ 041bfa8
- [x] **video-frames** · video · after: video-foundation — Extract frames at an interval, or build a thumbnail contact sheet. ✅ 041bfa8
- [x] **pdf-redact** · pdf — True redaction: rasterize affected pages and burn in the boxes. Warn the user that those pages lose their text layer. ✅ 041bfa8
- [x] **pdf-ocr** · pdf · after: image-ocr — Produce a searchable PDF by adding a tesseract.js text layer. ✅ 041bfa8
- [x] **image-upscale** · image · after: ml-runtime-foundation — 2x/4x with a permissively licensed ESRGAN-type model. WebGPU preferred; enforce size limits. ✅ 041bfa8
- [x] **noise-reduction** · audio — RNNoise WASM. ✅ 041bfa8
- [x] **world-clock** · datetime — Pinned cities and a meeting-overlap view. Reuse timezone-convert logic. ✅ already exists as world-clock
- [x] **online-notepad** · text — Autosave to IndexedDB, multiple notes, export .txt or .md. ✅ 041bfa8
