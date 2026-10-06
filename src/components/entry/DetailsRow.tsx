'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Calendar, ChevronLeft, ChevronRight, PenLine } from 'lucide-react';
import { useRepository, useWallets } from '@/lib/data/provider';
import type { Wallet } from '@/lib/data/types';
import { CategoryIcon } from '@/components/ui/category-icon';
import { formatMonth, pickName, shiftMonth } from '@/lib/format';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

const CHIP =
  'relative inline-flex h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-surface-2 px-3 text-body font-semibold text-ink transition-transform active:scale-95 cursor-pointer';

function localDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface WalletSelectProps {
  value: string | null;
  onChange: (walletId: string) => void;
  exclude?: string | null;
  label: string;
}

// The entry sheet underneath pulls focus back to itself; without this, tapping a text field here closes the picker
const keepFocus = (e: Event) => e.preventDefault();

const OPTION =
  'flex h-14 w-full items-center gap-3 rounded-2xl px-4 text-body font-semibold transition-transform active:scale-95 cursor-pointer';

/** Wallet chip ("Cash ▾"). Picking Bank asks which bank, and a new bank can be added by name right there. */
export function WalletSelect({ value, onChange, exclude, label }: WalletSelectProps) {
  const locale = useLocale();
  const t = useTranslations('entry');
  const repo = useRepository();
  const wallets = (useWallets() ?? []).filter((w) => !exclude || w.id !== exclude);
  const current = wallets.find((w) => w.id === value);
  const banks = wallets.filter((w) => w.type === 'bank');
  const others = wallets.filter((w) => w.type !== 'bank');
  const nameOf = (w: Wallet) => pickName({ name_ar: w.nameAr, name_en: w.nameEn }, locale);

  const [isOpen, setIsOpen] = React.useState(false);
  const [step, setStep] = React.useState<'kind' | 'bank'>('kind');
  const [newBank, setNewBank] = React.useState('');

  const open = () => {
    setStep('kind');
    setNewBank('');
    setIsOpen(true);
  };
  const pick = (id: string) => {
    onChange(id);
    setIsOpen(false);
  };
  const addBank = async () => {
    const name = newBank.trim();
    if (!name) return;
    const created = await repo.addWallet({ type: 'bank', nameAr: name, nameEn: name, icon: 'building-2' });
    pick(created.id);
  };

  const option = (w: Wallet) => (
    <button
      key={w.id}
      type="button"
      onClick={() => pick(w.id)}
      className={`${OPTION} ${w.id === value ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-ink'}`}
    >
      <CategoryIcon name={w.icon} className={`size-5 shrink-0 ${w.id === value ? 'text-accent-ink' : 'text-accent'}`} />
      <span className="truncate">{nameOf(w)}</span>
    </button>
  );

  return (
    <>
      <button type="button" onClick={open} aria-label={label} className={CHIP}>
        <CategoryIcon name={current?.icon} className="size-5 shrink-0 text-accent" />
        <span className="truncate">{current ? nameOf(current) : label}</span>
        </button>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent showCloseButton={false} onFocusOutside={keepFocus} className="max-w-[calc(100%-1.5rem)] gap-3 p-4">
          {step === 'kind' ? (
            <>
              <DialogTitle>{label}</DialogTitle>
              {others.map(option)}
              <button
                type="button"
                onClick={() => setStep('bank')}
                className={`${OPTION} ${current?.type === 'bank' ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-ink'}`}
              >
                <CategoryIcon
                  name="building-2"
                  className={`size-5 shrink-0 ${current?.type === 'bank' ? 'text-accent-ink' : 'text-accent'}`}
                />
                <span className="flex-1 truncate text-start">
                  {t('bank')}
                  {current?.type === 'bank' ? ` · ${nameOf(current)}` : ''}
                </span>
                <ChevronRight className="size-5 shrink-0 rtl:rotate-180" />
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={t('back')}
                  onClick={() => setStep('kind')}
                  className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink active:scale-95 cursor-pointer"
                >
                  <ChevronLeft className="size-5 rtl:rotate-180" />
                </button>
                <DialogTitle>{t('whichBank')}</DialogTitle>
              </div>
              {banks.map(option)}
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void addBank();
                }}
              >
                <Input
                  type="text"
                  maxLength={60}
                  aria-label={t('bankName')}
                  placeholder={t('bankName')}
                  value={newBank}
                  onChange={(e) => setNewBank(e.target.value)}
                  className="h-14 flex-1 rounded-2xl bg-surface-2 text-body"
                />
                <button
                  type="submit"
                  disabled={!newBank.trim()}
                  className="h-14 shrink-0 rounded-2xl bg-accent px-4 text-body font-semibold text-accent-ink active:scale-95 cursor-pointer disabled:opacity-40"
                >
                  {t('addBank')}
                </button>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Date chip showing Today / Yesterday / the date; opens the app's own calendar (works the same on every phone). */
export function DateChip({ value, onChange }: { value: string; onChange: (date: string) => void }) {
  const t = useTranslations('entry');
  const locale = useLocale();
  const [isOpen, setIsOpen] = React.useState(false);
  const today = localDate(0);
  const yesterday = localDate(-1);
  const intlLocale = locale.startsWith('ar') ? 'ar-EG' : 'en-EG';
  const label =
    value === today
      ? t('today')
      : value === yesterday
        ? t('yesterday')
        : new Intl.DateTimeFormat(intlLocale, { day: 'numeric', month: 'short', numberingSystem: 'latn' }).format(
            new Date(`${value}T00:00:00`)
          );

  const pick = (date: string) => {
    onChange(date);
    setIsOpen(false);
  };

  const quick = (date: string, text: string) => (
    <button
      type="button"
      onClick={() => pick(date)}
      className={`h-12 flex-1 rounded-2xl text-body font-semibold transition-transform active:scale-95 cursor-pointer ${
        value === date ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-ink'
      }`}
    >
      {text}
    </button>
  );

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} aria-label={t('pickDay')} className={CHIP}>
        <Calendar className="size-5 shrink-0 text-accent" />
        <span className="truncate tabular-nums">{label}</span>
      </button>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent showCloseButton={false} onFocusOutside={keepFocus} className="max-w-[calc(100%-1.5rem)] gap-3 p-4">
          <DialogTitle>{t('pickDay')}</DialogTitle>
          <div className="flex gap-2">
            {quick(today, t('today'))}
            {quick(yesterday, t('yesterday'))}
          </div>
          <MonthCalendar value={value} today={today} locale={intlLocale} onPick={pick} />
        </DialogContent>
      </Dialog>
    </>
  );
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Month grid (weeks start on Saturday, as in Egypt). Days after today can't be picked. */
function MonthCalendar({
  value,
  today,
  locale,
  onPick,
}: {
  value: string;
  today: string;
  locale: string;
  onPick: (date: string) => void;
}) {
  const t = useTranslations('entry');
  const [month, setMonth] = React.useState(value.slice(0, 7));
  const [year, m] = month.split('-').map(Number);
  const first = new Date(year, m - 1, 1);
  const daysInMonth = new Date(year, m, 0).getDate();
  const lead = (first.getDay() + 1) % 7; // Saturday = 0
  const isCurrentMonth = month >= today.slice(0, 7);

  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: locale.startsWith('ar') ? 'narrow' : 'short' }).format(
      new Date(2026, 9, 3 + i) // 3 Oct 2026 is a Saturday
    )
  );

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label={t('prevMonth')}
          onClick={() => setMonth(shiftMonth(month, -1))}
          className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-ink active:scale-95 cursor-pointer"
        >
          <ChevronLeft className="size-5 rtl:rotate-180" />
        </button>
        <span className="text-heading font-semibold text-ink">{formatMonth(month, locale)}</span>
        <button
          type="button"
          aria-label={t('nextMonth')}
          disabled={isCurrentMonth}
          onClick={() => setMonth(shiftMonth(month, 1))}
          className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-ink active:scale-95 cursor-pointer disabled:opacity-30"
        >
          <ChevronRight className="size-5 rtl:rotate-180" />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-caption text-ink-muted">
        {weekdays.map((w) => (
          <span key={w} className="py-1">{w}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {Array.from({ length: lead }, (_, i) => (
          <span key={`lead-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const date = `${month}-${pad2(i + 1)}`;
          const isSelected = date === value;
          return (
            <button
              key={date}
              type="button"
              disabled={date > today}
              onClick={() => onPick(date)}
              className={`mx-auto flex size-11 items-center justify-center rounded-full text-body tabular-nums transition-transform active:scale-95 cursor-pointer disabled:cursor-default disabled:opacity-30 ${
                isSelected
                  ? 'bg-accent font-bold text-accent-ink'
                  : date === today
                    ? 'font-bold text-accent ring-2 ring-accent'
                    : 'text-ink'
              }`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Note chip; tapping it opens a text field in the same spot. */
export function NoteChip({
  value,
  onChange,
  isOpen,
  onOpenChange,
}: {
  value: string;
  onChange: (note: string) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('entry');

  if (isOpen) {
    return (
      <Input
        autoFocus
        type="text"
        maxLength={500}
        aria-label={t('note')}
        placeholder={t('note')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => onOpenChange(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onOpenChange(false);
        }}
        className="h-12 w-full rounded-2xl bg-surface-2 text-body"
      />
    );
  }

  return (
    <button type="button" onClick={() => onOpenChange(true)} className={CHIP}>
      <PenLine className="size-5 shrink-0 text-accent" />
      <span className={`truncate ${value ? '' : 'text-ink-muted'}`}>{value || t('noteShort')}</span>
    </button>
  );
}
