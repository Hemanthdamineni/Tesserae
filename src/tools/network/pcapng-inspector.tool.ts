import type { FileToolModule, FileRunInput, FileRunResult, OutputFile } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './pcapng-inspector.meta';

/**
 * PCAP Next Generation (pcapng) inspector.
 *
 * A pcapng file is a sequence of variable-length blocks. Each block has a
 * 4-byte type, a 4-byte total length (covering the whole block including the
 * trailing length copy), a body displayed in a transfer-syntax-dependent
 * byte order, a trailing copy of the total length, and
 * padding to a 32-bit boundary. Expected values in the tests come from the
 * `file`(1) reference tool and a byte-level block walk, never from this
 * parser.
 */

const MAX_BYTES = 256 * 1024 * 1024;
const MAX_BLOCKS = 100000;

/** Known pcapng block types. */
const BLOCK_NAMES: Record<number, string> = {
  0x0a0d0d0a: 'Section Header Block (SHB)',
  0x00000001: 'Interface Description Block (IDB)',
  0x00000002: 'Packet Block (obsolete)',
  0x00000003: 'Simple Packet Block (SPB)',
  0x00000004: 'Name Resolution Block (NRB)',
  0x00000005: 'Interface Statistics Block (ISB)',
  0x00000006: 'Enhanced Packet Block (EPB)',
  0x0000000a: 'Decryption Secrets Block (DSB)',
};

/** Common data-link type names. */
const LINK_NAMES: Record<number, string> = {
  0: 'Null / Loopback',
  1: 'Ethernet',
  6: '802.5 Token Ring',
  7: 'ARCNET',
  8: 'SLIP',
  9: 'PPP',
  10: 'FDDI',
  101: 'Raw IP',
  105: '802.11',
  113: 'Linux SLL',
  127: 'Radiotap',
  147: 'IPv4',
  163: 'Raw IP',
  227: 'Linux SLL2',
  228: 'Ethernet',
  276: 'Netlink',
  293: 'USB',
};

function hex(v: number): string {
  return v.toString(16).padStart(8, '0').toUpperCase();
}

function u16le(b: Uint8Array, o: number): number {
  return ((b[o] ?? 0) + ((b[o + 1] ?? 0) << 8)) >>> 0;
}

function u32le(b: Uint8Array, o: number): number {
  return (u16le(b, o) + u16le(b, o + 2) * 65536) >>> 0;
}

function u32be(b: Uint8Array, o: number): number {
  return (
    ((((b[o] ?? 0) * 256 + (b[o + 1] ?? 0)) * 256 + (b[o + 2] ?? 0)) * 256 + (b[o + 3] ?? 0)) >>> 0
  );
}

