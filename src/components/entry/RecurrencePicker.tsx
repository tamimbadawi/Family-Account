'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Check, ChevronLeft, ChevronRight, Minus, Plus, Repeat } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { RecurrenceFrequency } from '@/lib/data/types';
import { dayOfWeek } from '@/lib/recurring/date';
import { useRecurrenceSummary, useWeekdayNames } from './useRecurrenceSummary';

/** How an entry repeats. `null` everywhere means "does not repeat". */
export interface RecurrenceConfig {
  frequency: RecurrenceFrequency;
  interval: number;
  daysOfWeek: number[]; // weekly only; empty = the weekday of the entry's date
  endDate: string | null;
}

export const MONTHLY: RecurrenceConfig = { frequency: 'monthly', interval: 1, daysOfWeek: [], endDate: null };

interface RecurrencePickerProps {
  value: RecurrenceConfig | null;
  onChange: (config: RecurrenceConfig | null) => void;
  /** The entry's date (YYYY-MM-DD): the first time it repeats from. */
  startDate: string;
}

const FREQUENCIES: RecurrenceFrequency[] = ['daily', 'weekly', 'monthly', 'yearly'];
const PRESETS: RecurrenceFrequency[] = ['weekly', 'monthly', 'yearly'];
// Weeks start on Saturday, as in Egypt (same as the day picker)
const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5];
const MAX_INTERVAL = 99;

const keepFocus = (e: Event) => e.preventDefault();

const OPTION =
  'flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 py-2 text-start text-body font-semibold transition-transform active:scale-95 cursor-pointer';
const PILL =
  'flex h-12 min-w-0 items-center justify-center rounded-2xl px-2 text-body font-semibold transition-transform active:scale-95 cursor-pointer select-none';
const pill = (on: boolean) => `${PILL} ${on ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-ink'}`;
const LABEL = 'text-caption font-semibold text-ink-muted';

/** A plain "every week / month / year" with nothing else chosen. */
function isPreset(value: RecurrenceConfig, startDate: string): boolean {
  if (value.interval !== 1 || value.endDate || !PRESETS.includes(value.frequency)) return false;
  if (value.frequency !== 'weekly' || value.daysOfWeek.length === 0) return true;
  return value.daysOfWeek.length === 1 && value.daysOfWeek[0] === dayOfWeek(startDate);
}

