import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './asn1-inspector.meta';

const MAX_BYTES = 4 * 1024 * 1024;

interface Node {
  offset: number;
  depth: number;
  /** 0 universal, 1 application, 2 context, 3 private. */
  cls: number;
  tag: number;
  /** DER header length (tag + length octets). */
  hl: number;
  length: number;
  constructed: boolean;
  value: Uint8Array | null;
  children: Node[];
  /** Long-form length used where the short form would do (not valid DER). */
  nonMinimalLength: boolean;
  /** Recursion stopped here because the nesting limit was reached. */
  truncatedChildren: boolean;
}

interface Finding {
  severity: 'error' | 'warn' | 'info';
  kind: string;
  detail: string;
}

function asciiBytes(b: Uint8Array, off: number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i += 1) s += String.fromCharCode(b[off + i] ?? 0);
  return s;
}

/** Decode a base64 string (standard alphabet, ignoring whitespace). */
function b64decode(s: string): Uint8Array | null {
  const clean = s.replace(/\s+/gu, '');
  if (clean === '') return null;
  const table = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const map = new Int16Array(128).fill(-1);
  for (let i = 0; i < table.length; i += 1) map[table.charCodeAt(i)] = i;
  const out: number[] = [];
  let buf = 0;
  let bits = 0;
  for (let i = 0; i < clean.length; i += 1) {
    const c = clean.charCodeAt(i);
    if (c === 61) break; // '='
    const v = c < 128 ? (map[c] ?? -1) : -1;
    if (v < 0) return null;
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buf >> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

function toHex(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 1)
    s += (b[i] ?? 0).toString(16).padStart(2, '0').toUpperCase();
  return s;
}

/** Strict byte-wise ASCII check; true if every byte is 0x09/0x0A/0x0D/0x20-0x7E. */
function isAscii(b: Uint8Array): boolean {
  if (b.length === 0) return false;
  for (let i = 0; i < b.length; i += 1) {
    const c = b[i] ?? 0;
    if (c === 9 || c === 10 || c === 13) continue;
    if (c < 0x20 || c > 0x7e) return false;
  }
  return true;
}

function isUtf8(b: Uint8Array): boolean {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(b);
    return true;
  } catch {
    return false;
  }
}
const UNIVERSAL = new Map<number, string>([
  [1, 'BOOLEAN'],
  [2, 'INTEGER'],
  [3, 'BIT STRING'],
  [4, 'OCTET STRING'],
  [5, 'NULL'],
  [6, 'OBJECT'],
  [7, 'OBJECT_DESCRIPTOR'],
  [8, 'EXTERNAL'],
  [9, 'REAL'],
  [10, 'ENUMERATED'],
  [12, 'UTF8STRING'],
  [13, 'RELATIVE-OID'],
  [16, 'SEQUENCE'],
  [17, 'SET'],
  [18, 'NUMERICSTRING'],
  [19, 'PRINTABLESTRING'],
  [20, 'T61STRING'],
  [22, 'IA5STRING'],
  [23, 'UTCTIME'],
  [24, 'GENERALIZEDTIME'],
  [26, 'VISIBLESTRING'],
  [27, 'GENERALSTRING'],
  [28, 'UNIVERSALSTRING'],
  [30, 'BMPSTRING'],
  [31, 'HIGH-TAG'],
]);

