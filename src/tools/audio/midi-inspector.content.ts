/**
 * Editorial content for the midi-inspector tool page.
 *
 * Kept out of `midi-inspector.meta.ts` so the eager client registry never
 * ships this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What it does',
      body: 'Drop in a Standard MIDI File (.mid or .midi) and the inspector verifies the MThd and MTrk chunks, reads the SMF format (0 or 1), the track count, and the division (ticks per quarter note), then walks every track chunk reporting each event with its delta time, message type (note on/off, control change, program change), and channel, and decodes the meta events (tempo, time and key signatures, track name, end of track). It also translates note numbers to names and decodes the variable-length quantities used for delta times.',
    },
    {
      heading: 'SMF format and division',
      body: 'A Standard MIDI File starts with an MThd chunk describing the overall sequence: the format, the number of tracks, and the division, which says how many ticks make up a quarter note. Format 0 stores everything in a single track, while format 1 uses multiple simultaneous tracks, and each track is an MTrk chunk of events and meta events. The division, in ticks per quarter note, is how timing in the file maps to real time.',
    },
    {
      heading: 'Events and meta events',
      body: 'Track events carry the musical content: note on and note off with pitch, velocity, and channel, plus control change, program change, and other channel messages. Meta events carry the non-note information, such as tempo (shown in microseconds per quarter note and as BPM), the time signature, the key signature, the track name, and the end-of-track marker that closes each track. Delta times say how many ticks after the previous event each new event happens.',
    },
    {
      heading: 'What it flags',
      body: 'The tool catches malformed files: a bad MThd magic, a truncated header or chunk, an event that overruns its track, and an unexpected running-status byte. Because running status lets a message omit a repeated status, a stray one can mean the track bytes are out of order, so flagging it helps before your DAW chokes on the file. Everything runs on-device.',
    },
  ],
  faq: [
    {
      q: 'What are format 0 and format 1 MIDI files?',
      a: 'Format 0 stores the whole sequence as one track, while format 1 splits it across multiple simultaneous tracks, typically one per instrument, plus a conductor track for tempo and time signature. The inspector reads the format from the MThd header and shows the track count, so you know which kind you are looking at.',
    },
    {
      q: 'What does "ticks per quarter note" mean?',
      a: 'The division, stored in the MThd chunk, says how many timing ticks equal one quarter note. Combined with the tempo, which says microseconds per quarter note, it turns the delta times between events into a real duration, and the tool shows the tempo in BPM as well.',
    },
    {
      q: 'Why are note numbers translated to names?',
      a: 'MIDI stores pitch as a number, where middle C is 60, and the inspector maps that to a readable note name so you can tell at a glance which note an event plays. Everything runs on-device and the file is never uploaded.',
    },
  ],
} as const;
