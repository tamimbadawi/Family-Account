/**
 * Online Currency Converter Utility
 * Fetches real-time exchange rates from public exchange rate feeds
 * and converts amounts rounded to 2 decimal places.
 */

export interface ExchangeRateResult {
  from: string;
  to: string;
  rate: number;
  provider: string;
  updatedAt?: string;
}

/**
 * Rounds an amount to 2 decimal places to avoid floating point issues.
 */
export function convertAmount(amount: number, rate: number): number {
  if (!Number.isFinite(amount) || !Number.isFinite(rate)) return 0;
  return Math.round((amount * rate + Number.EPSILON) * 100) / 100;
}

/**
 * Fetches the live exchange rate between two currency codes (e.g. 'USD' and 'EGP').
 * Tries open.er-api.com first, with fallback to frankfurter.app.
 */
export async function fetchExchangeRate(
  fromCurrency: string,
  toCurrency: string
): Promise<ExchangeRateResult> {
  const from = fromCurrency.trim().toUpperCase();
  const to = toCurrency.trim().toUpperCase();

  if (from === to) {
    return {
      from,
      to,
      rate: 1,
      provider: 'identical',
    };
  }

  // Primary: ExchangeRate-API (open.er-api.com) - no key required, highly reliable
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${from}`, {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.result === 'success' && data.rates && typeof data.rates[to] === 'number') {
        return {
          from,
          to,
          rate: data.rates[to],
          provider: 'ExchangeRate-API',
          updatedAt: data.time_last_update_utc,
        };
      }
    }
  } catch {
    // Primary failed, proceed to fallback
  }

  // Fallback: Frankfurter API (open ECB rates)
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`, {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.rates && typeof data.rates[to] === 'number') {
        return {
          from,
          to,
          rate: data.rates[to],
          provider: 'Frankfurter',
          updatedAt: data.date,
        };
      }
    }
  } catch {
    // Fallback failed
  }

  throw new Error(`Could not fetch exchange rate for ${from} to ${to}. Please check connection or enter rate manually.`);
}
