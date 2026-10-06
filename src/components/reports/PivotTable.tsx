'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronRight, Folder, Tag, User, Wallet as WalletIcon } from 'lucide-react';
import type { Category, Subcategory, Wallet } from '@/lib/data/types';
import type { PivotConfig, PivotResult } from '@/lib/reports/pivot';
import { CategoryIcon } from '@/components/ui/category-icon';
import { money } from '@/lib/format';

export interface BreadcrumbItem {
  level: 'category' | 'subcategory';
  id: string;
  name: string;
}

export interface PivotTableProps {
  result: PivotResult;
  config: PivotConfig;
  breadcrumbs: BreadcrumbItem[];
  onBreadcrumbClick: (index: number) => void;
  onRowClick?: (rowKey: string, rowLabel: string) => void;
  onCellClick?: (
    rowKey: string,
    colKey: string,
    value: number,
    rowLabel: string,
    colLabel: string
  ) => void;
  categoriesMap?: Map<string, Category>;
  subcategoriesMap?: Map<string, Subcategory>;
  walletsMap?: Map<string, Wallet>;
  className?: string;
}

function getHeatTint(val: number, maxAbsVal: number): string | undefined {
  if (val === 0 || maxAbsVal === 0) return undefined;
  const ratio = Math.min(Math.abs(val) / maxAbsVal, 1);
  const percent = Math.round((0.04 + ratio * 0.24) * 100);
  return `color-mix(in srgb, var(--accent) ${percent}%, transparent)`;
}

