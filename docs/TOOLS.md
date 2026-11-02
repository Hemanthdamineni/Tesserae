# Complete Tool List

Total: **505** tools across **20** categories.

Generated from `src/tools/**/*.meta.ts` (source of truth).

## archive (14)

| id | name | input | status | summary |
| --- | --- | --- | --- | --- |
| `compressed-file-inspector` | Compressed File Inspector | file | stable | Identify zstd, xz, bzip2, gzip, lz4 and brotli files and read their headers, sizes and checksums. |
| `tar-create` | Create TAR Archive | file | stable | Bundle files into a TAR (optionally gzipped .tar.gz) archive. |
| `zip-create` | Create ZIP Archive | file | stable | Create a ZIP archive from one or more files. |
| `tar-extract` | Extract TAR Archive | file | stable | Extract regular files from .tar, .tar.gz and .tgz archives. |
| `zip-extract` | Extract ZIP Archive | file | stable | Extract the entries of a ZIP archive as individual download files. |
| `file-metadata` | File Metadata | file | stable | Inspect file names, sizes, MIME types, timestamps and SHA-256 hashes. |
| `binary-file-signature` | File Signature Inspector | file | stable | Identify common file formats from their binary signatures, not just extensions. |
| `file-signature` | File Signature Inspector | file | stable | Identify common file formats from their bytes instead of trusting the extension. |
| `base64-file` | File to Base64 | file | stable | Encode a file as Base64 text or decode Base64 into a file. |
| `gzip` | Gzip Compress / Decompress | file | stable | Compress a file to .gz or decompress a .gz file back to its original bytes. |
| `zip-inspect` | Inspect ZIP Archive | file | stable | Inspect the files, sizes and compression ratio inside a ZIP archive. |
| `file-join` | Join File Chunks | file | stable | Join numbered file chunks into one file and verify an optional manifest. |
| `file-split` | Split File into Chunks | file | stable | Split a large file into numbered part chunks plus a JSON manifest. |
| `warc-archive-inspector` | WARC Archive Inspector | file | stable | Inspect WARC web archives: records, block digests, target URIs, lengths and damage. |

## audio (25)

| id | name | input | status | summary |
| --- | --- | --- | --- | --- |
| `audio-gain` | Adjust Audio Volume | file | stable | Raise or lower an audio file by a set amount in dB. |
| `aiff-inspector` | AIFF Inspector | file | stable | Parse an Audio Interchange File Format (AIFF/AIFC) file on-device: the FORM header, COMM, SSND and metadata chunks. |
| `audio-channels` | Audio Channel Tools | file | stable | Convert mono and stereo, swap channels, isolate left/right, or encode mid-side. |
| `audio-info` | Audio File Info | file | stable | Inspect an audio file: duration, sample rate, channels, bitrate, peak and clipping. |
| `bpm-detector` | BPM Detector | file | stable | Find the tempo of a song from a file or the mic, with a tap-tempo fallback. |
| `audio-speed` | Change Audio Speed | file | stable | Speed up or slow down audio, optionally preserving pitch approximately. |
| `audio-convert` | Convert Audio | file | stable | Convert audio to WAV, MP3 or Opus/OGG — locally in your browser, no uploads. |
| `audio-to-wav` | Convert Audio to WAV | file | stable | Convert browser-supported audio files to uncompressed 16-bit PCM WAV. |
| `audio-fade` | Fade Audio In / Out | file | stable | Apply a linear, exponential or logarithmic fade in and fade out to audio. |
| `flac-inspector` | FLAC Audio Inspector | file | stable | Inspect a FLAC audio file: metadata blocks, sample rate, channels, bit depth, duration, and tags. |
| `loudness-meter` | Loudness Meter (LUFS) | file | stable | Measure the perceived loudness of an audio file in integrated LUFS, with momentary/short-term levels, LRA and true peak. |
| `audio-merge` | Merge / Concatenate Audio | file | stable | Join audio files end-to-end or mix them together into one WAV. |
| `midi-inspector` | MIDI File Inspector | file | stable | Inspect a Standard MIDI File: header format, timing, track chunks, and note, tempo, and meta events. |
| `id3-tag-reader` | MP3 Tag (ID3) Reader | file | stable | Read ID3v2 and ID3v1 tags from an MP3: title, artist, album, year, track and cover art. |
| `noise-reduction` | Noise Reduction | file | beta | Remove background noise from speech with RNNoise, then blend the result back into the original. |
| `audio-normalize` | Normalise Audio | file | stable | Scale audio to a target peak or RMS level (in dBFS) without changing the length. |
| `ogg-inspector` | Ogg Stream Inspector | file | stable | Inspect an Ogg container: capture pattern, header flags, granule position, serial, and every page. |
| `audio-reverse` | Reverse Audio | file | stable | Reverse an audio clip sample-for-sample and save the result as WAV. |
| `spectrogram` | Spectrogram | file | stable | Render an audio file as a spectrogram PNG: FFT, window, colour map and dB range are yours. |
| `text-to-speech` | Text to Speech | text | stable | Read text aloud with your browser’s built-in voices — pick a voice, tune rate, pitch and volume. |
| `speech-to-text` | Transcribe Speech to Text | file | beta | Transcribe speech from an audio file or the microphone, on-device, and export TXT, SRT or VTT subtitles. |
| `audio-trim` | Trim / Clip Audio | file | stable | Cut an audio file to a range and apply click-free fade in/out edges. |
| `tuner` | Tuner | text | beta | Tune an instrument from your microphone: see the note, the cents deviation and a needle. |
| `voice-recorder` | Voice Recorder | file | stable | Record your microphone as WAV or WebM with a live level meter, pause/resume and a take you can play back. |
| `wav-inspector` | WAV Audio Inspector | file | stable | Inspect a WAV audio file: RIFF chunk tree, PCM format, sample rate, channels, bit depth, and duration. |

## color (8)

| id | name | input | status | summary |
| --- | --- | --- | --- | --- |
| `color-blend` | Color Blender | text | stable | Mix two colors in RGB or HSL space with a 0-100% blend ratio. |
| `color-blindness` | Color Blindness Simulator | text | stable | Simulate protanopia, deuteranopia, tritanopia and achromatopsia on your colors. |
| `color-contrast` | Color Contrast Checker | text | stable | Check WCAG 2.1 contrast ratios for foreground/background colour pairs. |
| `delta-e` | Color Difference (ΔE) | text | stable | Measure how far apart two colors look with the perceptual CIEDE2000, CIE76 and CIE94 colour-difference formulae. |
| `color-name` | Color Name Finder | text | stable | Find the nearest of the 148 CSS named colors, ranked by perceptual distance. |
| `color-palette` | Color Palette Generator | text | stable | Generate tints, shades, complementary, triadic and analogous color palettes. |
| `color-convert` | Colour Converter | text | stable | Convert a colour between HEX, RGB, HSL, HSV, CMYK and OKLCH. |
| `color-random` | Random Color Generator | text | stable | Generate random colors in a chosen style - warm, cool, pastel, vivid and more. |

## converters (3)

| id | name | input | status | summary |
| --- | --- | --- | --- | --- |
| `docx-to-markdown` | DOCX to Markdown | file | stable | Turn a Word .docx into Markdown or plain text locally — headings, lists and tables. |
| `subtitle-converter` | Subtitle Converter | text | stable | Convert subtitle files between SRT and WebVTT, and shift cue timings, entirely on-device. |
| `torrent-file-inspector` | Torrent File Inspector | file | stable | Read a .torrent: info-hash, magnet link, file list, piece size and tracker, decoded on-device. |

## crypto (11)

| id | name | input | status | summary |
| --- | --- | --- | --- | --- |
| `asn1-inspector` | ASN.1 / DER Inspector | file | stable | Parse a DER (or PEM) ASN.1 structure into a readable tree: tag, class, length, type, offset and value. |
| `crc-calculator` | CRC Calculator | file | stable | Compute any CRC preset — CRC-8, CRC-16, CRC-32, CRC-64 — or your own parameters, over files or text. |
| `crc32` | CRC-32 / Adler-32 Checksum | text | stable | Compute CRC-32, CRC-32C or Adler-32 checksums of text, as hex or decimal. |
| `keypair-generator` | Cryptographic Keypair Generator | text | stable | Generate RSA, ECDSA or Ed25519 key pairs in the browser and export them as PEM, with an optional sign-and-verify check. |
| `csr-decoder` | CSR Decoder | file | stable | Decode a PKCS#10 certificate request: subject, SANs, key details and a signature check. |
| `file-hash` | File Hash / Checksum | file | stable | Compute SHA-256/384/512 and SHA-1 checksums for one or more files. |
| `hmac` | HMAC Generator | text | stable | Compute an HMAC of text with a secret key using SHA-1, SHA-256, SHA-384 or SHA-512. |
| `pbkdf2-key-derivation` | PBKDF2 Key Derivation | text | stable | Derive a key from a passphrase with PBKDF2-HMAC, or verify a stored PBKDF2 password hash. |
| `rsa-encrypt-decrypt` | RSA Encrypt / Decrypt | text | stable | Encrypt with a public PEM key and decrypt with the private key using RSA-OAEP, fully on device. |
| `hash` | Text Hash Generator | text | stable | Hash text with MD5, SHA-1, SHA-256, SHA-384 or SHA-512 and output hex, Base64 or base64url. |
| `x509-certificate-inspector` | X.509 Certificate Inspector | text | stable | Parse an X.509 certificate: subject, issuer, validity, key details, SANs and fingerprints. |

