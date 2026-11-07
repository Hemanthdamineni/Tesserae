import type { APIRoute } from 'astro';
import { site } from '@/lib/site';

/** Base path the site is served from (`import.meta.env.BASE_URL`), e.g. `/Tesserae` or `/`. */
const BASE = import.meta.env.BASE_URL;

/** Join a route to the base path without doubling slashes. */
const url = (path: string): string => (BASE === '/' ? path : `${BASE}${path}`);

export const GET: APIRoute = () => {
  const manifest = {
    name: site.name,
    short_name: site.shortName,
    description: site.description,
    id: url('/'),
    start_url: url('/'),
    scope: url('/'),
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
    orientation: 'any',
    theme_color: site.themeColor,
    background_color: site.backgroundColor,
    categories: ['utilities', 'productivity', 'developer'],
    lang: site.locale,
    dir: 'ltr',
    icons: [
      { src: url('/icons/icon-192.png'), sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: url('/icons/icon-512.png'), sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: url('/icons/icon-maskable-512.png'),
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      { src: url('/favicon.svg'), sizes: 'any', type: 'image/svg+xml' },
    ],
    shortcuts: [
      { name: 'All tools', url: url('/tools') },
      { name: 'Search', url: url('/tools?focus=search') },
    ],
  };
  return new Response(JSON.stringify(manifest, null, 2), {
    headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' },
  });
};
