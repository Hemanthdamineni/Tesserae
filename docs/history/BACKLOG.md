# Backlog — fixes from the previous round

This file holds **only** corrections for mistakes made in earlier rounds. It is rewritten by a human (via review) at the start of each round. Agents never add, remove, reorder, or reword lines; they only update the status markers described in `TODOS.md`. Items here take priority over `TODOS.md`.

## Round 1 fixes

The first round over-produced near-duplicate tools, especially around 80 HTTP header builders, and left every image tool in `beta`.

- [x] **merge-cors-headers** · web — Merge the 6 `access-control-*` tools into one `cors-headers` tool. Old ids stay routable as aliases. ✅ already exists as cors-headers
- [x] **merge-conditional-headers** · web — Merge etag, last-modified, if-match, if-none-match, if-range, if-modified-since, and if-unmodified-since into `conditional-request-headers`. Old ids become aliases. ⚠️ run died ✅ e3fd37a
- [x] **merge-cache-headers** · web — Merge cache-control, cdn-cache-control, surrogate-control, expires-header, age-header, cache-status, and vary-header into `cache-headers`. Old ids become aliases. ⚠️ run died ✅ 8943bdc
- [x] **http-header-analyzer** · web · after: merge-cors-headers, merge-conditional-headers, merge-cache-headers — One tool where you paste any headers and each one is auto-detected and parsed. Fold the long-tail header tools in as aliases (alt-used, early-data, trailer-header, priority-header, signature-input, tracestate, and similar). Flag content-md5 and warning-header as deprecated in the UI. ✅ 1faf3a8
- [x] **merge-escape-tools** · developer — `string-escape` absorbs backslash-escape, json-escape, and unicode-escape as modes. html-entities stays separate. Old ids become aliases. ⚠️ run died ✅ 85eb2e3
- [x] **merge-base64** · encoding — `base64` gains a file mode; `base64-file` becomes an alias. ⚠️ run died ⚠️ run died ✅ 041bfa8
- [x] **merge-datauri** · web — Merge data-uri, image-to-datauri, and datauri-to-image into one tool with text and image modes. Old ids become aliases. ⚠️ run died ⏳ run-20261021-1604-7f47 @ 2026-10-21T17:30:00Z ✅ 0b2222e
- [x] **upgrade-image-batch-1** · image — Bring image-compress, image-convert, image-resize, and image-crop to `stable`. Add tests; handle EXIF orientation, transparency, and huge-image limits; add batch mode. ✅ aee042c
- [x] **upgrade-image-batch-2** · image — Bring image-rotate, image-metadata, and image-palette to `stable`. ⚠️ run died ✅ 4979654
- [x] **upgrade-image-batch-3** · image — Bring favicon-generator, image-diff, image-spritesheet, and svg-to-png to `stable`. ⚠️ run died ✅ 5903715