## data (45)

| id | name | input | status | summary |
| --- | --- | --- | --- | --- |
| `dotenv` | .env <-> JSON | text | stable | Parse a .env file into JSON, or turn a JSON object into .env text. Runs entirely on your device. |
| `ascii-table` | ASCII Table Generator | text | stable | Turn CSV (or tab-separated) rows into a bordered ASCII table for docs, emails and code comments. |
| `csv-diff` | CSV Diff | text | stable | Compare two CSV files keyed by a column: added, removed and changed cells. |
| `csv-sanitize` | CSV Formula Injection Guard | text | stable | Detect and neutralize spreadsheet formula injection in CSV cells. |
| `csv-to-html` | CSV to HTML Table | text | stable | Turn CSV data into a clean HTML table, with optional inline styling, on device. |
| `csv-to-ics` | CSV to iCalendar | text | stable | Turn a CSV of events into a downloadable .ics file importable into Google Calendar, Outlook or Apple Calendar. |
| `csv-to-json` | CSV to JSON | text | stable | Parse CSV (RFC 4180) into a JSON array, with delimiter sniffing and type inference. |
| `csv-to-markdown` | CSV to Markdown Table | text | stable | Convert a CSV table into a clean GitHub-Flavored Markdown pipe table with optional alignment. |
| `csv-to-sql` | CSV to SQL INSERT | text | stable | Turn a CSV table into INSERT statements for MySQL, Postgres, SQLite or any SQL database. |
| `csv-to-yaml` | CSV to YAML | text | stable | Convert a CSV table into block-style YAML with automatic type detection and quoting. |
| `csv-transpose` | CSV Transpose | text | stable | Swap CSV rows and columns while preserving quoted fields. |
| `json-flatten` | Flatten JSON | text | stable | Flatten nested JSON to dotted keys (users.0.name) or collapse dotted keys back into nested JSON. |
| `geojson-validator` | GeoJSON Validator | file | stable | Validate GeoJSON against RFC 7946 and inspect features, rings and bounds. |
| `gpx-track-stats` | GPX Track Stats | file | stable | Summarize a GPX track: distance, elevation gain and loss, duration, speed and splits. |
| `html-to-csv` | HTML Table to CSV | text | stable | Extract <table> elements from pasted HTML and output clean, RFC-4180 CSV. |
| `ini-convert` | INI Converter | text | stable | Convert INI config files to JSON or serialize JSON back to INI, on device. |
| `json-diff` | JSON Diff | text | stable | Structural diff of two JSON documents, showing added, removed and changed values by path. |
| `json-format` | JSON Formatter & Validator | text | stable | Pretty-print, minify, recursively sort keys or validate JSON, with line/column errors. |
| `json-patch` | JSON Patch | text | stable | Apply RFC 6902 JSON Patch operations to a JSON document in your browser. |
| `json-schema-check` | JSON Schema Checker | text | stable | Validate JSON against a practical subset of JSON Schema keywords. |
| `json-schema-to-typescript` | JSON Schema to TypeScript | text | stable | Turn a JSON Schema into TypeScript interfaces and types, including $defs, unions and enums. |
| `json-escape` | JSON String Escape / Unescape | text | stable | Turn raw text into a quoted JSON string literal, or decode a JSON string literal back. |
| `json-to-env` | JSON to .env | text | stable | Flatten a JSON config into .env lines: VAR__NESTED=value, arrays as JSON, quoting handled. |
| `json-to-csv` | JSON to CSV | text | stable | Turn a JSON array of objects into CSV, with delimiter, header, and flatten options. |
| `json-to-go-struct` | JSON to Go Struct | text | stable | Generate idiomatic Go structs with json tags from a JSON sample, ready for encoding/json round-trips. |
| `json-to-graphql` | JSON to GraphQL Types | text | stable | Generate GraphQL SDL type definitions from a sample JSON object, arrays to [Type], scalars inferred. |
| `json-to-html-table` | JSON to HTML Table | text | stable | Render a JSON array into an HTML table of rows and columns, with multi-level headers. |
| `json-to-jsonschema` | JSON to JSON Schema | text | stable | Infer a JSON Schema (draft 2020-12) from a JSON sample, with required and additionalProperties control. |
| `json-to-python` | JSON to Python Dataclasses | text | stable | Generate Python dataclass or TypedDict definitions from a JSON sample, with nested models. |
| `json-to-typescript` | JSON to TypeScript | text | stable | Generate TypeScript interfaces or type aliases from a JSON sample, with nested named types. |
| `json-to-yaml` | JSON to YAML | text | stable | Convert JSON to YAML on your device, with a 2- or 4-space indent. |
| `mbox-archive-analyzer` | mbox Archive Analyzer | file | stable | Analyze an mbox mail archive: messages, senders, attachments, flags and archive problems. |
| `ndjson` | NDJSON <-> JSON Array | text | stable | Convert newline-delimited JSON to a JSON array and back, one compact value per line. |
| `properties-convert` | Properties Converter | text | stable | Convert Java .properties config to JSON or serialize JSON back to .properties. |
| `plist-decoder` | Property List Decoder | file | stable | Read binary and XML property lists (.plist): tree, types, object table and warnings. |
| `querystring` | Query String <-> JSON | text | stable | Parse a URL query string into JSON, or build a query string from a JSON object. Local only. |
| `spreadsheet-viewer` | Spreadsheet Viewer | file | stable | Open XLSX, XLS, ODS or CSV on-device — switch sheets, scan the grid and convert to CSV, JSON or XLSX. |
| `sqlite-structure-inspector` | SQLite Structure Inspector | file | stable | Audit the physical layout of a .db/.sqlite file: header fields, page types, b-tree usage, freelist and integrity. |
| `toml-convert` | TOML ⇄ JSON Converter | text | stable | Parse TOML into JSON, or serialize JSON back to TOML. |
| `xml-json-convert` | XML ⇄ JSON Converter | text | stable | Convert XML documents into JSON and JSON back into XML. |
| `xml-format` | XML Formatter | text | stable | Pretty-print or minify XML with a pure-JS tokenizer — comments, CDATA and PIs kept intact. |
| `xml-to-csv` | XML to CSV | text | stable | Flatten repeated XML elements into a CSV table, with attributes and nested values as columns. |
| `yaml-format` | YAML Formatter & Validator | text | stable | Format and validate YAML locally, preserving comments and document streams. |
| `yaml-lint` | YAML Lint & Normalize | text | stable | Validate YAML and reformat it with consistent 2-space indentation and correct quoting. |
| `yaml-to-json` | YAML to JSON | text | stable | Convert YAML to JSON locally, with indent choice and optional key sorting. |

## datetime (15)

| id | name | input | status | summary |
| --- | --- | --- | --- | --- |
| `age-calculator` | Age Calculator | text | stable | Work out an exact age plus totals, zodiac sign and next birthday. |
| `countdown-timer` | Countdown Timer | text | stable | Run several countdown timers at once, each with a sound and an optional notification when it ends. |
| `date-add` | Date Add / Subtract | text | stable | Add or subtract years, months, days, hours and minutes from a date. |
| `date-diff` | Date Difference Calculator | text | stable | Measure the exact gap between two dates in every unit, including business days. |
| `duration-convert` | Duration Converter | text | stable | Convert durations between human, ISO 8601, clock and plain-seconds forms. |
| `rrule-builder` | iCalendar Recurrence Rule Builder | text | stable | Build and validate RFC 5545 RRULE recurrence strings for calendar events. |
| `pomodoro-timer` | Pomodoro Timer | text | stable | A deadline-accurate Pomodoro timer with configurable work, short-break and long-break cycles. |
| `recurrence-dates` | Recurrence Dates Calculator | text | stable | List the next upcoming dates for a weekly, monthly, or yearly repeating schedule. |
| `stopwatch` | Stopwatch | text | stable | A precise stopwatch with laps and keyboard shortcuts that stays accurate when the tab sleeps. |
| `strftime` | strftime Formatter | text | stable | Format a timestamp with strftime tokens — %Y-%m-%d, %H:%M:%S, %j, %U, %s and more — in your local time or UTC. |
| `timezone-convert` | Timezone Converter | text | stable | Convert a date and time across world timezones in one table. |
| `timestamp` | Unix Timestamp Converter | text | stable | Convert Unix timestamps to dates and dates to every common timestamp format. |
| `week-number` | Week Number Calculator | text | stable | Get the ISO 8601 week number plus day-of-year, quarter and leap-year facts. |
| `workday-calculator` | Workday Calculator | text | stable | Add business days to a date or count the working days between two dates, skipping weekends and holidays. |
| `world-clock` | World Clock | text | stable | Current time, date and UTC offset for any IANA time zones, instantly and on your device. |

## developer (66)

