/**
 * Keyboard-shortcut helpers shared by the global header chrome and the
 * workbenches. Dependency-free and DOM-light so it can be unit tested.
 */

/** One row in the shortcuts help dialog. */
export interface Shortcut {
  /** Individual `<kbd>` tokens, rendered joined with `+`. */
  tokens: string[];
  label: string;
  /** Optional qualifier shown next to the label. */
  note?: string;
}

/** Chords documented in the help dialog and wired by the page. */
export const SHORTCUTS: Shortcut[] = [
  { tokens: ['/'], label: 'Focus search' },
  { tokens: ['?'], label: 'This help dialog' },
  { tokens: ['Ctrl/⌘', 'Enter'], label: 'Run the current tool' },
  { tokens: ['Ctrl/⌘', 'C'], label: 'Copy the output', note: 'when an output is focused' },
];

/** `window` event a workbench listens on to run its tool (Ctrl/⌘+Enter). */
export const RUN_EVENT = 'tesserae:run';

/**
 * True for a text-entry surface. Bare character chords (`/`, `?`) must be left
 * to the field instead of hijacked; modifier chords are unaffected.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  // `isContentEditable` is the authoritative signal, but some environments do
  // not reflect it — fall back to the attribute (any value but "false" means
  // editable, including the bare `contenteditable` form).
  const editable = target.getAttribute('contenteditable');
  if (editable !== null && editable !== 'false') return true;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
}

/** Ctrl/⌘ + Enter — "run the current tool". */
export function isRunShortcut(e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey'>): boolean {
  return e.key === 'Enter' && (e.ctrlKey || e.metaKey);
}

/** Ctrl/⌘ + C — "copy the focused output". */
export function isCopyShortcut(e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey'>): boolean {
  return (e.key === 'c' || e.key === 'C') && (e.ctrlKey || e.metaKey);
}

/** True while a modal dialog is open, so page shortcuts stay out of its way. */
export function isModalOpen(doc: Document): boolean {
  return doc.querySelector('dialog[open]') !== null;
}

/**
 * Subscribe to the run chord. Returns a disposer.
 * Panels and workbenches use this instead of binding their own chords.
 */
export function onRunShortcut(run: () => void, target: EventTarget): () => void {
  const handler = () => run();
  target.addEventListener(RUN_EVENT, handler);
  return () => target.removeEventListener(RUN_EVENT, handler);
}

/**
 * Run-chord support for a container that exposes a `[data-run]` button:
 * click the first enabled one inside `root`.
 */
export function onRunShortcutClick(root: ParentNode, target: EventTarget): () => void {
  return onRunShortcut(() => {
    root.querySelector<HTMLButtonElement>('[data-run]:not([disabled])')?.click();
  }, target);
}
