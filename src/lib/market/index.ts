import fs from 'node:fs/promises';
import path from 'node:path';
import { parseCSVWithHeaders } from './csv';
import {
  rawBankSchema,
  rawFundSchema,
  rawManagerSchema,
  rawOfferSchema,
  transformBank,
  transformFund,
  transformManager,
  transformOffer,
} from './schemas';
import type {
  Bank,
  BankList,
  DataList,
  Fund,
  FundEstimate,
  FundList,
  Manager,
  ManagerList,
  Offer,
  OfferList,
} from './types';

import { estimatesFromRows } from '../calc/fund-estimate';
export * from './types';
export * from './schemas';
export * from './csv';
export * from './logos';

const DEFAULT_SHEET_BASE =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vRXmD2AKuwo9gMXiaJF3clZws0msaOmTEiFWhVd_8mxQg5wmXw6NDk9uB-azPwxAL0OfbsaIubwVH6l/pub?single=true&output=csv&gid=';

const TAB_GIDS = {
  offers: '1504478823',
  funds: '1692280800',
  banks: '399590378',
  managers: '1796292579',
} as const;

type TabName = keyof typeof TAB_GIDS;

// In-memory cache for 24 hours
interface CacheEntry<T> {
  data: DataList<T>;
  timestamp: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const inMemoryCache = new Map<TabName, CacheEntry<unknown>>();

// Validation stats tracker
const validationStats = {
  offers: { total: 0, activeEg: 0, valid: 0, dropped: 0 },
  funds: { total: 0, activeEg: 0, valid: 0, dropped: 0 },
  banks: { total: 0, activeEg: 0, valid: 0, dropped: 0 },
  managers: { total: 0, activeEg: 0, valid: 0, dropped: 0 },
};

export function getValidationStats() {
  return { ...validationStats };
}

export function clearDataCache(): void {
  inMemoryCache.clear();
}

function createDataList<T>(
  items: T[],
  hasError = false,
  missingColumns?: string[]
): DataList<T> {
  const list = [...items] as DataList<T>;
  if (hasError) {
    list.error = true;
  }
  if (missingColumns && missingColumns.length > 0) {
    list.missingColumns = missingColumns;
  }
  return list;
}

async function loadRawTabCSV(tab: TabName): Promise<string> {
  const dataSource = process.env.DATA_SOURCE;
  const fixturePath = path.join(
    process.cwd(),
    'src',
    'lib',
    'market',
    'fixtures',
    `${tab}.csv`
  );

  if (dataSource === 'fixtures') {
    return await fs.readFile(fixturePath, 'utf8');
  }

  const base = process.env.SHEET_CSV_BASE || DEFAULT_SHEET_BASE;
  const url = `${base}${TAB_GIDS[tab]}`;

  try {
    const res = await fetch(url, {
      next: {
        revalidate: 86400,
        tags: ['sheet-data', `sheet-${tab}`],
      },
    });

    if (res.ok) {
      const text = await res.text();
      if (!text.trim().startsWith('<') && text.trim().length > 0) {
        return text;
      }
    }
  } catch (err) {
    console.warn(`[market] Failed to fetch live sheet for ${tab}, falling back to fixture:`, err);
  }

  // Graceful fallback to local fixture
  return await fs.readFile(fixturePath, 'utf8');
}

const REQUIRED_OFFERS_COLUMNS = ['id', 'type', 'rate_percent', 'rate_kind'];
const OPTIONAL_OFFERS_COLUMNS = [
  'bank_en',
  'bank_ar',
  'name_en',
  'name_ar',
  'rate_note_en',
  'rate_note_ar',
  'term_months',
  'payout',
  'min_amount',
  'source_url',
  'checked_on',
  'active',
  'country',
  'currency',
  'sources',
  'published_on',
  'confidence',
  'term_days',
];

const REQUIRED_FUNDS_COLUMNS = ['id', 'fund_type', 'price'];
const OPTIONAL_FUNDS_COLUMNS = [
  'fund_en',
  'fund_ar',
  'manager_en',
  'manager_ar',
  'currency',
  'price_date',
  'change_30d_percent',
  'change_ytd_percent',
  'risk',
  'sharia',
  'source_url',
  'checked_on',
  'active',
  'country',
  'sources',
  'published_on',
  'confidence',
];

const REQUIRED_BANKS_COLUMNS = ['code', 'bank_en', 'bank_ar'];
const OPTIONAL_BANKS_COLUMNS = [
  'hotline',
  'website',
  'logo_url',
  'source_url',
  'checked_on',
  'logo',
  'country',
  'active',
];

const REQUIRED_MANAGERS_COLUMNS = ['manager_ar', 'manager_en'];
const OPTIONAL_MANAGERS_COLUMNS = [
  'phone',
  'website',
  'logo_url',
  'source_url',
  'checked_on',
  'country',
  'active',
];

function checkColumns(
  headers: string[],
  required: string[],
  optional: string[]
): { hasRequiredError: boolean; missingColumns: string[] } {
  const headerSet = new Set(headers);
  const missingRequired = required.filter((col) => !headerSet.has(col));
  const missingOptional = optional.filter((col) => !headerSet.has(col));
  const missingColumns = [...missingRequired, ...missingOptional];

  return {
    hasRequiredError: missingRequired.length > 0,
    missingColumns,
  };
}

export async function getOffers(): Promise<OfferList> {
  const cached = inMemoryCache.get('offers') as CacheEntry<Offer> | undefined;
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const rawText = await loadRawTabCSV('offers');
    const trimmed = rawText.trim();
    if (trimmed.startsWith('<') || trimmed.length === 0) {
      return createDataList<Offer>([], true);
    }

    const { headers, records } = parseCSVWithHeaders(trimmed);
    if (headers.length === 0) {
      return createDataList<Offer>([], true);
    }

    const { hasRequiredError, missingColumns } = checkColumns(
      headers,
      REQUIRED_OFFERS_COLUMNS,
      OPTIONAL_OFFERS_COLUMNS
    );

    if (hasRequiredError) {
      return createDataList<Offer>([], true, missingColumns);
    }

    validationStats.offers.total = records.length;
    let activeEgCount = 0;
    let validCount = 0;
    let droppedCount = 0;

    const offers: Offer[] = [];

    for (const record of records) {
      const active = (record.active || '').trim().toUpperCase();
      const country = (record.country || '').trim().toUpperCase();

      // Only rows with active = TRUE and country = EG
      if (active !== 'TRUE' || country !== 'EG') {
        continue;
      }
      activeEgCount++;

      const parseResult = rawOfferSchema.safeParse(record);
      if (!parseResult.success) {
        droppedCount++;
        continue;
      }

      offers.push(transformOffer(parseResult.data));
      validCount++;
    }

    validationStats.offers.activeEg = activeEgCount;
    validationStats.offers.valid = validCount;
    validationStats.offers.dropped = droppedCount;

    // If there were active rows and EVERY single one was dropped by schema validation -> error: true
    const hasSchemaDropError = activeEgCount > 0 && validCount === 0;

    const result = createDataList(offers, hasSchemaDropError, missingColumns);
    if (!result.error) {
      inMemoryCache.set('offers', { data: result, timestamp: Date.now() });
    }
    return result;
  } catch (err) {
    console.error('Error loading offers tab:', err);
    return createDataList<Offer>([], true);
  }
}

