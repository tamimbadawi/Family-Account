// =========================================================
// Pivot Engine  ·  Family Accounts (حساباتنا)
// Pure computation behind the Breakdown tab
// Free of React and Dexie imports
// =========================================================

import type {
  AccountRow,
  Category,
  CategoryRow,
  EnrichedEntry,
  Entry,
  HouseholdMemberRow,
  Item,
  ItemRow,
  Member,
  Subcategory,
  SubcategoryRow,
  TransactionRow,
  Wallet,
} from '../data/types';

export type PivotMeasure = 'expense' | 'income' | 'net';
export type PivotRowDimension = 'category' | 'subcategory' | 'item' | 'wallet' | 'person';
export type PivotColumnDimension = 'month' | 'week' | 'wallet' | 'category' | 'none';

export interface PivotConfig {
  measure: PivotMeasure;
  rows: PivotRowDimension;
  columns: PivotColumnDimension;
  period?: {
    from?: string; // 'YYYY-MM-DD'
    to?: string;   // 'YYYY-MM-DD'
  };
  filter?: {
    categoryId?: string;
    subcategoryId?: string;
  };
  locale?: 'ar' | 'en';
}

export type LookupCategory = Category | CategoryRow;
export type LookupSubcategory = Subcategory | SubcategoryRow;
export type LookupItem = Item | ItemRow;
export type LookupWallet = Wallet | AccountRow;
export type LookupMember = Member | HouseholdMemberRow;

export interface PivotLookups {
  categories?: Map<string, LookupCategory> | Record<string, LookupCategory> | LookupCategory[];
  subcategories?: Map<string, LookupSubcategory> | Record<string, LookupSubcategory> | LookupSubcategory[];
  items?: Map<string, LookupItem> | Record<string, LookupItem> | LookupItem[];
  wallets?: Map<string, LookupWallet> | Record<string, LookupWallet> | LookupWallet[];
  members?: Map<string, LookupMember> | Record<string, LookupMember> | LookupMember[];
  locale?: 'ar' | 'en';
}

export interface PivotResult {
  rowKeys: string[];
  rowLabels: string[];
  colKeys: string[];
  colLabels: string[];
  cells: number[][];
  rowTotals: number[];
  colTotals: number[];
  grandTotal: number;
}

const MONTH_NAMES_EN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const MONTH_NAMES_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

// Round to 2 decimal places
export function round2(val: number): number {
  return Math.round(val * 100) / 100;
}

// Parse local YYYY-MM-DD date without UTC skew
export function parseLocalDate(str: string): Date {
  const parts = str.split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2] || 1);
}

export function formatLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// In Egypt, the week starts on Saturday.
// Saturday: getDay() === 6 -> offset 0
// Sunday: getDay() === 0 -> offset 1
// ...
// Friday: getDay() === 5 -> offset 6
export function getEgyptWeekStart(d: Date): Date {
  const day = d.getDay();
  const offset = (day + 1) % 7;
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function formatMonthLabel(monthKey: string, locale: 'ar' | 'en'): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const monthIdx = Number(monthStr) - 1;
  const year = yearStr;

  if (locale === 'ar') {
    return `${MONTH_NAMES_AR[monthIdx]} ${year}`;
  }
  return `${MONTH_NAMES_EN[monthIdx]} ${year}`;
}

export function formatWeekLabel(weekStartKey: string, locale: 'ar' | 'en'): string {
  const start = parseLocalDate(weekStartKey);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);

  const startDay = start.getDate();
  const endDay = end.getDate();
  const startMonth = start.getMonth();
  const endMonth = end.getMonth();

  if (locale === 'ar') {
    if (startMonth === endMonth) {
      return `${startDay} - ${endDay} ${MONTH_NAMES_AR[startMonth]}`;
    }
    return `${startDay} ${MONTH_NAMES_AR[startMonth]} - ${endDay} ${MONTH_NAMES_AR[endMonth]}`;
  }

  if (startMonth === endMonth) {
    return `${startDay}–${endDay} ${MONTH_NAMES_EN[startMonth]}`;
  }
  return `${startDay} ${MONTH_NAMES_EN[startMonth]} – ${endDay} ${MONTH_NAMES_EN[endMonth]}`;
}

