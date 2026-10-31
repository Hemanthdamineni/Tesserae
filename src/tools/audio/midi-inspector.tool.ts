import type { FileToolModule, FileRunInput, FileRunResult } from '@/lib/types';
import { ToolError } from '@/lib/types';
import { resolveOptions } from '@/lib/options';
import { meta } from './midi-inspector.meta';

const MAX_BYTES = 128 * 1024 * 1024;

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

interface Event {
  delta: number;
  offset: number;
  label: string;
}

interface Track {
  index: number;
  offset: number;
  size: number;
  events: Event[];
}

interface Finding {
  severity: 'error' | 'warn' | 'info';
  kind: string;
  detail: string;
}

interface Model {
  size: number;
  magicOk: boolean;
  format: number;
  trackCount: number;
  division: number;
  tracks: Track[];
  findings: Finding[];
  tempoBpm: number;
}

function noteName(n: number): string {
  const nm = NOTE_NAMES[n % 12] ?? '?';
  return nm + (Math.floor(n / 12) - 1);
}

function ascii(b: Uint8Array, off: number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i += 1) {
    const c = b[off + i] ?? 0;
    s += c >= 32 && c < 127 ? String.fromCharCode(c) : '.';
  }
  return s;
}

function buildModel(data: Uint8Array): Model {
  const findings: Finding[] = [];
  const size = data.length;
  let pos = 0;
  let magicOk = size >= 4 && ascii(data, 0, 4) === 'MThd';
  if (!magicOk) {
    findings.push({
      severity: 'error',
      kind: 'magic',
      detail: 'The file does not begin with an MThd header chunk.',
    });
  }
  let format = -1;
  let trackCount = 0;
  let division = 0;
  let tempoBpm = 0;
  const tracks: Track[] = [];
  if (magicOk) {
    if (pos + 14 > size) {
      findings.push({ severity: 'error', kind: 'header', detail: 'The MThd header is truncated.' });
      magicOk = false;
    } else {
      pos = 4;
      const hlen =
        ((data[4] ?? 0) * 16777216 +
          (data[5] ?? 0) * 65536 +
          (data[6] ?? 0) * 256 +
          (data[7] ?? 0)) >>>
        0;
      if (hlen < 6 || 8 + hlen > size) {
        findings.push({
          severity: 'error',
          kind: 'header',
          detail: 'The MThd header length (' + hlen + ') is invalid or overruns the file.',
        });
        magicOk = false;
      } else {
        format = ((data[8] ?? 0) * 256 + (data[9] ?? 0)) >>> 0;
        trackCount = ((data[10] ?? 0) * 256 + (data[11] ?? 0)) >>> 0;
        division = ((data[12] ?? 0) * 256 + (data[13] ?? 0)) >>> 0;
        pos = 8 + hlen;
      }
    }
  }
  if (magicOk) {
    let idx = 0;
    while (pos + 8 <= size) {
      const cid = ascii(data, pos, 4);
      const clen =
        ((data[pos + 4] ?? 0) * 16777216 +
          (data[pos + 5] ?? 0) * 65536 +
          (data[pos + 6] ?? 0) * 256 +
          (data[pos + 7] ?? 0)) >>>
        0;
      const cstart = pos + 8;
      if (cstart + clen > size) {
        findings.push({
          severity: 'error',
          kind: 'chunk',
          detail:
            'Chunk ' +
            cid +
            ' at offset ' +
            pos +
            ' declares ' +
            clen +
            ' bytes but overruns the file.',
        });
        break;
      }
      if (cid === 'MTrk') {
        const events: Event[] = [];
        let p = cstart;
        const cend = cstart + clen;
        let running: number | null = null;
        let overrun = false;
        while (p < cend) {
          let delta = 0;
          let consumed = 0;
          let vlqOk = true;
          while (true) {
            if (p + consumed >= cend) {
              vlqOk = false;
              break;
            }
            const b = data[p + consumed] ?? 0;
            consumed += 1;
            delta = delta * 128 + (b & 0x7f);
            if (!(b & 0x80)) break;
            if (consumed > 4) {
              vlqOk = false;
              break;
            }
          }
          if (!vlqOk) {
            findings.push({
              severity: 'warn',
              kind: 'vlq',
              detail: 'Track ' + idx + ' has a malformed delta-time at offset ' + p + '.',
            });
            break;
          }
          p += consumed;
          if (p >= cend) {
            findings.push({
              severity: 'error',
              kind: 'event',
              detail: 'Track ' + idx + ' ends without an end-of-track event.',
            });
            overrun = true;
            break;
          }
          const status = data[p] ?? 0;
          let label: string;
          if (status === 0xff) {
            if (p + 3 > cend) {
              findings.push({
                severity: 'error',
                kind: 'event',
                detail: 'Track ' + idx + ' has a truncated meta event at offset ' + p + '.',
              });
              overrun = true;
              break;
            }
            const mtype = data[p + 1] ?? 0;
            const mlen = data[p + 2] ?? 0;
            const mstart = p + 3;
            if (mstart + mlen > cend) {
              findings.push({
                severity: 'error',
                kind: 'event',
                detail: 'Track ' + idx + ' meta event at offset ' + p + ' overruns the track.',
              });
              overrun = true;
              break;
            }
            const body = ascii(data, mstart, mlen);
            if (mtype === 0x51 && mlen === 3) {
              const us =
                (data[mstart] ?? 0) * 65536 +
                (data[mstart + 1] ?? 0) * 256 +
                (data[mstart + 2] ?? 0);
              tempoBpm = us > 0 ? Math.round(60000000 / us) : 0;
              label = 'tempo ' + us + 'us (' + tempoBpm + ' bpm)';
            } else if (mtype === 0x2f) {
              label = 'end of track';
            } else if (mtype === 0x03) {
              label = 'track name "' + body + '"';
            } else if (mtype === 0x58) {
              label = 'time signature';
            } else if (mtype === 0x59) {
              label = 'key signature';
            } else {
              label = 'meta 0x' + mtype.toString(16) + ' len ' + mlen;
            }
            events.push({ delta, offset: p, label });
            p = mstart + mlen;
            running = null;
          } else if (status & 0x80) {
            const eoff = p;
            p += 1;
            const hi = status & 0xf0;
            const ch = status & 0x0f;
            const twoByte = hi === 0xc0 || hi === 0xd0;
            if (p >= cend) {
              findings.push({
                severity: 'error',
                kind: 'event',
                detail: 'Track ' + idx + ' has a truncated channel message at offset ' + eoff + '.',
              });
              overrun = true;
              break;
            }
            const b1 = data[p] ?? 0;
            let b2 = 0;
            if (twoByte) {
              p += 1;
            } else {
              if (p + 1 >= cend) {
                findings.push({
                  severity: 'error',
                  kind: 'event',
                  detail:
                    'Track ' + idx + ' has a truncated channel message at offset ' + eoff + '.',
                });
                overrun = true;
                break;
              }
              b2 = data[p + 1] ?? 0;
              p += 2;
            }
            if (hi === 0x90) {
              label = 'note on ch' + ch + ' ' + noteName(b1) + ' vel ' + b2;
            } else if (hi === 0x80) {
              label = 'note off ch' + ch + ' ' + noteName(b1) + ' vel ' + b2;
            } else if (hi === 0xc0) {
              label = 'program change ch' + ch + ' prog ' + b1;
            } else if (hi === 0xb0) {
              label = 'control change ch' + ch + ' cc' + b1 + ' ' + b2;
            } else {
              label = 'message 0x' + status.toString(16) + ' ch' + ch;
            }
            events.push({ delta, offset: eoff, label });
            running = status;
          } else {
            // running status byte
            if (running === null) {
              findings.push({
                severity: 'warn',
                kind: 'running',
                detail:
                  'Track ' +
                  idx +
                  ' uses running status without a prior status byte at offset ' +
                  p +
                  '.',
              });
              label = 'data 0x' + status.toString(16);
              events.push({ delta, offset: p, label });
              p += 1;
            } else {
              const hi = running & 0xf0;
              const ch = running & 0x0f;
              const b1 = status;
              const b2 = hi === 0xc0 || hi === 0xd0 ? 0 : (data[p + 1] ?? 0);
              if (hi === 0xc0 || hi === 0xd0) {
                label = 'program change ch' + ch + ' prog ' + b1;
                p += 1;
              } else {
                label = 'note on ch' + ch + ' ' + noteName(b1) + ' vel ' + b2;
                p += 2;
              }
              events.push({ delta, offset: p - (hi === 0xc0 || hi === 0xd0 ? 1 : 2), label });
            }
          }
          if (overrun) break;
        }
        tracks.push({ index: idx, offset: cstart, size: clen, events });
        idx += 1;
      }
      pos = cstart + clen;
    }
    if (tracks.length === 0 && trackCount > 0) {
      findings.push({ severity: 'warn', kind: 'chunk', detail: 'No MTrk chunks were found.' });
    }
  }
  if (findings.length === 0) {
    findings.push({
      severity: 'info',
      kind: 'ok',
      detail: 'The MIDI structure looks well-formed.',
    });
  }
  return { size, magicOk, format, trackCount, division, tracks, findings, tempoBpm };
}

