import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToolError } from '@/lib/types';
import type { FileRunInput } from '@/lib/types';
import tool, { runWebcamRecorder } from './webcam-recorder.tool';
import { meta } from './webcam-recorder.meta';
import {
  DEFAULT_FILENAME_PREFIX,
  RECORDING_BITRATES,
  RECORDING_MIME_CANDIDATES,
  bitrateForQuality,
  buildRecordingFilename,
  cameraAccessError,
  containerForMimeType,
  describeCaptureError,
  describeRecorderError,
  emptyRecordingError,
  formatElapsed,
  formatTimestamp,
  insecureContextError,
  listCameras,
  mediaRecorderUnavailableError,
  noSupportedMimeTypeError,
  pickRecordingMimeType,
  recorderSupportError,
  requestCamera,
  sanitizeFilenamePrefix,
  startRecording,
  videoConstraintsForResolution,
  type RecorderFactory,
  type RecorderLike,
} from './webcam-recorder-core';

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** A probe that says "yes" to the given MIME types and "no" to the rest. */
const supports =
  (...supported: string[]) =>
  (mimeType: string): boolean =>
    supported.includes(mimeType);

/** A recorder that records what the browser would record. */
class FakeRecorder implements RecorderLike {
  mimeType: string;
  state: 'inactive' | 'recording' = 'inactive';
  // The browser hands over real `BlobEvent` / `ErrorEvent` objects; the fake
  // only needs the fields the recorder actually reads.
  ondataavailable: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onstop: ((event?: any) => void) | null = null;
  readonly chunks: Blob[] = [];
  startCalls = 0;
  stopCalls = 0;
  startError: string | null = null;

  constructor(readonly options: { mimeType?: string; videoBitsPerSecond?: number }) {
    this.mimeType = options.mimeType ?? '';
  }

  start(): void {
    this.startCalls += 1;
    if (this.startError) {
      throw Object.assign(new Error('nope'), { name: this.startError });
    }
    this.state = 'recording';
  }

  stop(): void {
    this.stopCalls += 1;
    this.state = 'inactive';
    this.onstop?.();
  }

  /** Hand over a chunk, the way the browser does. */
  push(text: string): void {
    const blob = new Blob([text], { type: this.mimeType });
    this.chunks.push(blob);
    this.ondataavailable?.({ data: blob });
  }

  /** Fire the recorder's `error` event. */
  fail(error: unknown): void {
    this.onerror?.({ error });
  }
}

interface FactoryOptions {
  /** The MIME types the browser supports; `null` means "no support check". */
  supported?: string[] | null;
  /** The error the constructor throws. */
  failConstruct?: string;
  /** The error `start()` throws. */
  failStart?: string;
}

function makeFactory(options: FactoryOptions = {}): {
  factory: RecorderFactory;
  created: FakeRecorder[];
} {
  const created: FakeRecorder[] = [];
  const support =
    options.supported === null ? null : (type: string) => (options.supported ?? []).includes(type);
  const factory: RecorderFactory = {
    isTypeSupported: support,
    create: (_stream, recorderOptions) => {
      if (options.failConstruct) {
        throw Object.assign(new Error('nope'), { name: options.failConstruct });
      }
      const recorder = new FakeRecorder(recorderOptions);
      recorder.startError = options.failStart ?? null;
      created.push(recorder);
      return recorder;
    },
  };
  return { factory, created };
}

const fakeStream = { id: 'fake-stream' } as unknown as MediaStream;

const recorded = (type = 'video/webm', bytes = 64): File =>
  new File([new Uint8Array(bytes)], 'recording.webm', { type });

/* -------------------------------------------------------------------------- */
/*  MIME type selection                                                        */
/* -------------------------------------------------------------------------- */

