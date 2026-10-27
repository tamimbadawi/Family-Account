import type { Fund, Offer } from '../market/types';
import { calculate } from './index';
import { fundHorizon, isFund } from './fund';
import { certaintyOf, type Certainty } from './plan';

/**
 * The goal engine: "I have A, I want to make G, within H months" → the mix of products (any kind) with the
 * highest estimated chance of getting there. Pure: returns data, never copy.
 *
 * Method (written down in How we check):
 *  - Each product's gain over the horizon is modelled as a normal variable with mean μ and spread σ.
 *    Fixed and stepped certificates and treasury bills: σ = 0 (the rate is set). A treasury bill shorter than the
 *    horizon is rolled over at its published yield, and the rollover carries a small spread.
 *    Variable certificates: the rate may move by about 3 points a year.
 *    Funds: μ from the published estimate; σ from the fund type's typical yearly swing (TYPE_VOL).
 *  - A product must give the money back within the horizon (certificates); funds can be sold any time.
 *  - The chance for a mix = P(total gain ≥ goal) with funds of the same type moving together (ρ = 0.8),
 *    others loosely (ρ = 0.3).
 *  - Mixes searched: every single product, pairs (10% steps) and triples (20% steps) among the strongest
 *    candidates, keeping each product's minimum. The highest chance wins; then the higher expected gain;
 *    then fewer products.
 */

export type HowSure = 'safe' | 'balanced' | 'bold';

const ALLOWED: Record<HowSure, Certainty[]> = {
  safe: ['fixed'],
  balanced: ['fixed', 'likely'],
  bold: ['fixed', 'likely', 'uncertain'],
};

/** Typical yearly swing of a fund's value, by type (standard deviation of yearly log change). */
export const TYPE_VOL: Record<string, number> = {
  money_market: 0.01,
  fixed_income: 0.04,
  balanced: 0.12,
  gold: 0.16,
  equity: 0.25,
  other: 0.15,
};

export const GOAL_HORIZONS = [1, 3, 6, 9, 12, 18, 24, 36, 48, 60] as const;

export interface Candidate {
  product: Offer | Fund;
  certainty: Certainty;
  /** Expected gain per pound placed, over the horizon. */
  mu: number;
  /** Spread of the gain per pound placed. */
  sigma: number;
  min: number;
  /** Months the money is tied up (an offer's term; for a fund, 0 = can be sold any time). */
  lockMonths: number;
  group: string;
  rolledOver: boolean;
}

function tbillDays(o: Offer): number | null {
  const d = o.termDays ?? Number((o.id.match(/(\d+)d\b/i) || [])[1] || 0);
  return d || null;
}

