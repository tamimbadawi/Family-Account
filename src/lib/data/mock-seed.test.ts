import { describe, expect, it } from 'vitest';
import { generateRealisticEntries, toLocalDateString } from './mock-seed';

describe('generateRealisticEntries timestamps', () => {
  // Early and mid-month: sample entries meant for later days are clamped to today
  for (const base of [new Date(2026, 9, 7, 9, 30), new Date(2026, 9, 2, 8, 0), new Date(2026, 9, 20, 18, 0)]) {
    it(`never stamps an entry after the seed time (${base.toDateString()})`, () => {
      const entries = generateRealisticEntries(base);
      for (const e of entries) {
        expect(new Date(e.created_at).getTime()).toBeLessThanOrEqual(base.getTime());
      }
    });

    it(`stamps each current-month entry on its own occurred_on day (${base.toDateString()})`, () => {
      const month = toLocalDateString(base).slice(0, 7);
      const entries = generateRealisticEntries(base).filter((e) => e.occurred_on.startsWith(month));
      expect(entries.length).toBeGreaterThan(0);
      for (const e of entries) {
        expect(e.occurred_on <= toLocalDateString(base)).toBe(true);
        expect(toLocalDateString(new Date(e.created_at))).toBe(e.occurred_on);
      }
    });
  }
});
