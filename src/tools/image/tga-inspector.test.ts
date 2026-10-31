import { describe, it, expect } from 'vitest';
import tool from './tga-inspector.tool';

const TGA_B64 =
  'AAAKAAAAAAAAAAAAQAAwABgghwAAAIcAAP+BAP8Ahf8A/4f/AACHAP//hgD/AAD/AP+H//8Ah////4cAAACHAAD/AAD/AIb/AP+H/wAAhwD//4cA/wCH//8Ah////4cAAACGAAD/AP//AIf/AP+H/wAAhwD//4cA/wCBAAD/hf//AIf///+HAAAAhQAA/4H//wCH/wD/h/8AAIcA//+HAP8AggAA/4T//wCH////hwAAAIQAAP+C//8Ah/8A/4f/AACHAP//hwD/AIMAAP+D//8Ah////4cAAACDAAD/g///AIf/AP+H/wAAhwD//4cA/wCEAAD/gv//AIf///+HAAAAggAA/4T//wCH/wD/h/8AAIcA//+HAP8AhQAA/4H//wCH////hwAAAIEAAP+F//8Ah/8A/4f/AACHAP//hwD/AIYAAP8A//8Ah////4cAAACBAAD/hf//AIf/AP+H/wAAhwD//4cA/wCGAAD/AP//AIf///+HAAAAAAAA/4b//wCH/wD/h/8AAIcA//+HAP8AhwAA/4f///+HAAAAh///AIf/AP+H/wAAhwD//4cA/wCHAAD/AAAAAIb///+HAAAAh///AIf/AP+H/wAAhwD//4cA/wCHAAD/AAAAAIb///+GAAAAAP///4f//wCH/wD/h/8AAIcA//+HAP8AhwAA/4EAAACF////hgAAAAD///+H//8Ah/8A/4f/AACHAP//hwD/AIcAAP+BAAAAhf///4UAAACB////h///AIf/AP+H/wAAhwD//4cA/wCHAAD/ggAAAIT///+FAAAAgf///4f//wCH/wD/h/8AAIcA//+HAP8AhwAA/4IAAACE////hQAAAIH///+H//8Ah/8A/4f/AACHAP//hwD/AIcAAP+CAAAAhP///4QAAACC////h///AIf/AP+H/wAAhwD//4cA/wCHAAD/gwAAAIP///+EAAAAgv///4f//wCH/wD/h/8AAIcA//+HAP8AhwAA/4MAAACD////hAAAAIL///+H//8Ah/8A/4f/AACHAP//hwD/AIcAAP+DAAAAg////4QAAACC////h///AIf/AP+H/wAAhwD//4cA/wCHAAD/gwAAAIP///+EAAAAgv///4f//wCH/wD/h/8AAIcA//+HAP8AhwAA/4MAAACD////hAAAAIL///+H//8Ah/8A/4f/AACHAP//hwD/AIcAAP+DAAAAg////4QAAACC////h///AIf/AP+H/wAAhwD//4cA/wCHAAD/gwAAAIP///+EAAAAgv///4f//wCH/wD/h/8AAIcA//+HAP8AhwAA/4MAAACD////hAAAAIL///+H//8Ah/8A/4f/AACHAP//hwD/AIcAAP+DAAAAg////4QAAACC////h///AIf/AP+H/wAAhwD//4cA/wCHAAD/gwAAAIP///+EAAAAgv///4f//wCH/wD/h/8AAIcA//+HAP8AhwAA/4MAAACD////hAAAAIL///+H//8Ah/8A/4f/AACHAP//hwD/AIcAAP+DAAAAg////4QAAACC////h///AIf/AP+H/wAAhwD//4cA/wCHAAD/gwAAAIP///+EAAAAgv///4f//wCH/wD/h/8AAIcA//+HAP8AhwAA/4MAAACD////hAAAAIL///+H//8Ah/8A/4f/AACHAP//hwD/AIcAAP+DAAAAg////4UAAACB////h///AIf/AP+H/wAAhwD//4cA/wCHAAD/ggAAAIT///+FAAAAgf///4f//wCH/wD/h/8AAIcA//+HAP8AhwAA/4IAAACE////hQAAAIH///+H//8Ah/8A/4f/AACHAP//hwD/AIcAAP+CAAAAhP///4YAAAAA////h///AIf/AP+H/wAAhwD//4cA/wCHAAD/gQAAAIX///8/AAD/ABj/ADD/AEj/AGD/AHj/AJD/AKj/AMD/ANj/APD/AP/3AP/fAP/HAP+vAP+XAP9/AP9nAP9PAP83AP8fAP8HEP8AKP8AQP8AWP8AcP8AiP8AoP8AuP8A0P8A6P8A//8A/+cA/88A/7cA/58A/4cA/28A/1cA/z8A/ycA/w8A/wAI/wAg/wA4/wBQ/wBo/wCA/wCY/wCw/wDI/wDg/wD47wD/1wD/vwD/pwD/jwD/dwD/XwD/RwD/LwD/FwD/PwAA/wAY/wAw/wBI/wBg/wB4/wCQ/wCo/wDA/wDY/wDw/wD/9wD/3wD/xwD/rwD/lwD/fwD/ZwD/TwD/NwD/HwD/BxD/ACj/AED/AFj/AHD/AIj/AKD/ALj/AND/AOj/AP//AP/nAP/PAP+3AP+fAP+HAP9vAP9XAP8/AP8nAP8PAP8ACP8AIP8AOP8AUP8AaP8AgP8AmP8AsP8AyP8A4P8A+O8A/9cA/78A/6cA/48A/3cA/18A/0cA/y8A/xcA/z8AAP8AGP8AMP8ASP8AYP8AeP8AkP8AqP8AwP8A2P8A8P8A//cA/98A/8cA/68A/5cA/38A/2cA/08A/zcA/x8A/wcQ/wAo/wBA/wBY/wBw/wCI/wCg/wC4/wDQ/wDo/wD//wD/5wD/zwD/twD/nwD/hwD/bwD/VwD/PwD/JwD/DwD/AAj/ACD/ADj/AFD/AGj/AID/AJj/ALD/AMj/AOD/APjvAP/XAP+/AP+nAP+PAP93AP9fAP9HAP8vAP8XAP8/AAD/ABj/ADD/AEj/AGD/AHj/AJD/AKj/AMD/ANj/APD/AP/3AP/fAP/HAP+vAP+XAP9/AP9nAP9PAP83AP8fAP8HEP8AKP8AQP8AWP8AcP8AiP8AoP8AuP8A0P8A6P8A//8A/+cA/88A/7cA/58A/4cA/28A/1cA/z8A/ycA/w8A/wAI/wAg/wA4/wBQ/wBo/wCA/wCY/wCw/wDI/wDg/wD47wD/1wD/vwD/pwD/jwD/dwD/XwD/RwD/LwD/FwD/PwAA/wAY/wAw/wBI/wBg/wB4/wCQ/wCo/wDA/wDY/wDw/wD/9wD/3wD/xwD/rwD/lwD/fwD/ZwD/TwD/NwD/HwD/BxD/ACj/AED/AFj/AHD/AIj/AKD/ALj/AND/AOj/AP//AP/nAP/PAP+3AP+fAP+HAP9vAP9XAP8/AP8nAP8PAP8ACP8AIP8AOP8AUP8AaP8AgP8AmP8AsP8AyP8A4P8A+O8A/9cA/78A/6cA/48A/3cA/18A/0cA/y8A/xcA/z8AAP8AGP8AMP8ASP8AYP8AeP8AkP8AqP8AwP8A2P8A8P8A//cA/98A/8cA/68A/5cA/38A/2cA/08A/zcA/x8A/wcQ/wAo/wBA/wBY/wBw/wCI/wCg/wC4/wDQ/wDo/wD//wD/5wD/zwD/twD/nwD/hwD/bwD/VwD/PwD/JwD/DwD/AAj/ACD/ADj/AFD/AGj/AID/AJj/ALD/AMj/AOD/APjvAP/XAP+/AP+nAP+PAP93AP9fAP9HAP8vAP8XAP8/AAD/ABj/ADD/AEj/AGD/AHj/AJD/AKj/AMD/ANj/APD/AP/3AP/fAP/HAP+vAP+XAP9/AP9nAP9PAP83AP8fAP8HEP8AKP8AQP8AWP8AcP8AiP8AoP8AuP8A0P8A6P8A//8A/+cA/88A/7cA/58A/4cA/28A/1cA/z8A/ycA/w8A/wAI/wAg/wA4/wBQ/wBo/wCA/wCY/wCw/wDI/wDg/wD47wD/1wD/vwD/pwD/jwD/dwD/XwD/RwD/LwD/FwD/hwAAAIMAAP+D//8Ah/8A/4f/AACHAP//hwD/AIQAAP+C//8Ah////4cAAACEAAD/gv//AIf/AP+H/wAAhwD//4cA/wCDAAD/g///AIf///+HAAAAhQAA/4H//wCH/wD/h/8AAIcA//+HAP8AggAA/4T//wCH////hwAAAIYAAP8A//8Ah/8A/4f/AACHAP//hwD/AIEAAP+F//8Ah////4cAAACHAAD/AAD/AIb/AP+H/wAAhwD//4cA/wCH//8Ah////wAAAAAAAAAAVFJVRVZJU0lPTi1YRklMRS4A';

