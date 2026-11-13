import { describe, it, expect } from 'vitest';
import {
  isTypingTarget,
  isRunShortcut,
  isCopyShortcut,
  isPasteShortcut,
  isModalOpen,
  onRunShortcut,
  onRunShortcutClick,
  SHORTCUTS,
  RUN_EVENT,
} from './keyboard';

describe('isTypingTarget', () => {
  it('treats inputs, textareas and selects as typing surfaces', () => {
    for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']) {
      const el = document.createElement(tag);
      expect(isTypingTarget(el)).toBe(true);
    }
  });
  it('treats contenteditable as a typing surface', () => {
    const el = document.createElement('div');
    el.setAttribute('contenteditable', 'true');
    expect(isTypingTarget(el)).toBe(true);
  });
  it('treats buttons and plain elements as non-typing', () => {
    expect(isTypingTarget(document.createElement('button'))).toBe(false);
    expect(isTypingTarget(document.createElement('div'))).toBe(false);
  });
  it('is false for null / non-element targets', () => {
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget(document)).toBe(false);
  });
});

describe('run shortcut', () => {
  it('matches Ctrl+Enter and Cmd+Enter only', () => {
    expect(isRunShortcut({ key: 'Enter', ctrlKey: true, metaKey: false })).toBe(true);
    expect(isRunShortcut({ key: 'Enter', ctrlKey: false, metaKey: true })).toBe(true);
    expect(isRunShortcut({ key: 'Enter', ctrlKey: false, metaKey: false })).toBe(false);
    expect(isRunShortcut({ key: 'x', ctrlKey: true, metaKey: false })).toBe(false);
  });
});

describe('copy shortcut', () => {
  it('matches Ctrl+C and Cmd+C only', () => {
    expect(isCopyShortcut({ key: 'c', ctrlKey: true, metaKey: false })).toBe(true);
    expect(isCopyShortcut({ key: 'C', ctrlKey: false, metaKey: true })).toBe(true);
    expect(isCopyShortcut({ key: 'c', ctrlKey: false, metaKey: false })).toBe(false);
    expect(isCopyShortcut({ key: 'v', ctrlKey: true, metaKey: false })).toBe(false);
  });
});

describe('paste shortcut', () => {
  it('matches Ctrl+V and Cmd+V only', () => {
    expect(isPasteShortcut({ key: 'v', ctrlKey: true, metaKey: false })).toBe(true);
    expect(isPasteShortcut({ key: 'V', ctrlKey: false, metaKey: true })).toBe(true);
    expect(isPasteShortcut({ key: 'v', ctrlKey: false, metaKey: false })).toBe(false);
    expect(isPasteShortcut({ key: 'c', ctrlKey: true, metaKey: false })).toBe(false);
  });
});

describe('isModalOpen', () => {
  it('reports whether any native dialog is open', () => {
    expect(isModalOpen(document)).toBe(false);
    const d = document.createElement('dialog');
    document.body.appendChild(d);
    d.setAttribute('open', '');
    expect(isModalOpen(document)).toBe(true);
    d.removeAttribute('open');
    expect(isModalOpen(document)).toBe(false);
  });
});

describe('onRunShortcut / onRunShortcutClick', () => {
  it('dispatches the run event to a subscribed listener', () => {
    const target = new EventTarget();
    let ran = 0;
    const dispose = onRunShortcut(() => ran++, target);
    target.dispatchEvent(new Event(RUN_EVENT));
    expect(ran).toBe(1);
    dispose();
    target.dispatchEvent(new Event(RUN_EVENT));
    expect(ran).toBe(1);
  });

  it('clicks the first enabled [data-run] button inside a root', () => {
    const root = document.createElement('div');
    const btn = document.createElement('button');
    btn.setAttribute('data-run', '');
    btn.disabled = false;
    root.appendChild(btn);
    let clicked = 0;
    btn.addEventListener('click', () => clicked++);
    const dispose = onRunShortcutClick(root, window);
    window.dispatchEvent(new Event(RUN_EVENT));
    expect(clicked).toBe(1);
    dispose();
  });

  it('ignores disabled run buttons', () => {
    const root = document.createElement('div');
    const btn = document.createElement('button');
    btn.setAttribute('data-run', '');
    btn.disabled = true;
    root.appendChild(btn);
    let clicked = 0;
    btn.addEventListener('click', () => clicked++);
    const dispose = onRunShortcutClick(root, window);
    window.dispatchEvent(new Event(RUN_EVENT));
    expect(clicked).toBe(0);
    dispose();
  });
});

describe('SHORTCUTS', () => {
  it('documents the supported chords', () => {
    const labels = SHORTCUTS.map((s) => s.tokens.join('+'));
    expect(labels).toContain('/');
    expect(labels).toContain('?');
    expect(labels).toContain('Ctrl/⌘+Enter');
    expect(labels).toContain('Ctrl/⌘+C');
  });
});
