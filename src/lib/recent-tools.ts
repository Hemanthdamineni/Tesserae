/**
 * "Recently used" tools, remembered in `localStorage` only.
 *
 * The home page reads the list to show a short row of shortcuts; every tool
 * page records itself. Nothing leaves the device, and a blocked or full store
 * simply means the row stays empty — it is never an error.
 */

/** The `localStorage` key the recent-tool list is kept under. */
export const RECENT_TOOLS_KEY = 'tb-recent-tools';

/** How many tools the row remembers (and renders). */
export const RECENT_TOOLS_LIMIT = 6;

export interface RecentTool {
  id: string;
  name: string;
  /** Site-relative link, including the deploy base, e.g. `/tools/base64`. */
  href: string;
}

const isRecentTool = (value: unknown): value is RecentTool => {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === 'string' &&
    entry.id.length > 0 &&
    typeof entry.name === 'string' &&
    entry.name.length > 0 &&
    typeof entry.href === 'string' &&
    entry.href.length > 0
  );
};

/**
 * Parse a stored list defensively: bad JSON, a non-array or malformed entries
 * yield an empty list (or drop just the bad entries), never a throw.
 */
export function parseRecentTools(raw: string | null): RecentTool[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const seen = new Set<string>();
  const out: RecentTool[] = [];
  for (const item of parsed) {
    if (!isRecentTool(item) || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push({ id: item.id, name: item.name, href: item.href });
    if (out.length === RECENT_TOOLS_LIMIT) break;
  }
  return out;
}

/** Move a tool to the front of the list, deduplicating by id and capping length. */
export function rememberTool(list: readonly RecentTool[], entry: RecentTool): RecentTool[] {
  return [entry, ...list.filter((tool) => tool.id !== entry.id)].slice(0, RECENT_TOOLS_LIMIT);
}

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = ReadableStorage & Pick<Storage, 'setItem'>;

/** Read the list from a store that may be missing or blocked. */
export function readRecentTools(storage: ReadableStorage | null | undefined): RecentTool[] {
  try {
    return parseRecentTools(storage?.getItem(RECENT_TOOLS_KEY) ?? null);
  } catch {
    return [];
  }
}

/** Record a visit and persist the updated list; returns what is now stored. */
export function recordRecentTool(
  storage: WritableStorage | null | undefined,
  entry: RecentTool,
): RecentTool[] {
  const next = rememberTool(readRecentTools(storage), entry);
  try {
    storage?.setItem(RECENT_TOOLS_KEY, JSON.stringify(next));
  } catch {
    /* a blocked or full store is not fatal — the tool still works */
  }
  return next;
}
