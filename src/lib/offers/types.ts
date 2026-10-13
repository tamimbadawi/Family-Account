// The shape of one row of the bank-offers "offers" sheet, as the bank-offers app reads it
// (bank-offers src/lib/data/types.ts). Only certificates and treasury bills; funds are not read here.

export type Confidence = 'confirmed' | 'single' | 'differ' | 'stale';

export interface Offer {
  id: string;
  bankCode: string;
  bankEn: string;
  bankAr: string;
  nameEn: string;
  nameAr: string;
  type: 'certificate' | 'tbill' | string;
  ratePercent: number;
  rateKind: 'fixed' | 'variable' | 'stepped' | string;
  rateNoteEn: string;
  rateNoteAr: string;
  termMonths: number | null;
  termDays?: number | null;
  payout: string | null;
  minAmount: number | null;
  currency: string;
  sourceUrl: string | null;
  sources: string[];
  publishedOn: string;
  confidence: Confidence;
  country: string;
}
