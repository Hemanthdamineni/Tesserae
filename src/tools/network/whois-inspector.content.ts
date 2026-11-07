/**
 * Editorial content for the whois-inspector tool page.
 *
 * Kept out of ``whois-inspector.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'Is my WHOIS record looked up online?',
      a: 'No. This tool only reads a WHOIS response you already have. Paste the record text and it is parsed locally in your browser; nothing is sent anywhere.',
    },
    {
      q: 'Why does the tool say my record has no registrar?',
      a: 'WHOIS formats differ by registry. If the registrar field uses an unusual name the tool does not recognise, it will be flagged as an unknown field and the registrar row will show as missing. The record view still lists every line it understood.',
    },
    {
      q: 'What does a "no match" result mean?',
      a: 'Some registrars answer with "No match found" or "Not found" when a domain is not registered. The issues view flags that signal, along with the structurally missing pieces a real record should have.',
    },
  ],
};
