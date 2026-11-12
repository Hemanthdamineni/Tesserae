/**
 * Editorial content for the kml-inspector tool page.
 *
 * Kept out of ``kml-inspector.meta.ts`` so the eager client registry never ships this
 * prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  faq: [
    {
      q: 'What does the inspector report about my KML?',
      a: 'It lists the Placemarks, folders, styles and coordinates in the document attack coordinates that fall outside valid latitude or longitude ranges, and structural problems such as mismatched or unclosed placemark tags.',
    },
    {
      q: 'Which coordinate formats are supported?',
      a: 'KML uses longitude,latitude pairs in the lon,lat order inside coordinates elements. The inspector checks that each pair is numeric and that the latitude stays within +-90 and the longitude within +-180.',
    },
    {
      q: 'Can I inspect KML with network links?',
      a: 'Yes. Network links are reported as such, and the validator does not follow them, so a document with remote links can still be checked offline without any external request.',
    },
  ],
} as const;
