import { describe, expect, it } from 'vitest';
import { formatDay, formatMonth, money, normalizeDigits, pickName, shiftMonth } from './index';

describe('normalizeDigits', () => {
  it('converts Arabic-Indic digits to ASCII', () => {
    expect(normalizeDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
    expect(normalizeDigits('١٢٥٠')).toBe('1250');
  });

  it('converts Eastern Arabic-Indic (Persian) digits to ASCII', () => {
    expect(normalizeDigits('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789');
  });

  it('handles decimal comma ٫ and removes thousands separators', () => {
    expect(normalizeDigits('١٬٢٣٤٫٥٠')).toBe('1234.50');
    expect(normalizeDigits('1,234.50')).toBe('1234.50');
  });

  it('handles null, undefined and empty strings', () => {
    expect(normalizeDigits('')).toBe('');
    expect(normalizeDigits(null)).toBe('');
    expect(normalizeDigits(undefined)).toBe('');
  });
});

describe('money', () => {
  it('formats whole amounts in English and Arabic with Western digits', () => {
    expect(money(1250, 'en')).toBe('1,250 EGP');
    expect(money(1250, 'ar')).toBe('1,250 ج.م');
  });

  it('formats decimal amounts with 2 decimal places', () => {
    expect(money(1250.5, 'en')).toBe('1,250.50 EGP');
    expect(money(1250.5, 'ar')).toBe('1,250.50 ج.م');
  });

  it('supports explicit sign option', () => {
    expect(money(500, 'en', { sign: true })).toBe('+500 EGP');
    expect(money(-500, 'en', { sign: true })).toBe('-500 EGP');
    expect(money(-500, 'en')).toBe('-500 EGP');
    expect(money(500, 'ar', { sign: true })).toBe('+500 ج.م');
  });

  it('supports hideCurrency', () => {
    expect(money(1250, 'en', { hideCurrency: true })).toBe('1,250');
    expect(money(1250.75, 'ar', { hideCurrency: true })).toBe('1,250.75');
  });

  it('supports compact notation', () => {
    const enCompact = money(15000, 'en', { compact: true });
    expect(enCompact).toContain('15K');
    expect(enCompact).toContain('EGP');

    const arCompact = money(15000, 'ar', { compact: true });
    // In Arabic with latn numbers: 15 ألف ج.م
    expect(arCompact).toContain('15');
    expect(arCompact).toContain('ج.م');
  });
});

describe('pickName', () => {
  const row = {
    name_ar: 'المنزل',
    name_en: 'Home',
  };

  it('selects Arabic name when locale is ar', () => {
    expect(pickName(row, 'ar')).toBe('المنزل');
  });

  it('selects English name when locale is en', () => {
    expect(pickName(row, 'en')).toBe('Home');
  });

  it('falls back to the other language if preferred is missing', () => {
    expect(pickName({ name_ar: 'المنزل' }, 'en')).toBe('المنزل');
    expect(pickName({ name_en: 'Home' }, 'ar')).toBe('Home');
    expect(pickName({ name: 'General' }, 'ar')).toBe('General');
  });

  it('handles null/undefined safely', () => {
    expect(pickName(null, 'en')).toBe('');
    expect(pickName(undefined, 'ar')).toBe('');
  });
});

describe('formatDay', () => {
  it('formats today with relative prefix', () => {
    const today = new Date();
    const formattedEn = formatDay(today, 'en');
    const formattedAr = formatDay(today, 'ar');

    expect(formattedEn).toContain('Today ·');
    expect(formattedAr).toContain('النهارده ·');
  });

  it('formats yesterday with relative prefix', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const formattedEn = formatDay(yesterday, 'en');
    const formattedAr = formatDay(yesterday, 'ar');

    expect(formattedEn).toContain('Yesterday ·');
    expect(formattedAr).toContain('امبارح ·');
  });

  it('formats older date with weekday and month', () => {
    const pastDate = new Date(2025, 9, 5); // Oct 5, 2025 (Sunday)
    const formattedEn = formatDay(pastDate, 'en');
    const formattedAr = formatDay(pastDate, 'ar');

    expect(formattedEn).toContain('Sunday');
    expect(formattedEn).toContain('5');
    expect(formattedAr).toContain('5');
  });
});

describe('formatMonth & shiftMonth', () => {
  it('formats month in English and Arabic with Western digits', () => {
    const en = formatMonth('2026-10', 'en');
    const ar = formatMonth('2026-10', 'ar');

    expect(en).toBe('October 2026');
    expect(ar).toContain('2026');
    expect(ar).toContain('أكتوبر');
  });

  it('shifts month forward and backward across year boundary', () => {
    expect(shiftMonth('2026-10', 1)).toBe('2026-11');
    expect(shiftMonth('2026-10', -1)).toBe('2026-09');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });
});

