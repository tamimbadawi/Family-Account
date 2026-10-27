function toDecimalString(n: number): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '';
  const str = n.toString();
  if (!str.includes('e') && !str.includes('E')) return str;
  return n.toFixed(20).replace(/\.?0+$/, '');
}

/**
 * Format a number preserving exact published decimals without rounding,
 * using Western digits and comma thousands separators. Handles exponential notation (1e-7).
 */
export function formatNumber(n: number): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '';
  const isNegative = n < 0;
  const absStr = toDecimalString(Math.abs(n));
  const parts = absStr.split('.');
  const intWithCommas = Number(parts[0]).toLocaleString('en-US');
  const frac = parts[1] ? `.${parts[1]}` : '';
  const result = `${intWithCommas}${frac}`;
  return isNegative ? `-${result}` : result;
}

/**
 * Format calculated money amounts: exactly two decimals, rounded down, never up.
 * E.g. moneyRounded(1479.1666, 'EGP', 'en') -> 'EGP 1,479.16'
 *      moneyRounded(1479.1666, 'EGP', 'ar') -> '1,479.16 ج.م'
 *      moneyRounded(1000, 'EGP', 'en') -> 'EGP 1,000.00'
 */
export function moneyRounded(
  n: number,
  currency = 'EGP',
  locale = 'en'
): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '';
  const isNegative = n < 0;
  const abs = Math.abs(n);
  // Floor to 2 decimals, never round up
  const flooredNum = Math.floor(abs * 100) / 100;
  const parts = flooredNum.toFixed(2).split('.');
  const intWithCommas = Number(parts[0]).toLocaleString('en-US');
  const formatted = `${intWithCommas}.${parts[1]}`;
  const signedFormatted = isNegative ? `-${formatted}` : formatted;

  const curEn = currency;
  const curAr = currency === 'EGP' ? 'ج.م' : currency;

  if (locale === 'ar') {
    return `${signedFormatted} ${curAr}`;
  }
  return `${curEn} ${signedFormatted}`;
}

/**
 * Whole-pound money: no decimals, rounded normally. E.g. 100,000 EGP.
 */
export function wholeMoney(
  n: number,
  currency = 'EGP',
  locale = 'en'
): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '';
  const isNegative = n < 0;
  const rounded = Math.round(Math.abs(n)).toLocaleString('en-US');
  const curEn = currency;
  const curAr = currency === 'EGP' ? 'ج.م' : currency;

  if (locale === 'ar') {
    return isNegative ? `-${rounded} ${curAr}` : `${rounded} ${curAr}`;
  }
  return isNegative ? `-${curEn} ${rounded}` : `${curEn} ${rounded}`;
}

/**
 * Format a rate percent, with up to 2 decimal places. Handles scientific notation (1e-7).
 */
export function percent(n: number | null | undefined): string {
  if (n == null || typeof n !== 'number' || !Number.isFinite(n)) return '';
  const absStr = toDecimalString(Math.abs(n));
  const sign = n < 0 ? '-' : '';
  const parts = absStr.split('.');
  let frac = parts[1] || '';
  if (frac.length > 2 && !absStr.includes('000000')) {
    // Round to 2 decimal places for typical rates
    const rounded = Number(n.toFixed(2));
    const rParts = toDecimalString(Math.abs(rounded)).split('.');
    frac = rParts[1] || '';
    return `${rounded < 0 ? '-' : ''}${rParts[0]}${frac ? `.${frac}` : ''}%`;
  }
  return `${sign}${parts[0]}${frac ? `.${frac}` : ''}%`;
}