| id | name | input | status | summary |
| --- | --- | --- | --- | --- |
| `dockerignore-generator` | .dockerignore Generator | text | stable | Build a .dockerignore for a lean Docker build context — pick a stack preset and add custom lines. |
| `ansi-sequences` | ANSI Escape Sequence Inspector | text | stable | Strip, visualize, or inspect ANSI terminal escape sequences in text and logs. |
| `avro-inspector` | Avro Inspector | file | stable | Read an Apache Avro object-container file on-device: magic, schema, codec, sync markers and data blocks. |
| `axml-inspector` | AXML Inspector | file | stable | Parse an Android binary XML (.axml) on-device: its chunk tree, string pool, elements, and attribute counts. |
| `backslash-escape` | Backslash Escape / Unescape | text | stable | Turn control characters into readable \\n \\t \\xNN \\uNNNN sequences, or interpret those sequences back into characters. |
| `chmod-calculator` | chmod Permission Calculator | text | stable | Convert Unix file permissions between octal (755) and symbolic (rwxr-xr-x), with a per-class breakdown. |
| `code-beautify` | Code Beautifier | text | beta | Beautify JS, TS, CSS, SCSS, Less, HTML, Vue, JSON, Markdown and YAML with Prettier, in your browser. |
| `code-minify` | Code Minifier | text | beta | Minify JavaScript, TypeScript, CSS, HTML and JSON in your browser, and see exactly how many bytes you saved. |
| `code-to-image` | Code to Image | text | beta | Turn a code snippet into a polished PNG or SVG with Shiki syntax highlighting. |
| `conventional-commit` | Conventional Commit Builder | text | stable | Compose a Conventional Commits message — type, scope, breaking change and body — and copy the ready commit text. |
| `cron-parser` | Cron Expression Parser | text | stable | Explain a cron expression in plain English and list its next run times in UTC. |
| `crontab-generator` | Crontab Generator | text | stable | Build a cron expression from presets or fields and get the crontab line plus a plain-English summary. |
| `css-specificity-calculator` | CSS Specificity Calculator | text | stable |  |
| `css-variables-extractor` | CSS Variables Extractor | text | stable | Extract every CSS custom property from a stylesheet into a table of names, values and scope. |
| `csv-profiler` | CSV Profiler | text | stable | Profile a CSV file: per-column type inference, missing values, unique counts, and numeric stats. |
| `curl-to-code` | cURL to Code | text | stable | Turn a curl command into ready-to-run code for 12 languages and frameworks. |
| `curl-to-fetch` | curl to fetch | text | stable | Turn a curl command into ready-to-run JavaScript fetch, axios or Python requests code. |
| `dex-inspector` | DEX File Inspector | file | stable | Parse an Android Dalvik .dex binary on-device: header, checksum and signature, and the string, type and class tables. |
| `docker-compose` | docker-compose.yml Generator | text | stable | Build a docker-compose.yml for one service — image, ports, environment, volumes and restart policy. |
| `dockerfile-generator` | Dockerfile Generator | text | stable | Build a Dockerfile from friendly fields — base image, workdir, env, ports, RUN steps and CMD — ready to paste. |
| `elf-binary-inspector` | ELF Binary Inspector | file | stable | Parse an ELF/Linux binary on-device: class, type, machine, sections, symbols, deps and hardening. |
| `font-inspector` | Font Inspector | file | stable | Inspect TTF, OTF, TTC, WOFF and WOFF2 fonts: tables, names, embedding rights and glyph coverage. |
| `glob-tester` | Glob Tester | text | stable | Match a glob pattern against file paths: *, **, ?, [...] classes and {a,b} sets. |
| `hash-identifier` | Hash Identifier | text | stable | Guess which hash or password format a string is, from its length and character set. |
| `html-playground` | HTML Playground | text | stable | Three panes for HTML, CSS and JS with a sandboxed live preview as you type, plus a one-click .html download. |
| `html-validator` | HTML Tag Validator | text | stable | Check tag balance and well-formedness: unclosed, mismatched, stray and unexpected tags, with line numbers. |
| `html-to-jsx` | HTML to JSX | text | stable | Convert an HTML snippet to JSX: class→className, for→htmlFor, void tags self-close, indented. |
| `html-to-markdown` | HTML to Markdown | text | stable | Convert an HTML snippet or page into clean Markdown, on device, no server. |
| `html-to-text` | HTML to Plain Text | text | stable | Strip HTML tags to clean, readable plain text — entities decoded, block layout preserved. |
| `html-to-pug` | HTML to Pug | text | stable | Convert HTML into Pug (formerly Jade) template syntax with shorthand selectors, attributes and indentation. |
| `http-request-builder` | HTTP Request Builder | text | stable | Compose a raw HTTP/1.1 request — method, URL, headers and body — with Host and Content-Length filled in. |
| `ieee754-inspector` | IEEE 754 Float Inspector | text | stable | Decode and encode 32/64-bit floats: sign, exponent, mantissa, hex and bytes. |
| `class-inspector` | Java Class Inspector | file | stable | Inspect a Java class file: magic, version, constant pool, access flags, fields, and methods. |
| `jsdoc-generator` | JSDoc Generator | text | stable | Generate a JSDoc comment block from a function signature, with @param and @returns lines. |
| `json-to-csharp` | JSON to C# Class | text | stable | Generate C# classes and record types from a JSON sample for System.Text.Json deserialization. |
| `json-to-java` | JSON to Java | text | stable | Generate Java POJO, Lombok or record classes from JSON with nested types and getters. |
| `json-to-mongodb` | JSON to MongoDB | text | stable | Wrap JSON documents in a mongosh insertMany script for a collection, exactly as BSON-ready documents. |
| `json-to-sql` | JSON to SQL | text | stable | Turn a JSON array of objects into SQL INSERT statements with correct types and escaping. |
| `json-to-swift` | JSON to Swift Struct | text | stable | Generate Swift Codable structs from a JSON sample so API payloads decode cleanly in iOS apps. |
| `json-to-zod` | JSON to Zod Schema | text | stable | Generate a Zod schema from a JSON sample so you can validate runtime data and infer clean types. |
| `jsonpath` | JSONPath Extractor | text | stable | Query JSON with JSONPath: select values by path, wildcards, filters, slices. |
| `mach-o-inspector` | Mach-O Binary Inspector | file | stable | Parse an Apple Mach-O binary on-device: 32/64-bit, CPU, file type, flags, load commands, segments and deps. |
| `markdown-link-checker` | Markdown Link Checker | text | stable | Check Markdown links and anchors: broken fragments, missing references, empty URLs. |
| `markdown-preview` | Markdown Preview | text | beta | Live split-pane Markdown editor with GFM, highlighted code, HTML export and print to PDF. |
| `markdown-table` | Markdown Table Formatter | text | stable | Normalize Markdown pipe tables and optionally align their columns. |
| `markdown-table-sort` | Markdown Table Sorter | text | stable | Sort Markdown pipe-table rows by a column: numeric or text, ascending or descending. |
| `markdown-to-html` | Markdown to HTML | text | stable | Convert Markdown to HTML source code — see the generated markup, not a preview. |
| `mermaid-renderer` | Mermaid Renderer | text | stable | Edit Mermaid diagram source and watch a live SVG render, then export the SVG or a PNG. |
| `objectid` | MongoDB ObjectId | text | stable | Decode a 24-character MongoDB ObjectId into its timestamp, random and counter bytes. |
| `uuid-namespace` | Namespaced UUID (v3 / v5) | text | stable | Generate a deterministic name-based UUID (v5 SHA-1 or v3 MD5) from a namespace and name. |
| `number-base` | Number Base Converter | text | stable | Convert an integer between any bases from 2 to 36 with arbitrary precision (BigInt). |
| `pe-inspector` | PE Inspector | file | stable | Parse a Windows PE/COFF binary on-device: machine, subsystems, sections, imports and hardening flags. |
| `regex-explainer` | Regex Explainer | text | stable | Break a regular expression into tokens with a plain-English explanation of each piece. |
| `regex-tester` | Regex Tester | text | stable | Test a JavaScript regular expression against text — highlight, list matches, replace or split. |
| `semver` | Semantic Version Tool | text | stable | Validate, compare, and sort Semantic Versioning 2.0.0 values. |
| `snowflake` | Snowflake ID Decoder | text | stable | Decode a 64-bit Snowflake ID into its timestamp, worker, process and sequence parts. |
| `sql-format` | SQL Formatter (basic) | text | stable | Pretty-print a SQL query: keyword casing, clause line breaks, indented joins and columns. |
| `sqlite-viewer` | sql.js | file | stable | Open a .db or .sqlite file in your browser: browse tables, run read-only SQL, export CSV. |
| `string-escape` | String Escaper | text | stable | Escape or unescape text for JS, JSON, C, Java, Python, shell, SQL, CSV, HTML, XML, URL, backslash or Unicode. |
| `svg-to-jsx` | SVG to JSX / React Component | text | stable | Convert SVG or XML markup into JSX — camelCased attributes, style objects, optional component. |
| `systemd-unit-inspector` | systemd Unit Inspector | text | stable | Inspect and validate systemd unit files: directives, dependencies, ExecStart and hardening. |
| `tar-inspector` | TAR Inspector | file | stable | Read a POSIX tar archive on-device: list every entry, its type, size, mode, owner and checksum validity. |
| `diff-text` | Text Diff | text | stable | Compare two blocks of text and see the differences as a unified diff or an inline word/character diff. |
| `text-inspector` | Text Encoding & Character Inspector | text | stable | Inspect BOMs, line endings, control characters, and Unicode code points in text. |
| `ua-parser` | User-Agent Parser | text | stable | Decode any User-Agent string into browser, version, engine, OS, OS version and device class — on your device. |
| `wasm-inspector` | WASM Module Inspector | file | stable | Decode a WebAssembly .wasm binary: version, section tree with sizes, imports/exports, and structure checks. |

