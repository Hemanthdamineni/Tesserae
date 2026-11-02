/**
 * Editorial content for the pe-inspector tool page.
 *
 * Kept out of `pe-inspector.meta.ts` so the eager client registry never
 * ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'From the DOS stub to the optional header',
      body: 'A Portable Executable begins with a small DOS header whose last field points at the PE signature. The inspector follows that pointer, verifies the PE\\0\\0 marker, and decodes the COFF file header: the target machine, section count, timestamp and characteristics. It then reads the optional header, which is where the entry point, image base, section and file alignment, image size and subsystem are defined, and distinguishes PE32 from PE32+ by its magic.',
    },
    {
      heading: 'Sections and how they map',
      body: 'The section table describes each region of the image by name, virtual address, virtual and raw size, raw file pointer and memory flags. The inspector lists every section so you can see the familiar code, data, resource and relocation areas, and spot an unusual layout. Because a section can declare a raw size larger than the file holds, the inspector checks each entry against the real file length and warns instead of reading past the end.',
    },
    {
      heading: 'Imports and hardening flags',
      body: 'The import table names the DLLs a binary loads and the functions it expects from each. The inspector walks the import descriptors and thunk arrays and prints the imported DLLs with their resolved function names, which is often enough to understand what a program depends on. It also reports the DLL characteristics flags, including dynamic base (ASLR), NX compatibility and control-flow guard, so the security posture of a build is visible at a glance.',
    },
    {
      heading: 'Limits and honest scope',
      body: 'This is a structural reader, not a disassembler, a packer detector or an antivirus scanner. It does not execute the file, does not import its resources and does not follow forwarded exports. Files up to 256 MB are supported, and the section and import tables are capped so a malformed file cannot produce an endless report. Every byte is parsed locally in the tab.',
    },
  ],
  faq: [
    {
      q: 'Does opening a file run the executable?',
      a: 'No. The file is read as bytes and parsed as a data structure. Nothing is executed, loaded as a library or handed to the operating system.',
    },
    {
      q: 'Can it show exports as well as imports?',
      a: 'The inspector decodes the import table and the section layout, and reports the data-directory entries that are present. It is aimed at triage and hardening checks rather than a full export dump.',
    },
    {
      q: 'What do ASLR, NX and control-flow guard mean here?',
      a: 'They are flags in the optional header that tell Windows which exploit mitigations the binary supports. The inspector reports whether the corresponding DLL-characteristic bits are set, so you can compare builds without opening a developer console.',
    },
    {
      q: 'How can I tell a 32-bit build from a 64-bit one?',
      a: 'The optional header magic is 0x10b for PE32 and 0x20b for PE32+. The inspector reports the format alongside the machine type, so a 64-bit image is identified even when the filename gives nothing away.',
    },
  ],
} as const;
