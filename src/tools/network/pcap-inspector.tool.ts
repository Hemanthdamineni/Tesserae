import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './pcap-inspector.meta';

const MAX_BYTES = 256 * 1024 * 1024;

const LINK_TYPES: Record<number, string> = {
  0: 'NULL (BSD loopback)',
  1: 'Ethernet',
  101: 'Raw IP',
  105: 'IEEE 802.11',
  113: 'Linux cooked capture',
  127: '802.11 + radiotap',
  228: 'IPv4',
  229: 'IPv6',
};

interface PktRecord {
  index: number;
  offset: number;
  sec: number;
  usec: number;
  incl: number;
  orig: number;
}

interface Finding {
  severity: 'error' | 'warn' | 'info';
  kind: string;
  detail: string;
}

interface Model {
  size: number;
  endian: string;
  magicOk: boolean;
  version: string;
  snaplen: number;
  network: number;
  linkName: string;
  records: PktRecord[];
  findings: Finding[];
}

function buildModel(data: Uint8Array): Model {
  const findings: Finding[] = [];
  const size = data.length;
  let endian = 'unknown';
  let magicOk = false;
  let version = '';
  let snaplen = 0;
  let network = 0;
  let linkName = '';
  const records: PktRecord[] = [];
  if (size >= 24) {
    const m4 =
      ((data[0] ?? 0) * 16777216 +
        (data[1] ?? 0) * 65536 +
        (data[2] ?? 0) * 256 +
        (data[3] ?? 0)) >>>
      0;
    const m4swap =
      ((data[3] ?? 0) * 16777216 +
        (data[2] ?? 0) * 65536 +
        (data[1] ?? 0) * 256 +
        (data[0] ?? 0)) >>>
      0;
    if (m4 === 0xa1b2c3d4) endian = 'big';
    else if (m4swap === 0xa1b2c3d4) endian = 'little';
    const le = endian === 'little';
    if (endian === 'unknown') {
      findings.push({
        severity: 'error',
        kind: 'magic',
        detail: 'The file does not begin with a PCAP magic (0xa1b2c3d4).',
      });
    } else {
      magicOk = true;
      const u16 = (a: number, b: number) => (le ? b * 256 + a : a * 256 + b);
      const u32 = (o: number) =>
        (le
          ? (data[o + 3] ?? 0) * 16777216 +
            (data[o + 2] ?? 0) * 65536 +
            (data[o + 1] ?? 0) * 256 +
            (data[o] ?? 0)
          : (data[o] ?? 0) * 16777216 +
            (data[o + 1] ?? 0) * 65536 +
            (data[o + 2] ?? 0) * 256 +
            (data[o + 3] ?? 0)) >>> 0;
      const vmaj = u16(data[4] ?? 0, data[5] ?? 0);
      const vmin = u16(data[6] ?? 0, data[7] ?? 0);
      version = vmaj + '.' + vmin;
      if (vmaj !== 2)
        findings.push({
          severity: 'warn',
          kind: 'version',
          detail: 'Unusual PCAP major version ' + vmaj + '.',
        });
      snaplen = u32(16);
      network = u32(20);
      linkName = LINK_TYPES[network] ?? 'unknown (' + network + ')';
      if (LINK_TYPES[network] === undefined)
        findings.push({
          severity: 'warn',
          kind: 'link',
          detail: 'Unknown data-link type ' + network + '.',
        });
      let p = 24;
      let idx = 0;
      while (p + 16 <= size) {
        const sec = u32(p);
        const usec = u32(p + 4);
        const incl = u32(p + 8);
        const orig = u32(p + 12);
        const doff = p + 16;
        if (doff + incl > size) {
          findings.push({
            severity: 'error',
            kind: 'record',
            detail:
              'Packet ' +
              idx +
              ' at offset ' +
              p +
              ' declares ' +
              incl +
              ' captured bytes but overruns the file.',
          });
          break;
        }
        if (incl > orig) {
          findings.push({
            severity: 'warn',
            kind: 'length',
            detail:
              'Packet ' +
              idx +
              ' captured length ' +
              incl +
              ' exceeds original length ' +
              orig +
              '.',
          });
        }
        records.push({ index: idx, offset: p, sec, usec, incl, orig });
        p = doff + incl;
        idx += 1;
      }
      if (p + 16 > size && p < size) {
        findings.push({
          severity: 'warn',
          kind: 'truncated',
          detail: 'A trailing partial packet record header was found.',
        });
      }
    }
  } else {
    findings.push({
      severity: 'error',
      kind: 'magic',
      detail: 'The file is too short to contain a PCAP global header.',
    });
  }
  if (findings.length === 0) {
    findings.push({
      severity: 'info',
      kind: 'ok',
      detail: 'The PCAP structure looks well-formed.',
    });
  }
  return { size, endian, magicOk, version, snaplen, network, linkName, records, findings };
}

const tool: FileToolModule = {
  meta,
  async run(input: FileRunInput): Promise<FileRunResult> {
    const options = resolveOptions(meta, input.options);
    const file = (input.files ?? [])[0];
    if (file === undefined)
      throw new ToolError(
        'Choose a PCAP capture file to inspect.',
        'Drop a .pcap file onto the tool.',
      );
    if (file.size > MAX_BYTES)
      throw new ToolError('That capture file is too large.', 'Use a file under 256 MB.');
    const data = new Uint8Array(await file.arrayBuffer());
    const m = buildModel(data);
    const view = String(options.view ?? 'records');
    let headers: string[];
    let rows: string[][];
    if (view === 'summary') {
      headers = ['Property', 'Value'];
      rows = [
        ['File size', String(m.size) + ' B'],
        ['Byte order', m.endian + ' (magic 0xa1b2c3d4)'],
        ['Magic', m.magicOk ? 'valid' : 'INVALID'],
        ['Version', m.version],
        ['Snapshot length', String(m.snaplen)],
        ['Link type', String(m.network) + ' (' + m.linkName + ')'],
        ['Packet records', String(m.records.length)],
      ];
    } else if (view === 'findings') {
      headers = ['Severity', 'Kind', 'Detail'];
      rows = m.findings.map((f) => [f.severity, f.kind, f.detail]);
      if (rows.length === 0) rows.push(['info', 'ok', 'No problems found.']);
    } else {
      headers = ['#', 'Offset', 'Time sec', 'Time usec', 'Captured', 'Original'];
      rows = m.records.map((r) => [
        String(r.index),
        String(r.offset),
        String(r.sec),
        String(r.usec),
        String(r.incl),
        String(r.orig),
      ]);
    }
    const report = { output: JSON.stringify({ headers, rows }), render: 'table' as const };
    const notes: string[] = [];
    notes.push(m.records.length + ' packet record(s) parsed.');
    return { outputs: [], report, notes, warnings: [] };
  },
};

export default tool;