function getEntityId(entity: object): string | undefined {
  if ('id' in entity && typeof entity.id === 'string') return entity.id;
  if ('userId' in entity && typeof entity.userId === 'string') return entity.userId;
  if ('user_id' in entity && typeof entity.user_id === 'string') return entity.user_id;
  return undefined;
}

// Convert any lookup collection (Array, Map, Object) to Map
function toLookupMap<T extends object>(
  collection?: Map<string, T> | Record<string, T> | T[]
): Map<string, T> {
  const map = new Map<string, T>();
  if (!collection) return map;

  if (collection instanceof Map) {
    return collection;
  }

  if (Array.isArray(collection)) {
    for (const item of collection) {
      const id = getEntityId(item);
      if (id) map.set(id, item);
    }
    return map;
  }

  for (const [k, v] of Object.entries(collection)) {
    map.set(k, v);
  }
  return map;
}

export function pickName(
  entity: object | string | null | undefined,
  locale: 'ar' | 'en' = 'en'
): string {
  if (!entity) return '';

  if (typeof entity === 'string') return entity;

  if ('displayName' in entity && typeof entity.displayName === 'string') {
    return entity.displayName;
  }
  if ('display_name' in entity && typeof entity.display_name === 'string') {
    return entity.display_name;
  }

  const ar =
    ('nameAr' in entity && typeof entity.nameAr === 'string' ? entity.nameAr : undefined) ??
    ('name_ar' in entity && typeof entity.name_ar === 'string' ? entity.name_ar : undefined);

  const en =
    ('nameEn' in entity && typeof entity.nameEn === 'string' ? entity.nameEn : undefined) ??
    ('name_en' in entity && typeof entity.name_en === 'string' ? entity.name_en : undefined);

  if (locale === 'ar') {
    return ar || en || '';
  }
  return en || ar || '';
}

function getItemSubcategoryId(item: LookupItem): string | null {
  if ('subcategoryId' in item && typeof item.subcategoryId === 'string') {
    return item.subcategoryId;
  }
  if ('subcategory_id' in item && typeof item.subcategory_id === 'string') {
    return item.subcategory_id;
  }
  return null;
}

function getSubcategoryCategoryId(sub: LookupSubcategory): string | null {
  if ('categoryId' in sub && typeof sub.categoryId === 'string') {
    return sub.categoryId;
  }
  if ('category_id' in sub && typeof sub.category_id === 'string') {
    return sub.category_id;
  }
  return null;
}

