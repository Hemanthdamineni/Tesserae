import { absoluteUrl, site } from './site';
import type { ToolMeta } from './types';
import { CATEGORIES } from './categories';

export { absoluteUrl };

/**
 * Stable `@id` for the whole organisation. Every page that describes the
 * publisher references this id instead of inlining the Organization node, so
 * the schema graph stays connected and unambiguous.
 */
export function organizationId(): string {
  return `${site.url}#organization`;
}

/** Stable `@id` for the website (the searchable home page). */
export function websiteId(): string {
  return `${site.url}#website`;
}

/** Stable `@id` for a single tool page, referenced by ItemList entries. */
export function toolPageId(id: string): string {
  return absoluteUrl(`/tools/${id}`);
}

/**
 * High-intent `<title>` for a tool page. BaseHead appends ` · Tesserae`, so
 * this returns just the tool-facing part. Leads with the tool name (the query
 * people type) and reinforces the privacy/utility angle that makes Tesserae
 * tools distinct and more likely to be chosen from a search result.
 */
export function toolPageTitle(meta: ToolMeta): string {
  return `${meta.name} — Free, Private, Client-Side Tool`;
}

/**
 * The organisation behind the site. Emitted on the home page and referenced by
 * id from every SoftwareApplication / WebSite node so they share one identity.
 */
export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@id': organizationId(),
    '@type': 'Organization',
    name: site.name,
    url: site.url,
    logo: { '@type': 'ImageObject', url: absoluteUrl('/icon-512.png') },
  };
}

/** The website itself, including a SearchAction so search engines index /tools?q=. */
export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@id': websiteId(),
    '@type': 'WebSite',
    name: site.name,
    alternateName: site.shortName,
    url: site.url,
    description: site.description,
    publisher: { '@id': organizationId() },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: absoluteUrl('/tools?q={search_term_string}'),
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function softwareAppJsonLd(meta: ToolMeta) {
  const appUrl = absoluteUrl(`/tools/${meta.id}`);
  return {
    '@context': 'https://schema.org',
    '@id': `${toolPageId(meta.id)}#software-application`,
    '@type': 'SoftwareApplication',
    name: meta.name,
    description: meta.summary,
    url: appUrl,
    image: absoluteUrl(`/og/${meta.id}.png`),
    keywords: meta.keywords?.length ? meta.keywords.join(', ') : meta.summary,
    applicationCategory: 'UtilitiesApplication',
    applicationSubCategory: 'Developer Utility',
    operatingSystem: 'Web browser (Windows, macOS, Linux, Android, iOS)',
    browserRequirements: 'Requires JavaScript. No sign-up, no install.',
    softwareRequirements: 'Any modern web browser',
    permissions: 'No special access required',
    storageRequirements: 'None — everything runs in the browser',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    isAccessibleForFree: true,
    featureList: [
      '100% client-side processing',
      `Private — data never leaves the device (${meta.privacy.network === 'none' ? 'fully offline' : 'minimal network use'})`,
      meta.privacy.offline ? 'Offline-ready' : 'Works online',
      'No account required',
    ],
    publisher: { '@id': organizationId() },
  };
}

export function faqJsonLd(meta: ToolMeta, faq?: { q: string; a: string }[]) {
  if (!faq?.length) return null;
  return {
    '@context': 'https://schema.org',
    '@id': `${toolPageId(meta.id)}#faq`,
    '@type': 'FAQPage',
    mainEntityOfPage: { '@id': toolPageId(meta.id) },
    url: toolPageId(meta.id),
    mainEntity: faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

export function breadcrumbJsonLd(meta: ToolMeta) {
  const category = CATEGORIES[meta.category];
  return {
    '@context': 'https://schema.org',
    '@id': `${toolPageId(meta.id)}#breadcrumb`,
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Tools', item: absoluteUrl('/tools') },
      {
        '@type': 'ListItem',
        position: 2,
        name: category.name,
        item: absoluteUrl(`/categories/${category.id}`),
      },
      { '@type': 'ListItem', position: 3, name: meta.name, item: toolPageId(meta.id) },
    ],
  };
}

/**
 * Ordered steps for the tool page, derived from the `article` headings. Only
 * emitted when the tool actually ships an `article`, so the schema never
 * describes content that is not visible on the page.
 */
export function howToJsonLd(meta: ToolMeta, article?: { heading: string; body: string }[]) {
  if (!article?.length) return null;
  return {
    '@context': 'https://schema.org',
    '@id': `${toolPageId(meta.id)}#how-to`,
    '@type': 'HowTo',
    name: meta.name,
    description: meta.summary,
    url: toolPageId(meta.id),
    step: article.map((entry, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: entry.heading,
      text: entry.body,
    })),
  };
}

/** Ordered list of pages, used on /tools and /categories/[category]. */
export function itemListJsonLd(
  items: { id: string; name: string; url: string }[],
  name: string,
  url: string,
) {
  return {
    '@context': 'https://schema.org',
    '@id': `${absoluteUrl(url)}#item-list`,
    '@type': 'ItemList',
    name,
    url: absoluteUrl(url),
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: item.url,
      item: { '@id': item.url },
    })),
  };
}

/** Breadcrumb for category listing pages ("Categories › <category>"). */
export function categoryBreadcrumbJsonLd(categoryId: string, categoryName: string) {
  return {
    '@context': 'https://schema.org',
    '@id': `${absoluteUrl(`/categories/${categoryId}`)}#breadcrumb`,
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Categories', item: absoluteUrl('/categories') },
      {
        '@type': 'ListItem',
        position: 2,
        name: categoryName,
        item: absoluteUrl(`/categories/${categoryId}`),
      },
    ],
  };
}

/**
 * ItemList of a tool's related tools, emitted on the tool page so search
 * engines and AI assistants can recommend the surrounding tool family.
 */
export function relatedToolsJsonLd(
  tool: ToolMeta,
  related: { id: string; name: string }[],
) {
  if (!related.length) return null;
  return {
    '@context': 'https://schema.org',
    '@id': `${toolPageId(tool.id)}#related`,
    '@type': 'ItemList',
    name: `Related tools to ${tool.name}`,
    numberOfItems: related.length,
    itemListElement: related.map((t, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: t.name,
      url: toolPageId(t.id),
      item: { '@id': toolPageId(t.id) },
    })),
  };
}
