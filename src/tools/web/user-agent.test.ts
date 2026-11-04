import { describe, it, expect } from 'vitest';
import tool from './user-agent.tool';
import { ToolError } from '@/lib/types';

type Result = { output: string };

const run = async (text: string) => (await tool.run({ text, options: {} })) as Result;

const rows = (r: Result) => (JSON.parse(r.output) as { rows: string[][] }).rows;
const value = (r: Result, field: string) => rows(r).find((row) => row[0] === field)![1];

describe('user-agent', async () => {
  const CHROME_WIN =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  it('parses the spec Chrome-on-Windows known answer', async () => {
    const r = await run(CHROME_WIN);
    expect(value(r, 'Browser')).toBe('Chrome');
    expect(value(r, 'OS')).toBe('Windows');
    expect(value(r, 'OS version')).toBe('10');
    expect(value(r, 'Engine')).toBe('Blink');
    expect(value(r, 'Device type')).toBe('desktop');
    expect(value(r, 'Is bot')).toBe('No');
  });

  it('flags curl as a bot with browser curl', async () => {
    const r = await run('curl/8.4.0');
    expect(value(r, 'Is bot')).toBe('Yes');
    expect(value(r, 'Browser')).toBe('cURL');
  });

  it('detects Firefox + macOS with OS version from underscores', async () => {
    const r = await run(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Gecko/20100101 Firefox/121.0',
    );
    expect(value(r, 'Browser')).toBe('Firefox');
    expect(value(r, 'OS')).toBe('macOS');
    expect(value(r, 'OS version')).toBe('10.15.7');
    expect(value(r, 'Engine')).toBe('Gecko');
  });

  it('treats Edge explicitly rather than as Chrome', async () => {
    const r = await run(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.2210.121',
    );
    expect(value(r, 'Browser')).toBe('Edge');
    expect(value(r, 'Is bot')).toBe('No');
  });

  it('detects Googlebot as a bot', async () => {
    const r = await run('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)');
    expect(value(r, 'Is bot')).toBe('Yes');
    expect(value(r, 'Device type')).toBe('bot');
  });

  it('detects Android mobile with version', async () => {
    const r = await run(
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36',
    );
    expect(value(r, 'OS')).toBe('Android');
    expect(value(r, 'OS version')).toBe('13');
    expect(value(r, 'Device type')).toBe('mobile');
    expect(value(r, 'Browser')).toBe('Chrome');
  });

  it('detects iPhone Safari as iOS tablet/mobile', async () => {
    const r = await run(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    );
    expect(value(r, 'OS')).toBe('iOS');
    expect(value(r, 'OS version')).toBe('16.6');
  });

  it('throws ToolError on empty input', async () => {
    await expect(run('')).rejects.toThrow(ToolError);
    await expect(run(' ')).rejects.toThrow(/Paste a User-Agent string/);
  });
});
