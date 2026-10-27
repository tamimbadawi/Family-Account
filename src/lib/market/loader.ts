import { effectiveConfidence } from '@/lib/confidence';
import { gradeFunds } from '@/lib/calc/goal';
import { getBanks, getFunds, getLastUpdated, getManagers, getOffers } from './index';
import type { Bank, Fund, Manager, Offer } from './types';

export interface MarketData {
  offers: Offer[];
  funds: Fund[];
  banks: Bank[];
  managers: Manager[];
  lastUpdated: string | null;
  failed: {
    offers: boolean;
    funds: boolean;
    banks: boolean;
    managers: boolean;
  };
}

/** Loads market offers, funds, banks, and managers for the investment calculator. */
export async function loadAllMarket(): Promise<MarketData> {
  const [offers, funds, banks, managers, lastUpdated] = await Promise.all([
    getOffers(),
    getFunds(),
    getBanks(),
    getManagers(),
    getLastUpdated(),
  ]);

  const today = new Date();
  const dated = funds.map((f) => ({ ...f, confidence: effectiveConfidence(f, today) }));
  const grades = gradeFunds(dated);

  return {
    offers: offers.map((o) => ({ ...o, confidence: effectiveConfidence(o, today) })),
    funds: dated.map((f) => ({
      ...f,
      grade: grades.get(f.id)?.grade ?? null,
      gradeScore: grades.get(f.id)?.score ?? null,
    })),
    banks: [...banks],
    managers: [...managers],
    lastUpdated,
    failed: {
      offers: !!offers.error,
      funds: !!funds.error,
      banks: !!banks.error,
      managers: !!managers.error,
    },
  };
}
