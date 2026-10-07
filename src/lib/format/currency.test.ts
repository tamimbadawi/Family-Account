import { describe, expect, it } from 'vitest';
import { currencyChoices, currencySymbol, isCurrencyCode } from './currency';
import { money } from './index';

describe('currency', () => {
  it('labels amounts by language', () => {
    expect(currencySymbol('EGP', 'en')).toBe('EGP');
    expect(currencySymbol('EGP', 'ar')).toBe('ج.م');
    expect(currencySymbol('usd', 'ar')).toBe('$');
    expect(currencySymbol('JPY', 'ar')).toBe('JPY');
  });
  it('lists common currencies first, then every other one once', () => {
    const list = currencyChoices('en');
    expect(list.slice(0, 3).map((c) => c.code)).toEqual(['EGP', 'USD', 'EUR']);
    expect(list.find((c) => c.code === 'USD')?.name).toMatch(/Dollar/);
    expect(new Set(list.map((c) => c.code)).size).toBe(list.length);
  });
  it('accepts only ISO codes', () => {
    expect(isCurrencyCode('SAR')).toBe(true);
    expect(isCurrencyCode('sar')).toBe(false);
    expect(isCurrencyCode('EG')).toBe(false);
  });
  it('money() writes the given currency, EGP by default', () => {
    expect(money(1250, 'en')).toBe('1,250 EGP');
    expect(money(1250, 'en', { currency: 'USD' })).toBe('1,250 USD');
    expect(money(-5, 'ar', { currency: 'USD' })).toBe('-5 $');
  });
});