## device (5)

| id | name | input | status | summary |
| --- | --- | --- | --- | --- |
| `dead-pixel-test` | Dead Pixel Test | text | stable | Sweep your screen with solid colours and greys, fullscreen, to spot dead or stuck pixels. |
| `keyboard-tester` | Keyboard Tester | text | beta | Watch every key you press light up on screen, read the key and code the browser receives, and test for ghosting. |
| `mic-test` | Microphone Test | file | beta | Check a microphone: live level meter and waveform, then record a take and play it back. |
| `speaker-test` | Speaker Test | text | stable | Play a test tone or a log-spaced frequency sweep out of the left, right or both channels. |
| `webcam-test` | Webcam Test | file | beta | Preview a camera, read its live resolution and frame rate, and save a PNG snapshot. |

## encoding (17)

| id | name | input | status | summary |
| --- | --- | --- | --- | --- |
| `ascii85` | Ascii85 / Base85 | text | stable | Encode and decode Ascii85 / Base85 text in the Adobe, btoa and Z85 variants. |
| `base32` | Base32 Encode / Decode | text | stable | RFC 4648 Base32 and Crockford Base32 encoding and decoding of text. |
| `base58` | Base58 Encode / Decode | text | stable | Convert text to and from Base58 using the Bitcoin and IPFS alphabet. |
| `base64` | Base64 Encode / Decode | file | stable | Convert text or a file to and from Base64, with URL-safe and MIME line-wrap options. |
| `bson-decoder` | BSON Decoder | file | stable | Decode a BSON (MongoDB) binary document on-device into readable JSON with a per-type breakdown. |
| `cbor-decoder` | CBOR Decoder | file | stable | Decode CBOR into readable JSON, with a structure outline and tag interpretation. |
| `hex` | Hex Encode / Decode | text | stable | Convert text to and from hexadecimal (UTF-8), with configurable separators. |
| `html-entity` | HTML Entity Converter | text | stable | Encode text to HTML entities (safe for &<>) and decode &amp;, &eacute;, &#123; back to text. |
| `html-entities` | HTML Entity Encode / Decode | text | stable | Escape text for safe insertion into HTML, or decode named and numeric entities. |
| `jwt-decode` | JWT Decoder | text | stable | Decode a JSON Web Token and pretty-print its header and payload. Does not verify the signature. |
| `jwt-sign` | JWT Signer | text | stable | Create and sign JSON Web Tokens with HMAC, or verify an existing token’s signature. |
| `msgpack-decoder` | MessagePack Decoder | file | stable | Decode a MessagePack binary message on-device into readable JSON with a type breakdown of every value. |
| `protobuf-decoder` | Protobuf Decoder | file | stable | Decode a Protocol Buffers binary message on-device into readable JSON with a per-field type breakdown. |
| `quoted-printable` | Quoted-Printable Encode / Decode | text | stable | Encode or decode MIME quoted-printable (=XX escapes, soft line breaks). |
| `text-to-binary` | Text to Binary | text | stable | Encode text as 8-bit binary (UTF-8 aware) or decode a string of 0s and 1s back to text. |
| `unicode-escape` | Unicode Escape / Unescape | text | stable | Convert text to and from \\uXXXX, \\xXX, \\u{...}, HTML and CSS escape forms. |
| `url-encode` | URL Encode / Decode | text | stable | Percent-encode or decode text for use in URLs — component or whole-URL mode. |

## generators (18)

| id | name | input | status | summary |
| --- | --- | --- | --- | --- |
| `barcode` | Barcode Generator | text | stable | Create Code 128, Code 39, EAN-13/8, UPC-A, ITF-14 and DataMatrix barcodes as crisp, scannable SVG. |
| `random-data` | Fake Data Generator | text | stable | Generate realistic fake datasets — people, contacts, addresses, products — as JSON, CSV or SQL. |
| `ical-event` | iCalendar Event Generator | text | stable | Create an .ics calendar event file with reminders that imports into any calendar app. |
| `invoice-generator` | Invoice Generator | text | stable | Build a clean, printable PDF invoice with line items, tax and totals, and save drafts locally. |
| `license-generator` | License Generator | text | stable | Generate a full open-source license text (MIT, Apache-2.0, BSD, ISC, Unlicense, CC0) with your year and name filled in. |
| `lorem-ipsum` | Lorem Ipsum Generator | text | stable | Generate lorem ipsum placeholder text as words, sentences, paragraphs, lists — plain, HTML or Markdown. |
| `metronome-click` | Metronome Click Track | text | stable | Generate a metronome click track as a WAV file at any tempo, bars and time signature. |
| `nanoid` | NanoID Generator | text | stable | Generate compact, URL-safe NanoIDs with unbiased randomness, in bulk. |
| `otp-uri` | OTP Auth URI Generator | text | stable | Build otpauth:// URIs (TOTP/HOTP) with a base32 secret for authenticator apps. |
| `placeholder-svg` | Placeholder Image Generator | text | stable | Generate sized SVG placeholder images with a custom label and colours for layouts and mockups. |
| `qr-scanner` | QR & Barcode Scanner | file | beta | Scan QR codes and barcodes from your camera or an image — decoded on-device with actions. |
| `qr-code` | QR Code Generator | text | stable | Generate QR codes for text, URLs, Wi-Fi, email, SMS and locations as crisp SVG. |
| `signature-maker` | Signature Maker | text | stable | Draw a signature or type one in a cursive style, then export it as a transparent PNG or SVG. |
| `tone-generator` | Tone / Signal Generator | text | stable | Generate a tone, waveform or noise signal as a downloadable WAV file. |
| `ulid` | ULID Generator | text | stable | Generate sortable ULIDs (timestamp + randomness) in Crockford base32. |
| `utm-builder` | UTM Campaign URL Builder | text | stable | Add utm_source, utm_medium, utm_campaign and more tracking parameters to any URL. |
| `uuid` | UUID Generator | text | stable | Generate RFC 4122 UUIDs (v4 random or v7 time-ordered) in bulk. |
| `vcard` | vCard Generator | text | stable | Build vCard 3.0 contact files, or parse a pasted vCard back into fields. |

## image (39)