/** One product over the horizon, per pound placed; null when it cannot be used for this horizon. */
export function candidateFor(p: Offer | Fund, horizonMonths: number, ownPercent?: number | null): Candidate | null {
  const certainty = certaintyOf(p);
  if (isFund(p)) {
    if ((p.currency || 'EGP') !== 'EGP') return null;
    // A charity fund gives its returns away; it is never part of a plan to grow your money.
    if (/charit|خيري/i.test(`${p.fundEn} ${p.fundAr}`)) return null;
    const own = typeof ownPercent === 'number' && Number.isFinite(ownPercent);
    const r = own ? ownPercent! : p.estimate?.estimatePercent ?? null;
    if (r == null || r <= -100) return null;
    const reach = fundHorizon(own ? 'own' : p.estimate?.method ?? 'none', own) * 12;
    if (reach <= 0) return null;
    const t = horizonMonths / 12;
    const m = Math.log(1 + r / 100) * t;
    // Past the years its figure covers, the fund keeps the same yearly figure, but each extra year counts
    // with twice the usual swing (four times the variance): we know less about those years.
    const covered = Math.min(horizonMonths, reach) / 12;
    const beyond = Math.max(0, horizonMonths - reach) / 12;
    const v = (TYPE_VOL[p.fundType] ?? TYPE_VOL.other) * Math.sqrt(covered + 4 * beyond);
    // Mean and spread of the lognormal outcome, in pounds per pound placed:
    const mean = Math.exp(m + (v * v) / 2) - 1;
    const sd = Math.sqrt((Math.exp(v * v) - 1) * Math.exp(2 * m + v * v));
    return { product: p, certainty, mu: mean, sigma: sd, min: 0, lockMonths: 0, group: `fund:${p.fundType}`, rolledOver: false };
  }
  if ((p.currency || 'EGP') !== 'EGP') return null;
  const o = p as Offer;
  if (o.type === 'tbill') {
    const days = tbillDays(o);
    if (!days || !(o.ratePercent > 0)) return null;
    const termMonths = days / (365 / 12);
    if (termMonths > horizonMonths + 0.01) return null;
    const rounds = Math.max(1, Math.floor((horizonMonths + 0.01) / termMonths));
    const per = (o.ratePercent / 100) * (days / 365);
    const mu = Math.pow(1 + per, rounds) - 1;
    // Later rounds are at whatever yield is published then: about 2 points a year of spread.
    const sigma = rounds > 1 ? 0.02 * ((rounds - 1) * termMonths) / 12 : 0;
    const min = o.minAmount ?? 0;
    return { product: o, certainty, mu, sigma, min, lockMonths: termMonths, group: 'tbill', rolledOver: rounds > 1 };
  }
  const term = o.termMonths;
  if (!term || term > horizonMonths + 0.01) return null;
  const factor = compoundFactor(o);
  if (factor == null) return null;
  // Rolled over at the same published rate when it ends before the horizon; later rounds carry a spread.
  const rounds = Math.max(1, Math.floor((horizonMonths + 0.01) / term));
  const mu = Math.pow(factor, rounds) - 1;
  const yearsLater = ((rounds - 1) * term) / 12;
  const sigma = (o.rateKind === 'variable' ? 0.03 * (term / 12) : 0) + (rounds > 1 ? 0.02 * yearsLater : 0);
  return {
    product: o,
    certainty,
    mu,
    sigma,
    min: o.minAmount ?? 0,
    lockMonths: term,
    group: o.rateKind === 'variable' ? 'variable' : 'fixed',
    rolledOver: rounds > 1,
  };
}

const PERIOD_MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, semiannual: 6, yearly: 12 };

/**
 * What one pound becomes by the end of an offer's term when every payout is put straight back in at the same
 * rate (compounding). A stepped rate uses each year's own rate; a note we cannot read counts year 1 only.
 * Daily payouts compound monthly. Maturity payouts do not compound within the term. Null when not calculable.
 */
export function compoundFactor(o: Offer): number | null {
  const term = o.termMonths;
  if (o.type === 'tbill') {
    const days = tbillDays(o);
    return days && o.ratePercent > 0 ? 1 + (o.ratePercent / 100) * (days / 365) : null;
  }
  if (!term) return null;
  const c = calculate(o, Math.max(o.minAmount ?? 0, 1_000_000));
  if (!c.ok) return null;
  const payout = (o.payout || '').toLowerCase();
  if (payout === 'maturity') return 1 + c.totalReturn / Math.max(o.minAmount ?? 0, 1_000_000);
  const every = payout === 'daily' ? 1 : PERIOD_MONTHS[payout];
  if (!every) return null;
  const rateFor = (month: number): number | null => {
    const year = Math.ceil(month / 12);
    const step = c.steps.find((s) => s.target.kind === 'year' && s.target.index === year);
    if (step) return step.rate;
    if (c.assumptions.includes('firstYearOnly')) return year === 1 ? o.ratePercent : null;
    return o.ratePercent;
  };
  let f = 1;
  for (let m = every; m <= term + 0.01; m += every) {
    const r = rateFor(m);
    if (r == null) break;
    f *= 1 + (r / 100) * (every / 12);
  }
  return f;
}

function rho(a: Candidate, b: Candidate): number {
  if (a.sigma === 0 || b.sigma === 0) return 0;
  return a.group === b.group ? 0.8 : 0.3;
}

