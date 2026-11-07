import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'sitemap-validator',
  name: 'XML Sitemap Validator',
  category: 'web',
  summary:
    'Validate an XML sitemap on-device: URL count, required loc, lastmod, priority and limits.',
  description:
    'Paste an XML sitemap (sitemap.xml) and check it without uploading it. The tool confirms the urlset root and namespace, counts the entries, and validates each one: a missing or relative loc, a lastmod that is not a W3C date, a priority outside 0.0 to 1.0, and a changefreq outside the allowed values. It also warns when a sitemap exceeds the specification limits of 50,000 URLs or 50 MB, and reports duplicate loc entries, so a sitemap can be fixed before search engines read it. The summary gives the counts and the issues view lists every problem with its URL.',
  keywords: [
    'sitemap',
    'xml sitemap',
    'seo',
    'urlset',
    'loc',
    'lastmod',
    'changefreq',
    'priority',
    'crawler',
    'validator',
    'inspector',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  acceptsText: true,
  options: [
    {
      key: 'format',
      label: 'View',
      type: 'select',
      default: 'summary',
      choices: [
        { value: 'summary', label: 'Summary' },
        { value: 'urls', label: 'URL list' },
        { value: 'issues', label: 'Issues' },
      ],
    },
  ],
  examples: [{ title: 'Validate an XML sitemap' }],
  related: ['robots-txt', 'feed-inspector', 'url-parse', 'meta-tags'],
  status: 'stable',
};
