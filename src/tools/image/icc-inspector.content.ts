/**
 * Editorial content for the icc-inspector tool page.
 *
 * Kept out of `icc-inspector.meta.ts` so the eager client registry never
 * ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'The 128-byte header',
      body: 'An ICC profile begins with a fixed 128-byte header that describes the profile before any tag data. The inspector reads the declared profile size and compares it with the file, the four-byte version, the device class (monitor, printer, scanner, camera, link, color space and the multi-colorant classes), the data color space and the connection space (PCS), the creation date, the "acsp" signature at offset 36, the platform signature, the flags, the manufacturer and model signatures, the rendering intent and the PCS illuminant. The header view shows all of these in one table.',
    },
    {
      heading: 'The tag table',
      body: 'After the header comes a tag count followed by one 12-byte entry per tag: a four-byte signature, an offset and a size. The inspector decodes every entry and lists the signature, a human-readable name for the tags it recognises (desc, wtpt, rXYZ, rTRC, cprt and the rest), the offset and the size. A profile with three tags and one with three hundred are shown the same way, and the table is capped at 1000 entries so a damaged file cannot produce an endless report.',
    },
    {
      heading: 'What the summary tells you',
      body: 'The summary view condenses the profile into the fields you check first: size, CMM type, version, device class, data and connection spaces, creation date, platform, rendering intent, illuminant, manufacturer, model, creator and tag count. The notes line reports the version, tag count and data space, which is enough to tell a display profile from a printer or link profile without opening a color-management application.',
    },
    {
      heading: 'Limits and honesty',
      body: 'The inspector parses structure only. It does not interpret tag payloads, apply transforms, convert between color spaces or validate the profile against its embedded MD5. A file is rejected outright when it is too short or lacks the "acsp" signature, and files larger than 16 MB are refused. Everything runs in the tab, so a profile copied from a print workflow never leaves the machine.',
    },
  ],
  faq: [
    {
      q: 'Does the inspector convert or apply the profile?',
      a: 'No. It reads the header and tag table and reports their values. Converting an image through the profile requires a color-management engine, which is outside the scope of a header reader.',
    },
    {
      q: 'What does the device class tell me?',
      a: 'It describes what the profile is for: a monitor profile, a printer profile, a scanner profile, a link profile that connects two devices directly, or a color space conversion profile. The inspector translates the four-letter code into a readable name.',
    },
    {
      q: 'Why is the rendering intent reported as a number and a name?',
      a: 'ICC stores the intent as an integer from 0 to 3. The inspector shows both the number and the name, so a value such as 1 is immediately recognisable as media-relative colorimetric.',
    },
    {
      q: 'How large a profile can I inspect?',
      a: 'Up to 16 MB, which covers every practical profile. The tag table is capped at 1000 entries so a truncated or malformed file cannot hang the page.',
    },
  ],
} as const;
