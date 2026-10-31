/**
 * Editorial content for the wasm-inspector tool page.
 *
 * Kept out of ``wasm-inspector.meta.ts`` so the eager client registry never
 * ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it does',
      body: 'Drop a compiled WebAssembly module (.wasm) into the workbench and inspect its binary structure. The tool verifies the 0x00 61 73 6D magic and version, then walks every section in order: type, import, function, table, memory, global, export, start, element, code, data, datacount, and custom sections. For each it reports the byte offset, the numeric section id, the name, and the declared size read as a variable-length LEB128 integer.',
    },
    {
      heading: 'Import and export tables',
      body: 'Beyond the section tree, the inspector decodes the high-value payloads: the import section (module, field, kind), the export section (name and kind), and the custom name sections. It counts the functions, memories, imports and exports surviving in each section, so you can see what a module consumes and what it exposes at a glance.',
    },
    {
      heading: 'Section-order and size checks',
      body: 'A valid module expects its sections to appear in a defined order. The tool flags a bad magic or unsupported version, a section id that appears out of order, a section that overruns the end of the file, and similar structural problems, so a malformed or hand-assembled module is reported instead of misparsed.',
    },
    {
      heading: 'On-device decoding',
      body: 'Everything is decoded in this tab and never leaves your browser. The tool runs fully offline, so a proprietary or unpublished .wasm module can be inspected without transmitting the bytes anywhere.',
    },
  ],
  faq: [
    {
      q: 'Is my .wasm module uploaded anywhere?',
      a: 'No. The module is parsed entirely on-device in your browser, with no network access, so the bytes never leave your machine.',
    },
    {
      q: 'What is the 0x00 61 73 6D magic?',
      a: 'It is the four-byte header that begins every valid WebAssembly binary: the null byte followed by the ASCII letters "asm". The inspector validates it and the version, then parses the sections that follow.',
    },
    {
      q: 'What is a custom section?',
      a: 'Custom sections are the extensible part of a WebAssembly module — they carry names and other metadata and are the only sections allowed to appear more than once. The inspector decodes the name-carrying ones and reports their offsets and sizes.',
    },
    {
      q: 'What structural problems does it flag?',
      a: 'It flags a bad magic or unsupported version, a section id that appears out of order, a section that overruns the file, and other inconsistencies in the declared section sizes.',
    },
  ],
} as const;
