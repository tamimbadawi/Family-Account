import { calculate, type CalcResult } from './calc';
import type { Offer } from './types';

// Investment ideas: for an amount, every certificate and treasury bill the family could buy with it,
// worked out with the bank-offers calculator and ranked by what it is estimated to pay.
// Estimates only (before tax, today's published rates); the screen says so.

export type IdeaGoal = 'monthly' | 'grow';
export type IdeaLength = 'any' | 'upTo1y' | 'upTo3y';

export type IdeaNote = 'variable' | 'firstYearOnly' | 'beforeTax' | 'dailyApprox' | 'stale';

type CalcOk = Extract<CalcResult, { ok: true }>;

export interface Idea {
  offer: Offer;
  result: CalcOk;
  /** Months the estimate covers: the whole term, or only year 1 when later years are unknown. */
  coveredMonths: number;
  /** The product's full term in months. */
  termMonths: number;
  /** Average estimated return per month and per year over the months covered. */
  perMonth: number;
  perYear: number;
  notes: IdeaNote[];
}

export interface IdeasResult {
  ideas: Idea[];
  /** Products that fit the goal and length but need a bigger amount than this one. */
  needMore: number;
  /** Newest published date among the products shown (YYYY-MM-DD), or null. */
  latestDate: string | null;
}

/** Cash arrives at least once a month. */
const MONTHLY_PAYOUTS = new Set(['monthly', 'daily']);

function termMonthsOf(offer: Offer): number | null {
  // Treasury bills are worked out on days / 365, so their months come from the days too.
  if (offer.type === 'tbill') {
    // Same fallback as calculate(): the sheet's ids carry the days, e.g. tbill-91d.
    const days = offer.termDays ?? Number(offer.id.match(/-(\d+)d\b/i)?.[1] ?? NaN);
    if (days > 0) return (days * 12) / 365;
  }
  if (offer.termMonths != null && offer.termMonths > 0) return offer.termMonths;
  if (offer.termDays != null && offer.termDays > 0) return (offer.termDays * 12) / 365;
  return null;
}

function fitsLength(months: number, length: IdeaLength): boolean {
  if (length === 'upTo1y') return months <= 12;
  if (length === 'upTo3y') return months <= 36;
  return true;
}

function fitsGoal(offer: Offer, goal: IdeaGoal): boolean {
  if (goal === 'grow') return true;
  return MONTHLY_PAYOUTS.has((offer.payout ?? '').trim().toLowerCase());
}

/** One bank's same product in different amount tiers counts once. */
function productKey(offer: Offer, termMonths: number): string {
  return [offer.bankCode, offer.nameEn || offer.nameAr, termMonths, (offer.payout ?? '').toLowerCase()].join('|');
}

const CONFIDENCE_ORDER = { confirmed: 0, single: 1, differ: 2, stale: 3 } as const;

export function investmentIdeas(
  offers: Offer[],
  amount: number,
  goal: IdeaGoal,
  length: IdeaLength,
): IdeasResult {
  const best = new Map<string, Idea>();
  const tooSmall = new Set<string>();

  if (!(amount > 0)) return { ideas: [], needMore: 0, latestDate: null };

  for (const offer of offers) {
    if (offer.type !== 'certificate' && offer.type !== 'tbill') continue;
    if (offer.currency.toUpperCase() !== 'EGP') continue;
    const termMonths = termMonthsOf(offer);
    if (termMonths == null || !fitsLength(termMonths, length) || !fitsGoal(offer, goal)) continue;

    const key = productKey(offer, termMonths);
    const result = calculate(offer, amount);
    if (!result.ok) {
      if (result.reason === 'belowMinimum') tooSmall.add(key);
      continue;
    }

    const firstYearOnly = result.assumptions.includes('firstYearOnly');
    const coveredMonths = firstYearOnly ? 12 : termMonths;
    const perMonth = result.totalReturn / coveredMonths;
    const notes: IdeaNote[] = [...result.assumptions];
    if (!notes.includes('beforeTax')) notes.push('beforeTax');
    if (offer.confidence === 'stale') notes.push('stale');

    const idea: Idea = {
      offer,
      result,
      coveredMonths,
      termMonths,
      perMonth,
      perYear: perMonth * 12,
      notes,
    };
    const existing = best.get(key);
    if (!existing || compareIdeas(idea, existing) < 0) best.set(key, idea);
  }

  const ideas = [...best.values()].sort(compareIdeas);
  const shown = new Set(ideas.map((i) => productKey(i.offer, i.termMonths)));
  const needMore = [...tooSmall].filter((k) => !shown.has(k)).length;
  const latestDate =
    ideas
      .map((i) => i.offer.publishedOn)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;

  return { ideas, needMore, latestDate };
}

/** Highest average return first; a fixed rate before one that can change; better-supported figures first. */
function compareIdeas(a: Idea, b: Idea): number {
  const byReturn = b.perMonth - a.perMonth;
  if (Math.abs(byReturn) > 0.005) return byReturn;
  const aVar = a.notes.includes('variable') ? 1 : 0;
  const bVar = b.notes.includes('variable') ? 1 : 0;
  if (aVar !== bVar) return aVar - bVar;
  const byConfidence = CONFIDENCE_ORDER[a.offer.confidence] - CONFIDENCE_ORDER[b.offer.confidence];
  if (byConfidence !== 0) return byConfidence;
  return a.offer.id.localeCompare(b.offer.id);
}
