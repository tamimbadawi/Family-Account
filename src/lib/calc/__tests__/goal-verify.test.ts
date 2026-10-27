import { describe, expect, it } from 'vitest';
import { getFunds, getOffers } from '../../market/index';
import { goalPlan } from '../goal';

describe('verify As much as possible fix', () => {
  it('bold mode delivers 54%+ expected return matching the top equity funds', async () => {
    const offers = await getOffers();
    const funds = await getFunds();
    const all = [...offers, ...funds];

    const plan = goalPlan(all, { amount: 100000, goal: 1, horizonMonths: 12, howSure: 'bold', maximize: 'gain' });
    const mix = plan.mix!;
    
    // Expected gain is 54.4% (54,431 EGP), not the old 33% (33,161 EGP)
    expect(mix.expectedGain).toBeGreaterThan(50000);
    expect(mix.high).toBeGreaterThan(100000);
    
    // Lines consist of top growth equity funds
    expect(mix.lines.every(l => l.certainty === 'uncertain')).toBe(true);
    expect(mix.lines[0].share).toBe(0.8);
    expect(mix.lines[1].share).toBe(0.2);
  });

  it('Safe <= Balanced <= Bold in expected return for As much as possible', async () => {
    const offers = await getOffers();
    const funds = await getFunds();
    const all = [...offers, ...funds];

    const safe = goalPlan(all, { amount: 100000, goal: 1, horizonMonths: 12, howSure: 'safe', maximize: 'gain' }).mix!;
    const balanced = goalPlan(all, { amount: 100000, goal: 1, horizonMonths: 12, howSure: 'balanced', maximize: 'gain' }).mix!;
    const bold = goalPlan(all, { amount: 100000, goal: 1, horizonMonths: 12, howSure: 'bold', maximize: 'gain' }).mix!;

    // Safe (26.3%) < Balanced (29.0%) < Bold (54.4%)
    expect(safe.expectedGain).toBeCloseTo(26294, -2);
    expect(balanced.expectedGain).toBeGreaterThanOrEqual(28500);
    expect(bold.expectedGain).toBeCloseTo(54431, -2);

    expect(balanced.expectedGain).toBeGreaterThan(safe.expectedGain);
    expect(bold.expectedGain).toBeGreaterThan(balanced.expectedGain);
  });
});
