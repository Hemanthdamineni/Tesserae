/**
 * Editorial content for the npmrc-inspector tool page.
 *
 * Kept out of ``npmrc-inspector.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What is an .npmrc file?',
      a: 'It is the configuration file npm reads for registry, auth, proxy and install settings, with one key=value line per setting and an optional leading comment or section.',
    },
    {
      q: 'What does the inspector report?',
      a: 'It lists the settings and their scope, flags a registry or auth token that is written insecurely, and warns about unknown or deprecated keys that a future npm may reject.',
    },
    {
      q: 'Are my auth tokens exposed?',
      a: 'The inspector masks values of known auth-sensitive keys such as _authToken and _password, so a config pasted as evidence does not leak a private registry credential.',
    },
  ],
} as const;
