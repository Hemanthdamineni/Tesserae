/**
 * Editorial content for the mach-o-inspector tool page.
 *
 * Kept out of `mach-o-inspector.meta.ts` so the eager client registry never
 * ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'The header at a glance',
      body: 'Open a macOS or iOS executable, dynamic library, bundle, kernel extension or object file and the inspector reads its Mach-O header: 32- or 64-bit, big or little endian (detected from the byte-swapped magic), the target CPU and subtype — x86_64, arm64 and others — the Mach-O file type (MH_EXECUTE, MH_DYLIB, MH_OBJECT, MH_BUNDLE, MH_DYLINKER and others) and the header flags. That answers the first question about any binary: what is it, and what will run it.',
    },
    {
      heading: 'Walking the load commands',
      body: 'Below the header, the inspector walks every load command in order and decodes the common ones into readable rows: segments (LC_SEGMENT and LC_SEGMENT_64, each with name, address, size, protections and section count), symbol tables, the UUID, version info, and the runtime dependencies loaded via LC_LOAD_DYLIB and LC_LOAD_DYLINKER. The load-commands, segments and dependencies views slice the same list for whichever question you have.',
    },
    {
      heading: 'Build and deployment targets',
      body: 'A dedicated build-info view pulls the platform, minimum OS version and SDK version out of the version commands. That is the quickest way to check whether a binary will load on the operating system you are targeting, and it beats grepping otool output by hand.',
    },
    {
      heading: 'On-device inspection',
      body: 'The bytes never leave your browser. Parsing happens entirely in this tab with no network access, so an internal or pre-release binary can be inspected safely. Large command lists are capped by the max-rows setting, defaulting to 200 rows.',
    },
  ],
  faq: [
    {
      q: 'Is my binary uploaded anywhere?',
      a: 'No. The Mach-O file is parsed entirely on-device in your browser, with no network access, so proprietary or pre-release binaries never leave your machine.',
    },
    {
      q: 'How does the tool know if a binary is 32-bit or 64-bit?',
      a: 'The Mach-O magic determines it: 32-bit and 64-bit binaries use different magic values, and a byte-swapped magic signals the endianness. The inspector reports the bit width, endianness and target CPU and subtype from the header.',
    },
    {
      q: 'What are load commands?',
      a: 'Load commands are the records after the Mach-O header that tell the loader what to do: which segments to map and how they are protected, which symbol tables exist, the binary UUID, version info, and which dynamic libraries to load.',
    },
    {
      q: 'Can it tell me the minimum OS version of a binary?',
      a: 'Yes. The build-info view reads the platform, minimum OS version and SDK version from the version load commands, which is exactly what you need to confirm a deployment target.',
    },
  ],
} as const;
