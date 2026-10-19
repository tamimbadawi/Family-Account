import { describe, expect, it } from 'vitest';
import { calculateViewportHeight, isTextInputFocused } from './viewport-height';

describe('viewport-height calculation', () => {
  it('normal case uses visualViewport height when available', () => {
    const height = calculateViewportHeight({
      visualViewportHeight: 844,
      innerHeight: 844,
      isInputFocused: false,
      lastHeight: null,
    });
    expect(height).toBe(844);
  });

  it('normal case updates when visualViewport changes (e.g. unfold from 915 to 900)', () => {
    const height = calculateViewportHeight({
      visualViewportHeight: 900,
      innerHeight: 900,
      isInputFocused: false,
      lastHeight: 915,
    });
    expect(height).toBe(900);
  });

  it('normal case falls back to innerHeight if visualViewport is null', () => {
    const height = calculateViewportHeight({
      visualViewportHeight: null,
      innerHeight: 740,
      isInputFocused: false,
      lastHeight: null,
    });
    expect(height).toBe(740);
  });

  it('keyboard-open case keeps the old height so the shell does not jump', () => {
    const oldHeight = 844;
    // Keyboard opens, shrinking visualViewport to 420px
    const heightWithKeyboard = calculateViewportHeight({
      visualViewportHeight: 420,
      innerHeight: 844,
      isInputFocused: true,
      lastHeight: oldHeight,
    });
    expect(heightWithKeyboard).toBe(oldHeight);
  });

  it('keyboard-open case falls back to visualViewport/innerHeight if no previous stable height exists', () => {
    const height = calculateViewportHeight({
      visualViewportHeight: 500,
      innerHeight: 800,
      isInputFocused: true,
      lastHeight: null,
    });
    expect(height).toBe(500);
  });

  it('normal case after keyboard closes uses the full visualViewport height', () => {
    const oldHeight = 844;
    // Keyboard closed: isInputFocused is false again
    const heightAfterClose = calculateViewportHeight({
      visualViewportHeight: 844,
      innerHeight: 844,
      isInputFocused: false,
      lastHeight: oldHeight,
    });
    expect(heightAfterClose).toBe(844);
  });
});

describe('isTextInputFocused detection', () => {
  it('identifies input elements by type', () => {
    const originalDocument = globalThis.document;

    // Simulate input[type="text"]
    const textInput = {
      tagName: 'INPUT',
      type: 'text',
    } as unknown as Element;
    globalThis.document = { activeElement: textInput } as Document;
    expect(isTextInputFocused()).toBe(true);

    // Simulate textarea
    const textarea = {
      tagName: 'TEXTAREA',
    } as unknown as Element;
    globalThis.document = { activeElement: textarea } as Document;
    expect(isTextInputFocused()).toBe(true);

    // Simulate button
    const button = {
      tagName: 'INPUT',
      type: 'button',
    } as unknown as Element;
    globalThis.document = { activeElement: button } as Document;
    expect(isTextInputFocused()).toBe(false);

    // Simulate checkbox
    const checkbox = {
      tagName: 'INPUT',
      type: 'checkbox',
    } as unknown as Element;
    globalThis.document = { activeElement: checkbox } as Document;
    expect(isTextInputFocused()).toBe(false);

    // Restore
    globalThis.document = originalDocument;
  });
});
