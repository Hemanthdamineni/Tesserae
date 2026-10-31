import type { ToolMeta } from '../../lib/types';

export const meta: ToolMeta = {
  id: 'asn1-inspector',
  name: 'ASN.1 / DER Inspector',
  category: 'crypto',
  summary:
    'Parse a DER (or PEM) ASN.1 structure into a readable tree: tag, class, length, type, offset and value.',
  description:
    'Drop in a DER-encoded certificate, private key, CSR, PKCS#7 blob, or any other ASN.1 object and see its complete structure as a tree. Each node shows the offset and depth, the tag class (universal, application, context, private), the tag number and a human-readable type name, the DER header length and value length, whether the node is constructed or primitive, and its value (integers in hex, string types as text, known OIDs resolved to names like commonName or sha256WithRSAEncryption). Both binary DER and base64 PEM input are accepted. This is the low-level view underneath the higher-level certificate and CSR inspectors, useful for debugging hand-crafted ASN.1, understanding TLV encodings, and checking that a structure is well-formed DER. Everything runs on-device.',
  keywords: [
    'asn.1',
    'asn1',
    'der',
    'ber',
    'tlv',
    'x.690',
    'x690',
    'certificate',
    'oid',
    'object identifier',
    'decoder',
    'parser',
    'hex dump',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  acceptsText: true,
  accept:
    '.der,.cer,.pem,.crt,.key,.csr,.pkcs7,.p7b,.p12,application/x-x509-ca-cert,application/pkcs8',
  options: [
    {
      key: 'view',
      label: 'View',
      type: 'select',
      default: 'tree',
      choices: [
        { value: 'tree', label: 'Structure tree' },
        { value: 'stats', label: 'Summary' },
        { value: 'findings', label: 'Findings' },
      ],
    },
    {
      key: 'maxDepth',
      label: 'Max depth',
      type: 'number',
      default: 12,
      min: 1,
      max: 30,
    },
  ],
  examples: [
    { title: 'Inspect a certificate', options: {} },
    { title: 'Debug a hand-built TLV', options: {} },
    {
      title: 'Parse a tiny DER integer',
      input: 'AgEB',
      options: { view: 'tree' },
    },
  ],
  related: ['x509-certificate-inspector', 'csr-decoder', 'keypair-generator'],
  status: 'stable',
};
