/**
 * Editorial content for the vcf-inspector tool page.
 *
 * Kept out of ``vcf-inspector.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What is a vCard?',
      a: 'A .vcf (vCard) file holds contact data as lines starting with BEGIN:VCARD, followed by properties such as FN (full name), N (name components), TEL, EMAIL and ADR, and ended by END:VCARD.',
    },
    {
      q: 'What does the inspector check?',
      a: 'It reports the number of cards, flags a card with a missing FN or a duplicated UID, and detects malformed properties such as a TEL without a VALUE or a line that is not a valid property.',
    },
    {
      q: 'Are my contacts uploaded?',
      a: 'No. The file is parsed in the browser only, so your address book stays private and the tool works offline.',
    },
  ],
} as const;