/** Standard normal CDF (Abramowitz–Stegun 7.1.26). */
export function normCdf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
  return 0.5 * (1 + sign * y);
}

export interface MixLine {
  product: Offer | Fund;
  amount: number;
  share: number;
  expectedGain: number;
  certainty: Certainty;
  lockMonths: number;
  rolledOver: boolean;
}

export interface Mix {
  lines: MixLine[];
  /** Estimated chance of reaching the goal, 0..1. */
  chance: number;
  expectedGain: number;
  /** A low and a high outcome (10th and 90th percentile of the gain). */
  low: number;
  high: number;
}

function evaluate(cands: Candidate[], amounts: number[], goal: number): Mix {
  let mean = 0;
  let variance = 0;
  for (let i = 0; i < cands.length; i++) {
    mean += amounts[i] * cands[i].mu;
    for (let j = 0; j < cands.length; j++) {
      const r = i === j ? 1 : rho(cands[i], cands[j]);
      variance += r * amounts[i] * amounts[j] * cands[i].sigma * cands[j].sigma;
    }
  }
  const sd = Math.sqrt(Math.max(variance, 0));
  const chance = sd < 1e-9 ? (mean + 1e-6 >= goal ? 1 : 0) : normCdf((mean - goal) / sd);
  const total = amounts.reduce((s, x) => s + x, 0);
  return {
    lines: cands.map((c, i) => ({
      product: c.product,
      amount: amounts[i],
      share: total ? amounts[i] / total : 0,
      expectedGain: amounts[i] * c.mu,
      certainty: c.certainty,
      lockMonths: c.lockMonths,
      rolledOver: c.rolledOver,
    })),
    chance,
    expectedGain: mean,
    low: mean - 1.2816 * sd,
    high: mean + 1.2816 * sd,
  };
}


/** The strongest candidates per group, so the search stays small. */
function shortlist(cands: Candidate[], perGroup = 3): Candidate[] {
  const byGroup = new Map<string, Candidate[]>();
  for (const c of cands) byGroup.set(c.group, [...(byGroup.get(c.group) ?? []), c]);
  const out: Candidate[] = [];
  for (const list of byGroup.values()) {
    // Strongest by expected gain per unit of spread (fixed ones by expected gain).
    list.sort((a, b) => b.mu - b.sigma * 0.5 - (a.mu - a.sigma * 0.5));
    out.push(...list.slice(0, perGroup));
  }
  return out;
}

export interface GoalInput {
  amount: number;
  /** Gain wanted in EGP. */
  goal: number;
  horizonMonths: number;
  howSure: HowSure;
  ownPercents?: Record<string, number | null | undefined>;
  /** 'chance' (default): the best odds of reaching the goal. 'gain': the most you'd likely make (I have). */
  maximize?: 'chance' | 'gain';
}

/** Different kinds of product in a mix (certificates, bills, each fund type). */
function spread(m: Mix): number {
  return new Set(m.lines.map((l) => (isFund(l.product) ? `fund:${l.product.fundType}` : (l.product as Offer).type))).size;
}

/**
 * The mix for the goal. Always a real mix when the products allow it: two or three products, each at least
 * 20% of the amount, preferring different kinds. "How sure" shapes it: safe = fixed outcomes only;
 * balanced = at least one steadier product that can move (variable rate, money market, fixed income);
 * bold = at least one growth fund (uncertain). Among those, the best chance wins, then the wider spread,
 * then the higher expected gain ("I have": the higher likely gain).
 */
function sdOf(m: Mix): number {
  return (m.high - m.low) / (2 * 1.2816);
}

