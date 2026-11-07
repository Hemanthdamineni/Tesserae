import { describe, it, expect } from 'vitest';
import tool from './ical-event.tool';

const run = (text: string, options: Record<string, string | number | boolean> = {}) =>
  (tool.run({ text, options }) as { output: string }).output;

describe('ical-event', () => {
  it('builds a basic event', () => {
    const out = run('', {
      summary: 'Launch',
      startDateTime: '2024-06-01 09:00',
      endDateTime: '2024-06-01 10:00',
    });
    expect(out).toContain('SUMMARY:Launch');
    expect(out).toContain('BEGIN:VEVENT');
    expect(out).toContain('DTSTART:20240601T');
    expect(out).toContain('END:VCALENDAR');
  });

  it('all-day events use VALUE=DATE', () => {
    const out = run('', {
      summary: 'Conf',
      startDateTime: '2024-06-01 00:00',
      endDateTime: '2024-06-01 23:59',
      allDay: true,
    });
    expect(out).toContain('DTSTART;VALUE=DATE:20240601');
    expect(out).not.toContain('DTSTART:20');
  });

  it('reminder produces a VALARM with TRIGGER:-PT15M', () => {
    const out = run('', {
      summary: 'X',
      startDateTime: '2024-06-01 09:00',
      endDateTime: '2024-06-01 10:00',
      reminderMinutes: 15,
    });
    expect(out).toContain('TRIGGER:-PT15M');
    expect(out).toContain('BEGIN:VALARM');
  });

  it('commas and semicolons are escaped in text fields', () => {
    const out = run('', { summary: 'Meet, eat; sleep', startDateTime: '2024-06-01 09:00' });
    expect(out).toContain('SUMMARY:Meet\\, eat\\; sleep');
  });

  it('end before start throws', () => {
    expect(() =>
      run('', { summary: 'X', startDateTime: '2024-06-02 09:00', endDateTime: '2024-06-01 09:00' }),
    ).toThrow(/before the start/);
  });

  it('invalid start date throws', () => {
    expect(() => run('', { summary: 'X', startDateTime: 'sometime' })).toThrow(/valid start/);
  });

  it('no title or description throws', () => {
    expect(() => run('', { startDateTime: '2024-06-01 09:00' })).toThrow(/at least an event title/);
  });

  it('UID is unique across runs', () => {
    const a = run('', { summary: 'A', startDateTime: '2024-06-01 09:00' }).match(
      /UID:(.+)@tesserae/,
    )?.[1];
    const b = run('', { summary: 'A', startDateTime: '2024-06-01 09:00' }).match(
      /UID:(.+)@tesserae/,
    )?.[1];
    expect(a).toMatch(/^[0-9a-f]{24}$/);
    expect(a).not.toBe(b);
  });
});
