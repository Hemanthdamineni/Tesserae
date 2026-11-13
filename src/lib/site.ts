/**
 * Single source of truth for branding, URLs and navigation.
 * Rename the product by editing `name` / `domain` here — nothing else hard-codes them.
 */

const DEFAULT_URL = 'https://hemanthdamineni.github.io/Tesserae';

/**
 * Deploy base path (e.g. `/Tesserae` on GitHub Pages), without a
 * trailing slash. Internal navigation must go through `link()` so the site
 * works at any base — Astro does not rewrite hardcoded absolute hrefs.
 */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Prefix a site-relative path with the deploy base. */
const link = (path: string): string => `${BASE}${path}`;

/**
 * Absolute URL for a site-relative path — base-path aware, so a project site
 * (`https://owner.github.io/repo`) produces `…/repo/tools/x`, never `…/tools/x`
 * off the origin root. Every canonical/SEO URL must go through here.
 */
export const absoluteUrl = (path: string): string =>
  new URL(link(path), import.meta.env.SITE_URL ?? DEFAULT_URL).toString();

/** The canonical repository for this project. */
const REPOSITORY = 'https://github.com/Hemanthdamineni/Tesserae';

export const site = {
  name: 'Tesserae',
  /** Shown in the header next to the logo. */
  shortName: 'Tesserae',
  tagline: 'An opus tessellatum of private tools',
  description:
    'A large collection of file and text utilities that run entirely on your device. ' +
    'No uploads, no accounts, no tracking. Works offline once loaded.',
  /** Canonical origin. Override at build with SITE_URL. */
  url: import.meta.env.SITE_URL ?? DEFAULT_URL,
  locale: 'en',
  themeColor: '#1e1e1c',
  backgroundColor: '#f8f4eb',
  repository: REPOSITORY,
  /** Optional: leave empty to hide social links. */
  social: {
    github: REPOSITORY,
  },
  nav: [
    { label: 'All tools', href: link('/tools') },
    { label: 'Categories', href: link('/categories') },
    { label: 'Guides', href: link('/guides') },
    { label: 'Privacy', href: link('/privacy') },
    { label: 'About', href: link('/about') },
  ],
  footer: {
    Product: [
      { label: 'All tools', href: link('/tools') },
      { label: 'Categories', href: link('/categories') },
      { label: 'Guides', href: link('/guides') },
      { label: 'Install as an app', href: link('/about#install') },
    ],
    Trust: [
      { label: 'Privacy model', href: link('/privacy') },
      { label: 'How it works', href: link('/about#how') },
      { label: 'Open source', href: REPOSITORY },
      { label: 'Contribute', href: REPOSITORY },
    ],
  },
} as const;

export type Site = typeof site;
