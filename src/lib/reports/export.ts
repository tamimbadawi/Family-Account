// =========================================================
// Pivot CSV Export  ·  Family Accounts (حساباتنا)
// Exports pivot table to UTF-8 with BOM so Excel displays
// Arabic text properly. Uses Western digits (0-9).
// =========================================================

import type { PivotResult } from './pivot';

function escapeCsvField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\r')) {
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
