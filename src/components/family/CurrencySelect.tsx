'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { useRestoreSheetAfterKeyboard } from '@/components/settings/useRestoreSheetAfterKeyboard';
import { currencyChoices, currencyName, normalizeDigits } from '@/lib/format';
import { cn } from '@/lib/utils';

interface CurrencySelectProps {
  id?: string;
  value: string;
  onChange: (code: string) => void;
  /** Adds a first "none" choice with this label (value ''), for the optional second currency. */
  noneLabel?: string;
  /** A code that can't be picked here (the other currency). */
  exclude?: string;
  className?: string;
}

const subscribeNever = () => () => {};

const fold = (text: string) => normalizeDigits(text).trim().toLowerCase();

/**
 * The family picks its own currencies. Tapping the field opens a sheet with a small search bar on
 * top of the list (code or name, in either language); common currencies come first.
 */
export function CurrencySelect({ id, value, onChange, noneLabel, exclude, className }: CurrencySelectProps) {
  const t = useTranslations('common.currencyPicker');
  const locale = useLocale();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');

  // Start with an empty search each time the sheet opens
  const [wasOpen, setWasOpen] = React.useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setQuery('');
  }

  const sheetRef = React.useRef<HTMLDivElement>(null);
  useRestoreSheetAfterKeyboard(sheetRef, open);

  // Currency names come from the phone's own Intl data, which differs from the server's: show the
  // name only after hydration (the server renders just the chosen code)
  const hydrated = React.useSyncExternalStore(subscribeNever, () => true, () => false);

  const choices = React.useMemo(() => {
    if (!open) return [];
    const otherLocale = locale.startsWith('ar') ? 'en' : 'ar';
    return currencyChoices(locale)
      .filter((c) => c.code !== exclude)
      .map((c) => ({ ...c, haystack: fold(`${c.code} ${c.name} ${currencyName(c.code, otherLocale)}`) }));
  }, [open, locale, exclude]);

  const needle = fold(query);
  const matches = needle ? choices.filter((c) => c.haystack.includes(needle)) : choices;
  const showNone = noneLabel !== undefined && (!needle || fold(noneLabel).includes(needle));

  const label = (code: string, name: string) => (name === code ? code : `${code} · ${name}`);
  const pick = (code: string) => {
    onChange(code);
    setOpen(false);
  };

  const rowClass =
    'flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 rounded-2xl px-3 text-start text-body text-ink transition-colors active:bg-surface-2';

  return (
    <>
      <button
        type="button"
        id={id}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={cn(
          'relative flex h-14 w-full cursor-pointer items-center rounded-2xl bg-surface ps-4 pe-10 text-start text-body text-ink shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-accent',
          className
        )}
      >
        <span className="truncate">
          {value ? (hydrated ? label(value, currencyName(value, locale)) : value) : (noneLabel ?? '')}
        </span>
        <ChevronDown aria-hidden className="pointer-events-none absolute end-3 top-1/2 size-5 -translate-y-1/2 text-ink-muted" />
      </button>

      <Drawer open={open} onOpenChange={setOpen} repositionInputs>
        <DrawerContent ref={sheetRef} className="h-[80dvh]">
          <DrawerHeader className="shrink-0 gap-3 px-5 pt-4 pb-3">
            <DrawerTitle className="text-start">{t('title')}</DrawerTitle>
            <div className="flex h-12 w-full items-center rounded-2xl border border-line/40 bg-surface-2 px-3">
              <Search className="ms-1 me-2 size-5 shrink-0 text-ink-muted" aria-hidden />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('search')}
                aria-label={t('search')}
                autoComplete="off"
                autoCorrect="off"
                enterKeyHint="search"
                className="min-w-0 flex-1 bg-transparent text-body text-ink placeholder:text-ink-muted focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label={t('clear')}
                  className="flex min-h-12 min-w-12 cursor-pointer items-center justify-center rounded-full text-ink-muted transition-transform active:scale-95"
                >
                  <X className="size-5" />
                </button>
              )}
            </div>
          </DrawerHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-8">
            {showNone && (
              <button type="button" onClick={() => pick('')} className={rowClass}>
                <span className="truncate">{noneLabel}</span>
                {value === '' && <Check aria-hidden className="size-5 shrink-0 text-accent" />}
              </button>
            )}
            {matches.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => pick(c.code)}
                aria-current={c.code === value || undefined}
                className={rowClass}
              >
                <span className="truncate">{label(c.code, c.name)}</span>
                {c.code === value && <Check aria-hidden className="size-5 shrink-0 text-accent" />}
              </button>
            ))}
            {!showNone && matches.length === 0 && (
              <p className="px-3 py-8 text-center text-body text-ink-muted">{t('empty')}</p>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
