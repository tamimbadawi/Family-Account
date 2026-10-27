export type Confidence = 'confirmed' | 'single' | 'differ' | 'stale';

export interface Offer {
  id: string;
  bankCode: string;
  bankEn: string;
  bankAr: string;
  nameEn: string;
  nameAr: string;
  type: 'certificate' | 'tbill' | 'tbond' | string;
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

export interface Fund {
  id: string;
  fundEn: string;
  fundAr: string;
  managerEn: string;
  managerAr: string;
  fundType: string;
  currency: string;
  price: number;
  change30dPercent: number | null;
  changeYtdPercent: number | null;
  risk: string | null;
  sharia: boolean | null;
  sourceUrl: string | null;
  sources: string[];
  publishedOn: string;
  confidence: Confidence;
  country: string;
  /** The statistical estimate from the `fund_estimates` tab (docs/PLAN.md §5a); null when there is none. */
  estimate?: FundEstimate | null;
  /** Grade A–E from the written method in src/lib/calc/goal.ts (gradeFunds); null when not graded. */
  grade?: 'A' | 'B' | 'C' | 'D' | 'E' | null;
  gradeScore?: number | null;
}

export type EstimateMethod = 'history' | 'ytd' | 'yield' | 'none';

export interface FundEstimate {
  /** Estimated median yearly change in percent; null when method is 'none'. */
  estimatePercent: number | null;
  method: EstimateMethod | string;
  pricesUsed: number | null;
  firstDate: string;
  lastDate: string;
  peers: number | null;
  computedOn: string;
  modelVersion: string;
}

export interface Bank {
  code: string;
  bankEn: string;
  bankAr: string;
  hotline: string | null;
  website: string | null;
  logoUrl: string | null;
  sourceUrl: string | null;
  checkedOn: string;
}

export interface Manager {
  managerAr: string;
  managerEn: string;
  phone: string | null;
  website: string | null;
  logoUrl: string | null;
  sourceUrl: string | null;
  checkedOn: string;
}

export type DataList<T> = T[] & {
  error?: boolean;
  missingColumns?: string[];
};

export type OfferList = DataList<Offer>;
export type FundList = DataList<Fund>;
export type BankList = DataList<Bank>;
export type ManagerList = DataList<Manager>;
