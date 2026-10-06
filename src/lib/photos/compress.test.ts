import { describe, expect, it } from 'vitest';
import { fitWithin, MAX_SIDE, MIN_QUALITY, MIN_SIDE, nextAttempt, START_QUALITY, type Attempt } from './compress';

describe('fitWithin', () => {
  it('shrinks a landscape photo so the long side is 1600', () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1600, height: 1200 });
  });

  it('shrinks a portrait photo by its height', () => {
    expect(fitWithin(3024, 4032)).toEqual({ width: 1200, height: 1600 });
  });

  it('never upscales a small photo', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1600, 1600)).toEqual({ width: 1600, height: 1600 });
  });

  it('keeps very thin images at least 1px wide', () => {
    expect(fitWithin(10000, 2, 1000)).toEqual({ width: 1000, height: 1 });
  });

  it('honours a custom max side', () => {
    expect(fitWithin(4000, 2000, 1280)).toEqual({ width: 1280, height: 640 });
  });
});

describe('nextAttempt', () => {
  it('lowers quality first, then shrinks, then stops', () => {
    const steps: Attempt[] = [];
    let a: Attempt | null = { maxSide: MAX_SIDE, quality: START_QUALITY };
    while (a) {
      steps.push(a);
      a = nextAttempt(a);
    }

    // 0.8 → 0.7 → 0.6 → 0.5 at full size
    expect(steps.slice(0, 4)).toEqual([
      { maxSide: 1600, quality: 0.8 },
      { maxSide: 1600, quality: 0.7 },
      { maxSide: 1600, quality: 0.6 },
      { maxSide: 1600, quality: 0.5 },
    ]);
    // then 20% smaller each time, never below the minimum side or quality
    expect(steps.slice(4).map((s) => s.maxSide)).toEqual([1280, 1024, 819]);
    for (const s of steps) {
      expect(s.quality).toBeGreaterThanOrEqual(MIN_QUALITY);
      expect(s.maxSide).toBeGreaterThanOrEqual(MIN_SIDE);
    }
  });
});