// Main pivot function
export function pivot(
  entries: (Entry | EnrichedEntry | TransactionRow)[],
  lookups: PivotLookups = {},
  config: PivotConfig
): PivotResult {
  const locale = config.locale ?? lookups.locale ?? 'en';
  const categoryMap = toLookupMap<LookupCategory>(lookups.categories);
  const subcategoryMap = toLookupMap<LookupSubcategory>(lookups.subcategories);
  const itemMap = toLookupMap<LookupItem>(lookups.items);
  const walletMap = toLookupMap<LookupWallet>(lookups.wallets);
  const memberMap = toLookupMap<LookupMember>(lookups.members);

  // 1. Filter entries
  const validEntries: {
    id: string;
    type: string;
    amount: number;
    occurredOn: string;
    accountId: string;
    toAccountId: string | null;
    itemId: string | null;
    subcategoryId: string | null;
    categoryId: string | null;
    createdById: string | null;
  }[] = [];

  for (const raw of entries) {
    // Exclude soft-deleted
    const deletedAt = 'deletedAt' in raw ? raw.deletedAt : raw.deleted_at;
    if (deletedAt) continue;

    // Exclude transfers
    const type = raw.type;
    if (type === 'transfer') continue;

    // Filter by measure: expense, income, or net
    if (config.measure === 'expense' && type !== 'expense') continue;
    if (config.measure === 'income' && type !== 'income') continue;

    const occurredOn = 'occurredOn' in raw ? raw.occurredOn : raw.occurred_on;
    if (!occurredOn) continue;

    // Period filter
    if (config.period?.from && occurredOn < config.period.from) continue;
    if (config.period?.to && occurredOn > config.period.to) continue;

    const itemId = 'itemId' in raw ? raw.itemId : raw.item_id;
    let subcategoryId =
      ('subcategoryId' in raw ? raw.subcategoryId : undefined) ?? null;
    let categoryId =
      ('categoryId' in raw ? raw.categoryId : undefined) ?? null;

    if (itemId && (!subcategoryId || !categoryId)) {
      const itemObj = itemMap.get(itemId);
      if (itemObj) {
        subcategoryId = subcategoryId ?? getItemSubcategoryId(itemObj);
        const subObj = subcategoryId ? subcategoryMap.get(subcategoryId) : undefined;
        if (subObj) {
          categoryId = categoryId ?? getSubcategoryCategoryId(subObj);
        }
      }
    }

    // Category / subcategory filter
    if (config.filter?.categoryId && categoryId !== config.filter.categoryId) continue;
    if (config.filter?.subcategoryId && subcategoryId !== config.filter.subcategoryId) continue;

    const amount = Number(raw.amount);
    const accountId = 'accountId' in raw ? raw.accountId : raw.account_id;
    const toAccountId =
      ('toAccountId' in raw ? raw.toAccountId : raw.to_account_id) ?? null;
    const createdById =
      ('createdBy' in raw ? raw.createdBy : raw.created_by) ?? null;

    validEntries.push({
      id: raw.id,
      type,
      amount,
      occurredOn,
      accountId,
      toAccountId,
      itemId,
      subcategoryId,
      categoryId,
      createdById,
    });
  }

  // 2. Identify all column keys
  const colKeySet = new Set<string>();

  if (config.columns === 'none') {
    colKeySet.add('total');
  } else if (config.columns === 'month') {
    // If period is provided with from and to, generate all months in between
    if (config.period?.from && config.period?.to) {
      const start = parseLocalDate(config.period.from);
      const end = parseLocalDate(config.period.to);
      const cur = new Date(start.getFullYear(), start.getMonth(), 1);
      const endTarget = new Date(end.getFullYear(), end.getMonth(), 1);

      while (cur <= endTarget) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, '0');
        colKeySet.add(`${y}-${m}`);
        cur.setMonth(cur.getMonth() + 1);
      }
    }
    // Also add any months present in data
    for (const e of validEntries) {
      colKeySet.add(e.occurredOn.slice(0, 7));
    }
  } else if (config.columns === 'week') {
    for (const e of validEntries) {
      const d = parseLocalDate(e.occurredOn);
      const wStart = getEgyptWeekStart(d);
      colKeySet.add(formatLocalDateStr(wStart));
    }
  } else if (config.columns === 'wallet') {
    for (const e of validEntries) {
      colKeySet.add(e.accountId);
    }
    if (walletMap.size > 0 && validEntries.length === 0) {
      for (const wId of walletMap.keys()) {
        colKeySet.add(wId);
      }
    }
  } else if (config.columns === 'category') {
    for (const e of validEntries) {
      if (e.categoryId) colKeySet.add(e.categoryId);
    }
  }

  // Determine chronological descending order for time columns (newest first for display)
  let colKeys: string[] = [];
  if (config.columns === 'none') {
    colKeys = ['total'];
  } else if (config.columns === 'month' || config.columns === 'week') {
    colKeys = Array.from(colKeySet).sort((a, b) => b.localeCompare(a));
  } else {
    // Categorical columns
    colKeys = Array.from(colKeySet);
  }

  // Generate column labels
  const colLabels: string[] = colKeys.map((key) => {
    if (config.columns === 'none') {
      return locale === 'ar' ? 'الإجمالي' : 'Total';
    }
    if (config.columns === 'month') {
      return formatMonthLabel(key, locale);
    }
    if (config.columns === 'week') {
      return formatWeekLabel(key, locale);
    }
    if (config.columns === 'wallet') {
      const w = walletMap.get(key);
      return w ? pickName(w, locale) : key;
    }
    if (config.columns === 'category') {
      const c = categoryMap.get(key);
      return c ? pickName(c, locale) : key;
    }
    return key;
  });

  // 3. Extract Row Keys
  const rowKeySet = new Set<string>();
  for (const e of validEntries) {
    let rk: string | null = null;
    if (config.rows === 'category') rk = e.categoryId;
    else if (config.rows === 'subcategory') rk = e.subcategoryId;
    else if (config.rows === 'item') rk = e.itemId;
    else if (config.rows === 'wallet') rk = e.accountId;
    else if (config.rows === 'person') rk = e.createdById;

    if (rk) rowKeySet.add(rk);
  }

  const rowKeysList = Array.from(rowKeySet);

  // 4. Populate Matrix
  // Map rowKey -> colKey -> amount
  const matrix = new Map<string, Map<string, number>>();
  for (const rk of rowKeysList) {
    matrix.set(rk, new Map<string, number>());
  }

  for (const e of validEntries) {
    let rk: string | null = null;
    if (config.rows === 'category') rk = e.categoryId;
    else if (config.rows === 'subcategory') rk = e.subcategoryId;
    else if (config.rows === 'item') rk = e.itemId;
    else if (config.rows === 'wallet') rk = e.accountId;
    else if (config.rows === 'person') rk = e.createdById;

    if (!rk) continue;

    let ck = 'total';
    if (config.columns === 'month') {
      ck = e.occurredOn.slice(0, 7);
    } else if (config.columns === 'week') {
      const d = parseLocalDate(e.occurredOn);
      const wStart = getEgyptWeekStart(d);
      ck = formatLocalDateStr(wStart);
    } else if (config.columns === 'wallet') {
      ck = e.accountId;
    } else if (config.columns === 'category') {
      ck = e.categoryId ?? 'unknown';
    }

    const rowMap = matrix.get(rk);
    if (!rowMap) continue;

    // Signed value based on measure: in net, income is positive and expense is negative
    const val = config.measure === 'net' && e.type === 'expense' ? -e.amount : e.amount;
    const cur = rowMap.get(ck) ?? 0;
    rowMap.set(ck, cur + val);
  }

  // 5. Calculate row totals and sort rows by total descending
  const rowTotalsMap = new Map<string, number>();
  for (const rk of rowKeysList) {
    const rowMap = matrix.get(rk)!;
    let sum = 0;
    for (const val of rowMap.values()) {
      sum += val;
    }
    rowTotalsMap.set(rk, round2(sum));
  }

  // Sort rows descending by total
  rowKeysList.sort((a, b) => {
    const totalA = rowTotalsMap.get(a) ?? 0;
    const totalB = rowTotalsMap.get(b) ?? 0;
    return totalB - totalA;
  });

  // Generate row labels
  const rowLabels: string[] = rowKeysList.map((rk) => {
    if (config.rows === 'category') {
      const c = categoryMap.get(rk);
      return c ? pickName(c, locale) : (locale === 'ar' ? 'فئة أخرى' : 'Other Category');
    }
    if (config.rows === 'subcategory') {
      const s = subcategoryMap.get(rk);
      return s ? pickName(s, locale) : (locale === 'ar' ? 'مجموعة أخرى' : 'Other Group');
    }
    if (config.rows === 'item') {
      const i = itemMap.get(rk);
      return i ? pickName(i, locale) : (locale === 'ar' ? 'بند غير محدد' : 'Item');
    }
    if (config.rows === 'wallet') {
      const w = walletMap.get(rk);
      return w ? pickName(w, locale) : (locale === 'ar' ? 'محفظة' : 'Wallet');
    }
    if (config.rows === 'person') {
      const m = memberMap.get(rk);
      return m ? pickName(m, locale) : (locale === 'ar' ? 'عضو' : 'Person');
    }
    return rk;
  });

  // 6. Build cells 2D array, rowTotals, colTotals, grandTotal
  const cells: number[][] = [];
  const rowTotals: number[] = [];
  const colTotals: number[] = new Array(colKeys.length).fill(0);
  let grandTotal = 0;

  for (let r = 0; r < rowKeysList.length; r++) {
    const rk = rowKeysList[r];
    const rowMap = matrix.get(rk)!;
    const rowCells: number[] = [];
    let rTotal = 0;

    for (let c = 0; c < colKeys.length; c++) {
      const ck = colKeys[c];
      const val = round2(rowMap.get(ck) ?? 0);
      rowCells.push(val);
      rTotal += val;
      colTotals[c] += val;
    }

    rTotal = round2(rTotal);
    cells.push(rowCells);
    rowTotals.push(rTotal);
    grandTotal += rTotal;
  }

  // Round colTotals and grandTotal
  for (let c = 0; c < colTotals.length; c++) {
    colTotals[c] = round2(colTotals[c]);
  }
  grandTotal = round2(grandTotal);

  return {
    rowKeys: rowKeysList,
    rowLabels,
    colKeys,
    colLabels,
    cells,
    rowTotals,
    colTotals,
    grandTotal,
  };
}