/** Every mix worth considering for one level of "how sure" (2–3 products, ≥ 20% each, shaped by the level). */
function mixesFor(products: (Offer | Fund)[], input: GoalInput, level: HowSure, goal: number): Mix[] {
  const { amount, horizonMonths } = input;
  const allowed = new Set(ALLOWED[level]);
  const all = products
    .filter((p) => allowed.has(certaintyOf(p)))
    .map((p) => candidateFor(p, horizonMonths, input.ownPercents?.[p.id]))
    .filter((c): c is Candidate => !!c && c.min <= amount);
  if (!all.length) return [];
  const pool = shortlist(all);
  const fits = (cs: Candidate[], xs: number[]) => xs.every((x, i) => x >= cs[i].min && x > 0);
  const needs: Certainty | null = level === 'bold' ? 'uncertain' : level === 'balanced' ? 'likely' : null;
  const canMeetNeed = needs != null && pool.some((c) => c.certainty === needs);
  const mixes: Mix[] = [];
  const consider = (cs: Candidate[], xs: number[]) => {
    if (!fits(cs, xs)) return;
    if (canMeetNeed && !cs.some((c) => c.certainty === needs)) return;
    mixes.push(evaluate(cs, xs, goal));
  };
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      for (let s = 2; s <= 8; s++) {
        const x = Math.round((amount * s) / 10);
        consider([pool[i], pool[j]], [x, amount - x]);
      }
    }
  }
  const top = pool.slice(0, 14);
  for (let i = 0; i < top.length; i++) {
    for (let j = i + 1; j < top.length; j++) {
      for (let k = j + 1; k < top.length; k++) {
        for (let a = 1; a <= 3; a++) {
          for (let b = 1; a + b <= 4; b++) {
            const xa = Math.round((amount * a) / 5);
            const xb = Math.round((amount * b) / 5);
            consider([top[i], top[j], top[k]], [xa, xb, amount - xa - xb]);
          }
        }
      }
    }
  }
  // A single product only when no mix fits (one product on offer, or minimums too high to split).
  if (!mixes.length) for (const c of pool) mixes.push(evaluate([c], [amount], goal));
  return mixes;
}

function pick(mixes: Mix[], maximize: 'chance' | 'gain'): Mix | null {
  let best: Mix | null = null;
  for (const m of mixes) {
    if (!best) {
      best = m;
      continue;
    }
    if (maximize === 'chance') {
      const ca = Math.round(m.chance * 100);
      const cb = Math.round(best.chance * 100);
      if (ca !== cb) {
        if (ca > cb) best = m;
        continue;
      }
      const sa = spread(m);
      const sb = spread(best);
      if (sa !== sb) {
        if (sa > sb) best = m;
        continue;
      }
      if (m.expectedGain > best.expectedGain + 0.5) best = m;
    } else {
      if (m.expectedGain > best.expectedGain + 0.5) {
        best = m;
        continue;
      }
      if (best.expectedGain > m.expectedGain + 0.5) {
        continue;
      }
      const sa = spread(m);
      const sb = spread(best);
      if (sa !== sb) {
        if (sa > sb) best = m;
        continue;
      }
    }
  }
  return best;
}

/**
 * The mix for the goal, one level of "how sure" at a time, so the levels always line up:
 * Safe ≤ Balanced ≤ Bold in expected gain and in risk (spread of outcomes), and, whenever the safer level
 * already has an even or better chance of reaching the goal, Safe ≥ Balanced ≥ Bold in chance.
 * (When the goal is out of reach for the safer level, a bolder mix is the only way there and its chance is
 * higher; it still carries more risk.) Within a level: the best chance, then the wider spread of kinds, then
 * the higher expected gain ("I have": the higher likely gain).
 */
