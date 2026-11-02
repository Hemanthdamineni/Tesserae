/**
 * Editorial content for the tar-inspector tool page.
 *
 * Kept out of `tar-inspector.meta.ts` so the eager client registry never
 * ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'How tar stores an archive',
      body: 'A tar archive is a sequence of 512-byte header blocks, each followed by the file data padded to a block boundary. The header carries the name, type, size, mode, owner, group and modification time as fixed-width text fields. The inspector reads those headers in order, decodes the octal and base-256 numeric fields, and stops at the pair of zero blocks that mark the end of the archive. Nothing is extracted to disk or memory as a file tree.',
    },
    {
      heading: 'Entry types and names',
      body: 'The type flag distinguishes regular files, directories, symbolic links, hard links, character and block devices, FIFOs and the extended header types used for long names. The inspector reports each entry with its type, size, mode, uid and gid, owner and group names, and modification time. It also joins the ustar prefix field to the name so paths longer than the original 100-byte field are shown in full.',
    },
    {
      heading: 'Checksums and structural warnings',
      body: 'Every tar header stores a checksum computed over the header bytes with the checksum field treated as spaces. The inspector recomputes it and flags any mismatch, which is the quickest way to catch a corrupted or hand-edited archive. It also warns when an entry data area runs past the end of the file, when the terminating zero blocks are missing, and when the ustar magic is absent so the format is reported as unknown.',
    },
    {
      heading: 'Audit before you extract',
      body: 'Extraction tools are convenient but they trust the archive. Inspecting first shows whether filenames are absolute or contain parent-directory segments, whether symlinks point outside the tree, and how much data the archive really holds. The summary view gives the format, entry count and total data size, while the entries view prints the full manifest. Files up to 512 MB are supported, entirely on-device.',
    },
  ],
  faq: [
    {
      q: 'Does the inspector extract the archive?',
      a: 'No. It reads the headers and reports the manifest. No file is written, and the archived data is never decompressed, so an archive with a huge payload is still fast to audit.',
    },
    {
      q: 'Does it handle compressed tarballs?',
      a: 'It reads the tar blocks themselves. A gzip or xz compressed tarball must be decompressed first, because the compressed stream no longer contains 512-byte tar headers.',
    },
    {
      q: 'What does a checksum warning mean?',
      a: 'The stored checksum no longer matches the header bytes. That usually means the archive was truncated or modified after it was written, and the affected entry should not be trusted.',
    },
    {
      q: 'Can it see long file names?',
      a: 'Yes. ustar splits long paths between the name and prefix fields, and the inspector joins them. GNU and PAX extended headers are listed as their own entries rather than silently applied.',
    },
  ],
} as const;
