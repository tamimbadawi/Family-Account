import { describe, expect, it } from 'vitest';
import { getFunds } from '../../market/index';
import { estimatesFromRows } from '../fund-estimate';

describe('estimates for funds the file does not cover', () => {
  it('give the same figure as the estimates script for every fund in the file', async () => {
    process.env.DATA_SOURCE = 'fixtures';
    const funds = await getFunds();
    const today = new Date('2026-10-13T00:00:00Z');
    const live = estimatesFromRows(funds, funds, today);
    let compared = 0;
    for (const f of funds) {
      const file = f.estimate;
      if (!file || file.estimatePercent == null || file.method === 'history') continue;
      const mine = live.get(f.id);
      expect(mine?.method, f.id).toBe(file.method);
      expect(mine!.estimatePercent!, f.id).toBeCloseTo(file.estimatePercent, 0);
      compared++;
    }
    expect(compared).toBeGreaterThan(100);
  }, 20000);

  it('a fund missing from the file still gets a figure', async () => {
    process.env.DATA_SOURCE = 'fixtures';
    const funds = await getFunds();
    const f = funds.find((x) => x.fundType === 'equity' && x.changeYtdPercent != null)!;
    const fresh = { ...f, id: 'brand-new', estimate: null };
    const m = estimatesFromRows([fresh], [...funds, fresh], new Date('2026-10-13T00:00:00Z'));
    expect(m.get('brand-new')!.estimatePercent!).toBeCloseTo(f.estimate!.estimatePercent!, 0);
  }, 20000);
});