const OID_NAMES = new Map<string, string>([
  ['1.2.840.113549.1.1.1', 'rsaEncryption'],
  ['1.2.840.113549.1.1.5', 'sha1WithRSAEncryption'],
  ['1.2.840.113549.1.1.10', 'rsaPSS'],
  ['1.2.840.113549.1.1.11', 'sha256WithRSAEncryption'],
  ['1.2.840.113549.1.1.12', 'sha384WithRSAEncryption'],
  ['1.2.840.113549.1.1.13', 'sha512WithRSAEncryption'],
  ['1.2.840.113549.1.7.1', 'data'],
  ['1.2.840.113549.1.7.2', 'signedData'],
  ['1.2.840.10045.2.1', 'id-ecPublicKey'],
  ['1.2.840.10045.3.1.7', 'prime256v1'],
  ['1.3.132.0.34', 'secp384r1'],
  ['1.3.132.0.35', 'secp521r1'],
  ['1.3.101.112', 'Ed25519'],
  ['1.2.840.10040.4.1', 'dsa'],
  ['1.2.840.10040.4.3', 'dsaWithSHA1'],
  ['2.16.840.1.101.3.4.1.42', 'aes-256-gcm'],
  ['1.2.840.113549.3.7', 'des-ede3-cbc'],
  ['1.2.840.113549.2.9', 'hmacWithSHA256'],
  ['1.3.14.3.2.26', 'sha1'],
  ['1.3.14.3.2.6', 'des-ecb'],
  ['2.5.4.3', 'commonName'],
  ['2.5.4.4', 'surname'],
  ['2.5.4.5', 'serialNumber'],
  ['2.5.4.6', 'countryName'],
  ['2.5.4.7', 'localityName'],
  ['2.5.4.8', 'stateOrProvinceName'],
  ['2.5.4.10', 'organizationName'],
  ['2.5.4.11', 'organizationalUnitName'],
  ['2.5.4.12', 'title'],
  ['2.5.4.13', 'description'],
  ['2.5.4.15', 'businessCategory'],
  ['2.5.4.17', 'postalCode'],
  ['2.5.4.42', 'givenName'],
  ['2.5.4.46', 'dnQualifier'],
  ['2.5.4.97', 'organizationIdentifier'],
  ['2.5.29.14', 'subjectKeyIdentifier'],
  ['2.5.29.15', 'keyUsage'],
  ['2.5.29.17', 'subjectAltName'],
  ['2.5.29.19', 'basicConstraints'],
  ['2.5.29.35', 'authorityKeyIdentifier'],
  ['1.3.6.1.4.1.11129.2.4.2', 'signedCertificateTimestampList'],
]);

/** Dotted-decimal OID string from a BER-encoded subidentifier sequence. */
function oidToDotted(v: Uint8Array): string {
  if (v.length === 0) return '';
  const parts: number[] = [];
  let value = 0;
  for (let i = 0; i < v.length; i += 1) {
    const b = v[i] ?? 0;
    value = value * 128 + (b & 0x7f);
    if ((b & 0x80) === 0) {
      parts.push(value);
      value = 0;
    }
  }
  const first = parts.shift() ?? 0;
  const a = first < 40 ? 0 : first < 80 ? 1 : 2;
  const b = first - 40 * a;
  const tail = parts.length === 0 ? '' : '.' + parts.map((p) => String(p)).join('.');
  return a + '.' + b + tail;
}

function typeName(cls: number, tag: number): string {
  if (cls === 0) return UNIVERSAL.get(tag) ?? '[' + tag + ']';
  const pfx = cls === 1 ? 'appl' : cls === 3 ? 'priv' : 'cont';
  return pfx + ' [ ' + tag + ' ]';
}

/** Read a DER length; returns [length, headerOctets] or throws on malformed input. */
function readLength(b: Uint8Array, off: number): [number, number] {
  const first = b[off];
  if (first === undefined) throw new Error('truncated length');
  if ((first & 0x80) === 0) return [first, 1];
  const n = first & 0x7f;
  if (n === 0) throw new Error('indefinite length is not valid DER');
  if (n > 4) throw new Error('length too large');
  let l = 0;
  for (let i = 0; i < n; i += 1) {
    l = l * 256 + (b[off + 1 + i] ?? 0);
  }
  return [l, 1 + n];
}
/** Hard cap on nesting so a hostile input cannot overflow the JS stack. */
const PARSE_MAX_DEPTH = 64;

