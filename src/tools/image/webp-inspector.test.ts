import { describe, it, expect } from 'vitest';
import tool from './webp-inspector.tool';

const WEBP_B64 =
  'UklGRlgEAABXRUJQVlA4WAoAAAASAAAAHwAAHwAAQU5JTQYAAAD/////AQBBTk1GEgIAAAAAAAAAAB8AAB8AAPoAAABWUDgg+gEAALAMAJ0BKiAAIAA+kTyaSCWjoqEoDVCwEglsAJ0zWjmfgH4zfsBxgXcDJA+QL6j+Tv9g3gD+jfkBwAP079ePpAPMA/oHsAfqT00XsOfsb+zPs9XaV9AYqBN5fH1mcl+bpOzhoA5kf3fq96V3ejgAAP7+oJ8AXc/zgjaBg+CKl6wv9jBJ9mbfGgunuvf+p1j88TXU0jxG58pBxW+VuHkKKrPw0cLROYZhJkqkWEuqTSSlzy3AHkcKVAffm8tVd/z/Ea//pEnsHlojzhvPUWWap6lgc3fScIH2yukv/NcFB1gplQbdBa1KZsLVv8USBYhzZXxpIInfKecPgPP6rNm0BbyVlB2xhhqNp78JWz8MlsEkLobt0P0rGYhJjt0cVuBtieWiP2V/1cx8iSvjZ25F46a+bwm6MX/tOm+eW5+kV8f+P8nf4EL/51NJAJ7rWVSPucn/i4TcQYuPutsHb8OLurnLOps7bowEnk7i/lk+vW+ixCwlDH/+DsZoUGlGDSevQ3hbSrm6RApfZfixeDSY+ZB4yMjzCOdpQ04L0MBZcoqiKb0NC/9vfH/vv5qFkN1yMSBVTPqUq4D8/e0d9kvIqst+jf+aFd4D5qgBye9Qbr1TToJP5jMvSVSmWdIkBn/8qoFsol//zAot3xQgPf52+xzzI3fM2k5EQAAAQU5NRhICAAAAAAAAAAAfAAAfAAD6AAAAVlA4IPoBAABQDQCdASogACAAPpE8mkglo6KhKA1QsBIJbACdM1o5n41+Kv7AcYEYBdFP0T8kv7BunO6A/U/9gPe63QD+q+wB+nPsAfqB6TPsNfs9+wHs9XaV9NnQClQJu745czLdZjcJsDMPsPvRRyA4HPy8jXauXGoAAP7+oKZvBvIU/VzlWxNYyzF+8hgw47gbdvxq5Ld5JYHKIUveTYBSBEnVR8kK5kCQob57Xr1xevZt5ZK4pKtyaBtPPLbduR2yY6H6z9om5n+VfN63fRMPdz8DmU/HsnQOmyQm5bhKqww/PSX2hOcdYaFsCdClLl7tL46XccharJdLs88qxLKvmRoG06HFtNu1fjSPnanlwBbRwipfhkxU+UxnO+6GqPwPRXbMQrjVHcnVp9/ZdfVziFKmTgyQgWe4Q1MMKMoT/l+AVtOW9kwi/8f5NcZhvcwzVVpx/uGIBflY+fV3dF9qmkf4U6/YES8aiMPIJ84+FeEvwXv3O6nXQ9//izDLFizDF9FXi/hSf0Y+4yd6qlgt6R1Oc9Eh5B+L+X/RUqPiwI9mi8fDoS9URTehoX/t74/99/MmQbJ/8T0nlMogZbcv5jy2tjLDI5yRSiNjzWmiJNpxXojzB6tO4/g//lyJ7KF1UPFTQ3Ht0eMVdpJZ+efztbJ06pfEx56MG2oqw1lAAA==';

// [offset, id, size, detail] from the Python oracle RIFF walker.
const WEBP_ORACLE: [number, string, number, string][] = [
  [12, 'VP8X', 10, 'flags=[alpha,animation] 32x32'],
  [30, 'ANIM', 6, 'bg=4294967295 loop=1'],
  [44, 'ANMF', 530, 'frame'],
  [582, 'ANMF', 530, 'frame'],
];

const WEBP_HEADER = { riff: 'RIFF', form: 'WEBP', size: 1120, chunks: 4 };

const META = tool.meta;

function b64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function fileOf(bytes: Uint8Array, name = 'x.webp'): File {
  const copy = new Uint8Array(bytes);
  return new File([copy.buffer as ArrayBuffer], name, { type: 'image/webp' });
}

async function rowsOf(
  f: File,
  options: Record<string, string | number | boolean> = {},
): Promise<string[][]> {
  const r = await tool.run({ files: [f], options });
  const parsed = JSON.parse(r.report?.output ?? '{"rows":[]}');
  return (parsed.rows ?? []) as string[][];
}

describe('webp-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(META.privacy.processing).toBe('on-device');
    expect(META.privacy.network).toBe('none');
    expect(META.privacy.offline).toBe(true);
  });

  it('matches the Python-oracle RIFF chunk tree of the animated WebP', async () => {
    const rows = await rowsOf(fileOf(b64(WEBP_B64), 'anim.webp'));
    const got = rows.map((r) => [Number(r[0]), r[1] ?? '', Number(r[2]), r[3] ?? '']);
    expect(got).toEqual(WEBP_ORACLE);
  });

  it('reads the header into the summary view', async () => {
    const rows = await rowsOf(fileOf(b64(WEBP_B64), 'anim.webp'), { view: 'summary' });
    const m = new Map<string, string>(rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('RIFF header')).toBe('valid');
    expect(m.get('Form type')).toBe(WEBP_HEADER.form);
    expect(m.get('Canvas')).toBe(WEBP_ORACLE[0] ? '32 x 32' : '');
    expect(m.get('Chunks')).toBe(String(WEBP_HEADER.chunks));
    expect(m.get('Animation frames')).toBe('2');
    expect(m.get('Animation loop')).toBe('1');
  });

  it('decodes the VP8X extended header and ANIM metadata', async () => {
    const rows = await rowsOf(fileOf(b64(WEBP_B64), 'anim.webp'));
    const vp8x = rows.find((r) => r[1] === 'VP8X');
    expect(vp8x?.[3]).toContain('32x32');
    expect(vp8x?.[3]).toContain('alpha');
    expect(vp8x?.[3]).toContain('animation');
    const anim = rows.find((r) => r[1] === 'ANIM');
    expect(anim?.[3]).toContain('loop=1');
  });

  it('flags a bad RIFF/WEBP signature', async () => {
    const rows = await rowsOf(
      fileOf(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), 'bad.webp'),
      { view: 'findings' },
    );
    expect(rows.some((r) => r[1] === 'magic')).toBe(true);
  });

  it('flags a truncated WebP with an overrunning chunk', async () => {
    const bytes = b64(WEBP_B64);
    const cut = new Uint8Array(bytes.subarray(0, 25));
    const rows = await rowsOf(fileOf(cut, 'cut.webp'), { view: 'findings' });
    expect(rows.some((r) => r[1] === 'overrun')).toBe(true);
  });

  it('throws a user-facing error when no file is given', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/WebP/);
  });
});
