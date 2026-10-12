import { EMPTY_FILTERS, type HistoryFilters, type HistoryType } from './filters';
import { PERIODS, type Period } from './period';

/**
 * What a tap on a total elsewhere in the app opens in History: the entries behind that number.
 * Every total (a category, an item, a wallet, a goal, a person, a month…) links here.
 */
export interface HistoryLink {
  type?: HistoryType;
  categoryId?: string | null;
  subcategoryId?: string | null;
  itemId?: string | null;
  walletId?: string | null;
  memberId?: string | null;
  /** Period shown, around `date` ('YYYY-MM-DD'). A Reports month 'YYYY-MM' can be passed as `month`. */
  period?: Period;
  date?: string;
  month?: string;
  q?: string;
}

const TYPES: HistoryType[] = ['all', 'expense', 'income', 'transfer'];

/** '/history?…' for a link; `back=1` lets History show a Back button to where the tap came from. */
export function historyHref(l: HistoryLink): string {
  const p = new URLSearchParams();
  if (l.type && l.type !== 'all') p.set('type', l.type);
  if (l.categoryId) {
    p.set('cat', l.categoryId);
    if (l.subcategoryId) {
      p.set('sub', l.subcategoryId);
      if (l.itemId) p.set('item', l.itemId);
    }
  }
  if (l.walletId) p.set('wallet', l.walletId);
  if (l.memberId) p.set('member', l.memberId);
  const date = l.date ?? (l.month ? `${l.month}-01` : undefined);
  const period = l.period ?? (l.month ? 'month' : undefined);
  if (period) p.set('period', period);
  if (date) p.set('date', date);
  if (l.q) p.set('q', l.q);
  p.set('back', '1');
  return `/history?${p.toString()}`;
}

export interface ParsedHistoryLink {
  filters: HistoryFilters;
  period?: Period;
  anchor?: string;
  q: string;
  back: boolean;
}

/** Reads a History link back into filters, period, search and whether to offer Back. */
export function parseHistoryLink(get: (key: string) => string | null): ParsedHistoryLink {
  const type = get('type') as HistoryType | null;
  const cat = get('cat');
  const sub = cat ? get('sub') : null;
  const item = sub ? get('item') : null;
  const wallet = get('wallet');
  const member = get('member');
  const period = get('period') as Period | null;
  const date = get('date');
  return {
    filters: {
      ...EMPTY_FILTERS,
      type: type && TYPES.includes(type) ? type : 'all',
      picks: cat ? [{ categoryId: cat, ...(sub ? { subcategoryId: sub } : {}), ...(item ? { itemId: item } : {}) }] : [],
      walletIds: wallet ? [wallet] : [],
      memberIds: member ? [member] : [],
    },
    period: period && PERIODS.includes(period) ? period : undefined,
    anchor: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined,
    q: get('q') ?? '',
    back: get('back') === '1',
  };
}