/** Recursively parse DER starting at the given offset. Returns the root node (or null on error). */
function parse(data: Uint8Array, start: number): Node | null {
  const readNode = (off: number, depth: number): [Node, number] | null => {
    if (off >= data.length) return null;
    const first = data[off];
    if (first === undefined) return null;
    const cls = first >> 6;
    const constructed = ((first >> 5) & 1) === 1;
    let tag = first & 0x1f;
    let off2 = off + 1;
    if (tag === 0x1f) {
      // High tag number form.
      tag = 0;
      let more = true;
      while (more) {
        const t = data[off2];
        if (t === undefined) return null;
        tag = tag * 128 + (t & 0x7f);
        more = (t & 0x80) !== 0;
        off2 += 1;
      }
    }
    let len: number;
    let lenOctets: number;
    try {
      const r = readLength(data, off2);
      len = r[0];
      lenOctets = r[1];
    } catch {
      return null;
    }
    // DER requires the shortest possible length encoding.
    const lenFirst = data[off2] ?? 0;
    let nonMinimalLength = false;
    if ((lenFirst & 0x80) !== 0) {
      const firstLenByte = data[off2 + 1] ?? 0;
      if (len < 128 || firstLenByte === 0) nonMinimalLength = true;
    }
    off2 += lenOctets;
    // hl is the whole DER header: identifier octets plus length octets.
    const hl = off2 - off;
    if (off2 + len > data.length) return null;
    const valueStart = off2;
    const valueEnd = off2 + len;
    let children: Node[] = [];
    let truncatedChildren = false;
    if (constructed) {
      if (depth >= PARSE_MAX_DEPTH) {
        truncatedChildren = true;
      } else {
        let cur = valueStart;
        while (cur < valueEnd) {
          const sub = readNode(cur, depth + 1);
          if (sub === null) {
            children = [];
            break;
          }
          children.push(sub[0]);
          cur = sub[1];
        }
      }
    }
    const node: Node = {
      offset: off,
      depth,
      cls,
      tag,
      hl,
      length: len,
      constructed,
      value: constructed ? null : data.subarray(valueStart, valueEnd),
      children,
      nonMinimalLength,
      truncatedChildren,
    };
    return [node, valueEnd];
  };
  const root = readNode(start, 0);
  return root === null ? null : root[0];
}

/** Render a primitive value for display, following openssl-style conventions. */
function formatValue(node: Node): string {
  if (node.value === null) return '';
  const v = node.value;
  if (node.cls === 0) {
    switch (node.tag) {
      case 2:
      case 10: {
        // INTEGER / ENUMERATED - hex, with a leading minus for negative values.
        const s = toHex(integerMagnitude(v));
        return isNegativeInteger(v) ? '-' + s : s;
      }
      case 6: {
        const dotted = oidToDotted(v);
        const name = OID_NAMES.get(dotted);
        return name === undefined ? dotted : dotted + ' (' + name + ')';
      }
      case 12:
      case 19:
      case 20:
      case 22:
      case 26:
        if (isAscii(v)) return asciiBytes(v, 0, v.length);
        if (isUtf8(v)) return new TextDecoder('utf-8').decode(v);
        return '[HEX DUMP]:' + toHex(v);
      case 23:
      case 24:
        return asciiBytes(v, 0, v.length);
      case 3: {
        // BIT STRING - first octet is unused-bit count.
        const unused = v[0] ?? 0;
        const body2 = v.subarray(1);
        if (body2.length === 0) return '(' + unused + ' unused bit)';
        const isText = isAscii(body2);
        const plural = unused === 1 ? ' unused bit' : ' unused bits';
        return (
          '(' +
          unused +
          plural +
          (isText ? ') ' + asciiBytes(body2, 0, body2.length) : '), HEX ' + toHex(body2))
        );
      }
      case 1:
        // openssl prints the raw octet in decimal, which also exposes non-canonical values.
        return String(v[0] ?? 0);
      case 5:
        return '';
      default:
        if (v.length === 0) return '';
        if (isAscii(v)) return asciiBytes(v, 0, v.length);
        return '[HEX DUMP]:' + toHex(v);
    }
  }
  // Context/application/private primitive - usually not meaningful text.
  if (isAscii(v) && v.length > 0) return asciiBytes(v, 0, v.length);
  return '[HEX DUMP]:' + toHex(v);
}

function isNegativeInteger(v: Uint8Array): boolean {
  return v.length > 0 && (v[0] ?? 0) >= 0x80;
}