const ESTIMATES_FILE = path.join(process.cwd(), 'src', 'lib', 'market', 'fixtures', 'fund_estimates.csv');

function numOrNull(v: string | undefined): number | null {
  if (v == null || v.trim() === '') return null;
  const n = Number(v.replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

/**
 * The `fund_estimates` tab (docs/PLAN.md §5a), by fund id. Read from the sheet when FUND_ESTIMATES_GID is set,
 * otherwise from the file the estimates script writes. The app works without it: any failure gives an empty map.
 */
export async function getFundEstimates(): Promise<Map<string, FundEstimate>> {
  const map = new Map<string, FundEstimate>();
  try {
    let text: string;
    const gid = process.env.FUND_ESTIMATES_GID;
    if (gid && process.env.DATA_SOURCE !== 'fixtures') {
      const base = process.env.SHEET_CSV_BASE || DEFAULT_SHEET_BASE;
      const res = await fetch(`${base}${gid}`, { next: { revalidate: 86400, tags: ['sheet-data', 'sheet-fund_estimates'] } });
      if (!res.ok) return map;
      text = await res.text();
    } else {
      text = await fs.readFile(ESTIMATES_FILE, 'utf8');
    }
    if (text.trim().startsWith('<')) return map;
    const { records } = parseCSVWithHeaders(text.trim());
    for (const r of records) {
      const id = (r.id || '').trim();
      if (!id) continue;
      const method = (r.method || 'none').trim() || 'none';
      const estimatePercent = method === 'none' ? null : numOrNull(r.estimate_percent);
      map.set(id, {
        estimatePercent,
        method: estimatePercent == null ? 'none' : method,
        pricesUsed: numOrNull(r.prices_used),
        firstDate: (r.first_date || '').trim(),
        lastDate: (r.last_date || '').trim(),
        peers: numOrNull(r.peers),
        computedOn: (r.computed_on || '').trim(),
        modelVersion: (r.model_version || '').trim(),
      });
    }
  } catch {
    // The app must work without the tab.
  }
  return map;
}

export async function getFunds(): Promise<FundList> {
  const funds = await getFundsWithoutEstimates();
  if (funds.error || funds.length === 0) return funds;
  const estimates = await getFundEstimates();
  // A fund the estimates file does not know yet (added to the sheet later) gets the same written method,
  // worked out here from its own published changes.
  const live = estimatesFromRows(funds.filter((f) => !estimates.has(f.id)), funds);
  const withEstimates = funds.map((f) => ({ ...f, estimate: estimates.get(f.id) ?? live.get(f.id) ?? null }));
  return createDataList(withEstimates, false, funds.missingColumns);
}

async function getFundsWithoutEstimates(): Promise<FundList> {
  const cached = inMemoryCache.get('funds') as CacheEntry<Fund> | undefined;
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const rawText = await loadRawTabCSV('funds');
    const trimmed = rawText.trim();
    if (trimmed.startsWith('<') || trimmed.length === 0) {
      return createDataList<Fund>([], true);
    }

    const { headers, records } = parseCSVWithHeaders(trimmed);
    if (headers.length === 0) {
      return createDataList<Fund>([], true);
    }

    const { hasRequiredError, missingColumns } = checkColumns(
      headers,
      REQUIRED_FUNDS_COLUMNS,
      OPTIONAL_FUNDS_COLUMNS
    );

    if (hasRequiredError) {
      return createDataList<Fund>([], true, missingColumns);
    }

    validationStats.funds.total = records.length;
    let activeEgCount = 0;
    let validCount = 0;
    let droppedCount = 0;

    const funds: Fund[] = [];

    for (const record of records) {
      const active = (record.active || '').trim().toUpperCase();
      const country = (record.country || '').trim().toUpperCase();

      // Only rows with active = TRUE and country = EG
      if (active !== 'TRUE' || country !== 'EG') {
        continue;
      }
      activeEgCount++;

      const parseResult = rawFundSchema.safeParse(record);
      if (!parseResult.success) {
        droppedCount++;
        continue;
      }

      funds.push(transformFund(parseResult.data));
      validCount++;
    }

    validationStats.funds.activeEg = activeEgCount;
    validationStats.funds.valid = validCount;
    validationStats.funds.dropped = droppedCount;

    const hasSchemaDropError = activeEgCount > 0 && validCount === 0;

    const result = createDataList(funds, hasSchemaDropError, missingColumns);
    if (!result.error) {
      inMemoryCache.set('funds', { data: result, timestamp: Date.now() });
    }
    return result;
  } catch (err) {
    console.error('Error loading funds tab:', err);
    return createDataList<Fund>([], true);
  }
}

export async function getBanks(): Promise<BankList> {
  const cached = inMemoryCache.get('banks') as CacheEntry<Bank> | undefined;
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const rawText = await loadRawTabCSV('banks');
    const trimmed = rawText.trim();
    if (trimmed.startsWith('<') || trimmed.length === 0) {
      return createDataList<Bank>([], true);
    }

    const { headers, records } = parseCSVWithHeaders(trimmed);
    if (headers.length === 0) {
      return createDataList<Bank>([], true);
    }

    const { hasRequiredError, missingColumns } = checkColumns(
      headers,
      REQUIRED_BANKS_COLUMNS,
      OPTIONAL_BANKS_COLUMNS
    );

    if (hasRequiredError) {
      return createDataList<Bank>([], true, missingColumns);
    }

    validationStats.banks.total = records.length;
    let activeEgCount = 0;
    let validCount = 0;
    let droppedCount = 0;

    const banks: Bank[] = [];

    for (const record of records) {
      const active = (record.active || 'TRUE').trim().toUpperCase();
      const country = (record.country || '').trim().toUpperCase();

      if (active !== 'TRUE' || country !== 'EG') {
        continue;
      }
      activeEgCount++;

      const parseResult = rawBankSchema.safeParse(record);
      if (!parseResult.success) {
        droppedCount++;
        continue;
      }

      banks.push(transformBank(parseResult.data));
      validCount++;
    }

    validationStats.banks.activeEg = activeEgCount;
    validationStats.banks.valid = validCount;
    validationStats.banks.dropped = droppedCount;

    const hasSchemaDropError = activeEgCount > 0 && validCount === 0;

    const result = createDataList(banks, hasSchemaDropError, missingColumns);
    if (!result.error) {
      inMemoryCache.set('banks', { data: result, timestamp: Date.now() });
    }
    return result;
  } catch (err) {
    console.error('Error loading banks tab:', err);
    return createDataList<Bank>([], true);
  }
}

