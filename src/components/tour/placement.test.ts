import { describe, expect, it } from 'vitest';
import { EDGE, GAP, PAD, placeBubble } from './placement';

const phone = { width: 390, height: 844 };
const bubble = { width: 358, height: 200 };

describe('placeBubble', () => {
  it('centres the bubble when there is nothing to point at', () => {
    const p = placeBubble(null, bubble, phone);
    expect(p.side).toBe('center');
    expect(p.left).toBe(16);
    expect(p.top).toBe((844 - 200) / 2);
  });

  it('goes below a part near the top of the screen', () => {
    const p = placeBubble({ top: 100, left: 20, width: 350, height: 120 }, bubble, phone);
    expect(p.side).toBe('below');
    expect(p.top).toBe(100 + 120 + PAD + GAP);
  });

  it('goes above the tab bar at the bottom', () => {
    const p = placeBubble({ top: 780, left: 171, width: 48, height: 48 }, bubble, phone);
    expect(p.side).toBe('above');
    expect(p.top + 200).toBe(780 - PAD - GAP);
    // The pointer sits over the middle of the + button
    expect(p.left + p.arrowLeft).toBe(195);
  });

  it('never leaves the screen beside a part in a corner', () => {
    const p = placeBubble({ top: 20, left: 330, width: 48, height: 48 }, { width: 300, height: 180 }, phone);
    expect(p.left + 300).toBeLessThanOrEqual(390 - EDGE);
    expect(p.arrowLeft).toBeLessThanOrEqual(300 - 24);
  });

  it('falls back to the middle when the part fills the screen', () => {
    const p = placeBubble({ top: 60, left: 0, width: 390, height: 700 }, bubble, phone);
    expect(p.side).toBe('center');
  });

  it('shrinks to fit a narrow phone', () => {
    const p = placeBubble(null, { width: 400, height: 200 }, { width: 320, height: 568 });
    expect(p.left).toBe(EDGE);
  });
});
