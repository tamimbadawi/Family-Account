'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronLeft, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from '@/i18n/navigation';
import { WalletShortcut } from '@/components/layout/WalletShortcut';
import { Button } from '@/components/ui/button';
import { CurrencySelect } from '@/components/family/CurrencySelect';
import { useHousehold, useRepository } from '@/lib/data/provider';
import { isOfflineError } from '@/lib/data/errors';
import { currencyName, currencySymbol, normalizeDigits } from '@/lib/format';
import { useIsFamilyAdmin } from '@/lib/auth/use-family-members';
import { fetchExchangeRate } from '@/lib/currency/converter';

function formatRate(val: number): string {
  if (!Number.isFinite(val) || val <= 0) return '—';
  const str = val.toFixed(6);
  return str.replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');
}

/** Settings → Currencies: The single household currency. With an online converter to convert existing amounts. */
export default function CurrenciesPage() {
  const t = useTranslations('family');
  const tCommon = useTranslations('common');
  const tSettings = useTranslations('settings');
  const locale = useLocale();
  const repo = useRepository();
  const household = useHousehold();

  const isOwner = useIsFamilyAdmin() ?? false;

  const currentCurrency = React.useMemo(() => {
    return household?.currency ?? household?.currencies?.[0] ?? 'EGP';
  }, [household]);

  const [overrideCurrency, setOverrideCurrency] = React.useState<string | null>(null);
  const [exchangeRateStr, setExchangeRateStr] = React.useState<string>('1');
  const [fetchingRate, setFetchingRate] = React.useState<boolean>(false);
  const [rateProvider, setRateProvider] = React.useState<string>('');
  const [converting, setConverting] = React.useState<boolean>(false);

  const selectedCurrency = overrideCurrency ?? currentCurrency;
  const hasCurrencyChange = selectedCurrency !== currentCurrency;

  const numericRate = React.useMemo(() => {
    return Number(normalizeDigits(exchangeRateStr).replace(/[,\s٬]/g, '')) || 0;
  }, [exchangeRateStr]);

  const inverseRate = numericRate > 0 ? 1 / numericRate : 0;

  const handleCurrencySelect = async (newCurrency: string) => {
    if (!newCurrency) return;
    setOverrideCurrency(newCurrency);

    if (newCurrency === currentCurrency) {
      setExchangeRateStr('1');
      setRateProvider('');
      return;
    }

    setFetchingRate(true);
    try {
      const res = await fetchExchangeRate(currentCurrency, newCurrency);
      setExchangeRateStr(String(res.rate));
      setRateProvider(res.provider);
      toast.success(`${res.from} → ${res.to}: ${res.rate}`);
    } catch {
      setExchangeRateStr('1');
      setRateProvider('');
      toast.error(t('rateFetchFailed'));
    } finally {
      setFetchingRate(false);
    }
  };

  const handleConvertAndSave = async () => {
    if (converting) return;
    if (!Number.isFinite(numericRate) || numericRate <= 0) {
      toast.error(tCommon('errors.invalidAmount') ?? 'Invalid exchange rate');
      return;
    }

    setConverting(true);
    try {
      await repo.convertHouseholdCurrency(selectedCurrency, numericRate);
      setOverrideCurrency(null);
      toast.success(t('conversionSuccess', { currency: selectedCurrency }));
    } catch (err) {
      if (isOfflineError(err) || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        toast.error(tCommon('noConnection'));
      } else {
        toast.error(err instanceof Error ? err.message : tCommon('errors.failed'));
      }
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto overscroll-contain">
      <div className="flex shrink-0 items-center justify-between border-b border-line/30 px-5 pt-[max(env(safe-area-inset-top,0px),1rem)] pb-3 select-none">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/settings"
            className="-ms-2 flex size-11 shrink-0 items-center justify-center rounded-full text-accent transition-colors hover:bg-surface-2"
            aria-label={tSettings('back')}
          >
            <ChevronLeft className="size-6 rtl:rotate-180" />
          </Link>
          <h1 className="truncate text-title font-bold text-ink">{t('currencies')}</h1>
        </div>
        <WalletShortcut />
      </div>

      <div className="flex-1 space-y-4 px-5 py-4 pb-24">
        <p className="text-body text-ink-muted leading-relaxed">{t('currenciesHint')}</p>

        {isOwner ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="main-currency" className="text-body font-semibold text-ink">
                {t('householdCurrency')}
              </label>
              <CurrencySelect
                id="main-currency"
                value={selectedCurrency}
                onChange={handleCurrencySelect}
              />
            </div>

            {hasCurrencyChange && (
              <div className="space-y-3 rounded-2xl border border-accent/20 bg-surface-2/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-caption font-semibold text-accent flex items-center gap-1.5">
                    <RefreshCw className={`size-3.5 ${fetchingRate ? 'animate-spin' : ''}`} />
                    {t('onlineConverter')}
                  </span>
                  {rateProvider && (
                    <span className="text-[11px] font-medium text-ink-muted">
                      {rateProvider}
                    </span>
                  )}
                </div>

                {/* Both conversion directions */}
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface p-3.5 border border-line/50">
                  <div className="space-y-0.5">
                    <span className="block text-[12px] font-medium text-ink-muted">
                      1 {currentCurrency} =
                    </span>
                    <span className="text-body font-mono font-bold text-ink tabular-nums">
                      {formatRate(numericRate)} <span className="text-caption font-sans font-medium text-ink-muted">{selectedCurrency}</span>
                    </span>
                  </div>
                  <div className="space-y-0.5 border-s border-line/40 ps-3">
                    <span className="block text-[12px] font-medium text-ink-muted">
                      1 {selectedCurrency} =
                    </span>
                    <span className="text-body font-mono font-bold text-ink tabular-nums">
                      {formatRate(inverseRate)} <span className="text-caption font-sans font-medium text-ink-muted">{currentCurrency}</span>
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="exchange-rate" className="text-caption font-medium text-ink-muted">
                    {t('exchangeRate')} (1 {currentCurrency} = ? {selectedCurrency})
                  </label>
                  <input
                    id="exchange-rate"
                    type="text"
                    inputMode="decimal"
                    value={exchangeRateStr}
                    disabled={fetchingRate || converting}
                    onChange={(e) => setExchangeRateStr(e.target.value)}
                    className="h-12 w-full rounded-xl bg-surface border border-line/60 px-3.5 text-body font-mono tabular-nums text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <p className="text-[12px] text-ink-muted tabular-nums">
                    1 {selectedCurrency} = {formatRate(inverseRate)} {currentCurrency}
                  </p>
                </div>

                <p className="text-caption text-ink-muted leading-relaxed">
                  {t('convertExplanation', { currency: selectedCurrency })}
                </p>

                <Button
                  type="button"
                  onClick={handleConvertAndSave}
                  disabled={converting || fetchingRate}
                  className="h-14 w-full text-heading font-semibold text-accent-ink"
                >
                  {converting
                    ? t('converting')
                    : t('applyConversion', { currency: selectedCurrency })}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-card border border-line/40 bg-surface shadow-card p-4">
            <span className="block text-caption text-ink-muted">{t('householdCurrency')}</span>
            <span className="text-body font-semibold text-ink">
              {currencyName(currentCurrency, locale)} ({currencySymbol(currentCurrency, locale)})
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
