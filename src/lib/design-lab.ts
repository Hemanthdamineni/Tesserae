/**
 * Design Lab — dev-only accent picker. The person building the site can try
 * any third colour against the charcoal + sand base; a pick is written into
 * the `--lab-accent*` override variables the stylesheet reads with stock
 * fallbacks, so the whole site restyles instantly.
 *
 * The choice persists in localStorage (`tb-lab`) and can be shared as
 * `?accent=%23d4623f`. The canonical token derivation lives here so the lab
 * panel and any future tooling share one source of truth.
 */

export interface AccentCandidate {
  hex: string;
  name: string;
}

/**
 * Curated third-colour candidates that read well on charcoal + sand. The free
 * colour picker is not limited to this list — this grid just anchors taste.
 */
export const ACCENT_CANDIDATES: AccentCandidate[] = [
  { hex: '#b3422a', name: 'Rust' },
  { hex: '#d4623f', name: 'Terracotta' },
  { hex: '#c78d2e', name: 'Ochre' },
  { hex: '#8a6a1f', name: 'Mustard' },
  { hex: '#6e7f3c', name: 'Moss' },
  { hex: '#2f6b4f', name: 'Forest' },
  { hex: '#1e7a73', name: 'Teal' },
  { hex: '#31589e', name: 'Indigo' },
  { hex: '#3e5770', name: 'Slate' },
  { hex: '#7a3e63', name: 'Plum' },
  { hex: '#8e2a3b', name: 'Wine' },
  { hex: '#d06a38', name: 'Clay' },
  // Owner shortlist for the final accent (T-0050); Moss/Indigo already above.
  { hex: '#613583', name: 'Violet' },
  { hex: '#e5a50a', name: 'Amber' },
  { hex: '#26a269', name: 'Emerald' },
  { hex: '#1a5fb4', name: 'Blue' },
  { hex: '#63452c', name: 'Umber' },
];

/** Stock theme accent (umber) — what "Reset" puts back. */
export const STOCK_ACCENT = '#63452c';

export interface LabChoice {
  accent?: string;
}

const STORAGE_KEY = 'tb-lab';

export function loadLab(storage: { getItem(k: string): string | null } = localStorage): LabChoice {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { accent?: unknown };
    const accent = typeof parsed.accent === 'string' ? normalizeHex(parsed.accent) : undefined;
    return accent ? { accent } : {};
  } catch {
    return {};
  }
}

export function saveLab(choice: LabChoice, storage: { setItem(k: string, v: string): void } = localStorage): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(choice));
  } catch {
    /* private mode — live with a temp pick */
  }
}

/* ------------------------------------------------------------------ */
/* Colour helpers                                                      */
/* ------------------------------------------------------------------ */

export function normalizeHex(hex: string): string | undefined {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m?.[1]) return undefined;
  let h = m[1].toLowerCase();
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  return `#${h}`;
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = normalizeHex(hex) ?? STOCK_ACCENT;
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

export function relLum([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(a: [number, number, number], b: [number, number, number]): number {
  const l1 = relLum(a);
  const l2 = relLum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function mix([r, g, b]: [number, number, number], withRgb: [number, number, number], amount: number): [number, number, number] {
  return [
    Math.round(r + (withRgb[0] - r) * amount),
    Math.round(g + (withRgb[1] - g) * amount),
    Math.round(b + (withRgb[2] - b) * amount),
  ];
}

function toCss([r, g, b]: [number, number, number]): string {
  return `${r} ${g} ${b}`;
}

export interface DerivedAccent {
  accent: string;
  accentStrong: string;
  accentSoft: string;
  accentFg: string;
}

/** Per-theme `--lab-*` variable names the stylesheet reads (with fallbacks). */
export interface LabVars {
  accent: string;
  strong: string;
  soft: string;
  fg: string;
}

/**
 * Derive the full `--accent*` token family for one theme. `bg` is the theme's
 * background triplet; `onDark` picks the best readable foreground on the
 * accent itself (sand white on deep accents, charcoal on light ones).
 */
export function deriveAccent(hex: string, bg: [number, number, number]): DerivedAccent {
  const rgb = hexToRgb(hex);
  const darkInk: [number, number, number] = [30, 30, 28];
  const paperFg: [number, number, number] = [253, 251, 246];
  const fgOnAccent = contrast(rgb, darkInk) >= contrast(rgb, paperFg) ? darkInk : paperFg;
  const soft = mix(rgb, bg, 0.86); // neighbours the background: soft tint, not a new colour
  return {
    accent: toCss(rgb),
    accentStrong: toCss(mix(rgb, [0, 0, 0], 0.22)),
    accentSoft: toCss(soft),
    accentFg: toCss(fgOnAccent),
  };
}

/**
 * One accent hex to serve both themes: if a colour barely clears 3:1 against
 * a dark background, lift it toward white for the dark theme; the light
 * theme keeps the picked hex as-is.
 */
export function deriveForThemes(hex: string): { light: DerivedAccent; dark: DerivedAccent } {
  const light = deriveAccent(hex, [248, 244, 235]);
  const darkBg: [number, number, number] = [21, 21, 19];
  let darkRgb = hexToRgb(hex);
  for (let i = 0; i < 4 && contrast(darkRgb, darkBg) < 3; i += 1) {
    darkRgb = mix(darkRgb, [255, 255, 255], 0.16);
  }
  const dark = deriveAccent(
    `#${darkRgb.map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('')}`,
    darkBg,
  );
  return { light, dark };
}

function toLabVars(_d: DerivedAccent, theme: 'light' | 'dark'): LabVars {
  const suffix = theme === 'dark' ? '-dark' : '';
  return {
    accent: `--lab-accent${suffix}`,
    strong: `--lab-accent-strong${suffix}`,
    soft: `--lab-accent-soft${suffix}`,
    fg: `--lab-accent-fg${suffix}`,
  };
}

/**
 * Write the derived token family onto a given element (normally <html>).
 * The stylesheet reads these through `var(--lab-accent, <stock>)`, so the
 * stock palette stays intact per theme while the lab only adds overrides.
 * Callers pass `null` for hex to clear overrides and fall back to stock.
 */
export function applyAccentVars(el: HTMLElement, hex: string | null): void {
  if (!hex) {
    for (const theme of ['light', 'dark'] as const) {
      const n = toLabVars({ accent: '', accentStrong: '', accentSoft: '', accentFg: '' }, theme);
      el.style.removeProperty(n.accent);
      el.style.removeProperty(n.strong);
      el.style.removeProperty(n.soft);
      el.style.removeProperty(n.fg);
    }
    return;
  }
  const { light, dark } = deriveForThemes(hex);
  const themes: [DerivedAccent, LabVars][] = [
    [light, toLabVars({ accent: '', accentStrong: '', accentSoft: '', accentFg: '' }, 'light')],
    [dark, toLabVars({ accent: '', accentStrong: '', accentSoft: '', accentFg: '' }, 'dark')],
  ];
  for (const [d, n] of themes) {
    el.style.setProperty(n.accent, d.accent);
    el.style.setProperty(n.strong, d.accentStrong);
    el.style.setProperty(n.soft, d.accentSoft);
    el.style.setProperty(n.fg, d.accentFg);
  }
}

export function readLabFromUrl(url: URL = new URL(window.location.href)): LabChoice | null {
  const accentRaw = url.searchParams.get('accent');
  if (!accentRaw) return null;
  const accent = normalizeHex(accentRaw);
  return accent ? { accent } : null;
}