| id | name | input | status | summary |
| --- | --- | --- | --- | --- |
| `image-add-text` | Add Text to Image | file | beta | Write captions and meme text on an image: fonts, outline, shadow, drag to place. |
| `image-blur-redact` | Blur & Redact Image | file | beta | Blur, pixelate or black out parts of an image and export a clean copy with no metadata. |
| `bmp-inspector` | BMP Image Inspector | file | stable | Inspect a Windows BMP: file header, DIB info, dimensions, bit depth, compression, and color table. |
| `image-compress` | Compress Image | file | stable | Reduce image file size by re-encoding locally in your browser. |
| `image-convert` | Convert Image Format | file | stable | Convert images between PNG, JPEG, WebP and AVIF in your browser. |
| `image-crop` | Crop Image | file | stable | Crop an image to an aspect ratio or explicit pixel rectangle. |
| `datauri-to-image` | Data URI to Image | file | beta | Decode an image data URI from a text file into an image file. |
| `dds-inspector` | DDS Texture Inspector | file | stable | Inspect a DirectDraw Surface texture: header flags, dimensions, mipmap count, and pixel format. |
| `dicom-inspector` | DICOM Inspector | file | stable | Parse a medical DICOM .dcm on-device: the preamble, DICM prefix, every tag and VR, and key patient and imaging fields. |
| `image-palette` | Extract Colour Palette | file | stable | Extract the dominant colour palette from an image locally. |
| `favicon-generator` | Favicon Generator | file | stable | Generate favicon, Apple touch, and Android icon assets from one image. |
| `gif-inspector` | GIF Inspector | file | stable | Decode the structure of a GIF: logical screen, color tables, frames, graphic-control/comment/application blocks. |
| `gif-maker` | GIF Maker | file | stable | Build an animated GIF from image frames: order, trim, set delays, pick size, loop and preview. |
| `heic-to-jpg` | HEIC to JPG | file | beta | Convert HEIC photos from iPhone and Android to JPG, PNG or WebP — right in your browser. |
| `icns-inspector` | ICNS Icon Inspector | file | stable | Inspect an Apple ICNS icon set: file magic and size, then every icon resource chunk and its type. |
| `ico-inspector` | ICO Icon Inspector | file | stable | Inspect a Windows icon (.ico): header, directory entries, dimensions, bit depth, and embedded image format. |
| `image-collage` | Image Collage Maker | file | stable | Arrange photos in a grid: layouts, spacing, background, corners, drag to reorder. |
| `image-diff` | Image Difference | file | stable | Compare two images and visualize their pixel differences. |
| `image-filters` | Image Filters | file | stable | Brightness, contrast, saturation, grayscale, sepia and sharpen with a live preview. |
| `image-metadata` | Image Metadata & EXIF Viewer | file | stable | Inspect image dimensions, file details, and common JPEG EXIF tags. |
| `image-ocr` | Image OCR | file | beta | Read text out of images with on-device OCR — nothing is uploaded, nothing leaves your browser. |
| `image-to-datauri` | Image to Data URI | file | beta | Encode an image as a data URI for HTML, CSS, or source code. |
| `jpeg-inspector` | JPEG Segment Inspector | file | stable | Walk a JPEG as a marker stream: every segment offset, type and length, plus frame, quantisation and Huffman details. |
| `netpbm-inspector` | Netpbm Inspector | file | stable | Parse a Netpbm image (PBM, PGM, PPM) on-device: the P1-P6 magic, dimensions, maxval, and the raw or ASCII pixel data. |
| `png-chunk-inspector` | PNG Chunk Inspector | file | stable | Parse a PNG into its chunk stream: offsets, lengths, CRCs, critical/ancillary status and decompressed pixel data. |
| `psd-inspector` | PSD Inspector | file | stable | Parse a Photoshop .psd on-device: the header, color mode, resources, layers, and image data compression. |
| `qoi-inspector` | QOI Inspector | file | stable | Parse a Quite OK Image (.qoi) on-device: the 14-byte header, channels and colorspace, and the pixel opcode stream. |
| `background-remover` | Remove Background | file | beta | Cut a subject out of a photo with an on-device AI matting model (MODNet). |
| `image-resize` | Resize Image | file | stable | Resize images by percentage or to exact dimensions, entirely in your browser. |
| `image-rotate` | Rotate / Flip Image | file | stable | Rotate images by 90-degree steps or flip them horizontally and vertically. |
| `image-spritesheet` | Sprite Sheet Builder | file | stable | Combine multiple images into one sprite sheet with a position map. |
| `image-strip-metadata` | Strip Image Metadata | file | beta | Remove EXIF, GPS, XMP and IPTC metadata from JPEG, PNG and WebP images losslessly. |
| `svg-to-png` | SVG to PNG | file | stable | Rasterize an SVG image to a downloadable PNG. |
| `tga-inspector` | TGA Image Inspector | file | stable | Inspect a TGA/Targa image: header fields, image type, color map, dimensions, origin, and footer. |
| `tiff-inspector` | TIFF Image Inspector | file | stable | Inspect a TIFF image: byte order, IFD entry tree, dimensions, compression, photometric, and tags. |
| `image-upscale` | Upscale Image | file | stable | Enlarge photos 2× or 4× with sharp Lanczos resampling and edge-preserving sharpening, on-device. |
| `image-watermark` | Watermark Image | file | beta | Stamp text or a logo onto one or many images — opacity, position or tiled. |
| `webp-inspector` | WebP Image Inspector | file | stable | Inspect a WebP image: RIFF chunk tree, VP8X features, animation frames, alpha, and dimensions. |
| `xcf-inspector` | XCF Inspector | file | stable | Read a GIMP XCF image file on-device: the header, dimensions, base type, and top-level property list. |

## misc (13)

| id | name | input | status | summary |
| --- | --- | --- | --- | --- |
| `aspect-ratio` | Aspect Ratio Calculator | text | stable | Solve, simplify or look up common aspect ratios and resolutions. |
| `bmi-calculator` | BMI Calculator | text | stable | Calculate body mass index from metric or imperial measurements. |
| `compound-interest-calculator` | Compound Interest Calculator | text | stable | Project savings growth with compound interest, optional regular contributions and a per-year breakdown. |
| `data-size` | Data Size Converter | text | stable | Convert data sizes between bytes, decimal/binary units and bits. |
| `calculator` | Expression Calculator | text | stable | Evaluate a mathematical expression with a safe parser — no eval, ever. |
| `gpa-calculator` | GPA Calculator | text | stable | Calculate GPA on 4.0 and 10-point scales with configurable percentage conversion. |
| `gst-calculator` | GST Calculator | text | beta | Add or remove GST and split the tax into CGST/SGST or IGST, using the current Indian slab rates. |
| `loan-calculator` | Loan / EMI Calculator | text | stable | Compute monthly payments, total interest and a payoff timeline for a loan. |
| `percentage-calculator` | Percentage Calculator | text | stable | Percentage of a number, percent change, and percent increase/decrease. |
| `programmer-calculator` | Programmer Calculator | text | stable | Calculate integer expressions with bitwise operators in multiple bases. |
| `random-picker` | Random Picker / Shuffler | text | stable | Pick random list items, shuffle an order or deal balanced teams. |
| `sip-calculator` | SIP Calculator | text | beta | Project a monthly SIP with an annual step-up and a one-time lumpsum, plus a growth chart. |
| `tip-calculator` | Tip Calculator | text | stable | Calculate a tip, bill total and per-person split. |

## network (7)

| id | name | input | status | summary |
| --- | --- | --- | --- | --- |
| `cidr-calculator` | CIDR Calculator | text | stable | Calculate network address, range, broadcast and host count for any IPv4 or IPv6 CIDR block. |
| `ip-address-inspector` | IP Address Inspector | text | stable | Parse and classify an IPv4 or IPv6 address — scope, port, groups and mapped forms. |
| `ipv4-to-int` | IPv4 ↔ Integer | text | stable | Convert between a dotted IPv4 address and its 32-bit integer form, either direction. |
| `ipv6-expander` | IPv6 Address Expander | text | stable | Expand and validate IPv6 addresses (:: shorthand). |
| `mac-address` | MAC Address Analyzer | text | stable | Validate, normalize and decode MAC addresses, incl. EUI-64. |
| `pcap-inspector` | PCAP Capture Inspector | file | stable | Inspect a PCAP packet capture: global header, byte order, version, link type, and per-packet records. |
| `pcapng-inspector` | PCAPNG Inspector | file | stable | Parse a PCAP Next Generation capture: block type, length and offset, plus section, interface, packet and stats blocks. |

## numbers (12)

| id | name | input | status | summary |
| --- | --- | --- | --- | --- |
| `fraction-simplify` | Fraction Simplifier | text | stable | Reduce a fraction to lowest terms, or convert a decimal to a fraction; optional mixed numbers. |
| `luhn-validator` | Luhn Checksum Validator | text | stable | Validate and generate Luhn (mod-10) checksum numbers. |
| `matrix-calculator` | Matrix Calculator | text | stable | Add, multiply, transpose, and find the determinant or inverse of small matrices. |
| `number-to-words` | Number to Words | text | stable | Spell out numbers in cardinal or ordinal English words with flexible casing. |
| `prime-factorization` | Prime Factorization Calculator | text | stable | Factor any integer into its prime powers and compute its divisors, totient and sigma. |
| `roman-numeral` | Roman Numeral Converter | text | stable | Convert numbers to Roman numerals and back, with optional vinculum notation. |
| `significant-figures` | Significant Figures & Notation | text | stable | Count significant figures, see scientific and engineering notation, and round. |
| `statistics-calculator` | Statistics Calculator | text | stable | Mean, median, mode, variance, standard deviation, quartiles, IQR and outliers from any list of numbers. |
| `unit-convert` | Unit Converter | text | stable | Convert between units of length, mass, temperature, data and more. |
| `barcode-validator` | UPC / EAN Barcode Validator | text | stable | Validate GS1 GTIN barcodes — UPC-A, UPC-E, EAN-13 and EAN-8 — and compute their check digit. |
| `vin-validator` | VIN Validator & Decoder | text | stable | Validate and decode 17-character VINs with check digit. |
| `words-to-number` | Words to Number | text | stable | Parse English number words like "two hundred thirty-four" into 234, with decimals and negatives. |

## pdf (20)

| id | name | input | status | summary |
| --- | --- | --- | --- | --- |
| `pdf-protect` | @jspawn/qpdf-wasm | file | beta | Add a password to a PDF with AES-256 encryption and optional printing limits. |
| `pdf-unlock` | @jspawn/qpdf-wasm | file | beta | Remove a password you already know from a PDF, on your own device. |
| `pdf-page-numbers` | Add Page Numbers | file | stable | Stamp page numbers onto a PDF in the position and format you choose. |
| `pdf-compress` | Compress PDF | file | beta | Shrink a PDF by re-encoding its images and rebuilding the file, with before/after size. |
| `pdf-delete-pages` | Delete Pages | file | stable | Remove selected pages from a PDF and download the trimmed document. |
| `pdf-extract-pages` | Extract Pages | file | stable | Pull selected pages out of a PDF into a new document. |
| `pdf-extract-text` | Extract PDF Text | file | stable | Extract selectable text from every page of a PDF. |
| `pdf-fill-form` | Fill PDF Form | file | beta | Fill an AcroForm in a PDF — text, checkboxes, radio and dropdowns — then flatten it. |
| `images-to-pdf` | Images to PDF | file | stable | Combine image files into a PDF, with one image per page. |
| `pdf-merge` | Merge PDFs | file | stable | Combine several PDF files into one document, page by page. |
| `pdf-organize` | Organize PDF Pages | file | beta | Reorder, rotate, delete and add blank pages to a PDF, then save the new order as a PDF. |
| `pdf-structure-inspector` | PDF Structure Inspector | file | stable | Inspect a PDF’s internals: header version, xref, objects, trailer, encryption and damage. |
| `pdf-to-images` | PDF to Images | file | stable | Render selected PDF pages as PNG, JPEG, or WebP images. |
| `pdf-redact` | Redact PDF | file | beta | Burn opaque black boxes over selected areas and export a PDF where the hidden content is truly gone. |
| `pdf-rotate` | Rotate Pages | file | stable | Rotate every page — or a selection — of a PDF by 90, 180, or 270 degrees. |
| `pdf-sign` | Sign PDF | file | beta | Draw, type or upload a signature, place it on a page and flatten it into the PDF. |
| `pdf-split` | Split PDF | file | stable | Split a PDF into one file per page, per range, or into fixed-size chunks. |
| `pdf-ocr` | tesseract.js | file | beta | Make a scanned PDF searchable — read the text on every page and hide a selectable text layer inside. |
| `pdf-metadata` | View / Edit PDF Metadata | file | stable | Inspect document properties or update PDF title, author, subject, keywords and more. |
| `pdf-watermark` | Watermark PDF | file | stable | Overlay translucent text on selected PDF pages as a centered or tiled watermark. |