describe('pickRecordingMimeType', () => {
  it('prefers VP9 when the browser supports it', () => {
    expect(pickRecordingMimeType(supports('video/webm;codecs=vp9'))).toBe('video/webm;codecs=vp9');
  });

  it('falls back to VP8 when VP9 is missing', () => {
    expect(pickRecordingMimeType(supports('video/webm;codecs=vp8'))).toBe('video/webm;codecs=vp8');
  });

  it('falls back to the bare WebM container', () => {
    expect(pickRecordingMimeType(supports('video/webm'))).toBe('video/webm');
  });

  it('picks MP4 when the browser only supports MP4', () => {
    expect(pickRecordingMimeType(supports('video/mp4'))).toBe('video/mp4');
  });

  it('never picks MP4 while WebM is available', () => {
    expect(pickRecordingMimeType(supports('video/webm;codecs=vp9', 'video/mp4'))).toBe(
      'video/webm;codecs=vp9',
    );
  });

  it('asks the browser in preference order', () => {
    const asked: string[] = [];
    pickRecordingMimeType((type) => {
      asked.push(type);
      return false;
    });
    expect(asked).toEqual([...RECORDING_MIME_CANDIDATES]);
  });

  it('returns null when the browser supports nothing we know', () => {
    expect(pickRecordingMimeType(supports())).toBeNull();
  });

  it('falls back to the browser default when there is no support check', () => {
    expect(pickRecordingMimeType(null)).toBe('');
    expect(pickRecordingMimeType(undefined)).toBe('');
  });
});

describe('containerForMimeType', () => {
  it('recognises WebM', () => {
    expect(containerForMimeType('video/webm')).toBe('webm');
    expect(containerForMimeType('video/webm;codecs=vp9')).toBe('webm');
  });

  it('recognises MP4', () => {
    expect(containerForMimeType('video/mp4')).toBe('mp4');
    expect(containerForMimeType('video/mp4;codecs=avc1.42E01E')).toBe('mp4');
  });

  it('falls back to WebM for an unknown or missing type', () => {
    expect(containerForMimeType('video/x-matroska')).toBe('webm');
    expect(containerForMimeType('')).toBe('webm');
    expect(containerForMimeType(null)).toBe('webm');
    expect(containerForMimeType(undefined)).toBe('webm');
  });
});

/* -------------------------------------------------------------------------- */
/*  Filenames                                                                  */
/* -------------------------------------------------------------------------- */

describe('sanitizeFilenamePrefix', () => {
  it('keeps a normal name', () => {
    expect(sanitizeFilenamePrefix('my clip')).toBe('my clip');
  });

  it('strips path separators and characters Windows forbids', () => {
    expect(sanitizeFilenamePrefix('../../etc/passwd')).toBe('etc-passwd');
    expect(sanitizeFilenamePrefix('a:b*c?d"e<f>g|h')).toBe('a-b-c-d-e-f-g-h');
  });

  it('drops control characters and leading dots', () => {
    expect(sanitizeFilenamePrefix('a\u0000b\u001fc')).toBe('abc');
    expect(sanitizeFilenamePrefix('...hidden')).toBe('hidden');
  });

  it('falls back to the default prefix for an empty name', () => {
    expect(sanitizeFilenamePrefix('')).toBe(DEFAULT_FILENAME_PREFIX);
    expect(sanitizeFilenamePrefix('   ')).toBe(DEFAULT_FILENAME_PREFIX);
    expect(sanitizeFilenamePrefix(null)).toBe(DEFAULT_FILENAME_PREFIX);
    expect(sanitizeFilenamePrefix(undefined)).toBe(DEFAULT_FILENAME_PREFIX);
  });
});