const TGA_HEADER = {
  size: 3015,
  imgtype: 10,
  type_name: 'RLE truecolor',
  w: 64,
  h: 48,
  pixdepth: 24,
  origin: 2,
  alpha_bits: 0,
  data_offset: 18,
  footer: true,
};

const META = tool.meta;

function b64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function fileOf(bytes: Uint8Array, name = 'x.tga'): File {
  const copy = new Uint8Array(bytes);
  return new File([copy.buffer as ArrayBuffer], name, { type: 'image/tga' });
}

async function rowsOf(
  f: File,
  options: Record<string, string | number | boolean> = {},
): Promise<string[][]> {
  const r = await tool.run({ files: [f], options });
  const parsed = JSON.parse(r.report?.output ?? '{"rows":[]}');
  return (parsed.rows ?? []) as string[][];
}

describe('tga-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(META.privacy.processing).toBe('on-device');
    expect(META.privacy.network).toBe('none');
    expect(META.privacy.offline).toBe(true);
  });

  it('reads the header into the summary view', async () => {
    const rows = await rowsOf(fileOf(b64(TGA_B64), 'img.tga'));
    const m = new Map<string, string>(rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('Image type')).toBe(TGA_HEADER.type_name);
    expect(m.get('Width')).toBe(String(TGA_HEADER.w));
    expect(m.get('Height')).toBe(String(TGA_HEADER.h));
    expect(m.get('Pixel depth')).toBe(String(TGA_HEADER.pixdepth) + ' bit');
  });

  it('reports origin, alpha bits, and footer', async () => {
    const rows = await rowsOf(fileOf(b64(TGA_B64), 'img.tga'));
    const m = new Map<string, string>(rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('Origin')).toBe('top-left');
    expect(m.get('Alpha bits')).toBe(String(TGA_HEADER.alpha_bits));
    expect(m.get('TRUEVISION footer')).toBe(TGA_HEADER.footer ? 'present' : 'none');
  });

  it('decodes the header fields view', async () => {
    const rows = await rowsOf(fileOf(b64(TGA_B64), 'img.tga'), { view: 'header' });
    const h = new Map<string, string>(rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(h.get('Image type')).toBe(
      String(TGA_HEADER.imgtype) + ' (' + TGA_HEADER.type_name + ')',
    );
    expect(h.get('Color map type')).toBe('0');
    expect(h.get('Color map length')).toBe('0');
    expect(h.get('Data offset')).toBe(String(TGA_HEADER.data_offset));
    expect(h.get('TRUEVISION footer')).toBe(TGA_HEADER.footer ? 'present' : 'none');
  });

  it('flags a too-short file', async () => {
    const rows = await rowsOf(fileOf(new Uint8Array([1, 2, 3, 4]), 'bad.tga'), {
      view: 'findings',
    });
    expect(rows.some((r) => r[1] === 'header')).toBe(true);
  });

  it('throws a user-facing error when no file is given', async () => {
    await expect(tool.run({ files: [], options: {} })).rejects.toThrow(/TGA/);
  });
});