## security (21)

| id | name | input | status | summary |
| --- | --- | --- | --- | --- |
| `bcrypt` | BCrypt Hash / Verify | text | stable | Hash a password with bcrypt, or verify a password against a stored hash. |
| `credit-card-validator` | Credit Card Validator | text | stable | Check a card number with the Luhn algorithm and detect the card brand from its prefix. |
| `email-header-analyzer` | Email Header Analyzer | file | stable | Analyze email headers: delivery hops and delays, SPF, DKIM and DMARC results, addresses. |
| `email-validator` | Email Validator | text | stable | Validate an email address: structure, local-part rules, domain labels, TLD and length limits. |
| `file-encrypt` | File Encryption (AES-GCM) | file | stable | Encrypt or decrypt any file with a password using AES-256-GCM — chunked, with a versioned header. |
| `security-headers` | HTTP Security Headers Analyzer | text | stable | Review pasted HTTP response headers for common browser security protections. |
| `checksum-validator` | Identifier Checksum Validator | text | stable | Check Luhn, IBAN MOD-97, ISBN-10, and ISBN-13 checksums locally. |
| `iptables-ruleset-auditor` | iptables Ruleset Auditor | file | stable | Audit an iptables-save ruleset: chains, policies, reachable ports, shadowed rules and open ports. |
| `known-hosts-inspector` | Known Hosts Inspector | file | stable | Audit ~/.ssh/known_hosts: hashed vs plain host entries, host-key fingerprints, duplicates and collisions. |
| `passphrase` | Passphrase Generator | text | stable | Diceware-style passphrases from an embedded word list — memorable and high-entropy. |
| `password` | Password Generator | text | stable | Generate strong random passwords with your browser CSPRNG — no bias, nothing uploaded. |
| `password-strength` | Password Strength Analyzer | text | stable | Estimate password entropy and score strength with feedback. |
| `pgp-tool` | PGP Tool | file | stable | Generate OpenPGP keys, and encrypt, decrypt, sign and verify text or files — fully on-device. |
| `random-string` | Random String Generator | text | stable | Generate random strings from a chosen character set with an unbiased browser CSPRNG. |
| `secret-scanner` | Secret & Credential Scanner | text | stable | Find and optionally redact likely credentials in pasted text or configuration. |
| `ssh-config-auditor` | SSH Config Auditor | file | stable | Audit an SSH client config: resolve host options, flag risky settings and ordering mistakes. |
| `ssh-key-fingerprint` | SSH Key Fingerprint | text | stable | Compute the SHA256 and MD5 fingerprints of an SSH public key, with key type and size. |
| `sudoers-auditor` | sudoers Auditor | file | stable | Audit a sudoers file for NOPASSWD shells, wildcard commands, env_keep leaks and unused aliases. |
| `svg-sanitizer` | SVG Sanitizer | file | stable | Strip scripts, event handlers and external references from an SVG, and report what changed. |
| `text-encrypt` | Text Encryption (AES-GCM) | text | stable | Encrypt or decrypt text with a passphrase using AES-256-GCM and PBKDF2, entirely on your device. |
| `totp-authenticator` | TOTP Authenticator Code Generator | text | stable | Generate and verify RFC 6238 TOTP codes from a base32 secret. |

## text (34)

| id | name | input | status | summary |
| --- | --- | --- | --- | --- |
| `line-numbers` | Add Line Numbers | text | stable | Prefix every line with a running number, with configurable start, separator, zero-padding. |
| `case-convert` | Case Converter | text | stable | Convert between UPPER, lower, Title, Sentence, camelCase, snake_case, kebab-case and more. |
| `char-frequency` | Character Frequency | text | stable | Count how often each character occurs, with scope filters, optional case folding and count or character sorting. |
| `duplicate-line-finder` | Duplicate Line Finder | text | stable | Find repeated lines in a list, with occurrence counts and first line numbers. |
| `eml-inspector` | EML Message Inspector | file | stable | Parse a single .eml email on-device: the RFC 5322 headers, MIME tree and boundaries, and each decoded part. |
| `fancy-text` | Fancy Text Generator | text | stable | Restyle text into bold, italic, script, fraktur, double-struck, circled, squared and more Unicode letter styles. |
| `find-replace` | Find and Replace | text | stable | Replace text by plain string, whole word, or regular expression, with optional case folding. |
| `indent-text` | Indent / Dedent Text | text | stable | Add or remove leading indentation on every line, using spaces or tabs, with an optional skip for blank lines. |
| `markdown-table-format` | Markdown Table Formatter | text | stable | Align the pipes in Markdown tables and preserve column alignment from the header divider. |
| `markdown-toc` | Markdown Table of Contents | text | stable | Generate a nested table of contents from Markdown headings, with GitHub-compatible slugs and links. |
| `morse-code` | Morse Code Translator | text | stable | Translate text to International Morse code and back, tolerant of messy spacing. |
| `nato-alphabet` | NATO Phonetic Alphabet | text | stable | Spell text aloud with the NATO phonetic alphabet, or decode spoken words back into text. |
| `nato-phonetic` | NATO Phonetic Alphabet | text | stable | Spell text with the NATO/ICAO phonetic alphabet (Alfa, Bravo, Charlie…) and back. |
| `online-notepad` | Online Notepad | text | stable | Keep multiple notes in your browser, autosaved on-device and exportable as .txt or .md. |
| `readability-score` | Readability Score | text | stable | Score text with Flesch Reading Ease and Flesch-Kincaid Grade Level, with syllable estimates and interpretation. |
| `dedupe-lines` | Remove Duplicate Lines | text | stable | Delete repeated lines from a list, keeping the first or last occurrence. |
| `remove-empty-lines` | Remove Empty Lines | text | stable | Strip blank and whitespace-only lines, collapse blank runs to one, or trim trailing blanks. |
| `text-repeat` | Repeat Text | text | stable | Repeat the input a set number of times, joined by a newline, space, comma, or custom separator. |
| `reverse-text` | Reverse Text | text | stable | Reverse text by character, word, sentence or line — emoji-safe. |
| `rot13` | ROT13 / Caesar Cipher | text | stable | Apply ROT13, ROT5, ROT18, ROT47 or an arbitrary Caesar shift to text. |
| `slugify` | Slugify | text | stable | Turn a title into a clean URL slug — lowercase, hyphenated, accent-folded. |
| `sort-lines` | Sort Lines | text | stable | Sort lines alphabetically, numerically, by length, naturally, or shuffle them. |
| `text-similarity` | Text Similarity & Edit Distance | text | stable | Compare strings with edit distance and similarity scores to find near-duplicates. |
| `text-stats` | Text Statistics | text | stable | Count characters, words, sentences and paragraphs, with platform limits, readability scores and reading time. |
| `text-summarizer` | Text Summarizer | text | stable | Extract the most important sentences from a long document to make a quick summary. |
| `text-to-slug` | Text to Slug | text | stable | Convert text into URL-friendly slugs: lowercase, separator, trim, stopword and unicode options. |
| `typing-test` | Typing Test | text | stable | Measure your typing speed (WPM) and accuracy with configurable time modes and local history. |
| `unicode-lookup` | Unicode Code Point Explorer | text | stable | Inspect every character code point, plane, and UTF-8/UTF-16 encodings in a table. |
| `unicode-normalize` | Unicode Normalizer | text | stable | Normalize Unicode text, optionally remove accents and standardize line endings. |
| `unicode-styles` | Unicode Style Converter | text | stable | Convert text between plain ASCII and full-width, circled, squared or bold math sans-serif Unicode styles. |
| `vtt-inspector` | WebVTT Inspector | text | stable | Validate and analyze a WebVTT subtitle file: header, cues, timings, overlap and malformed lines. |
| `whitespace-visualizer` | Whitespace Visualizer | text | stable | Reveal spaces, tabs, line endings, non-breaking spaces and zero-width formatting characters. |
| `word-frequency` | Word Frequency Counter | text | stable | Count how often each word appears, with case folding, a minimum length, stop-word removal and a top-N limit. |
| `wrap-text` | Wrap / Unwrap Text | text | stable | Hard-wrap text to a fixed column width with greedy word wrap, or unwrap wrapped lines back into paragraphs. |

