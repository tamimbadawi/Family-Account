import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { convertAmount, fetchExchangeRate } from './converter';

describe('converter', () => {
  describe('convertAmount', () => {
    it('accurately converts and rounds to 2 decimal places', () => {
      expect(convertAmount(100, 1.5)).toBe(150);
      expect(convertAmount(10.55, 56.27)).toBe(593.65);
      expect(convertAmount(100, 0.0178)).toBe(1.78);
      expect(convertAmount(0, 50)).toBe(0);
      expect(convertAmount(NaN, 50)).toBe(0);
    });
  });

  describe('fetchExchangeRate', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
      vi.restoreAllMocks();
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('returns rate 1 when from and to are identical', async () => {
      const res = await fetchExchangeRate('EGP', 'EGP');
      expect(res.rate).toBe(1);
      expect(res.provider).toBe('identical');
    });

    it('fetches rate from primary provider', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          result: 'success',
          time_last_update_utc: 'Tue, 27 Oct 2026 00:00:00 +0000',
          rates: {
            EGP: 56.27,
          },
        }),
      } as unknown as Response);

      const res = await fetchExchangeRate('USD', 'EGP');
      expect(res.rate).toBe(56.27);
      expect(res.provider).toBe('ExchangeRate-API');
    });

    it('falls back to secondary provider if primary fails', async () => {
      globalThis.fetch = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            rates: {
              EGP: 55.8,
            },
            date: '2026-10-27',
          }),
        } as unknown as Response);

      const res = await fetchExchangeRate('USD', 'EGP');
      expect(res.rate).toBe(55.8);
      expect(res.provider).toBe('Frankfurter');
    });

    it('throws error when all providers fail', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      await expect(fetchExchangeRate('USD', 'XYZ')).rejects.toThrow('Could not fetch exchange rate');
    });
  });
});
