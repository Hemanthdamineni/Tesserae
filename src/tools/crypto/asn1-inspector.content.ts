/**
 * Editorial content for the asn1-inspector tool page.
 *
 * Kept out of `asn1-inspector.meta.ts` so the eager client registry
 * never ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What the inspector reads',
      body: 'Drop in any DER-encoded ASN.1 object — a certificate, private key, CSR, PKCS#7 blob, or a hand-built structure — and the tool renders its full TLV (tag, length, value) tree. Binary DER, base64 PEM, hex and raw base64 input are all accepted, so you can paste a certificate block or upload a .der file. Every node reports its byte offset and depth, the tag class (universal, application, context, private), the tag number, a human-readable type name, the DER header length, the value length, and whether the node is constructed or primitive.',
    },
    {
      heading: 'Reading a TLV node',
      body: 'DER encodes every element as a tag byte, a length, then the value bytes. The inspector decodes the length field (including the long form), reports the value, and recurses into constructed elements so a real certificate appears as a nested tree. Integers are shown in hex, string types as text, and known object identifiers are resolved to names such as commonName or sha256WithRSAEncryption, which is what makes a raw key or certificate readable at a glance. A max-depth option caps how deeply the tree is expanded so a large blob does not drown the view.',
    },
    {
      heading: 'Well-formedness checks',
      body: 'Beyond listing structure, the tool runs canonical DER checks over the parsed tree: it confirms every element is closed inside the input, the outermost element consumes the expected number of bytes, and that lengths and nesting are consistent. Problems such as a truncated input, a dangling length, or an element that overruns the end of the object are reported as findings instead of crashing the parse. This is the low-level view underneath the certificate and CSR inspectors, handy for debugging hand-crafted ASN.1 or checking that a structure is well-formed DER before a parser accepts it.',
    },
    {
      heading: 'Privacy and limits',
      body: 'Everything is decoded in your browser; the file or text never leaves this tab and the tool works fully offline. Inputs up to 4 MB are supported, and nesting is capped internally so a hostile or deeply nested structure cannot overflow the stack. No account, no upload, no telemetry.',
    },
  ],
  faq: [
    {
      q: 'What input formats does the inspector accept?',
      a: 'Both binary DER files and text are accepted. Paste PEM (-----BEGIN ... -----) blocks, hex, or raw base64, or upload a .der/.cer/.crt/.pem/.key/.csr/.p7b/.p12 file; the tool auto-detects which form the bytes are in.',
    },
    {
      q: 'What does "constructed vs primitive" mean?',
      a: 'A primitive tag holds a leaf value (an integer, a string, a raw bit string). A constructed tag holds child TLV elements, so the inspector recurses into it. This is exactly what makes an ASN.1 structure a tree rather than a flat list.',
    },
    {
      q: 'Why are some OIDs replaced with names?',
      a: 'The tool keeps a map of common object identifiers — such as commonName and sha256WithRSAEncryption — and substitutes the human-readable name when it recognises one)Skip; unknown OIDs are shown as their dotted-decimal form so nothing is lost.',
    },
    {
      q: 'Can I feed it a hand-built sequence?',
      a: 'Yes. The 3rd example is a minimal DER integer (02 01 01, base64 AgEB), and you can paste any custom TLV you construct. The tree view and canonical checks will show whether it is well-formed DER.',
    },
  ],
} as const;
