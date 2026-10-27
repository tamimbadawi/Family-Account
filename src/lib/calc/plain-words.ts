import type { Fund, Offer } from '../market/types';
import { calculate } from './index';
import { calculateFund, fundHorizon, isFund } from './fund';
import { certaintyOf, type Certainty } from './plan';
import { compoundFactor } from './goal';

/**
 * Two products in plain words: a short list of facts that differ between them, as sentence ids and numbers.
 * The screen turns each into one sentence. It describes differences; it never says which is better.
 */
export type PlainFact =
  | { id: 'yearly'; a: number; b: number; aKind: 'rate' | 'estimate'; bKind: 'rate' | 'estimate' }
  | { id: 'gainOver'; who: 'a' | 'b'; diff: number; months: number; currency: string }
  | { id: 'termLonger'; who: 'a' | 'b'; months: number }
  | { id: 'payout'; a: string; b: string }
  | { id: 'certainty'; a: Certainty; b: Certainty }
  | { id: 'minimum'; who: 'a' | 'b'; amount: number; currency: string }
  | { id: 'belowMinimum'; who: 'a' | 'b'; amount: number; currency: string }
  | { id: 'noEstimate'; who: 'a' | 'b' }
  | { id: 'currency'; a: string; b: string }
  | { id: 'sharia'; who: 'a' | 'b' }
  | { id: 'same' };

interface Side {
  yearly: number | null;
  kind: 'rate' | 'estimate';
  months: number | null;
  payout: string;
  currency: string;
  min: number;
  gainFor: (months: number) => number | null;
  below: boolean;
}

function side(p: Offer | Fund, amount: number, own?: number | null): Side {
  if (isFund(p)) {
    const r = calculateFund(p, amount, { ownPercent: own });
    const yearly = r.ok ? r.yearlyPercent : null;
    const reach = r.ok ? fundHorizon(r.method, r.ownFigure) * 12 : 0;
    return {
      yearly,
      kind: 'estimate',
      months: null,
      payout: 'none',
      currency: p.currency || 'EGP',
      min: 0,
      below: false,
      gainFor: (m) => (yearly == null || m > reach ? null : Math.floor(amount * Math.pow(1 + yearly / 100, m / 12)) - amount),
    };
  }
  const months = p.type === 'tbill' ? (p.termDays ?? Number((p.id.match(/(\d+)d\b/i) || [])[1] || 0)) / (365 / 12) : p.termMonths;
  const c = calculate(p, amount);
  return {
    yearly: p.ratePercent ?? null,
    kind: 'rate',
    months: months ?? null,
    payout: p.type === 'tbill' ? 'maturity' : (p.payout || '').toLowerCase(),
    currency: p.currency || 'EGP',
    min: p.minAmount ?? 0,
    below: !c.ok && c.reason === 'belowMinimum',
    gainFor: (m) => {
      if (!c.ok || !months || Math.abs(m - months) >= 0.01) return null;
      const f = compoundFactor(p);
      return f != null ? amount * (f - 1) : c.totalReturn;
    },
  };
}

export function plainComparison(
  a: Offer | Fund,
  b: Offer | Fund,
  amount: number,
  own: Record<string, number | null | undefined> = {}
): PlainFact[] {
  const A = side(a, amount, own[a.id]);
  const B = side(b, amount, own[b.id]);
  const facts: PlainFact[] = [];

  if (A.currency !== B.currency) facts.push({ id: 'currency', a: A.currency, b: B.currency });

  if (A.below) facts.push({ id: 'belowMinimum', who: 'a', amount: A.min, currency: A.currency });
  if (B.below) facts.push({ id: 'belowMinimum', who: 'b', amount: B.min, currency: B.currency });

  if (A.yearly == null) facts.push({ id: 'noEstimate', who: 'a' });
  if (B.yearly == null) facts.push({ id: 'noEstimate', who: 'b' });
  if (A.yearly != null && B.yearly != null && A.yearly !== B.yearly) {
    facts.push({ id: 'yearly', a: A.yearly, b: B.yearly, aKind: A.kind, bKind: B.kind });
  }

  // Money gained over the same stretch of time, when both can be worked out for it (same currency only).
  if (A.currency === B.currency && !A.below && !B.below) {
    const months = A.months ?? B.months ?? 12;
    const ga = A.months != null ? A.gainFor(A.months) : A.gainFor(months);
    const gb = B.months != null ? B.gainFor(B.months) : B.gainFor(months);
    const sameStretch = A.months == null || B.months == null || Math.abs(A.months - B.months) < 0.01;
    if (sameStretch && ga != null && gb != null && Math.abs(ga - gb) >= 0.01) {
      facts.push({ id: 'gainOver', who: ga > gb ? 'a' : 'b', diff: Math.abs(ga - gb), months, currency: A.currency });
    }
  }

  if (A.months != null && B.months != null && Math.abs(A.months - B.months) >= 0.5) {
    facts.push({ id: 'termLonger', who: A.months > B.months ? 'a' : 'b', months: Math.round(Math.abs(A.months - B.months)) });
  }

  if (A.payout !== 'none' && B.payout !== 'none' && A.payout !== B.payout) facts.push({ id: 'payout', a: A.payout, b: B.payout });

  const ca = certaintyOf(a);
  const cb = certaintyOf(b);
  if (ca !== cb) facts.push({ id: 'certainty', a: ca, b: cb });

  if (A.min !== B.min && (A.min > 0 || B.min > 0) && !A.below && !B.below) {
    facts.push(A.min > B.min ? { id: 'minimum', who: 'a', amount: A.min, currency: A.currency } : { id: 'minimum', who: 'b', amount: B.min, currency: B.currency });
  }

  const sa = isFund(a) ? a.sharia : null;
  const sb = isFund(b) ? b.sharia : null;
  if (sa === true && sb !== true) facts.push({ id: 'sharia', who: 'a' });
  if (sb === true && sa !== true) facts.push({ id: 'sharia', who: 'b' });

  return facts.length ? facts : [{ id: 'same' }];
}
