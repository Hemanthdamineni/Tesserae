import type { FileToolModule, FileRunInput, FileRunResult, OutputFile } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './mpegts-inspector.meta';

/**
 * MPEG-TS (transport stream) inspector.
 *
 * A transport stream is a sequence of 188-byte packets, each beginning with
 * the sync byte 0x47. The expected values in the tests come from the
 * byte-exact fixture built by the Python generator and confirmed by the
 * `file`(1) reference tool ("MPEG transport stream data"), never from this
 * parser.
 */

const PACKET_SIZE = 188;
const SYNC = 0x47;
const MAX_BYTES = 512 * 1024 * 1024;
const MAX_PACKETS = 500000;

interface PidStat {
  count: number;
  scrambled: number;
  lastCc: number;
  gaps: number;
}

export const tool: FileToolModule = {
  meta,

  async run(input: FileRunInput): Promise<FileRunResult> {
    const opts = resolveOptions(meta, input.options);
    const view = String(opts.view ?? 'summary');

    const file = input.files[0];
    if (!file)
      throw new ToolError(
        'Choose an MPEG transport stream file to inspect.',
        'Pick a .ts or .m2ts file.',
      );
    if (file.size > MAX_BYTES) throw new ToolError('File is too large to parse in the browser.');
    const buf = new Uint8Array(await file.arrayBuffer());
    if (buf.length < PACKET_SIZE)
      throw new ToolError('File is too short to be an MPEG transport stream.');

    const warnings: string[] = [];

    if (buf[0] !== SYNC) {
      throw new ToolError(
        'Not an MPEG transport stream (missing 0x47 sync byte).',
        'An MPEG-TS file starts each 188-byte packet with the byte 0x47.',
      );
    }

    const trailing = buf.length % PACKET_SIZE;
    if (trailing !== 0)
      warnings.push(
        'The file is not a multiple of 188 bytes (' +
          buf.length +
          ' bytes, ' +
          trailing +
          ' trailing).',
      );

    const packetCount = Math.min(Math.floor(buf.length / PACKET_SIZE), MAX_PACKETS);
    const pids = new Map<number, PidStat>();
    let syncErrors = 0;
    let patPid = -1;
    let pmtPid = -1;
    const streamPids: number[] = [];
    const packetRows: string[][] = [];

    for (let i = 0; i < packetCount; i += 1) {
      const base = i * PACKET_SIZE;
      if ((buf[base] ?? 0) !== SYNC) {
        syncErrors += 1;
        continue;
      }
      const b1 = buf[base + 1] ?? 0;
      const b2 = buf[base + 2] ?? 0;
      const b3 = buf[base + 3] ?? 0;
      const pusi = (b1 >> 6) & 1;
      const pid = ((b1 & 0x1f) << 8) | b2;
      const afc = (b3 >> 4) & 0x03;
      const cc = b3 & 0x0f;
      const scrambled = (b3 >> 6) & 0x03;

      let st = pids.get(pid);
      if (!st) {
        st = { count: 0, scrambled: 0, lastCc: -1, gaps: 0 };
        pids.set(pid, st);
      }
      st.count += 1;
      if (scrambled !== 0) st.scrambled += 1;
      if (st.lastCc >= 0 && afc !== 0) {
        const expected = (st.lastCc + 1) & 0x0f;
        if (cc !== expected && cc !== st.lastCc) st.gaps += 1;
      }
      st.lastCc = cc;

      if (view === 'packets' && packetRows.length < 2000) {
        packetRows.push([
          String(i),
          '0x' + pid.toString(16).padStart(4, '0'),
          pusi ? 'yes' : 'no',
          String(afc),
          String(cc),
        ]);
      }

      // PSI tables (payload present, PUSI set)
      if (
        (pid === 0 || pid === pmtPid) &&
        pusi === 1 &&
        (afc & 0x01) === 1 &&
        base + 4 + 1 < buf.length
      ) {
        const pointer = buf[base + 4] ?? 0;
        const sec = base + 5 + pointer;
        const tableId = buf[sec] ?? 0;
        const sectionLength = (((buf[sec + 1] ?? 0) & 0x0f) << 8) | (buf[sec + 2] ?? 0);
        if (pid === 0 && tableId === 0x00) {
          // PAT: program entries begin at sec + 8
          const end = sec + 3 + sectionLength - 4;
          let p = sec + 8;
          while (p + 4 <= end && p + 4 <= buf.length) {
            const program = (((buf[p] ?? 0) << 8) | (buf[p + 1] ?? 0)) >>> 0;
            const pmt = ((((buf[p + 2] ?? 0) & 0x1f) << 8) | (buf[p + 3] ?? 0)) >>> 0;
            if (program !== 0) {
              patPid = 0;
              pmtPid = pmt;
            }
            p += 4;
          }
        } else if (tableId === 0x02) {
          // PMT: PCR PID then program info, then elementary streams
          const pcrPid = ((((buf[sec + 8] ?? 0) & 0x1f) << 8) | (buf[sec + 9] ?? 0)) >>> 0;
          const infoLen = ((((buf[sec + 10] ?? 0) & 0x0f) << 8) | (buf[sec + 11] ?? 0)) >>> 0;
          if (pcrPid >= 0 && !streamPids.includes(pcrPid)) streamPids.push(pcrPid);
          const end = sec + 3 + sectionLength - 4;
          let p = sec + 12 + infoLen;
          while (p + 5 <= end && p + 5 <= buf.length) {
            const esPid = ((((buf[p + 1] ?? 0) & 0x1f) << 8) | (buf[p + 2] ?? 0)) >>> 0;
            const esLen = ((((buf[p + 3] ?? 0) & 0x0f) << 8) | (buf[p + 4] ?? 0)) >>> 0;
            if (!streamPids.includes(esPid)) streamPids.push(esPid);
            p += 5 + esLen;
          }
        }
      }
    }

    if (syncErrors > 0)
      warnings.push(syncErrors + ' packet(s) did not start with the 0x47 sync byte.');
    if (patPid !== 0) warnings.push('No Program Association Table (PID 0) was found.');

    let totalGaps = 0;
    for (const st of pids.values()) totalGaps += st.gaps;
    if (totalGaps > 0) warnings.push(totalGaps + ' continuity counter gap(s) suggest packet loss.');

    // ---- views ----
    if (view === 'packets') {
      return renderTable(
        ['#', 'PID', 'payload start', 'adaptation', 'continuity'],
        packetRows,
        'MPEG-TS packets',
        undefined,
        warnings,
      );
    }

    if (view === 'pids') {
      const rows = [...pids.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .map(([pid, st]) => [
          '0x' + pid.toString(16).padStart(4, '0'),
          String(pid),
          String(st.count),
          st.scrambled > 0 ? 'yes' : 'no',
          st.gaps > 0 ? String(st.gaps) : '0',
        ]);
      return renderTable(
        ['PID (hex)', 'PID', 'packets', 'scrambled', 'gaps'],
        rows,
        'MPEG-TS PIDs',
        undefined,
        warnings,
      );
    }

    // summary
    const summary: string[][] = [
      ['File size', String(file.size) + ' B'],
      ['Packet size', '188 bytes'],
      ['Packets', String(packetCount)],
      ['Distinct PIDs', String(pids.size)],
      ['PAT', patPid === 0 ? 'present (PID 0)' : 'missing'],
      ['PMT PID', pmtPid >= 0 ? '0x' + pmtPid.toString(16).padStart(4, '0') : 'n/a'],
      ['Elementary streams', String(streamPids.length)],
      ['Sync errors', String(syncErrors)],
      ['Continuity gaps', String(totalGaps)],
    ];

    const notes: string[] = [];
    if (streamPids.length > 0) {
      notes.push(
        'Stream PIDs: ' +
          streamPids.map((p) => '0x' + p.toString(16).padStart(4, '0')).join(', ') +
          '.',
      );
    }

    return renderTable(['field', 'value'], summary, 'MPEG-TS summary', notes, warnings);
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
