import type { ToolContent } from '../../lib/content';

export const content: ToolContent = {
  article: [
    {
      heading: 'What cpio is',
      body: 'cpio is a Unix archive format still used in initramfs images, RPM packages and system boot tooling. This inspector reads the archive bytes in your browser and recognises the newc SVR4 format or the older ASCII odc format without extracting anything to a server or writing files to disk.',
    },
    {
      heading: 'What the report shows',
      body: 'The summary identifies the magic, archive flavour, entry count, total uncompressed data and whether the TRAILER!!! record is present. The entry view lists each path, type, size and mode. The header view keeps the archive-level facts visible when you are checking a damaged or unfamiliar initramfs.',
    },
    {
      heading: 'Limits and malformed data',
      body: 'The parser caps an input at 256 MB and stops displaying entries after the configured row limit, but it still validates header boundaries and padded name/data offsets. A truncated entry, invalid magic or archive with no readable entries produces an error instead of a partial success that could hide corruption. Empty directories remain visible as directory entries, while file contents are not copied into the result.',
    },
  ],
  faq: [
    {
      q: 'Does this upload the archive?',
      a: 'No. The bytes are read and parsed in your browser tab. The tool declares no network access and works offline once the page is loaded.',
    },
    {
      q: 'Which cpio formats are supported?',
      a: 'The inspector recognises newc with magic 070701 and old ASCII odc with magic 070707. Other binary or compressed archive variants are rejected with a clear message.',
    },
    {
      q: 'Does it extract files?',
      a: 'No. It reports metadata and entry names only. It does not write archive contents to your filesystem or create output files.',
    },
  ],
};
