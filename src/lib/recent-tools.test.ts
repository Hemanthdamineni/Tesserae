import { describe, expect, it } from 'vitest';
import {
  parseRecentTools,
  readRecentTools,
  recordRecentTool,
  rememberTool,
  RECENT_TOOLS_KEY,
  RECENT_TOOLS_LIMIT,
  type RecentTool,
} from './recent-tools';

const tool = (id: string): RecentTool => ({ id, name: id, href: `/tools/${id}` });

/** A tiny in-memory stand-in for `localStorage`. */
function fakeStorage(
  initial?: string | null,
  options: { failRead?: boolean; failWrite?: boolean } = {},
) {
  let value = initial ?? null;
  return {
    getItem: (key: string) => {
      if (options.failRead) throw new Error('blocked');
      return key === RECENT_TOOLS_KEY ? value : null;
    },
    setItem: (key: string, next: string) => {
      if (options.failWrite) throw new Error('full');
      if (key === RECENT_TOOLS_KEY) value = next;
    },
    snapshot: () => value,
  };
}

describe('recent tools', () => {
  it('returns an empty list for missing, malformed or non-array values', () => {
    expect(parseRecentTools(null)).toEqual([]);
    expect(parseRecentTools('')).toEqual([]);
    expect(parseRecentTools('not json')).toEqual([]);
    expect(parseRecentTools('{"id":"base64"}')).toEqual([]);
  });

  it('keeps well-formed entries and drops malformed ones', () => {
    const raw = JSON.stringify([
      tool('base64'),
      { id: 'broken' },
      { id: '', name: 'Empty', href: '/tools/empty' },
      tool('hash'),
    ]);
    expect(parseRecentTools(raw)).toEqual([tool('base64'), tool('hash')]);
  });

  it('caps stored history and removes duplicates', () => {
    const raw = JSON.stringify([...Array.from({ length: 9 }, (_, i) => tool(`t${i}`))]);
    expect(parseRecentTools(raw)).toHaveLength(RECENT_TOOLS_LIMIT);
    const duplicated = JSON.stringify([tool('base64'), tool('base64'), tool('hash')]);
    expect(parseRecentTools(duplicated)).toEqual([tool('base64'), tool('hash')]);
  });

  it('moves a repeated tool to the front and caps the list', () => {
    const list = [tool('base64'), tool('hash')];
    expect(rememberTool(list, tool('hash'))).toEqual([tool('hash'), tool('base64')]);
    const full = Array.from({ length: RECENT_TOOLS_LIMIT }, (_, i) => tool(`t${i}`));
    const next = rememberTool(full, tool('new'));
    expect(next).toHaveLength(RECENT_TOOLS_LIMIT);
    expect(next[0]).toEqual(tool('new'));
    expect(next.at(-1)?.id).toBe('t4');
  });

  it('records a visit and persists the updated list', () => {
    const storage = fakeStorage(JSON.stringify([tool('base64')]));
    const next = recordRecentTool(storage, tool('hash'));
    expect(next).toEqual([tool('hash'), tool('base64')]);
    expect(parseRecentTools(storage.snapshot())).toEqual(next);
  });

  it('survives a blocked store in both directions', () => {
    expect(readRecentTools(fakeStorage(null, { failRead: true }))).toEqual([]);
    const blocked = fakeStorage(null, { failWrite: true });
    expect(recordRecentTool(blocked, tool('base64'))).toEqual([tool('base64')]);
    expect(blocked.snapshot()).toBeNull();
    expect(readRecentTools(null)).toEqual([]);
  });
});
