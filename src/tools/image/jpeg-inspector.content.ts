/**
 * Editorial content for the jpeg-inspector tool page.
 *
 * Kept out of `jpeg-inspector.meta.ts` so the eager client registry never
 * ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it does',
      body: 'Drop in a JPEG and see it as the decoder sees it: a stream of 0xFF markers. The tool lists every segment in order with its byte offset, marker code and name, and declared length, and decodes the important ones on-device. It reads the SOF frame header (precision, image width and height, component count, and each sampling ratio plus quantisation table selector), every DQT quantisation table, every DHT Huffman table (class, id, number of codes per length), the SOS scan header (component DC/AC Huffman selectors, spectral selection and successive approximation), and a DRI restart interval. It also decodes JFIF APP0 (version, units, pixel density) and reports APP1 Exif, APP2 ICC and text comments.',
    },
    {
      heading: 'A file that is a list of markers',
      body: 'A JPEG has no single central header. It is a sequence of 0xFF marker segments that each announce their own type and length: SOI starts the stream, SOF describes the frame, DQT and DHT carry the quantisation and Huffman tables, SOS begins the scan, and EOI ends it. Listing these markers in order is the natural way to inspect a JPEG, which is exactly what the tool does.',
    },
    {
      heading: 'What the frame and tables hold',
      body: 'The SOF frame header carries the image geometry — precision, width, height and component sampling ratios — plus which quantisation table each component uses. DQT segments hold the 8×8 quantisation values, and DHT segments hold the Huffman code tables that make the compressed data decodable. Because those tables live inside the file, two JPEGs with identical pixels can differ in their tables, and inspecting them shows why file sizes vary.',
    },
    {
      heading: 'Metadata and structural problems',
      body: 'Beyond the image data, the tool reports JFIF APP0 (version, units and pixel density), APP1 Exif, APP2 ICC and text comments. It also flags classic structural problems such as a missing SOI at the start, so a file that will not open is usually caught before the first segment is even decoded.',
    },
  ],
  faq: [
    {
      q: 'What is a marker?',
      a: 'A marker is a byte pair beginning with 0xFF that introduces each JPEG segment. Each marker has its own meaning — SOI for start of image, SOF for frame, DQT for quantisation tables, DHT for Huffman tables, SOS for start of scan, EOI for end. The tool walks the file as a list of these markers with their offsets and names.',
    },
    {
      q: 'What are DQT and DHT segments?',
      a: 'DQT holds the quantisation tables that scale coefficients during compression, and DHT holds the Huffman tables used to encode them. They are stored inside the file, which is why the tool can list every table with its class, id and number of codes per length, and why two JPEGs can differ in size even with the same pixels.',
    },
    {
      q: 'What is in APP0, APP1 and APP2?',
      a: 'These are application marker segments. APP0 usually holds JFIF metadata such as version, density units and pixel density; APP1 typically holds Exif camera data; and APP2 often holds an embedded ICC colour profile. The tool decodes APP0 and reports the others by type.',
    },
    {
      q: 'Is my JPEG uploaded anywhere?',
      a: 'No. The marker stream and tables are parsed on-device, so a JPEG can be inspected offline with nothing leaving the browser.',
    },
  ],
} as const;