export function PivotTable({
  result,
  config,
  breadcrumbs,
  onBreadcrumbClick,
  onRowClick,
  onCellClick,
  categoriesMap,
  subcategoriesMap,
  walletsMap,
  className = '',
}: PivotTableProps) {
  const locale = useLocale();
  const t = useTranslations('reports');

  // Compute maximum absolute value across cells (excluding totals) for heat tinting
  const maxAbsVal = React.useMemo(() => {
    let max = 0;
    for (const row of result.cells) {
      for (const val of row) {
        const abs = Math.abs(val);
        if (abs > max) max = abs;
      }
    }
    return max;
  }, [result.cells]);

  const canDrill = config.rows === 'category' || config.rows === 'subcategory';

  const renderRowIcon = (rk: string) => {
    if (config.rows === 'category') {
      const cat = categoriesMap?.get(rk);
      const color = cat?.color || 'var(--accent)';
      return (
        <div
          style={{
            backgroundColor: `${color}18`,
            color: color,
          }}
          className="flex size-7 shrink-0 items-center justify-center rounded-full"
        >
          <CategoryIcon name={cat?.icon} className="size-3.5" />
        </div>
      );
    }

    if (config.rows === 'subcategory') {
      const sub = subcategoriesMap?.get(rk);
      const parentCat = sub?.categoryId ? categoriesMap?.get(sub.categoryId) : undefined;
      const color = parentCat?.color || 'var(--accent)';
      return (
        <div
          style={{
            backgroundColor: `${color}18`,
            color: color,
          }}
          className="flex size-7 shrink-0 items-center justify-center rounded-full"
        >
          <Folder className="size-3.5" />
        </div>
      );
    }

    if (config.rows === 'item') {
      return (
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-muted">
          <Tag className="size-3.5" />
        </div>
      );
    }

    if (config.rows === 'wallet') {
      const w = walletsMap?.get(rk);
      const color = w?.color || 'var(--accent)';
      return (
        <div
          style={{
            backgroundColor: `${color}18`,
            color: color,
          }}
          className="flex size-7 shrink-0 items-center justify-center rounded-full"
        >
          <WalletIcon className="size-3.5" />
        </div>
      );
    }

    if (config.rows === 'person') {
      return (
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <User className="size-3.5" />
        </div>
      );
    }

    return null;
  };

  return (
    <div className={`rounded-card bg-surface shadow-card overflow-hidden select-none border border-line/60 ${className}`}>
      {/* Breadcrumb Header Bar */}
      {breadcrumbs.length > 0 && (
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-line bg-surface-2/40 text-caption font-semibold">
          <button
            type="button"
            onClick={() => onBreadcrumbClick(-1)}
            className="text-accent hover:underline flex items-center gap-1"
          >
            <span>{t('all')}</span>
          </button>
          {breadcrumbs.map((bc, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={bc.id}>
                <ChevronRight className="size-3.5 text-ink-muted rtl:rotate-180" />
                {isLast ? (
                  <span className="text-ink font-bold truncate max-w-[150px]">
                    {bc.name}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onBreadcrumbClick(idx)}
                    className="text-accent hover:underline truncate max-w-[120px]"
                  >
                    {bc.name}
                  </button>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Horizontal Scroll Table Container */}
      <div className="overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <table className="w-full border-collapse text-start">
          {/* Header Row */}
          <thead>
            <tr className="h-10 border-b border-line text-caption font-semibold text-ink-muted">
              {/* Sticky first column header: 140px */}
              <th className="sticky start-0 z-20 w-[140px] min-w-[140px] max-w-[140px] bg-surface px-3 text-start">
                <span className="truncate block">
                  {breadcrumbs.length > 0
                    ? breadcrumbs[breadcrumbs.length - 1].name
                    : t(`dim.${config.rows}`)}
                </span>
              </th>

              {/* Value columns: 96px */}
              {result.colLabels.map((label, c) => (
                <th
                  key={result.colKeys[c]}
                  className="w-24 min-w-24 px-2 text-end font-semibold text-ink-muted"
                >
                  <span className="truncate block">{label}</span>
                </th>
              ))}

              {/* Total Column Header */}
              {config.columns !== 'none' && (
                <th className="w-24 min-w-24 bg-surface-2/70 px-2 text-end font-bold text-ink">
                  {t('total')}
                </th>
              )}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-line/40">
            {result.rowKeys.length === 0 ? (
              <tr>
                <td
                  colSpan={result.colLabels.length + (config.columns !== 'none' ? 2 : 1)}
                  className="py-10 text-center text-body text-ink-muted"
                >
                  {t('emptyEntries')}
                </td>
              </tr>
            ) : (
              result.rowKeys.map((rk, r) => {
                const label = result.rowLabels[r];
                return (
                  <tr
                    key={rk}
                    className="h-[52px] transition-colors hover:bg-surface-2/20"
                  >
                    {/* Sticky first column: 140px (icon + name) */}
                    <td
                      onClick={canDrill ? () => onRowClick?.(rk, label) : undefined}
                      className={`sticky start-0 z-10 w-[140px] min-w-[140px] max-w-[140px] bg-surface px-3 ${
                        canDrill
                          ? 'cursor-pointer hover:bg-surface-2/60 active:scale-[0.99] transition-transform'
                          : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {renderRowIcon(rk)}
                        <span className="text-body font-semibold text-ink truncate leading-tight">
                          {label}
                        </span>
                        {canDrill && (
                          <ChevronRight className="size-3.5 text-ink-faint shrink-0 rtl:rotate-180" />
                        )}
                      </div>
                    </td>

                    {/* Value cells with heat tint */}
                    {result.cells[r].map((val, c) => {
                      const tint = getHeatTint(val, maxAbsVal);
                      const ck = result.colKeys[c];
                      const colLabel = result.colLabels[c];
                      return (
                        <td
                          key={ck}
                          style={tint ? { backgroundColor: tint } : undefined}
                          onClick={() =>
                            onCellClick?.(rk, ck, val, label, colLabel)
                          }
                          className="w-24 min-w-24 px-2 text-end text-body tabular-nums cursor-pointer transition-colors active:opacity-75"
                        >
                          {val === 0 ? (
                            <span className="text-ink-faint font-normal">–</span>
                          ) : (
                            <span
                              className={`font-medium ${
                                val < 0 ? 'text-expense' : 'text-ink'
                              }`}
                            >
                              {money(Math.round(val), locale, {
                                hideCurrency: true,
                                fractionDigits: 0,
                              })}
                            </span>
                          )}
                        </td>
                      );
                    })}

                    {/* Total column */}
                    {config.columns !== 'none' && (
                      <td
                        onClick={() =>
                          onCellClick?.(
                            rk,
                            'total',
                            result.rowTotals[r],
                            label,
                            t('total')
                          )
                        }
                        className="w-24 min-w-24 bg-surface-2/70 px-2 text-end text-body font-bold tabular-nums text-ink cursor-pointer hover:bg-surface-2"
                      >
                        {result.rowTotals[r] === 0 ? (
                          <span className="text-ink-faint font-normal">–</span>
                        ) : (
                          <span
                            className={
                              result.rowTotals[r] < 0 ? 'text-expense' : 'text-ink'
                            }
                          >
                            {money(Math.round(result.rowTotals[r]), locale, {
                              hideCurrency: true,
                              fractionDigits: 0,
                            })}
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>

          {/* Footer Total Row */}
          {result.rowKeys.length > 0 && (
            <tfoot>
              <tr className="h-[52px] border-t-2 border-line bg-surface-2/80 font-bold text-ink">
                {/* Sticky Total Label: 140px */}
                <td className="sticky start-0 z-10 w-[140px] min-w-[140px] max-w-[140px] bg-surface-2 px-3 text-start">
                  <span className="text-body font-bold text-ink truncate block">
                    {t('total')}
                  </span>
                </td>

                {/* Column Totals */}
                {result.colTotals.map((cTot, c) => {
                  const ck = result.colKeys[c];
                  const colLabel = result.colLabels[c];
                  return (
                    <td
                      key={ck}
                      onClick={() =>
                        onCellClick?.('total', ck, cTot, t('total'), colLabel)
                      }
                      className="w-24 min-w-24 px-2 text-end text-body font-bold tabular-nums cursor-pointer hover:bg-surface-2/90"
                    >
                      {cTot === 0 ? (
                        <span className="text-ink-faint font-normal">–</span>
                      ) : (
                        <span
                          className={cTot < 0 ? 'text-expense' : 'text-ink'}
                        >
                          {money(Math.round(cTot), locale, {
                            hideCurrency: true,
                            fractionDigits: 0,
                          })}
                        </span>
                      )}
                    </td>
                  );
                })}

                {/* Grand Total */}
                {config.columns !== 'none' && (
                  <td
                    onClick={() =>
                      onCellClick?.(
                        'total',
                        'total',
                        result.grandTotal,
                        t('total'),
                        t('total')
                      )
                    }
                    className="w-24 min-w-24 bg-surface-2 px-2 text-end text-body font-bold tabular-nums text-ink cursor-pointer hover:bg-surface-2/90"
                  >
                    {result.grandTotal === 0 ? (
                      <span className="text-ink-faint font-normal">–</span>
                    ) : (
                      <span
                        className={
                          result.grandTotal < 0 ? 'text-expense' : 'text-ink'
                        }
                      >
                        {money(Math.round(result.grandTotal), locale, {
                          hideCurrency: true,
                          fractionDigits: 0,
                        })}
                      </span>
                    )}
                  </td>
                )}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