/** Magnitude bytes of a two's-complement INTEGER, without redundant sign octets. */
function integerMagnitude(v: Uint8Array): Uint8Array {
  if (v.length === 0) return v;
  if (!isNegativeInteger(v)) {
    let i = 0;
    while (i < v.length - 1 && (v[i] ?? 0) === 0x00) i += 1;
    return v.subarray(i);
  }
  // Negate in place (invert and add one) to get the magnitude.
  const out = new Uint8Array(v.length);
  let carry = 1;
  for (let i = v.length - 1; i >= 0; i -= 1) {
    const sum = 0xff - (v[i] ?? 0) + carry;
    out[i] = sum & 0xff;
    carry = sum > 0xff ? 1 : 0;
  }
  let j = 0;
  while (j < out.length - 1 && (out[j] ?? 0) === 0x00) j += 1;
  return out.subarray(j);
}
/** True if the bytes begin with a PEM armour line. */
function looksLikePem(b: Uint8Array): boolean {
  return b.length >= 11 && asciiBytes(b, 0, 11) === '-----BEGIN ';
}

/** True if every byte is printable ASCII or whitespace. */
function allPrintable(b: Uint8Array): boolean {
  if (b.length === 0) return false;
  for (let i = 0; i < b.length; i += 1) {
    const c = b[i] ?? 0;
    if (c === 9 || c === 10 || c === 13 || c === 32) continue;
    if (c < 0x21 || c > 0x7e) return false;
  }
  return true;
}

interface Decoded {
  der: Uint8Array;
  form: string;
}

/** Work out whether the input is PEM, hex, base64, or raw DER. */
function decodeInput(b: Uint8Array): Decoded {
  if (looksLikePem(b)) {
    const text = asciiBytes(b, 0, b.length);
    const m = /-----BEGIN [^-]+-----([\s\S]*?)-----END [^-]+-----/u.exec(text);
    const body = m?.[1] ?? '';
    const der = b64decode(body);
    if (der !== null && der.length > 0) return { der, form: 'PEM (base64)' };
    return { der: b, form: 'DER' };
  }
  if (allPrintable(b)) {
    const text = asciiBytes(b, 0, b.length).trim();
    const compact = text.replace(/\s+/gu, '');
    // Hex?
    if (compact.length >= 8 && compact.length % 2 === 0 && /^[0-9a-fA-F]+$/u.test(compact)) {
      const out = new Uint8Array(compact.length / 2);
      for (let i = 0; i < out.length; i += 1)
        out[i] = Number.parseInt(compact.slice(i * 2, i * 2 + 2), 16);
      if (out.length > 0 && (out[0] ?? 0) === 0x30) return { der: out, form: 'hex' };
    }
    // base64 (try only if it decodes to something starting with SEQUENCE)
    if (compact.length >= 8 && /^[A-Za-z0-9+/]+={0,2}$/u.test(compact)) {
      const out = b64decode(compact);
      if (out !== null && out.length > 0 && (out[0] ?? 0) === 0x30)
        return { der: out, form: 'base64' };
    }
  }
  return { der: b, form: 'DER' };
}

function truncHex(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max) + '... (' + (s.length - max) + ' more hex chars)';
}

