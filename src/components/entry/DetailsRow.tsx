'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Calendar, ChevronDown, PenLine } from 'lucide-react';
import { useWallets } from '@/lib/data/provider';
import { CategoryIcon } from '@/components/ui/category-icon';
import { pickName } from '@/lib/format';
import { Input } from '@/components/ui/input';

const CHIP =
  'relative inline-flex h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-surface-2 px-3 text-body font-semibold text-ink transition-transform active:scale-95 cursor-pointer';

// Invisible native control stretched over a chip, so iOS shows its own picker
const NATIVE_OVERLAY = 'absolute inset-0 h-full w-full cursor-pointer opacity-0';

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

/** Wallet chip ("Cash ▾") that opens the iOS picker. */
export function WalletSelect({ value, onChange, exclude, label }: WalletSelectProps) {
  const locale = useLocale();
  const wallets = (useWallets() ?? []).filter((w) => !exclude || w.id !== exclude);
  const current = wallets.find((w) => w.id === value);

  return (
    <label className={CHIP}>
      <CategoryIcon name={current?.icon} className="size-5 shrink-0 text-accent" />
      <span className="truncate">
        {current ? pickName({ name_ar: current.nameAr, name_en: current.nameEn }, locale) : label}
      </span>
      <ChevronDown className="size-4 shrink-0 text-ink-muted" />
      <select
        aria-label={label}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className={NATIVE_OVERLAY}
        style={{ fontSize: '16px' }} // Prevents iOS Safari zoom on focus
      >
        {!current && <option value="">{label}</option>}
        {wallets.map((w) => (
          <option key={w.id} value={w.id}>
            {pickName({ name_ar: w.nameAr, name_en: w.nameEn }, locale)}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Date chip showing Today / Yesterday / the date; opens the iOS date picker. */
export function DateChip({ value, onChange }: { value: string; onChange: (date: string) => void }) {
  const t = useTranslations('entry');
  const label = value === localDate(0) ? t('today') : value === localDate(-1) ? t('yesterday') : value;

  return (
    <label className={CHIP}>
      <Calendar className="size-5 shrink-0 text-accent" />
      <span className="truncate tabular-nums">{label}</span>
      <input
        type="date"
        aria-label={t('pickDay')}
        value={value}
        onChange={(e) => {
          if (e.target.value) onChange(e.target.value);
        }}
        className={NATIVE_OVERLAY}
        style={{ fontSize: '16px' }}
      />
    </label>
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
