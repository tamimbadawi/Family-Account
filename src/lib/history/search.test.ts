import { describe, expect, it } from 'vitest';
import type { EnrichedEntry } from '@/lib/data/types';
import { matchHistoryEntry, normalizeSearchTerm, searchHistory } from './search';

const sampleEntry: EnrichedEntry = {
  id: 'e1',
  householdId: 'h1',
  type: 'expense',
  amount: 250.5,
  occurredOn: '2026-10-12',
  accountId: 'w1',
  toAccountId: null,
  itemId: 'i1',
  note: 'Weekly shopping at Carrefour',
  photoPath: null,
  createdBy: 'u1',
  updatedBy: null,
  createdAt: '2026-10-12T10:00:00Z',
  updatedAt: '2026-10-12T10:00:00Z',
  deletedAt: null,
  categoryNameEn: 'Groceries',
  categoryNameAr: 'بقالة ومشتريات',
  subcategoryNameEn: 'Supermarket',
  subcategoryNameAr: 'سوبر ماركت',
  itemNameEn: 'Milk & Eggs',
  itemNameAr: 'لبن وبيض',
};

describe('normalizeSearchTerm', () => {
  it('converts Arabic-Indic digits to ASCII', () => {
    expect(normalizeSearchTerm('٢٥٠')).toBe('250');
    expect(normalizeSearchTerm('١٢٣٤٫٥٠')).toBe('1234.50');
  });

  it('normalises Arabic letters and removes diacritics', () => {
    expect(normalizeSearchTerm('أرز')).toBe('ارز');
    expect(normalizeSearchTerm('إيجار')).toBe('ايجار');
    expect(normalizeSearchTerm('بَقَالَةٌ')).toBe('بقاله');
    expect(normalizeSearchTerm('حلوى')).toBe('حلوي');
    expect(normalizeSearchTerm('مستشفى')).toBe('مستشفي');
  });

  it('lowercases English text', () => {
    expect(normalizeSearchTerm('Carrefour Market')).toBe('carrefour market');
  });
});

describe('matchHistoryEntry', () => {
  it('matches English item name', () => {
    expect(matchHistoryEntry(sampleEntry, 'milk')).toBe(true);
    expect(matchHistoryEntry(sampleEntry, 'Eggs')).toBe(true);
  });

  it('matches Arabic item name', () => {
    expect(matchHistoryEntry(sampleEntry, 'لبن')).toBe(true);
    expect(matchHistoryEntry(sampleEntry, 'بيض')).toBe(true);
  });

  it('matches subcategory name in both languages', () => {
    expect(matchHistoryEntry(sampleEntry, 'Supermarket')).toBe(true);
    expect(matchHistoryEntry(sampleEntry, 'ماركت')).toBe(true);
  });

  it('matches category name in both languages', () => {
    expect(matchHistoryEntry(sampleEntry, 'Groceries')).toBe(true);
    expect(matchHistoryEntry(sampleEntry, 'بقالة')).toBe(true);
    expect(matchHistoryEntry(sampleEntry, 'بقاله')).toBe(true); // normalized teh marbuta
  });

  it('matches note text', () => {
    expect(matchHistoryEntry(sampleEntry, 'Carrefour')).toBe(true);
    expect(matchHistoryEntry(sampleEntry, 'weekly')).toBe(true);
  });

  it('matches amount with Western digits', () => {
    expect(matchHistoryEntry(sampleEntry, '250')).toBe(true);
    expect(matchHistoryEntry(sampleEntry, '250.5')).toBe(true);
    expect(matchHistoryEntry(sampleEntry, '250.50')).toBe(true);
  });

  it('matches amount with Arabic-Indic digits', () => {
    expect(matchHistoryEntry(sampleEntry, '٢٥٠')).toBe(true);
    expect(matchHistoryEntry(sampleEntry, '٢٥٠٫٥')).toBe(true);
  });

  it('returns true on empty or whitespace query', () => {
    expect(matchHistoryEntry(sampleEntry, '')).toBe(true);
    expect(matchHistoryEntry(sampleEntry, '   ')).toBe(true);
  });

  it('returns false when nothing matches', () => {
    expect(matchHistoryEntry(sampleEntry, 'Pharmacy')).toBe(false);
    expect(matchHistoryEntry(sampleEntry, 'صيدلية')).toBe(false);
    expect(matchHistoryEntry(sampleEntry, '999')).toBe(false);
  });
});

describe('searchHistory', () => {
  it('filters a list of entries', () => {
    const entry2: EnrichedEntry = {
      ...sampleEntry,
      id: 'e2',
      itemNameEn: 'Coffee',
      itemNameAr: 'قهوة',
      amount: 45,
    };

    const list = [sampleEntry, entry2];

    expect(searchHistory(list, '')).toEqual(list);
    expect(searchHistory(list, 'milk')).toEqual([sampleEntry]);
    expect(searchHistory(list, 'قهوة')).toEqual([entry2]);
    expect(searchHistory(list, '٤٥')).toEqual([entry2]);
    expect(searchHistory(list, 'none')).toEqual([]);
  });
});