/** DER canonical-form checks, run over the parsed tree. */
function collectFindings(
  root: Node | null,
  data: Uint8Array,
  consumed: number,
  form: string,
): Finding[] {
  const findings: Finding[] = [];
  findings.push({
    severity: 'info',
    kind: 'input',
    detail: 'Interpreted the input as ' + form + ' (' + data.length + ' bytes).',
  });
  if (root === null) {
    findings.push({
      severity: 'error',
      kind: 'parse',
      detail: 'Could not parse a DER object from this input.',
    });
    return findings;
  }
  if (consumed < data.length) {
    findings.push({
      severity: 'error',
      kind: 'trailing',
      detail:
        data.length -
        consumed +
        ' trailing byte(s) after the top-level object; DER should contain exactly one value.',
    });
  }
  const walk = (n: Node): void => {
    if (n.nonMinimalLength) {
      findings.push({
        severity: 'warn',
        kind: 'length',
        detail:
          'Object at offset ' +
          n.offset +
          ' uses a long-form length where the short form would do; DER requires minimal length encoding.',
      });
    }
    if (n.truncatedChildren) {
      findings.push({
        severity: 'info',
        kind: 'nesting',
        detail:
          'Nesting stopped at offset ' +
          n.offset +
          ' after ' +
          PARSE_MAX_DEPTH +
          ' levels; deeper objects are not shown.',
      });
    }
    if (n.constructed && n.children.length === 0 && n.length > 0) {
      findings.push({
        severity: 'warn',
        kind: 'empty-constructed',
        detail:
          'Constructed object at offset ' +
          n.offset +
          ' has a non-zero length but no child objects parsed.',
      });
    }
    if (n.cls === 0 && n.tag === 3 && n.value !== null && n.value.length > 0) {
      const unused = n.value[0] ?? 0;
      if (unused > 7) {
        findings.push({
          severity: 'error',
          kind: 'bit-string',
          detail:
            'BIT STRING at offset ' + n.offset + ' claims ' + unused + ' unused bits (max 7).',
        });
      } else if (unused > 0 && n.value.length > 1) {
        const last = n.value[n.value.length - 1] ?? 0;
        const mask = (1 << unused) - 1;
        if ((last & mask) !== 0) {
          findings.push({
            severity: 'warn',
            kind: 'bit-string',
            detail:
              'BIT STRING at offset ' + n.offset + ' has non-zero padding bits, which DER forbids.',
          });
        }
      }
    }
    if (n.cls === 0 && n.tag === 1 && n.value !== null && n.value.length === 1) {
      const v = n.value[0] ?? 0;
      if (v !== 0 && v !== 0xff) {
        findings.push({
          severity: 'warn',
          kind: 'boolean',
          detail:
            'BOOLEAN at offset ' +
            n.offset +
            ' encodes TRUE as 0x' +
            v.toString(16) +
            '; DER uses 0xFF.',
        });
      }
    }
    if (n.cls === 0 && n.tag === 2 && n.value !== null && n.value.length > 1) {
      const a = n.value[0] ?? 0;
      const b = n.value[1] ?? 0;
      if ((a === 0x00 && (b & 0x80) === 0) || (a === 0xff && (b & 0x80) !== 0)) {
        findings.push({
          severity: 'warn',
          kind: 'integer',
          detail:
            'INTEGER at offset ' +
            n.offset +
            ' has a redundant leading sign octet; DER requires minimal encoding.',
        });
      }
    }
    for (const c of n.children) walk(c);
  };
  walk(root);
  if (findings.length === 1) {
    findings.push({
      severity: 'info',
      kind: 'canonical',
      detail: 'No canonical-form problems found.',
    });
  }
  return findings;
}

/** Depth-first flatten, stopping descent below maxDepth. */
function flatten(root: Node, maxDepth: number): Node[] {
  const out: Node[] = [];
  const walk = (n: Node): void => {
    out.push(n);
    if (n.depth >= maxDepth) return;
    for (const c of n.children) walk(c);
  };
  walk(root);
  return out;
}

/** Total node count (unbounded). */
function countNodes(n: Node): number {
  let total = 1;
  for (const c of n.children) total += countNodes(c);
  return total;
}

/** Byte offset just past the last byte of the object. */
function endOf(n: Node): number {
  return n.offset + n.hl + n.length;
}

/** Deepest depth value anywhere in the tree. */
function maxDepthOf(n: Node): number {
  let d = n.depth;
  for (const c of n.children) d = Math.max(d, maxDepthOf(c));
  return d;
}

interface Model {
  data: Uint8Array;
  decoder: Decoded;
  root: Node | null;
  findings: Finding[];
  consumed: number;
}

function buildModel(b: Uint8Array): Model {
  const decoder = decodeInput(b);
  const root = parse(decoder.der, 0);
  const consumed = root === null ? 0 : endOf(root);
  const findings = collectFindings(root, decoder.der, consumed, decoder.form);
  return { data: decoder.der, decoder, root, findings, consumed };
}
function treeRows(root: Node | null, maxDepth: number): { headers: string[]; rows: string[][] } {
  const headers = ['Offset', 'Depth', 'Type', 'Constructed', 'Hdr len', 'Value len', 'Value'];
  const rows: string[][] = [];
  if (root === null) return { headers, rows };
  for (const n of flatten(root, maxDepth)) {
    const typeLabel = typeName(n.cls, n.tag);
    const val = n.constructed ? '' : formatValue(n);
    rows.push([
      String(n.offset),
      String(n.depth),
      typeLabel,
      n.constructed ? 'yes' : 'no',
      String(n.hl),
      String(n.length),
      truncHex(val, 72),
    ]);
  }
  return { headers, rows };
}

