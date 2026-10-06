'use client';

import * as React from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { RepositoryProvider } from '@/lib/data/provider';
import type { Category, EntryType, Item, Subcategory } from '@/lib/data/types';
import { TypeToggle } from '@/components/entry/TypeToggle';
import { AmountDisplay } from '@/components/entry/AmountDisplay';
import { AmountPad } from '@/components/entry/AmountPad';
import { CategoryPicker } from '@/components/entry/CategoryPicker';
import { WalletPicker } from '@/components/entry/WalletPicker';
import { DateChips } from '@/components/entry/DateChips';
import { NoteField } from '@/components/entry/NoteField';
import { pickName } from '@/lib/format';

function EntryPartsDemo() {
  const t = useTranslations('styleguide');
  const locale = useLocale();

  const otherLocale = locale === 'ar' ? 'en' : 'ar';
  const otherLocaleLabel = locale === 'ar' ? 'English' : 'العربية';

  // State
  const [entryType, setEntryType] = React.useState<EntryType>('expense');
  const [amountStr, setAmountStr] = React.useState('150');
  const [selectedWalletId, setSelectedWalletId] = React.useState<string | null>(null);
  const [dateStr, setDateStr] = React.useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [noteStr, setNoteStr] = React.useState('');
  const [pickedItemInfo, setPickedItemInfo] = React.useState<{
    item: Item;
    subcategory?: Subcategory;
    category?: Category;
  } | null>(null);

  const handlePickItem = (item: Item, subcategory: Subcategory, category: Category) => {
    setPickedItemInfo({ item, subcategory, category });
  };

  const pickedItemLabel = pickedItemInfo
    ? `${pickName({ name_ar: pickedItemInfo.category?.nameAr, name_en: pickedItemInfo.category?.nameEn }, locale)} ‹ ${pickName({ name_ar: pickedItemInfo.subcategory?.nameAr, name_en: pickedItemInfo.subcategory?.nameEn }, locale)} ‹ ${pickName({ name_ar: pickedItemInfo.item.nameAr, name_en: pickedItemInfo.item.nameEn }, locale)}`
    : null;

  return (
    <main className="mx-auto min-h-screen max-w-[540px] px-5 py-8 pb-24 text-ink">
      {/* Header */}
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-title font-bold text-ink">{t('entryPartsTitle')}</h1>
          <p className="mt-1 text-caption text-ink-muted">{t('entryPartsSubtitle')}</p>
        </div>
        <Link
          href="/styleguide/entry"
          locale={otherLocale}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-surface-2 px-3.5 text-caption font-semibold text-ink transition-colors hover:bg-line/70"
        >
          {otherLocaleLabel}
        </Link>
      </header>

      {/* 1. Type Toggle */}
      <section className="mb-8 space-y-3">
        <h2 className="text-heading font-semibold text-ink">{t('typeToggleSection')}</h2>
        <TypeToggle value={entryType} onChange={setEntryType} />
      </section>

      {/* 2. Amount Display + AmountPad */}
      <section className="mb-8 space-y-3">
        <h2 className="text-heading font-semibold text-ink">{t('amountSection')}</h2>
        <div className="rounded-card bg-surface p-5 shadow-card space-y-3">
          <AmountDisplay value={amountStr} type={entryType} />
          <AmountPad value={amountStr} onChange={setAmountStr} />
        </div>
      </section>

      {/* 3. Category Picker */}
      {entryType !== 'transfer' && (
        <section className="mb-8 space-y-3">
          <h2 className="text-heading font-semibold text-ink">{t('categoryPickerSection')}</h2>
          <div className="rounded-card bg-surface p-5 shadow-card space-y-4">
            {pickedItemLabel && (
              <div className="rounded-xl bg-surface-2 p-3 text-caption font-medium text-ink">
                <span className="text-ink-muted me-1">{t('pickedItem')}</span>
                <span className="font-semibold text-accent">{pickedItemLabel}</span>
              </div>
            )}
            <CategoryPicker
              kind={entryType === 'income' ? 'income' : 'expense'}
              onPick={handlePickItem}
            />
          </div>
        </section>
      )}

      {/* 4. Wallet Picker */}
      <section className="mb-8 space-y-3">
        <h2 className="text-heading font-semibold text-ink">{t('walletPickerSection')}</h2>
        <div className="rounded-card bg-surface p-5 shadow-card">
          <WalletPicker
            value={selectedWalletId}
            onChange={setSelectedWalletId}
          />
        </div>
      </section>

      {/* 5. Date Chips & Note Field */}
      <section className="mb-8 space-y-3">
        <h2 className="text-heading font-semibold text-ink">{t('dateAndNoteSection')}</h2>
        <div className="rounded-card bg-surface p-5 shadow-card space-y-4">
          <DateChips value={dateStr} onChange={setDateStr} />
          <NoteField value={noteStr} onChange={setNoteStr} />
        </div>
      </section>
    </main>
  );
}

export default function StyleguideEntryPage() {
  return (
    <RepositoryProvider>
      <EntryPartsDemo />
    </RepositoryProvider>
  );
}
