import { describe, it, expect } from 'vitest';
import tool from './whois-inspector.tool';

const RECORD = [
  'Domain Name: EXAMPLE.COM',
  'Registry Domain ID: 233254_DOMAIN_COM-VRSN',
  'Registrar WHOIS Server: whois.registrar.example',
  'Registrar URL: https://registrar.example',
  'Updated Date: 2026-01-01T00:00:00Z',
  'Creation Date: 2000-01-01T05:00:00Z',
  'Registry Expiry Date: 2027-01-01T05:00:00Z',
  'Registrar: Example Registrar LLC',
  'Registrar IANA ID: 123',
  'Name Server: NS1.EXAMPLE.COM',
  'Name Server: NS2.EXAMPLE.COM',
  'Status: clientDeleteProhibited',
  'Status: serverTransferProhibited',
  'Registrant Org: Example Org LLC',
].join('\n');

function rowsOf(t: ReturnType<typeof tool.run>): { headers: string[]; rows: string[][] } {
  const out = (t as { output?: string }).output ?? '{"rows":[]}';
  return JSON.parse(out) as { headers: string[]; rows: string[][] };
}

function summaryOf(t: ReturnType<typeof tool.run>): Map<string, string> {
  return new Map<string, string>(rowsOf(t).rows.map((r) => [r[0] ?? '', r[1] ?? '']));
}

describe('whois-inspector', () => {
  it('declares on-device privacy and no network', () => {
    expect(tool.meta.privacy.processing).toBe('on-device');
    expect(tool.meta.privacy.network).toBe('none');
    expect(tool.meta.privacy.offline).toBe(true);
  });

  it('rejects empty input synchronously', () => {
    expect(() => tool.run({ text: '', options: {} })).toThrow(/WHOIS/i);
    expect(() => tool.run({ text: '   \n ', options: {} })).toThrow(/WHOIS/i);
  });

  it('summarises a standard record', () => {
    const s = summaryOf(tool.run({ text: RECORD, options: { format: 'summary' } }));
    expect(s.get('Domain name')).toBe('EXAMPLE.COM');
    expect(s.get('Registrar')).toBe('Example Registrar LLC');
    expect(s.get('Creation date')).toBe('2000-01-01T05:00:00Z');
    expect(s.get('Expiry date')).toBe('2027-01-01T05:00:00Z');
    expect(s.get('Name servers')).toBe('2');
    expect(s.get('Statuses')).toBe('clientDeleteProhibited, serverTransferProhibited');
    expect(s.get('Registrant org')).toBe('Example Org LLC');
    expect(s.get('Field lines')).toBe('14');
    expect(s.get('Repeated fields')).toBe('2');
    expect(s.get('Issues')).toBe('0');
  });

  it('defaults to the summary view', () => {
    const s = summaryOf(tool.run({ text: RECORD, options: {} }));
    expect(s.get('Domain name')).toBe('EXAMPLE.COM');
  });

  it('lists every field in record view, in order, with repeats marked', () => {
    const rows = rowsOf(tool.run({ text: RECORD, options: { format: 'record' } })).rows;
    expect(rows).toHaveLength(14);
    expect(rows[0]).toEqual(['1', 'Domain Name', 'EXAMPLE.COM']);
    expect(rows[9]).toEqual(['10', 'Name Server (×2)', 'NS1.EXAMPLE.COM']);
    expect(rows[11]).toEqual(['12', 'Status (×2)', 'clientDeleteProhibited']);
    expect(rows[13]).toEqual(['14', 'Registrant Org', 'Example Org LLC']);
  });

  it('flags missing registrar, missing creation date, and unknown fields', () => {
    const text = [
      'Domain Name: MISSING.COM',
      'Status: clientTransferProhibited',
      '',
      'Random junk line',
      'X-Custom: something',
    ].join('\n');
    const rows = rowsOf(tool.run({ text, options: { format: 'issues' } })).rows;
    expect(rows).toContainEqual(['Record', 'Record has no creation date.']);
    expect(rows).toContainEqual(['Record', 'Record has no registrar.']);
    expect(rows).toContainEqual(['Line 4', 'Line has no "field: value" form.']);
    expect(rows).toContainEqual(['Line 5', 'Unknown field name "X-Custom".']);
    expect(rows).toHaveLength(4);
  });

  it('flags a no-match response', () => {
    const rows = rowsOf(
      tool.run({ text: 'No match found for this domain.', options: { format: 'issues' } }),
    ).rows;
    expect(rows).toContainEqual(['Record', 'Record reports no match / not found.']);
    expect(rows).toContainEqual(['Record', 'Record has no domain name.']);
  });

  it('ignores blank and comment lines', () => {
    const text = ['% Example registrar record', RECORD, '  ', '# trailing comment'].join('\n');
    const s = summaryOf(tool.run({ text, options: { format: 'summary' } }));
    expect(s.get('Field lines')).toBe('14');
    expect(s.get('Issues')).toBe('0');
  });

  it('reports missing pieces in the summary', () => {
    const s = summaryOf(
      tool.run({ text: 'Domain Name: BARE.COM', options: { format: 'summary' } }),
    );
    expect(s.get('Domain name')).toBe('BARE.COM');
    expect(s.get('Registrar')).toBe('(missing)');
    expect(s.get('Creation date')).toBe('(missing)');
    expect(s.get('Expiry date')).toBe('(missing)');
    expect(s.get('Name servers')).toBe('0');
    expect(s.get('Statuses')).toBe('(none)');
    expect(s.get('Issues')).toBe('2');
  });

  it('keeps the WHOIS meta id and options', () => {
    expect(tool.meta.id).toBe('whois-inspector');
    const opt = tool.meta.options?.[0] as { choices?: { value: string }[] } | undefined;
    expect(opt?.choices?.map((c) => c.value)).toEqual(['summary', 'record', 'issues']);
  });
});

describe('whois-inspector records', () => {
  it('handles CRLF line endings', () => {
    const text = RECORD.replace(/\n/g, '\r\n');
    const s = summaryOf(tool.run({ text, options: {} }));
    expect(s.get('Field lines')).toBe('14');
    expect(s.get('Issues')).toBe('0');
  });
});