function statsRows(m: Model): { headers: string[]; rows: string[][] } {
  const headers = ['Property', 'Value'];
  const rows: string[][] = [];
  rows.push(['Input', m.decoder.form]);
  rows.push(['Size', m.data.length + ' bytes']);
  if (m.root !== null) {
    const counts = new Map<string, number>();
    const tagOf = (n: Node): string => typeName(n.cls, n.tag);
    for (const n of flatten(m.root, 1e9)) counts.set(tagOf(n), (counts.get(tagOf(n)) ?? 0) + 1);
    rows.push(['Top-level type', tagOf(m.root)]);
    rows.push(['Total objects', String(countNodes(m.root))]);
    rows.push(['Max depth', String(maxDepthOf(m.root) + 1)]);
    const hex = toHex(m.data.subarray(0, 8));
    rows.push(['First bytes', hex]);
    let constructed = 0;
    for (const n of flatten(m.root, 1e9)) if (n.constructed) constructed += 1;
    rows.push(['Constructed', String(constructed)]);
    const kinds = Array.from(counts.entries())
      .sort((a, b2) => b2[1] - a[1])
      .slice(0, 8)
      .map((kv) => kv[0] + ' x' + kv[1]);
    rows.push(['Types', kinds.join(', ') || 'none']);
  }
  if (m.consumed < m.data.length) {
    rows.push(['Trailing bytes', String(m.data.length - m.consumed)]);
  }
  return { headers, rows };
}

function findingsRows(m: Model): { headers: string[]; rows: string[][] } {
  const headers = ['Severity', 'Kind', 'Detail'];
  const rows = m.findings.map((f) => [f.severity, f.kind, f.detail]);
  if (rows.length === 0) rows.push(['info', 'ok', 'No problems found.']);
  return { headers, rows };
}

const tool: FileToolModule = {
  meta,
  async run(input: FileRunInput): Promise<FileRunResult> {
    const options = resolveOptions(meta, input.options);
    const file = (input.files ?? [])[0];
    const text = input.text ?? '';
    if (file === undefined && text.trim() === '') {
      throw new ToolError(
        'Drop a DER/PEM file or paste ASN.1 text.',
        'Provide a .der, .pem, .crt, .cer, .key, .csr or base64 text.',
      );
    }
    let bytes: Uint8Array;
    let provenance: string;
    if (file !== undefined) {
      if (file.size > MAX_BYTES)
        throw new ToolError('That file is too large.', 'Use a file under 4 MB.');
      bytes = new Uint8Array(await file.arrayBuffer());
      provenance = file.name;
    } else {
      bytes = new TextEncoder().encode(text);
      provenance = 'pasted text';
    }
    const m = buildModel(bytes);
    const view = String(options.view ?? 'tree');
    const maxDepth = Math.max(1, Math.min(30, Number(options.maxDepth) || 12));
    let report: FileRunResult['report'];
    if (view === 'stats') report = { output: JSON.stringify(statsRows(m)), render: 'table' };
    else if (view === 'findings')
      report = { output: JSON.stringify(findingsRows(m)), render: 'table' };
    else report = { output: JSON.stringify(treeRows(m.root, maxDepth)), render: 'table' };
    const notes: string[] = [];
    notes.push('Source: ' + provenance + '.');
    if (m.root !== null) {
      notes.push(
        'Top-level: ' +
          typeName(m.root.cls, m.root.tag) +
          ' with ' +
          countNodes(m.root) +
          ' object(s), depth ' +
          (m.root.depth + 1) +
          '.',
      );
    } else {
      notes.push('No DER object could be parsed from this input.');
    }
    if (m.consumed < m.data.length) {
      notes.push(
        m.data.length -
          m.consumed +
          ' trailing byte(s) present; the top-level value does not span the whole input.',
      );
    }
    notes.push(
      'Nodes are shown as they would appear in openssl asn1parse; values are truncated for display.',
    );
    return { outputs: [], report, notes, warnings: [] };
  },
};

export default tool;