export function bestMix(products: (Offer | Fund)[], input: GoalInput): Mix | null {
  const { amount } = input;
  const goal = input.maximize === 'gain' ? Math.max(input.goal, 1) : input.goal;
  if (!(amount > 0) || !(goal > 0)) return null;
  const maximize = input.maximize === 'gain' ? 'gain' : 'chance';
  const order: HowSure[] = ['safe', 'balanced', 'bold'];
  let prev: Mix | null = null;
  for (const level of order) {
    let mixes = mixesFor(products, input, level, goal);
    if (prev) {
      const p = prev;
      const ordered = mixes.filter(
        (m) =>
          m.expectedGain >= p.expectedGain - 0.5 &&
          sdOf(m) >= sdOf(p) - 1e-9 &&
          (maximize === 'gain' || p.chance < 0.5 || Math.round(m.chance * 100) <= Math.round(p.chance * 100))
      );
      // Nothing riskier earns more: this level keeps the safer level's mix.
      mixes = ordered.length ? ordered : [p];
    }
    const chosen = pick(mixes, maximize);
    if (level === input.howSure) {
      if (chosen) chosen.lines.sort((x, y) => y.amount - x.amount);
      return chosen;
    }
    prev = chosen ?? prev;
  }
  return null;
}

export interface GoalPlan {
  mix: Mix | null;
  /** Best chance at each horizon in the drop-down, for the chance-by-time strip. */
  chanceByHorizon: { months: number; chance: number }[];
  /** The shortest horizon where the best mix has at least a 50% chance, or null. */
  earliestLikely: number | null;
}

export function goalPlan(products: (Offer | Fund)[], input: GoalInput): GoalPlan {
  const chanceByHorizon = GOAL_HORIZONS.map((h) => ({
    months: h,
    chance: h === input.horizonMonths ? -1 : bestMix(products, { ...input, horizonMonths: h })?.chance ?? 0,
  }));
  const mix = bestMix(products, input);
  for (const c of chanceByHorizon) if (c.chance === -1) c.chance = mix?.chance ?? 0;
  const earliest = chanceByHorizon.find((c) => c.chance >= 0.5)?.months ?? null;
  return { mix, chanceByHorizon, earliestLikely: earliest };
}

// ---------------------------------------------------------------- fund grades

export type FundGrade = 'A' | 'B' | 'C' | 'D' | 'E';

export interface FundScore {
  grade: FundGrade | null;
  score: number | null;
  /** Points per part, for the fund check panel. */
  parts: { reward: number; record: number; freshness: number; sources: number };
}

/**
 * A fund's grade, 0–100 → A (80+), B (65+), C (50+), D (35+), E. Written method:
 *  - Reward for the swing (50): the estimate divided by the type's typical swing, ranked against funds of the
 *    same type and currency (top of the type = 50).
 *  - Track record (25): weekly price history 25, money market yield 18, this year's change only 12, none 0.
 *  - Freshness (15): figures within the out-of-date limit 15, else 0.
 *  - Sources (10): confirmed by two sources 10, one source 6.
 *  No estimate → not graded.
 */
export function gradeFunds(funds: Fund[]): Map<string, FundScore> {
  const out = new Map<string, FundScore>();
  const ratio = (f: Fund) =>
    f.estimate?.estimatePercent == null ? null : f.estimate.estimatePercent / 100 / (TYPE_VOL[f.fundType] ?? TYPE_VOL.other);
  const groups = new Map<string, number[]>();
  for (const f of funds) {
    const r = ratio(f);
    if (r == null) continue;
    const k = `${f.fundType}|${f.currency}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  for (const list of groups.values()) list.sort((a, b) => a - b);
  for (const f of funds) {
    const r = ratio(f);
    const record = { history: 25, yield: 18, ytd: 12 }[f.estimate?.method as 'history'] ?? 0;
    const freshness = f.confidence === 'stale' ? 0 : 15;
    const sources = f.confidence === 'confirmed' ? 10 : 6;
    if (r == null) {
      out.set(f.id, { grade: null, score: null, parts: { reward: 0, record, freshness, sources } });
      continue;
    }
    const list = groups.get(`${f.fundType}|${f.currency}`)!;
    const rank = list.length > 1 ? list.filter((x) => x < r).length / (list.length - 1) : 0.5;
    const reward = Math.round(rank * 50);
    const score = reward + record + freshness + sources;
    const grade: FundGrade = score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : score >= 35 ? 'D' : 'E';
    out.set(f.id, { grade, score, parts: { reward, record, freshness, sources } });
  }
  return out;
}
