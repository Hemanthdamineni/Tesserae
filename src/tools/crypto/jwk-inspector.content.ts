/**
 * Editorial content for the jwk-inspector tool page.
 *
 * Kept out of ``jwk-inspector.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What is a JWK or JWKS?',
      a: 'A JSON Web Key (JWK) is the JSON object that represents a cryptographic key, most often RSA or EC, used to verify signed JWTs. A JWKS is a set of such keys wrapped in an object with a keys array.',
    },
    {
      q: 'What does the inspector report?',
      a: 'It reports the key type (kty), the algorithm (alg) and the key id (kid) for each key, flags a key missing a required member such as n or e, and warns about a key type it cannot fully describe.',
    },
    {
      q: 'Is the key material at risk?',
      a: 'No. A JWKS is public by design, and the inspector parses it locally, so a key set shared for review or debugging is never transmitted.',
    },
  ],
} as const;