export async function getManagers(): Promise<ManagerList> {
  const cached = inMemoryCache.get('managers') as CacheEntry<Manager> | undefined;
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const rawText = await loadRawTabCSV('managers');
    const trimmed = rawText.trim();
    if (trimmed.startsWith('<') || trimmed.length === 0) {
      return createDataList<Manager>([], true);
    }

    const { headers, records } = parseCSVWithHeaders(trimmed);
    if (headers.length === 0) {
      return createDataList<Manager>([], true);
    }

    const { hasRequiredError, missingColumns } = checkColumns(
      headers,
      REQUIRED_MANAGERS_COLUMNS,
      OPTIONAL_MANAGERS_COLUMNS
    );

    if (hasRequiredError) {
      return createDataList<Manager>([], true, missingColumns);
    }

    validationStats.managers.total = records.length;
    let activeEgCount = 0;
    let validCount = 0;
    let droppedCount = 0;

    const managers: Manager[] = [];

    for (const record of records) {
      const active = (record.active || 'TRUE').trim().toUpperCase();
      const country = (record.country || '').trim().toUpperCase();

      if (active !== 'TRUE' || country !== 'EG') {
        continue;
      }
      activeEgCount++;

      const parseResult = rawManagerSchema.safeParse(record);
      if (!parseResult.success) {
        droppedCount++;
        continue;
      }

      managers.push(transformManager(parseResult.data));
      validCount++;
    }

    validationStats.managers.activeEg = activeEgCount;
    validationStats.managers.valid = validCount;
    validationStats.managers.dropped = droppedCount;

    const hasSchemaDropError = activeEgCount > 0 && validCount === 0;

    const result = createDataList(managers, hasSchemaDropError, missingColumns);
    if (!result.error) {
      inMemoryCache.set('managers', { data: result, timestamp: Date.now() });
    }
    return result;
  } catch (err) {
    console.error('Error loading managers tab:', err);
    return createDataList<Manager>([], true);
  }
}

export async function getOffer(id: string): Promise<Offer | null> {
  const offers = await getOffers();
  return offers.find((o) => o.id === id) || null;
}

export async function getFund(id: string): Promise<Fund | null> {
  const funds = await getFunds();
  return funds.find((f) => f.id === id) || null;
}

export async function getBank(code: string): Promise<Bank | null> {
  const banks = await getBanks();
  return banks.find((b) => b.code.toLowerCase() === code.toLowerCase()) || null;
}

export async function getLastUpdated(): Promise<string | null> {
  const [offers, funds] = await Promise.all([getOffers(), getFunds()]);
  const dates: string[] = [];

  for (const o of offers) {
    if (o.publishedOn) dates.push(o.publishedOn);
  }
  for (const f of funds) {
    if (f.publishedOn) dates.push(f.publishedOn);
  }

  if (dates.length === 0) return null;
  dates.sort();
  return dates[dates.length - 1];
}
