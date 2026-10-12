import type { EnrichedEntry } from '@/lib/data/types';
import { normalizeDigits } from '@/lib/format';

/**
 * Normalises text for bilingual, forgiving search:
 * - Converts Arabic-Indic and Persian digits to ASCII 0-9
 * - Normalises common Arabic letter variants (alef forms, teh marbuta, alef maqsura)
 * - Removes Arabic diacritics / tashkeel
 * - Lowercases for case-insensitive matching
 */
export function normalizeSearchTerm(term: string | null | undefined): string {
  if (!term) return '';
  const asciiDigits = normalizeDigits(term);
  return asciiDigits
    .toLowerCase()
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '')
    .trim();
}

/**
 * Checks whether an enriched entry matches the search query.
 * Matches:
 * - Item name (English and Arabic)
 * - Subcategory name (English and Arabic)
 * - Category name (English and Arabic)
 * - Note
 * - Amount (both integer and decimal representations)
 */
export function matchHistoryEntry(entry: EnrichedEntry, query: string): boolean {
  const normQuery = normalizeSearchTerm(query);
  if (!normQuery) return true;

  // 1. Text fields
  const fieldsToMatch: (string | null | undefined)[] = [
    entry.itemNameEn,
    entry.itemNameAr,
    entry.subcategoryNameEn,
    entry.subcategoryNameAr,
    entry.categoryNameEn,
    entry.categoryNameAr,
    entry.note,
  ];

  for (const field of fieldsToMatch) {
    if (field && normalizeSearchTerm(field).includes(normQuery)) {
      return true;
    }
  }

  // 2. Amount matching
  if (entry.amount !== undefined && entry.amount !== null) {
    const rawAmt = entry.amount.toString();
    const fixedAmt = entry.amount.toFixed(2);
    const intAmt = Math.floor(Math.abs(entry.amount)).toString();

    if (
      rawAmt.includes(normQuery) ||
      fixedAmt.includes(normQuery) ||
      intAmt.includes(normQuery)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Filters a list of enriched entries by the search query.
 * Returns the original array if the query is blank.
 */
export function searchHistory(
  entries: EnrichedEntry[] | undefined,
  query: string
): EnrichedEntry[] | undefined {
  if (!entries) return entries;
  const trimmed = query.trim();
  if (!trimmed) return entries;

  return entries.filter((e) => matchHistoryEntry(e, trimmed));
}
