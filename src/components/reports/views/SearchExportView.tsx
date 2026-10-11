'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Download, Search, X } from 'lucide-react';
import { useEntries } from '@/lib/data/provider';
import { searchEntries, type SearchQuery } from '@/lib/reports/planning';
import { Card } from '@/components/ui/card';
import { CategoryIcon } from '@/components/ui/category-icon';
import { localISODate, money, pickName } from '@/lib/format';

export function SearchExportView() {
  const locale = useLocale();
  const t = useTranslations('reports');
  const [searchText, setSearchText] = React.useState('');
  const [selectedType, setSelectedType] = React.useState<'all' | 'expense' | 'income' | 'transfer'>('all');

  const entries = useEntries();

  const query: SearchQuery = React.useMemo(() => ({
    text: searchText.trim() || undefined,
    type: selectedType === 'all' ? undefined : selectedType,
  }), [searchText, selectedType]);

  const { results, total } = React.useMemo(() => {
    if (!entries) return { results: [], total: 0 };
    return searchEntries(entries, query);
  }, [entries, query]);

  const handleExportCsv = () => {
    if (!results.length) return;
    const headers = ['Date', 'Type', 'Amount', 'Category', 'Group', 'Item', 'Wallet', 'Note'];
    const rows = results.map((r) => [
      r.occurredOn,
      r.type,
      r.amount,
      r.categoryNameEn || r.categoryNameAr || '',
      r.subcategoryNameEn || r.subcategoryNameAr || '',
      r.itemNameEn || r.itemNameAr || '',
      r.accountNameEn || r.accountNameAr || '',
      `"${(r.note || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `search-results-${localISODate()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-3 select-none">
      {/* Search Input Bar */}
      <Card className="rounded-card bg-surface p-2.5 shadow-card border border-line/60">
        <div className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2">
          <Search className="size-5 shrink-0 text-ink-muted" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={t('library.searchPlaceholder')}
            className="flex-1 bg-transparent text-body font-medium text-ink placeholder:text-ink-faint focus:outline-none"
          />
          {searchText && (
            <button
              type="button"
              onClick={() => setSearchText('')}
              className="size-6 flex items-center justify-center rounded-full text-ink-muted hover:text-ink active:scale-95"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </Card>

      {/* Type Filter Chips */}
      <div className="flex items-center gap-1.5 p-0.5">
        {[
          { id: 'all', label: t('all') },
          { id: 'expense', label: t('spent') },
          { id: 'income', label: t('income') },
          { id: 'transfer', label: t('dim.wallet') },
        ].map((chip) => {
          const isSelected = selectedType === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => setSelectedType(chip.id as typeof selectedType)}
              className={`flex-1 h-8 rounded-full text-caption font-semibold transition-all active:scale-95 text-center px-1 whitespace-nowrap cursor-pointer ${
                isSelected
                  ? 'bg-accent text-accent-ink shadow-xs'
                  : 'bg-surface-2 text-ink-muted hover:text-ink'
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* Results Header: Count, Total, and Export Button */}
      <div className="flex items-center justify-between px-1">
        <div className="min-w-0">
          <span className="text-caption text-ink-muted block">
            {t('library.resultsFound', { count: results.length })}
          </span>
          <span className="text-heading font-bold tabular-nums text-ink block mt-0.5">
            {money(total, locale, { fractionDigits: 0 })}
          </span>
        </div>

        {results.length > 0 && (
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl bg-surface-2 px-3 py-1.5 text-caption font-semibold text-accent hover:bg-surface-2/80 active:scale-95 transition-all cursor-pointer"
          >
            <Download className="size-4" />
            <span>{t('library.downloadCsv')}</span>
          </button>
        )}
      </div>

      {/* Results List */}
      <Card className="rounded-card bg-surface shadow-card border border-line/60 overflow-hidden p-0 gap-0">
        <div className="px-4 divide-y divide-line/40">
          {results.length === 0 ? (
            <div className="py-12 text-center text-ink-muted">
              <Search className="size-8 mx-auto text-ink-faint mb-2" />
              <p className="text-body font-medium">{t('library.noResults')}</p>
            </div>
          ) : (
            results.slice(0, 30).map((entry) => {
              const itemName = pickName(
                { name_ar: entry.itemNameAr, name_en: entry.itemNameEn },
                locale
              );
              const categoryName = pickName(
                { name_ar: entry.categoryNameAr, name_en: entry.categoryNameEn },
                locale
              );
              const title = itemName || categoryName || t('title');
              const icon = entry.categoryIcon ?? 'Receipt';

              return (
                <div key={entry.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      style={
                        entry.categoryColor
                          ? {
                              backgroundColor: `${entry.categoryColor}18`,
                              color: entry.categoryColor,
                            }
                          : undefined
                      }
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"
                    >
                      <CategoryIcon name={icon} className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-body font-semibold text-ink truncate block">
                        {title}
                      </span>
                      <span className="text-caption text-ink-muted tabular-nums block">
                        {entry.occurredOn}
                      </span>
                    </div>
                  </div>

                  <div className="text-end shrink-0">
                    <span
                      className={`text-body font-bold tabular-nums block ${
                        entry.type === 'income'
                          ? 'text-income'
                          : entry.type === 'expense'
                          ? 'text-expense'
                          : 'text-ink'
                      }`}
                    >
                      {entry.type === 'income' ? '+' : entry.type === 'expense' ? '-' : ''}
                      {money(entry.amount, locale, { fractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}
