/**
 * Editorial content for the sri-validator tool page.
 *
 * Kept out of ``sri-validator.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What does the validator check?',
      a: 'It parses the integrity attribute of a script or style tag, checks that it names a known hash algorithm (sha256, sha384 or sha512), and that the value is a valid Base64 digest of the expected length.',
    },
    {
      q: 'Does it hash the file for me?',
      a: 'No. This tool validates an already-written integrity attribute. To compute an integrity value from an asset, use the companion sri-hash-generator tool.',
    },
    {
      q: 'What does a mismatched hash mean?',
      a: 'It means the served bytes differ from what the integrity attribute pins, so the browser would refuse to run the resource. That is the signal to re-generate the hash from the exact deployed asset.',
    },
  ],
} as const;
