'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Layers } from 'lucide-react';
import { useEntries } from '@/lib/data/provider';
import { calculateSpendingCalendar, type CalendarDay } from '@/lib/reports/spending-calendar';
import { EntryRow } from '@/components/entry/EntryRow';
import { useEntrySheet } from '@/components/entry/EntrySheetContext';
import { Card } from '@/components/ui/card';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { money } from '@/lib/format';
import { MonthSwitcher } from '../MonthSwitcher';

// Weekdays starting Saturday (Egypt week)
const WEEKDAYS_EN = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const WEEKDAYS_AR = ['سبت', 'أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة'];

export function SpendingCalendarView() {
  const locale = useLocale();
  const t = useTranslations('reports');
  const isAr = locale.startsWith('ar');
  const { openEdit } = useEntrySheet();

  const [month, setMonth] = React.useState(() => new Date().toISOString().slice(0, 7));
  const [selectedDay, setSelectedDay] = React.useState<CalendarDay | null>(null);

  const entries = useEntries();

  const result = React.useMemo(() => {
    if (!entries) return null;
    return calculateSpendingCalendar(entries, month);
  }, [entries, month]);

  const weekdays = isAr ? WEEKDAYS_AR : WEEKDAYS_EN;

  if (!result) return null;

  return (
    <div className="space-y-2 select-none">
      {/* Month Switcher */}
      <MonthSwitcher month={month} onMonthChange={setMonth} />

      {/* Calendar Card */}
      <Card className="rounded-card bg-surface p-3 shadow-card border border-line/60 space-y-2">
        {/* Total & Peak Info */}
        <div className="flex items-center justify-between text-caption px-1">
          <div>
            <span className="text-ink-muted">{t('spent')}: </span>
            <span className="font-bold tabular-nums text-expense">
              {money(result.monthTotal, locale, { fractionDigits: 0 })}
            </span>
          </div>
          {result.highestDay && result.highestDay.amount > 0 && (
            <div>
              <span className="text-ink-muted">{t('library.highestDay')}: </span>
              <span className="font-bold tabular-nums text-ink">
                {money(result.highestDay.amount, locale, { fractionDigits: 0 })}
              </span>
            </div>
          )}
        </div>

        {/* Weekday Headers Grid */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {weekdays.map((wd) => (
            <div key={wd} className="text-caption font-semibold text-ink-muted py-1">
              {wd}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Leading empty slots before day 1 */}
          {Array.from({ length: result.leadingEmptyDays }).map((_, i) => (
            <div key={`empty-${i}`} className="h-10 rounded-xl" />
          ))}

          {/* Calendar day cells */}
          {result.days.map((day) => {
            const hasSpend = day.amount > 0;
            const tint =
              hasSpend && day.tintRatio > 0
                ? `color-mix(in srgb, var(--accent) ${Math.round(
                    (0.04 + day.tintRatio * 0.24) * 100
                  )}%, transparent)`
                : undefined;

            return (
              <button
                key={day.dateStr}
                type="button"
                onClick={() => setSelectedDay(day)}
                style={tint ? { backgroundColor: tint } : undefined}
                className={`flex flex-col items-center justify-center h-10 rounded-xl transition-all active:scale-95 ${
                  hasSpend
                    ? 'font-bold text-ink cursor-pointer hover:ring-1 hover:ring-accent/40'
                    : 'bg-surface-2/40 text-ink-muted cursor-pointer'
                }`}
              >
                <span className="text-caption leading-tight tabular-nums font-semibold">
                  {day.dayNumber}
                </span>
                {hasSpend && (
                  <span className="text-caption font-normal tabular-nums text-ink-muted leading-none scale-90">
                    {Math.round(day.amount)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Day Entries Drawer Sheet */}
      <Drawer
        open={Boolean(selectedDay)}
        onOpenChange={(open) => !open && setSelectedDay(null)}
      >
        <DrawerContent className="max-h-[85dvh] flex flex-col bg-surface text-ink">
          <DrawerHeader className="pb-3 border-b border-line shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DrawerTitle className="text-heading font-bold text-ink">
                  {selectedDay?.dateStr}
                </DrawerTitle>
                <p className="text-caption text-ink-muted mt-0.5">
                  {selectedDay?.entriesCount} {t('dim.item')}
                </p>
              </div>
              {selectedDay && selectedDay.amount > 0 && (
                <span className="text-heading font-bold tabular-nums text-expense">
                  {money(selectedDay.amount, locale)}
                </span>
              )}
            </div>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-5 py-2 divide-y divide-line [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {!selectedDay || selectedDay.entries.length === 0 ? (
              <div className="py-12 text-center text-ink-muted">
                <Layers className="size-8 mx-auto text-ink-faint mb-2" />
                <p className="text-body font-medium">{t('emptyEntries')}</p>
              </div>
            ) : (
              selectedDay.entries.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  onClick={() => {
                    setSelectedDay(null);
                    openEdit(entry);
                  }}
                />
              ))
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
