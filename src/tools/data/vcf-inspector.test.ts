import { describe, it, expect } from 'vitest';
import tool from './vcf-inspector.tool';

const VCF_B64 =
  'QkVHSU46VkNBUkQKVkVSU0lPTjozLjAKTjpEb2U7Sm9objs7OwpGTjpKb2huIERvZQpURUw7VFlQ' +
  'RT1DRUxMOisxLTU1NS0wMTAwCkVNQUlMO1RZUEU9SU5URVJORVQ6am9obi5kb2VAZXhhbXBsZS5j' +
  'b20KQURSO1RZUEU9SE9NRTo7OzEyMyBNYWluIFN0O1NwcmluZ2ZpZWxkO0lMOzYyNzA0O1VTQQpV' +
  'SUQ6dXJuOnV1aWQ6MTIzNC01Njc4CkVORDpWQ0FSRA==';

const VCF_TEXT = atob(VCF_B64);

const ORACLE = { cards: 1, fields: 7, fn: 'John Doe', tel: '+1-555-0100' };

function rowsOf(t: ReturnType<typeof tool.run>): { headers: string[]; rows: string[][] } {
  const out = (t as { output?: string }).output ?? '{"rows":[]}';
  return JSON.parse(out) as { headers: string[]; rows: string[][] };
}

describe('vcf-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects empty input synchronously', () => {
    expect(() => tool.run({ text: '', options: {} })).toThrow(/contact/i);
  });

  it('reads the summary', () => {
    const t = rowsOf(tool.run({ text: VCF_TEXT, options: {} }));
    const m = new Map<string, string>(t.rows.map((r) => [r[0] ?? '', r[1] ?? '']));
    expect(m.get('Format')).toBe('vCard (VCF)');
    expect(m.get('Cards')).toBe(String(ORACLE.cards));
    expect(m.get('Fields')).toBe(String(ORACLE.fields));
    expect(m.get('Issues')).toBe('0');
  });

  it('lists the cards', () => {
    const t = rowsOf(tool.run({ text: VCF_TEXT, options: { format: 'cards' } }));
    expect(t.rows).toHaveLength(ORACLE.cards);
    expect(t.rows[0]?.[1]).toBe(ORACLE.fn);
    expect(t.rows[0]?.[2]).toBe(ORACLE.tel);
  });

  it('flags a missing FN and a missing VERSION', () => {
    const bad = 'BEGIN:VCARD\nN:Doe;Jane;;;\nEND:VCARD\n';
    const t = rowsOf(tool.run({ text: bad, options: { format: 'issues' } }));
    const flat = t.rows.map((r) => r[0] ?? '').join('\n');
    expect(flat).toMatch(/VERSION/i);
    expect(flat).toMatch(/FN/i);
  });
});