export function RecurrencePicker({ value, onChange, startDate }: RecurrencePickerProps) {
  const t = useTranslations('recurring');
  const summarize = useRecurrenceSummary();
  const weekdayLetters = useWeekdayNames('narrow');
  const weekdaysLong = useWeekdayNames('long');
  const [step, setStep] = React.useState<'closed' | 'options' | 'custom'>('closed');
  const [draft, setDraft] = React.useState<RecurrenceConfig>(MONTHLY);

  const summaryOf = (config: RecurrenceConfig) => summarize({ ...config, startDate });
  const startDay = dayOfWeek(startDate);
  const customActive = value !== null && !isPreset(value, startDate);

  const choose = (config: RecurrenceConfig | null) => {
    onChange(config);
    setStep('closed');
  };

  const openCustom = () => {
    const from = value ?? { ...MONTHLY, frequency: 'weekly' as const };
    setDraft({ ...from, daysOfWeek: from.daysOfWeek.length ? from.daysOfWeek : [startDay] });
    setStep('custom');
  };

  const toggleDay = (day: number) =>
    setDraft((d) => {
      const days = d.daysOfWeek.includes(day) ? d.daysOfWeek.filter((x) => x !== day) : [...d.daysOfWeek, day];
      // A weekly schedule always keeps at least one day
      return days.length ? { ...d, daysOfWeek: days } : d;
    });

  const applyCustom = () =>
    choose({
      ...draft,
      daysOfWeek: draft.frequency === 'weekly' ? [...draft.daysOfWeek].sort((a, b) => a - b) : [],
      endDate: draft.endDate && draft.endDate >= startDate ? draft.endDate : null,
    });

  const option = (key: string, label: string, active: boolean, onClick: () => void, more = false) => (
    <button
      key={key}
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`${OPTION} ${active ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-ink'}`}
    >
      <span className="min-w-0 flex-1">{label}</span>
      {active && !more && <Check className="size-5 shrink-0" />}
      {more && <ChevronRight className="size-5 shrink-0 rtl:rotate-180" />}
    </button>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setStep('options')}
        className="flex h-11 w-full items-center gap-2 rounded-2xl bg-surface-2 px-3.5 text-body font-semibold transition-transform active:scale-[0.98] cursor-pointer select-none"
      >
        <Repeat className={`size-5 shrink-0 ${value ? 'text-accent' : 'text-ink-muted'}`} />
        <span className="shrink-0 text-ink">{t('repeat')}</span>
        <span className={`min-w-0 flex-1 truncate text-end ${value ? 'text-accent' : 'font-medium text-ink-muted'}`}>
          {value ? summaryOf(value) : t('never')}
        </span>
        <ChevronRight className="size-5 shrink-0 text-ink-muted rtl:rotate-180" />
      </button>

      <Dialog open={step !== 'closed'} onOpenChange={(open) => !open && setStep('closed')}>
        <DialogContent
          showCloseButton={false}
          onFocusOutside={keepFocus}
          onCloseAutoFocus={keepFocus}
          className="max-h-[calc(100dvh-2rem)] max-w-[calc(100%-1.5rem)] gap-3 overflow-y-auto overscroll-contain p-4"
        >
          {step !== 'custom' ? (
            <>
              <DialogTitle>{t('repeat')}</DialogTitle>
              <div role="radiogroup" aria-label={t('repeat')} className="flex flex-col gap-2">
                {option('never', t('never'), value === null, () => choose(null))}
                {PRESETS.map((frequency) => {
                  const preset: RecurrenceConfig = { ...MONTHLY, frequency };
                  return option(
                    frequency,
                    summaryOf(preset),
                    value !== null && !customActive && value.frequency === frequency,
                    () => choose(preset)
                  );
                })}
                {option('custom', customActive && value ? summaryOf(value) : t('custom'), customActive, openCustom, true)}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setStep('options')}
                  aria-label={t('back')}
                  className="-ms-2 flex size-12 shrink-0 items-center justify-center rounded-2xl text-ink-muted transition-transform active:scale-90 cursor-pointer"
                >
                  <ChevronLeft className="size-6 rtl:rotate-180" />
                </button>
                <DialogTitle>{t('customTitle')}</DialogTitle>
              </div>

              <div className="flex flex-col gap-1.5">
                <p className={LABEL}>{t('frequency')}</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {FREQUENCIES.map((frequency) => (
                    <button
                      key={frequency}
                      type="button"
                      aria-pressed={draft.frequency === frequency}
                      className={`${pill(draft.frequency === frequency)} text-caption`}
                      onClick={() => setDraft((d) => ({ ...d, frequency }))}
                    >
                      {t(`freq_${frequency}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <p className={LABEL}>{t('every')}</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label={t('less')}
                    disabled={draft.interval <= 1}
                    className={`${pill(false)} w-14 shrink-0 disabled:opacity-40`}
                    onClick={() => setDraft((d) => ({ ...d, interval: Math.max(1, d.interval - 1) }))}
                  >
                    <Minus className="size-5" />
                  </button>
                  <span className="flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl bg-surface-2 text-body font-semibold text-ink">
                    <span className="tabular-nums">{draft.interval}</span>
                    <span className="truncate">{t(`unit_${draft.frequency}`, { count: draft.interval })}</span>
                  </span>
                  <button
                    type="button"
                    aria-label={t('more')}
                    disabled={draft.interval >= MAX_INTERVAL}
                    className={`${pill(false)} w-14 shrink-0 disabled:opacity-40`}
                    onClick={() => setDraft((d) => ({ ...d, interval: Math.min(MAX_INTERVAL, d.interval + 1) }))}
                  >
                    <Plus className="size-5" />
                  </button>
                </div>
              </div>

              {draft.frequency === 'weekly' && (
                <div className="flex flex-col gap-1.5">
                  <p className={LABEL}>{t('onDays')}</p>
                  <div className="grid grid-cols-7 gap-1">
                    {WEEK_ORDER.map((day) => (
                      <button
                        key={day}
                        type="button"
                        aria-pressed={draft.daysOfWeek.includes(day)}
                        aria-label={weekdaysLong[day]}
                        className={pill(draft.daysOfWeek.includes(day))}
                        onClick={() => toggleDay(day)}
                      >
                        {weekdayLetters[day]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <p className={LABEL}>{t('ends')}</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    aria-pressed={draft.endDate === null}
                    className={pill(draft.endDate === null)}
                    onClick={() => setDraft((d) => ({ ...d, endDate: null }))}
                  >
                    {t('endsNever')}
                  </button>
                  <label className={`${pill(draft.endDate !== null)} relative`}>
                    <span className="truncate">{t('endsOn')}</span>
                    <input
                      type="date"
                      aria-label={t('endsOn')}
                      min={startDate}
                      value={draft.endDate ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, endDate: e.target.value || null }))}
                      className="absolute inset-0 size-full cursor-pointer opacity-0"
                    />
                  </label>
                </div>
              </div>

              <p className="rounded-2xl bg-accent-soft px-4 py-3 text-body font-semibold text-accent" aria-live="polite">
                {summaryOf(draft)}
              </p>

              <button
                type="button"
                onClick={applyCustom}
                className="h-14 w-full rounded-2xl bg-accent text-body font-semibold text-accent-ink transition-transform active:scale-95 cursor-pointer"
              >
                {t('done')}
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