## video (13)

| id | name | input | status | summary |
| --- | --- | --- | --- | --- |
| `avi-inspector` | AVI Inspector | file | stable | Parse an AVI video file on-device: the RIFF chunk tree, dimensions, frame rate, streams and codec, and the index blocks. |
| `video-extract-audio` | Extract Audio from Video | file | beta | Pull the sound track out of a video as WAV, MP3 or AAC — entirely on your device. |
| `mp4-box-inspector` | MP4 Box Inspector | file | stable | Walk an MP4/MOV ISO-BMFF atom tree: every box offset, size, type, container nesting, header form and CRC. |
| `mpegts-inspector` | MPEG-TS Inspector | file | stable | Parse an MPEG transport stream (.ts, .m2ts) on-device: 188-byte packets, PIDs, PAT and PMT tables, continuity. |
| `screen-recorder` | Screen Recorder | file | beta | Record your screen with an optional microphone and save it as WebM — or MP4 where the browser can record it. |
| `video-trim` | Trim Video | file | beta | Cut a video to a start and end time — stream copy when the container allows it, re-encode when it does not. |
| `video-compress` | Video Compressor | file | beta | Shrink a video in your browser: aim at a target file size or at a quality level. Nothing is uploaded. |
| `video-convert` | Video Converter | file | beta | Convert a video between MP4, WebM, MOV and MKV in your browser. Nothing is uploaded. |
| `video-info` | Video File Info | file | beta | Inspect a video: container, duration, resolution, codecs, frame rate and bitrate. |
| `video-frames` | Video Frames | file | beta | Pull still frames out of a video every N seconds, or as N evenly spaced shots — each as a PNG, or as one contact sheet. |
| `video-to-gif` | Video to GIF | file | beta | Turn a clip into an animated GIF: trim it, pick the frame rate, width and palette quality. |
| `webcam-recorder` | Webcam Recorder | file | beta | Record your webcam in the browser and download the clip — the video never leaves your device. |
| `webm-inspector` | WebM Inspector | file | stable | Parse a Matroska or WebM file on-device: the EBML element tree, DocType, and the top-level segment structure. |

## web (119)

