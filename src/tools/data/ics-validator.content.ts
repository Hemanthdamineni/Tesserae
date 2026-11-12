/**
 * Editorial content for the ics-validator tool page.
 *
 * Kept out of ``ics-validator.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What kinds of iCalendar files can I check?',
      a: 'Any .ics export, including a single VEVENT from a calendar app, a VTODO task list, or a whole feed with many components. Paste the text and the validator reads the BEGIN/END blocks, the VERSION and the required properties.',
    },
    {
      q: 'What does the validator flag?',
      a: 'It reports unbalanced BEGIN/END components, a missing VERSION or PRODID, a VEVENT with no DTSTART, malformed date-time values, and unescaped commas or semicolons in property values.',
    },
    {
      q: 'Does a valid file import everywhere?',
      a: 'Usually yes, but calendar apps differ in which optional properties they understand. The validator checks the standards-compliant core, so a file it accepts is a solid basis, even if a specific app rejects a niche property it does not implement.',
    },
  ],
} as const;
