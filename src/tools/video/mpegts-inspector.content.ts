/**
 * Editorial content for the mpegts-inspector tool page.
 *
 * Kept out of `mpegts-inspector.meta.ts` so the eager client registry never
 * ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'Why transport streams are packetised',
      body: 'MPEG-TS was designed for broadcast, where a receiver can join a stream at any point and must recover from loss. The file is a flat sequence of fixed 188-byte packets, each starting with the 0x47 sync byte. Inside each packet header are a 13-bit PID identifying the stream, a payload-start flag, an adaptation-field control and a 4-bit continuity counter. The inspector validates the sync byte and decodes that header for every packet.',
    },
    {
      heading: 'PIDs, PAT and PMT',
      body: 'Every elementary stream — video, audio, subtitles — has its own PID. The Program Association Table on PID 0 lists the programs, and each program points to a Program Map Table that declares its elementary streams. The inspector walks those tables and reports the PMT PID and the stream PIDs it declares, then builds a PID histogram so you can see how the bytes are distributed across tracks.',
    },
    {
      heading: 'Continuity counters and loss',
      body: 'The continuity counter increments for each packet on a PID that carries a payload. A gap means packets were lost or the file was spliced, and the inspector counts those gaps per PID rather than only reporting a global error. It also flags a corrupt or missing sync byte, a scrambled payload, an unexpected PID list, a PAT that never appears, and a file whose length is not a multiple of 188 bytes.',
    },
    {
      heading: 'Practical limits',
      body: 'Files up to 512 MB are inspected, and the packet walk stops after 500000 packets so a multi-gigabyte capture still returns a useful summary quickly. The views cover a compact summary, the per-PID table and a packet-level listing. Nothing is demuxed or remuxed, so the file is read-only and remains untouched on disk.',
    },
  ],
  faq: [
    {
      q: 'Does the inspector extract the video or audio?',
      a: 'No. It reads packet headers and the PAT and PMT tables to describe the stream. Extracting elementary streams is a demuxing job, which is a different tool.',
    },
    {
      q: 'What does a continuity-counter gap mean?',
      a: 'It means packets on that PID were lost or reordered. Broadcast captures often show a few gaps after a signal drop, and a file with many gaps is likely to play with visible glitches.',
    },
    {
      q: 'Why does it warn that the file does not end on a packet boundary?',
      a: 'A transport stream packet is exactly 188 bytes. A trailing partial packet usually means the capture was cut off mid-write, which is the most common kind of damage in a recorded .ts file.',
    },
    {
      q: 'Can it read .m2ts files?',
      a: 'Yes. The extension is accepted, and the inspector starts from the first 0x47 sync byte, so a transport stream with a different leading offset is still found and parsed.',
    },
  ],
} as const;
