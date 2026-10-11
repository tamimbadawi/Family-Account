// History periods: one day, week (Saturday → Friday, as in Egypt), month or year around an anchor date.
// All dates are local 'YYYY-MM-DD' strings; nothing here touches UTC.

export type Period = 'day' | 'week' | 'month' | 'year';
export const PERIODS: Period[] = ['day', 'week', 'month', 'year'];

const pad = (n: number) => String(n).padStart(2, '0');
export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromISO = (s: string) => new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));

export interface Range {
  startDate: string;
  endDate: string;
}

/** The day/week/month/year that contains `anchor`. */
export function rangeOf(period: Period, anchor: string): Range {
  const d = fromISO(anchor);
  if (period === 'day') return { startDate: anchor, endDate: anchor };
  if (period === 'week') {
    const back = (d.getDay() + 1) % 7; // days since Saturday
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - back);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    return { startDate: toISO(start), endDate: toISO(end) };
  }
  if (period === 'month') {
    return {
      startDate: toISO(new Date(d.getFullYear(), d.getMonth(), 1)),
      endDate: toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
    };
  }
  return { startDate: `${d.getFullYear()}-01-01`, endDate: `${d.getFullYear()}-12-31` };
}

/** The anchor moved by `steps` whole periods (month/year moves keep a valid day: Jan 31 + 1 month = Feb 28/29). */
export function shiftAnchor(period: Period, anchor: string, steps: number): string {
  const d = fromISO(anchor);
  if (period === 'day') return toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + steps));
  if (period === 'week') return toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7 * steps));
  if (period === 'month') {
    const target = new Date(d.getFullYear(), d.getMonth() + steps, 1);
    const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    return toISO(new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), last)));
  }
  const last = new Date(d.getFullYear() + steps, d.getMonth() + 1, 0).getDate();
  return toISO(new Date(d.getFullYear() + steps, d.getMonth(), Math.min(d.getDate(), last)));
}

/** The `count` periods ending with the one that contains `anchor`, oldest first. */
export function lastPeriods(period: Period, anchor: string, count: number): Range[] {
  return Array.from({ length: count }, (_, i) => rangeOf(period, shiftAnchor(period, anchor, i - (count - 1))));
}

/** Which of `ranges` a date falls in (-1 if none). */
export function bucketIndex(ranges: Range[], date: string): number {
  return ranges.findIndex((r) => date >= r.startDate && date <= r.endDate);
}

const intl = (locale: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locale.startsWith('ar') ? 'ar-EG' : 'en-EG', { numberingSystem: 'latn', ...opts });

/** Header label: "Wednesday, Oct 7" · "Oct 3 – 9" · "October 2026" · "2026". */
export function periodLabel(period: Period, anchor: string, locale: string): string {
  const { startDate, endDate } = rangeOf(period, anchor);
  const s = fromISO(startDate);
  const e = fromISO(endDate);
  if (period === 'day') return intl(locale, { weekday: 'long', month: 'short', day: 'numeric' }).format(s);
  if (period === 'week') {
    const sameMonth = s.getMonth() === e.getMonth();
    const end = intl(locale, sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' }).format(e);
    return `${intl(locale, { month: 'short', day: 'numeric' }).format(s)} – ${end}`;
  }
  if (period === 'month') return intl(locale, { month: 'long', year: 'numeric' }).format(s);
  return String(s.getFullYear());
}

/** Short bar label under the history chart: "Wed" · "3/10" · "Oct" · "2026". */
export function barLabel(period: Period, range: Range, locale: string): string {
  const s = fromISO(range.startDate);
  if (period === 'day') return intl(locale, { weekday: 'short' }).format(s);
  if (period === 'week') return `${s.getDate()}/${s.getMonth() + 1}`; // day/month, as written in Egypt
  if (period === 'month') return intl(locale, { month: 'short' }).format(s);
  return String(s.getFullYear());
}
