// =========================================================
// CSV Export  ·  Family Accounts (حساباتنا)
// Exports data to UTF-8 with BOM so Excel displays
// Arabic text properly. Uses Western digits (0-9).
// =========================================================

import type { PivotResult } from './pivot';

export function escapeCsvField(field: string): string {
  if (
    field.includes(',') ||
    field.includes('"') ||
    field.includes('\n') ||
    field.includes('\r')
  ) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export function pivotToCsv(result: PivotResult, locale: 'ar' | 'en' = 'en'): string {
  const BOM = '\uFEFF';
  const itemHeader = locale === 'ar' ? 'البند' : 'Item';
  const totalHeader = locale === 'ar' ? 'الإجمالي' : 'Total';

  const rows: string[] = [];

  // Header row
  const headerCols = [
    escapeCsvField(itemHeader),
    ...result.colLabels.map(escapeCsvField),
    escapeCsvField(totalHeader),
  ];
  rows.push(headerCols.join(','));

  // Data rows
  for (let r = 0; r < result.rowLabels.length; r++) {
    const label = escapeCsvField(result.rowLabels[r]);
    const cells = result.cells[r].map((v) => v.toFixed(2));
    const rowTotal = result.rowTotals[r].toFixed(2);

    rows.push([label, ...cells, rowTotal].join(','));
  }

  // Summary row (Total at the bottom)
  const totalCols = [
    escapeCsvField(totalHeader),
    ...result.colTotals.map((v) => v.toFixed(2)),
    result.grandTotal.toFixed(2),
  ];
  rows.push(totalCols.join(','));

  return BOM + rows.join('\r\n');
}

export interface EntryExportRow {
  occurredOn?: string | null;
  type?: string | null;
  amount?: number | null;
  categoryNameEn?: string | null;
  categoryNameAr?: string | null;
  subcategoryNameEn?: string | null;
  subcategoryNameAr?: string | null;
  itemNameEn?: string | null;
  itemNameAr?: string | null;
  accountNameEn?: string | null;
  accountNameAr?: string | null;
  note?: string | null;
  createdByName?: string | null;
}

export function entriesToCsv(
  entries: EntryExportRow[],
  locale: 'ar' | 'en' = 'en'
): string {
  const BOM = '\uFEFF';
  const isAr = locale === 'ar';

  const headers = isAr
    ? ['التاريخ', 'النوع', 'المبلغ', 'القسم', 'الفرع', 'البند', 'المحفظة', 'ملاحظة', 'بواسطة']
    : ['Date', 'Type', 'Amount', 'Category', 'Subcategory', 'Item', 'Wallet', 'Note', 'Entered by'];

  const typeLabels: Record<string, string> = isAr
    ? { expense: 'مصروف', income: 'دخل', transfer: 'تحويل' }
    : { expense: 'Expense', income: 'Income', transfer: 'Transfer' };

  const rows: string[] = [headers.map(escapeCsvField).join(',')];

  for (const e of entries) {
    const date = e.occurredOn || '';
    const rawType = e.type || '';
    const type = typeLabels[rawType] || rawType;
    const amount = Number(e.amount || 0).toFixed(2);
    const category = isAr
      ? (e.categoryNameAr || e.categoryNameEn || '')
      : (e.categoryNameEn || e.categoryNameAr || '');
    const subcategory = isAr
      ? (e.subcategoryNameAr || e.subcategoryNameEn || '')
      : (e.subcategoryNameEn || e.subcategoryNameAr || '');
    const item = isAr
      ? (e.itemNameAr || e.itemNameEn || '')
      : (e.itemNameEn || e.itemNameAr || '');
    const wallet = isAr
      ? (e.accountNameAr || e.accountNameEn || '')
      : (e.accountNameEn || e.accountNameAr || '');
    const note = e.note || '';
    const enteredBy = e.createdByName || '';

    const cols = [
      escapeCsvField(date),
      escapeCsvField(type),
      escapeCsvField(amount),
      escapeCsvField(category),
      escapeCsvField(subcategory),
      escapeCsvField(item),
      escapeCsvField(wallet),
      escapeCsvField(note),
      escapeCsvField(enteredBy),
    ];

    rows.push(cols.join(','));
  }

  return BOM + rows.join('\r\n');
}
