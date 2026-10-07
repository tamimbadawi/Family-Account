import { describe, expect, it } from 'vitest';
import { entriesToCsv, escapeCsvField, pivotToCsv, type EntryExportRow } from './export';
import type { PivotResult } from './pivot';

describe('escapeCsvField', () => {
  it('leaves simple strings unquoted', () => {
    expect(escapeCsvField('Groceries')).toBe('Groceries');
    expect(escapeCsvField('123.45')).toBe('123.45');
    expect(escapeCsvField('بقالة')).toBe('بقالة');
  });

  it('quotes fields containing commas', () => {
    expect(escapeCsvField('Food, Drinks')).toBe('"Food, Drinks"');
    expect(escapeCsvField('أكل, شرب')).toBe('"أكل, شرب"');
  });

  it('escapes and quotes fields containing double quotes', () => {
    expect(escapeCsvField('He said "hello"')).toBe('"He said ""hello"""');
    expect(escapeCsvField('"quoted"')).toBe('"""quoted"""');
  });

  it('quotes fields containing newlines', () => {
    expect(escapeCsvField('Line 1\nLine 2')).toBe('"Line 1\nLine 2"');
    expect(escapeCsvField('Line 1\r\nLine 2')).toBe('"Line 1\r\nLine 2"');
  });
});

describe('entriesToCsv', () => {
  const sampleEntries: EntryExportRow[] = [
    {
      occurredOn: '2026-10-01',
      type: 'expense',
      amount: 1250.5,
      categoryNameEn: 'Food & Dining',
      categoryNameAr: 'طعام ومشروبات',
      subcategoryNameEn: 'Groceries',
      subcategoryNameAr: 'بقالة',
      itemNameEn: 'Milk & Eggs',
      itemNameAr: 'لبن وبيض',
      accountNameEn: 'Cash',
      accountNameAr: 'كاش',
      note: 'Weekly shopping, market',
      createdByName: 'Injy',
    },
    {
      occurredOn: '2026-10-02',
      type: 'income',
      amount: 15000,
      categoryNameEn: 'Income',
      categoryNameAr: 'دخل',
      subcategoryNameEn: 'Salary',
      subcategoryNameAr: 'مرتب',
      itemNameEn: 'Monthly Salary',
      itemNameAr: 'مرتب شهري',
      accountNameEn: 'CIB Bank',
      accountNameAr: 'بنك CIB',
      note: 'Note with "quotes" and, commas',
      createdByName: 'Tamim',
    },
    {
      occurredOn: '2026-10-03',
      type: 'transfer',
      amount: 3000.75,
      accountNameEn: 'CIB Bank',
      accountNameAr: 'بنك CIB',
      note: 'ATM withdrawal',
      createdByName: 'Injy',
    },
  ];

  it('includes UTF-8 BOM at the very start in both locales', () => {
    const csvEn = entriesToCsv(sampleEntries, 'en');
    const csvAr = entriesToCsv(sampleEntries, 'ar');

    expect(csvEn.startsWith('\uFEFF')).toBe(true);
    expect(csvAr.startsWith('\uFEFF')).toBe(true);
  });

  it('generates the correct header row in English and Arabic', () => {
    const csvEn = entriesToCsv(sampleEntries, 'en');
    const linesEn = csvEn.replace('\uFEFF', '').split('\r\n');
    expect(linesEn[0]).toBe('Date,Type,Amount,Category,Subcategory,Item,Wallet,Note,Entered by');

    const csvAr = entriesToCsv(sampleEntries, 'ar');
    const linesAr = csvAr.replace('\uFEFF', '').split('\r\n');
    expect(linesAr[0]).toBe('التاريخ,النوع,المبلغ,القسم,الفرع,البند,المحفظة,ملاحظة,بواسطة');
  });

  it('uses Western digits (0-9) for all amounts', () => {
    const csvEn = entriesToCsv(sampleEntries, 'en');
    const csvAr = entriesToCsv(sampleEntries, 'ar');

    // Amounts should match 1250.50, 15000.00, 3000.75
    expect(csvEn).toContain('1250.50');
    expect(csvEn).toContain('15000.00');
    expect(csvEn).toContain('3000.75');

    // In Arabic too, Western ASCII digits
    expect(csvAr).toContain('1250.50');
    expect(csvAr).toContain('15000.00');
    expect(csvAr).toContain('3000.75');

    // Must not contain Arabic-Indic digits
    expect(/[٠-٩]/.test(csvAr)).toBe(false);
  });

  it('localizes entry types properly', () => {
    const csvEn = entriesToCsv(sampleEntries, 'en');
    expect(csvEn).toContain('Expense');
    expect(csvEn).toContain('Income');
    expect(csvEn).toContain('Transfer');

    const csvAr = entriesToCsv(sampleEntries, 'ar');
    expect(csvAr).toContain('مصروف');
    expect(csvAr).toContain('دخل');
    expect(csvAr).toContain('تحويل');
  });

  it('properly quotes commas, quotes, and preserves Arabic text', () => {
    const csvEn = entriesToCsv(sampleEntries, 'en');
    // Note with comma: 'Weekly shopping, market'
    expect(csvEn).toContain('"Weekly shopping, market"');
    // Note with quotes and comma: 'Note with "quotes" and, commas'
    expect(csvEn).toContain('"Note with ""quotes"" and, commas"');

    const csvAr = entriesToCsv(sampleEntries, 'ar');
    expect(csvAr).toContain('طعام ومشروبات');
    expect(csvAr).toContain('بقالة');
    expect(csvAr).toContain('لبن وبيض');
    expect(csvAr).toContain('بنك CIB');
  });
});

describe('pivotToCsv', () => {
  const samplePivot: PivotResult = {
    rowKeys: ['cat-1'],
    rowLabels: ['Food, Groceries'],
    colKeys: ['2026-09', '2026-10'],
    colLabels: ['2026-09', '2026-10'],
    cells: [[100.5, 200.75]],
    rowTotals: [301.25],
    colTotals: [100.5, 200.75],
    grandTotal: 301.25,
  };

  it('includes BOM and properly escapes rowLabels with commas', () => {
    const csv = pivotToCsv(samplePivot, 'en');
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"Food, Groceries"');
    expect(csv).toContain('301.25');
  });
});