describe('formatTimestamp and buildRecordingFilename', () => {
  it('writes the local date and time', () => {
    expect(formatTimestamp(new Date(2026, 9, 21, 17, 31, 5))).toBe('2026-10-21-17-31-05');
  });

  it('pads single digits', () => {
    expect(formatTimestamp(new Date(2026, 0, 2, 3, 4, 5))).toBe('2026-01-02-03-04-05');
  });

  it('names the download after the recording and its container', () => {
    const name = buildRecordingFilename('webm', new Date(2026, 9, 21, 17, 31, 5));
    expect(name).toBe('webcam-recording-2026-10-21-17-31-05.webm');
  });

  it('uses the MP4 extension for an MP4 recording', () => {
    const name = buildRecordingFilename('mp4', new Date(2026, 9, 21, 17, 31, 5));
    expect(name).toBe('webcam-recording-2026-10-21-17-31-05.mp4');
  });

  it('honours a custom prefix', () => {
    const name = buildRecordingFilename('webm', new Date(2026, 9, 21, 17, 31, 5), 'standup');
    expect(name).toBe('standup-2026-10-21-17-31-05.webm');
  });

  it('cleans a custom prefix up', () => {
    const name = buildRecordingFilename('webm', new Date(2026, 9, 21, 17, 31, 5), '../evil');
    expect(name).toBe('evil-2026-10-21-17-31-05.webm');
    expect(name).not.toContain('/');
  });
});

/* -------------------------------------------------------------------------- */
/*  Elapsed time                                                               */
/* -------------------------------------------------------------------------- */

describe('formatElapsed', () => {
  it('shows zero for no time at all', () => {
    expect(formatElapsed(0)).toBe('00:00');
    expect(formatElapsed(999)).toBe('00:00');
  });

  it('shows minutes and seconds', () => {
    expect(formatElapsed(1_000)).toBe('00:01');
    expect(formatElapsed(65_000)).toBe('01:05');
    expect(formatElapsed(599_000)).toBe('09:59');
  });

  it('adds hours for a long recording', () => {
    expect(formatElapsed(3_600_000)).toBe('1:00:00');
    expect(formatElapsed(3_723_000)).toBe('1:02:03');
  });

  it('never shows a negative or broken clock', () => {
    expect(formatElapsed(-5_000)).toBe('00:00');
    expect(formatElapsed(Number.NaN)).toBe('00:00');
    expect(formatElapsed(Number.POSITIVE_INFINITY)).toBe('00:00');
  });
});

/* -------------------------------------------------------------------------- */
/*  Quality                                                                    */
/* -------------------------------------------------------------------------- */

describe('bitrateForQuality', () => {
  it('maps every quality onto its bitrate', () => {
    expect(bitrateForQuality('small')).toBe(RECORDING_BITRATES.small);
    expect(bitrateForQuality('balanced')).toBe(RECORDING_BITRATES.balanced);
    expect(bitrateForQuality('high')).toBe(RECORDING_BITRATES.high);
  });

  it('falls back to the balanced bitrate for an unknown value', () => {
    expect(bitrateForQuality('ultra')).toBe(RECORDING_BITRATES.balanced);
    expect(bitrateForQuality('')).toBe(RECORDING_BITRATES.balanced);
    expect(bitrateForQuality(null)).toBe(RECORDING_BITRATES.balanced);
  });
});

/* -------------------------------------------------------------------------- */
/*  Resolutions                                                                 */
/* -------------------------------------------------------------------------- */

describe('videoConstraintsForResolution', () => {
  it('maps every preset onto its ideal size', () => {
    expect(videoConstraintsForResolution('1080')).toEqual({
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    });
    expect(videoConstraintsForResolution('720')).toEqual({
      width: { ideal: 1280 },
      height: { ideal: 720 },
    });
    expect(videoConstraintsForResolution('480')).toEqual({
      width: { ideal: 854 },
      height: { ideal: 480 },
    });
  });

  it('returns no constraint for auto and unknown values', () => {
    expect(videoConstraintsForResolution('auto')).toBeNull();
    expect(videoConstraintsForResolution('')).toBeNull();
    expect(videoConstraintsForResolution('2160')).toBeNull();
    expect(videoConstraintsForResolution(null)).toBeNull();
    expect(videoConstraintsForResolution(undefined)).toBeNull();
  });
});