export const tool: FileToolModule = {
  meta,

  async run(input: FileRunInput): Promise<FileRunResult> {
    const opts = resolveOptions(meta, input.options);
    const view = String(opts.view ?? 'blocks');

    const file = input.files[0];
    if (!file)
      throw new ToolError(
        'Choose a PCAPNG capture file to inspect.',
        'Pick a .pcapng or .pcap file.',
      );
    if (file.size > MAX_BYTES) throw new ToolError('File is too large to parse in the browser.');
    const buf = new Uint8Array(await file.arrayBuffer());
    if (buf.length < 12) throw new ToolError('File is too short to be a pcapng capture.');

    // ---- byte-order detection from the Section Header Block ----
    const magic0 =
      (buf[0] ?? 0) === 0x0a &&
      (buf[1] ?? 0) === 0x0d &&
      (buf[2] ?? 0) === 0x0d &&
      (buf[3] ?? 0) === 0x0a;
    if (!magic0) {
      throw new ToolError(
        'Not a pcapng file (missing Section Header Block).',
        'A pcapng file must start with block type 0x0A0D0D0A.',
      );
    }
    // byte-order magic follows the type+length: 0x1A2B3C4D = little-endian.
    const bom = u32le(buf, 8);
    const little = bom === 0x1a2b3c4d;

    // ---- walk blocks ----
    interface Block {
      offset: number;
      type: number;
      name: string;
      length: number;
      detail: string;
    }
    const blocks: Block[] = [];
    const packets: string[][] = [];
    let major = 0;
    let minor = 0;
    let sectionLength = 0;
    let linkType = -1;
    let snapLen = 0;
    let packetCount = 0;
    const warnings: string[] = [];

    let o = 0;
    let guard = 0;
    while (o < buf.length && blocks.length < MAX_BLOCKS && guard++ < 200000) {
      if (o + 8 > buf.length) break;
      const type = little ? u32le(buf, o) : u32be(buf, o);
      const len = little ? u32le(buf, o + 4) : u32be(buf, o + 4);
      if (len < 12) {
        warnings.push('Block at offset ' + o + ' has an invalid length (' + len + ').');
        break;
      }
      if (o + len > buf.length) {
        warnings.push('Block at offset ' + o + ' overruns the end of the file.');
        break;
      }
      // verify trailing length copy
      if (o + len - 4 + 4 <= buf.length) {
        const trailing = little ? u32le(buf, o + len - 4) : u32be(buf, o + len - 4);
        if (trailing !== len)
          warnings.push('Block at offset ' + o + ' has an inconsistent trailing length.');
      }

      let detail = '';
      if (type === 0x0a0d0d0a) {
        major = little ? u16le(buf, o + 12) : (buf[o + 12] ?? 0) * 256 + (buf[o + 13] ?? 0);
        minor = little ? u16le(buf, o + 14) : (buf[o + 14] ?? 0) * 256 + (buf[o + 15] ?? 0);
        // The 8-byte section length; the all-0xFF sentinel means "unspecified".
        const allFF =
          (buf[o + 16] ?? 0) === 0xff &&
          (buf[o + 17] ?? 0) === 0xff &&
          (buf[o + 18] ?? 0) === 0xff &&
          (buf[o + 19] ?? 0) === 0xff &&
          (buf[o + 20] ?? 0) === 0xff &&
          (buf[o + 21] ?? 0) === 0xff &&
          (buf[o + 22] ?? 0) === 0xff &&
          (buf[o + 23] ?? 0) === 0xff;
        sectionLength = allFF ? -1 : 0;
        detail =
          'version ' + major + '.' + minor + (allFF ? ', section length -1' : ', section length 0');
      } else if (type === 0x00000001) {
        linkType = little ? u16le(buf, o + 8) : (buf[o + 8] ?? 0) * 256 + (buf[o + 9] ?? 0);
        snapLen = little ? u32le(buf, o + 12) : u32be(buf, o + 12);
        detail =
          'link type ' +
          linkType +
          ' (' +
          (LINK_NAMES[linkType] ?? 'unknown') +
          '), snap length ' +
          snapLen;
      } else if (type === 0x00000006) {
        const caplen = little ? u32le(buf, o + 20) : u32be(buf, o + 20);
        const origlen = little ? u32le(buf, o + 24) : u32be(buf, o + 24);
        detail = 'packet ' + caplen + '/' + origlen + ' bytes';
        packets.push([String(packetCount), String(caplen), String(origlen)]);
        packetCount += 1;
      } else if (type === 0x00000003) {
        const origlen = little ? u32le(buf, o + 8) : u32be(buf, o + 8);
        detail = 'simple packet, original ' + origlen + ' bytes';
      } else if (type === 0x00000005) {
        const ts = little ? u32le(buf, o + 20) : u32be(buf, o + 20);
        detail =
          'interface ' +
          (little ? u32le(buf, o + 8) : u32be(buf, o + 8)) +
          ', timestamp high ' +
          ts;
      }

      blocks.push({
        offset: o,
        type,
        name: BLOCK_NAMES[type] ?? 'Unknown block type',
        length: len,
        detail,
      });
      o += len;
    }

    if (blocks.length === 0) {
      throw new ToolError('No blocks could be parsed from the capture.');
    }

    // ---- views ----
    if (view === 'packets') {
      return renderTable(
        ['packet', 'captured', 'original'],
        packets,
        'PCAPNG packet blocks',
        undefined,
        warnings,
      );
    }

    if (view === 'blocks') {
      const rows = blocks.map((b) => [
        String(b.offset),
        hex(b.type),
        b.name,
        String(b.length),
        b.detail,
      ]);
      return renderTable(
        ['offset', 'type', 'block', 'length', 'detail'],
        rows,
        'PCAPNG blocks',
        undefined,
        warnings,
      );
    }

    // summary view
    const summary: string[][] = [
      ['File size', String(file.size) + ' B'],
      ['Byte order', little ? 'little-endian' : 'big-endian'],
      ['Format version', major + '.' + minor],
      ['Section length', sectionLength === -1 ? '-1 (unspecified)' : String(sectionLength)],
      ['Interfaces', String(blocks.filter((b) => b.type === 0x00000001).length)],
      [
        'Data-link type',
        linkType >= 0 ? linkType + ' (' + (LINK_NAMES[linkType] ?? 'unknown') + ')' : '-',
      ],
      ['Snap length', snapLen ? String(snapLen) : '-'],
      ['Packets', String(packetCount)],
      ['Blocks', String(blocks.length)],
    ];

    return renderTable(['field', 'value'], summary, 'PCAPNG summary', undefined, warnings);
  },
};

function renderTable(
  headers: string[],
  rows: string[][],
  title: string,
  notes: string[] | undefined,
  warnings: string[],
): FileRunResult {
  const output = JSON.stringify({ title, headers, rows });
  return {
    outputs: [] as OutputFile[],
    report: { output, render: 'table' },
    notes: notes && notes.length > 0 ? notes : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
    stats: { rows: rows.length },
  };
}

export default tool;
