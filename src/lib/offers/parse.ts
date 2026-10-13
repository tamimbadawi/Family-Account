import { parseCSVWithHeaders } from './csv';
import type { Confidence, Offer } from './types';

// Same rules as the bank-offers app (src/lib/data/index.ts + schemas.ts): only active Egyptian rows,
// a row needs an id, a type, a rate, a rate kind and a name, and a bad row is skipped, never guessed.

const REQUIRED_COLUMNS = ['id', 'type', 'rate_percent', 'rate_kind'];
const CONFIDENCE_VALUES: Confidence[] = ['confirmed', 'single', 'differ', 'stale'];

function num(raw: string | undefined): number | null {
  if (!raw || raw.trim() === '') return null;
  const n = Number(raw.replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

function text(raw: string | undefined): string {
  return (raw ?? '').trim();
}

export interface ParsedOffers {
  offers: Offer[];
  /** The sheet could not be read as a list of offers at all. */
  error: boolean;
}

export function parseOffersCsv(csv: string): ParsedOffers {
  const trimmed = csv.trim();
  if (trimmed === '' || trimmed.startsWith('<')) return { offers: [], error: true };

  const { headers, records } = parseCSVWithHeaders(trimmed);
  if (REQUIRED_COLUMNS.some((c) => !headers.includes(c))) return { offers: [], error: true };

  const offers: Offer[] = [];
  for (const r of records) {
    if (text(r.active).toUpperCase() !== 'TRUE' || text(r.country).toUpperCase() !== 'EG') continue;

    const id = text(r.id);
    const type = text(r.type);
    const rateKind = text(r.rate_kind);
    const ratePercent = num(r.rate_percent);
    const nameEn = text(r.name_en);
    const nameAr = text(r.name_ar);
    if (!id || !type || !rateKind || ratePercent == null || (!nameEn && !nameAr)) continue;

    const sourceUrl = text(r.source_url) || null;
    const sources = text(r.sources)
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean);
    const confidence = text(r.confidence).toLowerCase() as Confidence;

    offers.push({
      id,
      bankCode: id.includes('-') ? id.slice(0, id.indexOf('-')) : id,
      bankEn: text(r.bank_en),
      bankAr: text(r.bank_ar),
      nameEn,
      nameAr,
      type,
      ratePercent,
      rateKind,
      rateNoteEn: text(r.rate_note_en),
      rateNoteAr: text(r.rate_note_ar),
      termMonths: num(r.term_months),
      termDays: num(r.term_days),
      payout: text(r.payout) || null,
      minAmount: num(r.min_amount),
      currency: text(r.currency) || 'EGP',
      sourceUrl,
      sources,
      publishedOn: text(r.published_on) || text(r.checked_on),
      confidence: CONFIDENCE_VALUES.includes(confidence) ? confidence : 'single',
      country: 'EG',
    });
  }

  // Every active row was unreadable: treat it as a broken sheet, not as "no offers".
  return { offers, error: offers.length === 0 && records.length > 0 };
}