| id | name | input | status | summary |
| --- | --- | --- | --- | --- |
| `nth-child-evaluator` | :nth-child An+B Evaluator | file | stable | Parse CSS An+B (:nth-child, :nth-of-type) microsyntax, validate it, and list which child indices it matches. |
| `editorconfig` | .editorconfig Generator | text | stable | Generate an .editorconfig with your indentation, line-ending and charset settings. |
| `gitignore` | .gitignore Generator | text | stable | Generate a .gitignore for Node, Python, Rust, Go, Java, macOS, Windows and more. |
| `accept-ch` | Accept-CH Builder & Analyzer | text | stable | Build or inspect HTTP client-hints opt-in values. |
| `accept-language` | Accept-Language Header Analyzer | text | stable | Analyze and build Accept-Language values |
| `accept-patch` | Accept-Patch Builder & Analyzer | text | stable | Build or inspect HTTP Accept-Patch media-type capabilities. |
| `accept-post` | Accept-Post Builder & Analyzer | text | stable | Build or inspect HTTP Accept-Post media-type capabilities. |
| `access-log-analyzer` | Access Log Analyzer | file | stable | Analyze Apache and nginx access logs: traffic, top lists, status codes, errors and probes. |
| `access-control-allow-credentials` | Access-Control-Allow-Credentials Builder & Analyzer | text | stable | Build or inspect the CORS credentials flag. |
| `access-control-allow-methods-headers` | Access-Control-Allow-Methods & Headers Builder | text | stable | Build or inspect CORS preflight grant lists. |
| `access-control-allow-origin` | Access-Control-Allow-Origin Builder & Analyzer | text | stable | Build or inspect CORS origin grants. |
| `access-control-expose-headers` | Access-Control-Expose-Headers Builder | text | stable | Build or inspect exposed cross-origin response headers. |
| `access-control-max-age` | Access-Control-Max-Age Builder & Analyzer | text | stable | Build or inspect the CORS preflight cache time. |
| `age-header` | Age Response Header Analyzer | text | stable | Validate Age response header cache residency. |
| `allow-header` | Allow Header Builder & Analyzer | text | stable | Build or inspect HTTP Allow method lists for API responses. |
| `alt-svc` | Alt-Svc Builder & Analyzer | text | stable | Build or inspect HTTP Alt-Svc alternate-service advertisements. |
| `alt-used` | Alt-Used Header Analyzer | text | stable | Validate the Alt-Used request header back to the origin. |
| `authentication-info` | Authentication-Info Builder & Analyzer | text | stable | Build or inspect HTTP Authentication-Info parameters. |
| `cache-headers` | Cache Headers Builder & Analyzer | text | beta | Build or analyze Cache-Control, CDN-Cache-Control, Surrogate-Control, Expires, Age, Cache-Status, and Vary. |
| `cache-control` | Cache-Control Builder & Analyzer | text | stable | Build or review HTTP Cache-Control directives for browser and CDN caching. |
| `cache-status` | Cache-Status Header Analyzer (RFC 9211) | text | stable | Analyze RFC 9211 Cache-Status debug fields. |
| `cdn-cache-control` | CDN-Cache-Control Builder & Analyzer | text | stable | Build or inspect CDN-Cache-Control directives. |
| `clear-site-data` | Clear-Site-Data Builder & Analyzer | text | stable | Build or inspect site storage-wipe signals. |
| `conditional-request-headers` | Conditional Request Headers Builder & Analyzer | text | beta | Build and analyze ETag, Last-Modified and the If-* request conditions. |
| `connection-header` | Connection Header Builder & Analyzer | text | stable | Build or inspect HTTP/1.1 Connection control tokens. |
| `content-digest` | Content-Digest Builder & Analyzer | text | stable | Build or inspect HTTP Content-Digest integrity fields. |
| `content-disposition` | Content-Disposition Builder & Parser | text | stable | Build or inspect Content-Disposition download and inline headers. |
| `content-language` | Content-Language Builder & Analyzer | text | stable | Build or inspect HTTP Content-Language locale tags. |
| `content-length-app` | Content-Length & Body Byte Counter | text | stable | Compute body byte length and verify content-length. |
| `content-location` | Content-Location Builder & Analyzer | text | stable | Build or inspect HTTP Content-Location resource references. |
| `content-md5` | Content-MD5 Builder & Analyzer | text | stable | Build or verify legacy Content-MD5 integrity values — the header is deprecated. |
| `content-security-policy` | Content-Security-Policy Builder & Analyzer | text | stable | Build or inspect CSP directives and sources. |
| `content-type` | Content-Type Header Builder & Parser | text | stable | Build or inspect HTTP media-type headers, charsets, and multipart boundaries. |
| `cookie-request` | Cookie Request Header Analyzer | text | stable | Parse and inspect Cookie request-header pairs. |
| `cors-headers` | CORS Headers Builder & Analyzer | text | beta | Build a full CORS policy or analyze pasted Access-Control-* response headers. |
| `access-control-request-headers` | CORS Preflight Request Analyzer | text | stable | Analyze Access-Control-Request-Method and request headers. |
| `critical-ch` | Critical-CH Builder & Analyzer | text | stable | Build or inspect HTTP critical client-hints values. |
| `cross-origin-embedder-policy` | Cross-Origin-Embedder-Policy Builder & Analyzer | text | stable | Build or inspect cross-origin resource embedding controls. |
| `cross-origin-opener-policy` | Cross-Origin-Opener-Policy Builder & Analyzer | text | stable | Build or inspect browsing-context opener isolation. |
| `cross-origin-resource-policy` | Cross-Origin-Resource-Policy Builder & Analyzer | text | stable | Build or inspect CORP resource-embedding policies. |
| `border-radius` | CSS Border Radius Generator | text | stable | Build border-radius rules per corner — circles, pills, blobs and the elliptical slash syntax. |
| `box-shadow` | CSS Box Shadow Generator | text | stable | Generate box-shadow rules — single or layered soft shadows. |
| `gradient-css` | CSS Gradient Generator | text | stable | Build linear, radial and conic CSS gradients with custom colour stops. |
| `css-grid` | CSS Grid Generator | text | stable | Generate CSS Grid layout declarations for tracks, gaps, alignment, and named areas. |
| `css-minifier` | CSS Minifier | text | stable | Minify CSS: strip comments, collapse whitespace, drop empty rules and extra semicolons. |
| `css-to-js` | CSS to JS Object | text | stable | Convert CSS declarations or rule blocks into a JS object with camelCase style keys. |
| `css-transform-inspector` | CSS Transform Inspector | file | stable | Parse a CSS transform, compose it into one matrix, and report the decomposition, determinant and invertibility. |
| `css-units` | CSS Unit Converter | text | stable | Convert between px, rem, em, pt, pc, in, cm, mm and % for CSS lengths. |
| `cubic-bezier` | Cubic Bezier Explorer | text | stable | Sample a cubic-bezier() easing curve and find the nearest CSS keyword. |
| `data-uri` | Data URI Converter | file | stable | Encode text or an image as a data: URI, or decode a data: URI back to text or an image file. |
| `date-header` | Date Header Builder & Analyzer | text | stable | Build or inspect HTTP Date response timestamps. |
| `document-policy` | Document-Policy Builder & Analyzer | text | stable | Build or inspect Document-Policy behavior controls. |
| `early-data` | Early-Data Builder & Analyzer | text | stable | Build or inspect HTTP Early-Data replay signals. |
| `etag` | ETag Builder & Analyzer | text | stable | Build and compare HTTP entity tags for conditional requests. |
| `expect-header` | Expect Header Builder & Analyzer | text | stable | Build or inspect HTTP Expect request expectations. |
| `expires-header` | Expires Header Builder & Analyzer | text | stable | Build or inspect HTTP Expires cache timestamps. |
| `feed-inspector` | Feed Inspector | file | stable | Inspect an RSS, Atom or RDF feed: channel details, items, enclosures and spec problems. |
| `fluid-clamp` | Fluid CSS Clamp Generator | text | stable | Generate responsive CSS clamp() values between viewport breakpoints. |
| `forwarded-header` | Forwarded Header Builder & Parser | text | stable | Build or inspect standardized proxy Forwarded headers. |
| `meta-tags` | HTML Meta Tag Generator | text | stable | Generate SEO, Open Graph and Twitter card meta tags from page details. |
| `html-prettifier` | HTML Prettifier | text | stable | Beautify HTML output — indented tags, one attribute per line for long tags, preserved text. |
| `basic-auth` | HTTP Basic Auth Header | text | stable | Build or decode HTTP Basic Authorization headers, UTF-8 safe. |
| `http-encoding` | HTTP Encoding Header Builder & Analyzer | text | stable | Build or inspect Accept-Encoding and Content-Encoding negotiation values. |
| `http-header-analyzer` | HTTP Header Analyzer | text | beta | Paste any HTTP headers and auto-detect, parse and check every one of them. |
| `link-header` | HTTP Link Header Builder & Parser | text | stable | Build or inspect HTTP Link headers for preload, canonical, pagination, and alternates. |
| `http-range` | HTTP Range Header Builder & Parser | text | stable | Build or inspect byte-range request and response headers. |
| `http-status` | HTTP Status Code Reference | text | stable | Look up HTTP status codes — what they mean and when APIs return them. |
| `via-header` | HTTP Via Header Builder & Analyzer | text | stable | Build or inspect HTTP Via header field values for proxy control. |
| `if-match` | If-Match Builder & Analyzer | text | stable | Build or inspect HTTP If-Match entity-tag conditions. |
| `if-modified-since` | If-Modified-Since Builder & Analyzer | text | stable | Build or inspect HTTP If-Modified-Since cache conditions. |
| `if-none-match` | If-None-Match Builder & Analyzer | text | stable | Build or inspect HTTP If-None-Match conditions. |
| `if-range` | If-Range Builder & Analyzer | text | stable | Build or inspect HTTP If-Range validators for partial responses. |
| `if-unmodified-since` | If-Unmodified-Since Builder & Analyzer | text | stable | Build or inspect HTTP If-Unmodified-Since preconditions. |
| `js-to-css` | JS Object to CSS | text | stable | Turn a JS style object into CSS: camelCase to kebab-case, numbers to px-aware values, rules support. |
| `last-modified` | Last-Modified Header Builder & Analyzer | text | stable | Build or inspect HTTP Last-Modified resource timestamps. |
| `media-query-builder` | Media Query Builder & Analyzer | text | stable | Build or inspect CSS @media queries. |
| `mime-lookup` | MIME Type Lookup | text | stable | Look up the MIME type for an extension, or the extensions for a MIME type. |
| `port-lookup` | Network Port Lookup | text | stable | Look up which service uses a TCP/UDP port, or find ports by service name. |
| `network-error-logging` | Network-Error-Logging (NEL) Policy Builder | text | stable | Build or inspect NEL policies and report delivery. |
| `origin-header` | Origin Request Header Analyzer | text | stable | Validate the Origin request header for CORS and CSRF. |
| `origin-agent-cluster` | Origin-Agent-Cluster Builder & Analyzer | text | stable | Build or inspect origin-keyed browsing isolation signals. |
| `permissions-policy` | Permissions-Policy Builder & Analyzer | text | stable | Build or inspect browser capability policy directives. |
| `prefer-header` | Prefer Header Builder & Analyzer | text | stable | Build or inspect HTTP Prefer negotiation directives for APIs. |
| `priority-header` | Priority Header Builder & Analyzer | text | stable | Build or inspect HTTP Priority scheduling parameters. |
| `proxy-authenticate` | Proxy-Authenticate Builder & Analyzer | text | stable | Build or inspect HTTP proxy authentication challenges. |
| `proxy-authorization` | Proxy-Authorization Builder & Analyzer | text | stable | Build or inspect HTTP proxy credential values. |
| `proxy-status` | Proxy-Status Builder & Analyzer | text | stable | Build or inspect HTTP Proxy-Status diagnostics. |
| `punycode` | Punycode / IDN Converter | text | stable | Convert internationalised domain names to ASCII (xn--) and back, per RFC 3492. |
| `referrer-policy` | Referrer-Policy Builder & Analyzer | text | stable | Build or inspect referrer information controls. |
| `reporting-endpoints` | Reporting-Endpoints Builder & Analyzer | text | stable | Build or inspect Reporting API endpoint groups. |
| `repr-digest` | Repr-Digest Builder & Analyzer | text | stable | Build or verify modern representation digest fields. |
| `retry-after` | Retry-After Header Builder & Parser | text | stable | Build or inspect Retry-After headers using seconds or an HTTP date. |
| `robots-txt` | robots.txt Generator | text | stable | Generate a robots.txt: allow all, block all, block AI crawlers, or custom rules. |
| `sec-fetch-inspector` | Sec-Fetch Request Inspector | text | stable | Inspect fetch metadata for cross-site requests. |
| `server-timing` | Server-Timing Builder & Analyzer | text | stable | Build or inspect Server-Timing performance metrics. |
| `set-cookie` | Set-Cookie Builder & Analyzer | text | stable | Build or review Set-Cookie headers and their security attributes locally. |
| `signature-input` | Signature-Input Builder & Analyzer | text | stable | Build or inspect HTTP Message Signature-Input fields. |
| `speculation-rules` | Speculation Rules Analyzer | text | stable | Validate and build prefetch/prerender speculation rules. |
| `srcset-inspector` | Srcset Inspector | file | stable | Parse and validate srcset and sizes, compute each candidate density and show which image a browser picks. |
| `strict-transport-security` | Strict-Transport-Security (HSTS) Builder & Analyzer | text | stable | Build or inspect HSTS policies. |
| `sri-hash-generator` | Subresource Integrity (SRI) Hash Generator | text | stable | Generate SRI integrity hashes for scripts and styles. |
| `sunset-deprecation` | Sunset & Deprecation Header Analyzer | text | stable | Build or inspect API lifecycle deprecation signals. |
| `surrogate-control` | Surrogate-Control Builder & Analyzer | text | stable | Build or inspect Surrogate-Control intermediary-cache directives. |
| `svg-optimizer` | SVG Optimizer | text | stable | Minify or pretty-print SVG, rounding coordinates, stripping comments and empty groups. |
| `timing-allow-origin` | Timing-Allow-Origin Builder & Analyzer | text | stable | Build or inspect cross-origin timing data access. |
| `traceparent` | Traceparent Builder & Analyzer | text | stable | Build or inspect W3C Traceparent propagation values. |
| `tracestate` | Tracestate Builder & Analyzer | text | stable | Build or inspect W3C Trace Context tracestate values. |
| `trailer-header` | Trailer Header Builder & Analyzer | text | stable | Build or inspect HTTP Trailer field-name declarations. |
| `upgrade-header` | Upgrade Header Builder & Analyzer | text | stable | Build or inspect HTTP Upgrade protocol-switch values. |
| `url-parse` | URL Parser | text | stable | Break a URL into protocol, host, path, query parameters and hash. |
| `user-agent` | User-Agent Parser | text | stable | Break a User-Agent string into browser, version, OS, engine and device type. |
| `vary-header` | Vary Header Builder & Analyzer | text | stable | Build or inspect HTTP Vary cache-key fields. |
| `warning-header` | Warning Header Analyzer | text | stable | Decode Warning response-header codes (RFC 7234). |
| `web-manifest` | Web App Manifest Generator & Validator | text | stable | Generate or validate a web app manifest for installable sites. |
| `www-authenticate` | WWW-Authenticate Builder & Parser | text | stable | Build or inspect HTTP authentication challenges for Basic and Bearer schemes. |
| `x-content-type-options` | X-Content-Type-Options Analyzer | text | stable | Validate X-Content-Type-Options: nosniff. |
| `x-frame-options` | X-Frame-Options Builder & Analyzer | text | stable | Build or inspect clickjacking frame controls. |
| `request-id` | X-Request-ID / Correlation-ID Tool | text | stable | Generate or validate request correlation IDs. |
| `x-robots-tag` | X-Robots-Tag Analyzer | text | stable | Validate per-resource indexing directives (X-Robots-Tag). |
