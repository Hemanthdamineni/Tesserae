import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const layout = readFileSync(resolve(process.cwd(), 'src/components/Layout.astro'), 'utf8');
const prepaintScript = layout.match(/<script is:inline>\s*([\s\S]*?)\s*<\/script>/)?.[1];

describe('Layout accent pre-paint', () => {
  it('applies a shared accent link when local storage has no saved choice', () => {
    expect(prepaintScript).toBeTruthy();
    const variables = new Map<string, string>();

    runInNewContext(prepaintScript!, {
      URLSearchParams,
      location: { search: '?accent=%23d4623f' },
      localStorage: { getItem: () => null },
      document: {
        documentElement: {
          style: { setProperty: (name: string, value: string) => variables.set(name, value) },
        },
      },
    });

    expect(variables.get('--lab-accent')).toBe('212 98 63');
  });
});