const tool: FileToolModule = {
  meta,
  async run(input: FileRunInput): Promise<FileRunResult> {
    const options = resolveOptions(meta, input.options);
    const file = (input.files ?? [])[0];
    if (file === undefined)
      throw new ToolError(
        'Choose a MIDI file to inspect.',
        'Drop a .mid or .midi file onto the tool.',
      );
    if (file.size > MAX_BYTES)
      throw new ToolError('That MIDI file is too large.', 'Use a file under 128 MB.');
    const data = new Uint8Array(await file.arrayBuffer());
    const m = buildModel(data);
    const view = String(options.view ?? 'events');
    let headers: string[];
    let rows: string[][];
    if (view === 'summary') {
      headers = ['Property', 'Value'];
      rows = [
        ['File size', String(m.size) + ' B'],
        ['Magic', m.magicOk ? 'valid (MThd)' : 'INVALID'],
        ['Format', String(m.format)],
        ['Track count', String(m.trackCount)],
        ['Division (tick/quarter)', String(m.division)],
        ['Tracks parsed', String(m.tracks.length)],
        ['Tempo', m.tempoBpm > 0 ? String(m.tempoBpm) + ' bpm' : '-'],
      ];
    } else if (view === 'findings') {
      headers = ['Severity', 'Kind', 'Detail'];
      rows = m.findings.map((f) => [f.severity, f.kind, f.detail]);
      if (rows.length === 0) rows.push(['info', 'ok', 'No problems found.']);
    } else {
      headers = ['Track', 'Offset', 'Delta', 'Event'];
      rows = [];
      for (const tr of m.tracks) {
        for (const ev of tr.events) {
          rows.push([String(tr.index), String(ev.offset), String(ev.delta), ev.label]);
        }
      }
    }
    const report = { output: JSON.stringify({ headers, rows }), render: 'table' as const };
    const notes: string[] = [];
    notes.push(
      m.tracks.length +
        ' track chunk(s), ' +
        m.tracks.reduce((a, t) => a + t.events.length, 0) +
        ' event(s).',
    );
    return { outputs: [], report, notes, warnings: [] };
  },
};

export default tool;