describe('requestCamera', () => {
  /** A getUserMedia stub that records the constraints it was called with. */
  function captureStub(): {
    getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
    calls: MediaStreamConstraints[];
  } {
    const calls: MediaStreamConstraints[] = [];
    return {
      calls,
      getUserMedia: async (constraints) => {
        calls.push(constraints);
        return { id: 'stub' } as unknown as MediaStream;
      },
    };
  }

  it('asks for the chosen resolution', async () => {
    const devices = captureStub();
    await requestCamera(devices, { resolution: '1080' });
    expect(devices.calls[0]).toEqual({
      video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    });
  });

  it('falls back to a sane default resolution', async () => {
    const devices = captureStub();
    await requestCamera(devices, { resolution: 'auto' });
    expect(devices.calls[0]).toEqual({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
  });

  it('keeps the microphone off unless it is asked for', async () => {
    const devices = captureStub();
    await requestCamera(devices, { mic: false });
    expect(devices.calls[0]!.audio).toBe(false);
    await requestCamera(devices, { mic: true });
    expect(devices.calls[1]!.audio).toBe(true);
    await requestCamera(devices, {});
    expect(devices.calls[2]!.audio).toBe(false);
  });

  it('pins the camera by device id when one is chosen', async () => {
    const devices = captureStub();
    await requestCamera(devices, { deviceId: 'cam-2' });
    expect(devices.calls[0]!.video).toEqual({
      width: { ideal: 1280 },
      height: { ideal: 720 },
      deviceId: { exact: 'cam-2' },
    });
  });
});

describe('listCameras', () => {
  const camera = (id: string, label = ''): MediaDeviceInfo =>
    ({ kind: 'videoinput', deviceId: id, label }) as MediaDeviceInfo;

  it('returns only video inputs', async () => {
    const devices = {
      enumerateDevices: async () => [
        camera('a'),
        { kind: 'audioinput', deviceId: 'b', label: 'mic' } as MediaDeviceInfo,
        camera('c'),
      ],
    };
    const cameras = await listCameras(devices);
    expect(cameras.map((c) => c.deviceId)).toEqual(['a', 'c']);
  });

  it('returns an empty list without enumerateDevices', async () => {
    expect(await listCameras({ getUserMedia: async () => ({}) as MediaStream } as never)).toEqual(
      [],
    );
    expect(await listCameras(null)).toEqual([]);
    expect(await listCameras(undefined)).toEqual([]);
  });

  it('survives an enumerateDevices rejection', async () => {
    const devices = { enumerateDevices: async () => Promise.reject(new Error('nope')) };
    await expect(listCameras(devices)).resolves.toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/*  Errors                                                                     */
/* -------------------------------------------------------------------------- */

describe('describeCaptureError', () => {
  const cases: [string, RegExp][] = [
    ['NotAllowedError', /permission was denied/i],
    ['PermissionDeniedError', /permission was denied/i],
    ['NotFoundError', /no camera was found/i],
    ['DevicesNotFoundError', /no camera was found/i],
    ['NotReadableError', /already in use/i],
    ['TrackStartError', /already in use/i],
    ['OverconstrainedError', /does not support the requested settings/i],
    ['SecurityError', /blocked on this page/i],
    ['TypeError', /does not expose a camera API/i],
  ];

  it.each(cases)('maps %s onto a friendly message', (name, pattern) => {
    const error = describeCaptureError(Object.assign(new Error('raw'), { name }));
    expect(error).toBeInstanceOf(ToolError);
    expect(error.message).toMatch(pattern);
    expect(error.hint).toBeTruthy();
  });

  it('keeps the browser message for an unknown failure', () => {
    const error = describeCaptureError(
      Object.assign(new Error('Something odd'), { name: 'Weird' }),
    );
    expect(error.message).toBe('Something odd');
    expect(error.hint).toBeTruthy();
  });

  it('never returns an empty message', () => {
    expect(describeCaptureError(new Error('')).message).toMatch(/could not be started/i);
    expect(describeCaptureError(undefined).message).toMatch(/could not be started/i);
  });
});

describe('describeRecorderError', () => {
  const cases: [string, RegExp][] = [
    ['NotSupportedError', /cannot record the camera in a supported format/i],
    ['NotReadableError', /stopped delivering frames/i],
    ['SecurityError', /blocked on this page/i],
    ['AbortError', /interrupted/i],
    ['InvalidStateError', /wrong state/i],
    ['TypeError', /could not be recorded/i],
  ];

  it.each(cases)('maps %s onto a friendly message', (name, pattern) => {
    const error = describeRecorderError(Object.assign(new Error('raw'), { name }));
    expect(error).toBeInstanceOf(ToolError);
    expect(error.message).toMatch(pattern);
    expect(error.hint).toBeTruthy();
  });

  it('keeps the browser message for an unknown failure', () => {
    expect(describeRecorderError(new Error('codec exploded')).message).toBe('codec exploded');
  });
});

describe('the ready-made errors', () => {
  it('explains that a secure page is needed', () => {
    const error = insecureContextError();
    expect(error).toBeInstanceOf(ToolError);
    expect(error.message).toMatch(/cannot reach the camera/i);
    expect(error.hint).toMatch(/https:\/\//);
    expect(error.hint).toMatch(/localhost/i);
  });

  it('explains that MediaRecorder is missing', () => {
    const error = mediaRecorderUnavailableError();
    expect(error).toBeInstanceOf(ToolError);
    expect(error.message).toMatch(/cannot record video/i);
    expect(error.hint).toBeTruthy();
  });

  it('explains that no container is supported', () => {
    const error = noSupportedMimeTypeError();
    expect(error).toBeInstanceOf(ToolError);
    expect(error.message).toMatch(/cannot record the camera in a format we can save/i);
    expect(error.hint).toBeTruthy();
  });

  it('explains that the recording was empty', () => {
    const error = emptyRecordingError();
    expect(error).toBeInstanceOf(ToolError);
    expect(error.message).toMatch(/empty/i);
    expect(error.hint).toBeTruthy();
  });
});

describe('the browser API checks', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('accepts a page that can reach a camera', () => {
    expect(cameraAccessError({ getUserMedia: () => undefined })).toBeNull();
  });

  it('rejects a page without a camera API', () => {
    expect(cameraAccessError(undefined)).toBeInstanceOf(ToolError);
    expect(cameraAccessError(undefined)?.hint).toMatch(/https:\/\//);
    expect(cameraAccessError({})).toBeInstanceOf(ToolError);
  });

  it('sees that navigator.mediaDevices is missing', () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
    try {
      expect(cameraAccessError(navigator.mediaDevices)).toBeInstanceOf(ToolError);
    } finally {
      if (original) Object.defineProperty(navigator, 'mediaDevices', original);
    }
  });

  it('accepts a browser that can record', () => {
    vi.stubGlobal('MediaRecorder', class {});
    expect(
      recorderSupportError((globalThis as { MediaRecorder?: unknown }).MediaRecorder),
    ).toBeNull();
  });

  it('rejects a browser without MediaRecorder', () => {
    vi.stubGlobal('MediaRecorder', undefined);
    const error = recorderSupportError((globalThis as { MediaRecorder?: unknown }).MediaRecorder);
    expect(error).toBeInstanceOf(ToolError);
    expect(error?.message).toMatch(/cannot record video/i);
  });
});

/* -------------------------------------------------------------------------- */
/*  The recording session                                                      */
/* -------------------------------------------------------------------------- */

describe('startRecording', () => {
  it('collects the chunks and resolves with the recording', async () => {
    const { factory, created } = makeFactory({ supported: ['video/webm;codecs=vp9'] });
    const session = startRecording(fakeStream, factory, { timesliceMs: 1000 });

    const recorder = created[0]!;
    expect(recorder.options.mimeType).toBe('video/webm;codecs=vp9');
    expect(recorder.startCalls).toBe(1);
    expect(session.mimeType).toBe('video/webm;codecs=vp9');

    recorder.push('a');
    recorder.push('b');
    session.stop();

    const clip = await session.result();
    expect(clip.blob.size).toBe(2);
    expect(clip.blob.type).toBe('video/webm;codecs=vp9');
    expect(clip.mimeType).toBe('video/webm;codecs=vp9');
    expect(clip.container).toBe('webm');
    expect(clip.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('passes the target bitrate to the recorder', async () => {
    const { factory, created } = makeFactory({ supported: ['video/webm'] });
    const session = startRecording(fakeStream, factory, { videoBitsPerSecond: 2_500_000 });
    expect(created[0]?.options.videoBitsPerSecond).toBe(2_500_000);
    created[0]!.push('a');
    session.stop();
    await session.result();
  });

  it('reports the MIME type the browser actually used', async () => {
    const { factory, created } = makeFactory({ supported: ['video/webm;codecs=vp9'] });
    const session = startRecording(fakeStream, factory);
    const recorder = created[0]!;
    recorder.mimeType = 'video/mp4';
    recorder.push('a');
    session.stop();
    await expect(session.result()).resolves.toMatchObject({
      mimeType: 'video/mp4',
      container: 'mp4',
    });
  });

  it('uses the browser default when there is no support check', async () => {
    const { factory, created } = makeFactory({ supported: null });
    const session = startRecording(fakeStream, factory);
    expect(session.mimeType).toBe('');
    expect(created[0]?.options.mimeType).toBeUndefined();
    created[0]!.push('a');
    session.stop();
    await session.result();
  });

  it('throws a friendly error when no container is supported', () => {
    const { factory } = makeFactory({ supported: [] });
    expect(() => startRecording(fakeStream, factory)).toThrow(ToolError);
    expect(() => startRecording(fakeStream, factory)).toThrow(/cannot record the camera/i);
  });

  it('throws a friendly error when the recorder cannot be built', () => {
    const { factory } = makeFactory({
      supported: ['video/mp4'],
      failConstruct: 'NotSupportedError',
    });
    expect(() => startRecording(fakeStream, factory)).toThrow(/supported format/i);
  });

  it('throws a friendly error when the recorder refuses to start', () => {
    const { factory } = makeFactory({ supported: ['video/webm'], failStart: 'InvalidStateError' });
    expect(() => startRecording(fakeStream, factory)).toThrow(/wrong state/i);
  });

  it('rejects with a friendly error when the recorder fails mid-way', async () => {
    const { factory, created } = makeFactory({ supported: ['video/webm'] });
    const session = startRecording(fakeStream, factory);
    created[0]!.fail(Object.assign(new Error('raw'), { name: 'NotReadableError' }));
    await expect(session.result()).rejects.toThrow(/stopped delivering frames/i);
  });

  it('rejects with a friendly error when the user stops before any data', async () => {
    const { factory } = makeFactory({ supported: ['video/webm'] });
    const session = startRecording(fakeStream, factory);
    session.stop();
    await expect(session.result()).rejects.toThrow(/empty/i);
  });

  it('ignores empty chunks', async () => {
    const { factory, created } = makeFactory({ supported: ['video/webm'] });
    const session = startRecording(fakeStream, factory);
    const recorder = created[0]!;
    recorder.ondataavailable?.({ data: new Blob([], { type: 'video/webm' }) });
    recorder.push('a');
    session.stop();
    const clip = await session.result();
    expect(clip.blob.size).toBe(1);
  });

  it('stops only once', async () => {
    const { factory, created } = makeFactory({ supported: ['video/webm'] });
    const session = startRecording(fakeStream, factory);
    created[0]!.push('a');
    session.stop();
    session.stop();
    expect(created[0]?.stopCalls).toBe(1);
    const clip = await session.result();
    expect(clip.blob.size).toBe(1);
  });

  it('measures the duration with the injected clock', async () => {
    const { factory, created } = makeFactory({ supported: ['video/webm'] });
    let now = 1_000;
    const session = startRecording(fakeStream, factory, { now: () => now });
    created[0]!.push('a');
    now = 4_500;
    session.stop();
    const clip = await session.result();
    expect(clip.durationMs).toBe(3_500);
  });
});

/* -------------------------------------------------------------------------- */
/*  The tool                                                                   */
/* -------------------------------------------------------------------------- */

const run = (input: Partial<FileRunInput> = {}) =>
  runWebcamRecorder({
    files: [],
    options: {},
    ...input,
  } as FileRunInput);

describe('the webcam recorder tool', () => {
  it('exposes the metadata it was built with', () => {
    expect(tool.meta).toBe(meta);
    expect(tool.meta.id).toBe('webcam-recorder');
    expect(tool.meta.category).toBe('video');
    expect(tool.meta.panel).toBe('webcam-recorder');
    expect(tool.meta.input).toBe('file');
    expect(tool.meta.privacy.network).toBe('none');
    expect(meta.summary.length).toBeLessThanOrEqual(120);
  });

  it('packages a recording as a download', async () => {
    const file = recorded('video/webm;codecs=vp9', 128);
    const result = await run({ files: [file] });
    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]!.filename).toMatch(
      /^webcam-recording-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.webm$/,
    );
    expect(result.outputs[0]!.blob.size).toBe(128);
    expect(result.stats?.container).toBe('webm');
  });

  it('uses the MP4 extension for an MP4 recording', async () => {
    const result = await run({ files: [recorded('video/mp4', 128)] });
    expect(result.outputs[0]!.filename).toMatch(/\.mp4$/);
    expect(result.stats?.container).toBe('mp4');
  });

  it('uses the file name the user asked for', async () => {
    const result = await run({ files: [recorded()], options: { filename: 'standup' } });
    expect(result.outputs[0]!.filename).toMatch(/^standup-\d{4}-\d{2}-\d{2}/);
  });

  it('falls back to the default name for an empty file name', async () => {
    const result = await run({ files: [recorded()], options: { filename: '' } });
    expect(result.outputs[0]!.filename).toMatch(/^webcam-recording-/);
  });

  it('reports the quality in the stats and the notes', async () => {
    const result = await run({ files: [recorded()], options: { quality: 'high' } });
    expect(result.stats?.quality).toBe('high');
    expect(result.notes?.join(' ')).toMatch(/high/i);
  });

  it('reports whether the microphone was recorded', async () => {
    const withMic = await run({ files: [recorded()], options: { mic: true } });
    expect(withMic.notes?.join(' ')).toMatch(/microphone audio/i);
    const withoutMic = await run({ files: [recorded()], options: { mic: false } });
    expect(withoutMic.notes?.join(' ')).toMatch(/without audio/i);
  });

  it('refuses to run without a recording', async () => {
    await expect(run({ files: [] })).rejects.toThrow(ToolError);
    await expect(run({ files: [] })).rejects.toThrow(/record a clip first/i);
  });

  it('refuses an empty recording', async () => {
    const empty = new File([], 'recording.webm', { type: 'video/webm' });
    await expect(run({ files: [empty] })).rejects.toThrow(/empty/i);
  });

  it('refuses more than one recording', async () => {
    await expect(run({ files: [recorded(), recorded()] })).rejects.toThrow(
      /one recording at a time/i,
    );
  });

  it('works when the options are omitted entirely', async () => {
    const result = await runWebcamRecorder({
      files: [recorded()],
    } as unknown as FileRunInput);
    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]!.filename).toMatch(/^webcam-recording-/);
  });
});
