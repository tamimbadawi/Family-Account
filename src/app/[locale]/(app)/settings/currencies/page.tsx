'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from '@/i18n/navigation';
import { WalletShortcut } from '@/components/layout/WalletShortcut';
import { Button } from '@/components/ui/button';
import { CurrencySelect } from '@/components/family/CurrencySelect';
import { useHousehold, useRepository } from '@/lib/data/provider';
import { isOfflineError } from '@/lib/data/errors';
import { currencyName, currencySymbol } from '@/lib/format';
import { useIsFamilyAdmin } from '@/lib/auth/use-family-members';

/** Settings → Currencies: the one or two currencies the family's wallets use. Only the admin can change them. */
export default function CurrenciesPage() {
  const t = useTranslations('family');
  const tCommon = useTranslations('common');
  const tSettings = useTranslations('settings');
  const locale = useLocale();
  const repo = useRepository();
  const household = useHousehold();

  const isOwner = useIsFamilyAdmin() ?? false;

  const currentCurrencies = React.useMemo(() => {
    return household?.currencies ?? (household?.currency ? [household.currency] : ['EGP']);
  }, [household]);
  const defaultMain = currentCurrencies[0] || 'EGP';
  const defaultSecond = currentCurrencies[1] || '';

  const [overrideMain, setOverrideMain] = React.useState<string | null>(null);
  const [overrideSecond, setOverrideSecond] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const mainCurrency = overrideMain ?? defaultMain;
  const secondCurrency = overrideSecond !== null ? overrideSecond : defaultSecond;
  const hasChanges = mainCurrency !== defaultMain || secondCurrency !== defaultSecond;

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await repo.setHouseholdCurrencies(secondCurrency ? [mainCurrency, secondCurrency] : [mainCurrency]);
      setOverrideMain(null);
      setOverrideSecond(null);
      toast.success(t('currenciesSaved'));
    } catch (err) {
      if (isOfflineError(err) || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        toast.error(tCommon('noConnection'));
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('wallet still uses')) toast.error(t('currencyInUse'));
        else if (msg.includes('one or two') || msg.includes('Choose')) toast.error(t('chooseCurrencies'));
        else toast.error(t('errors.failed'));
      }
    } finally {
      setSaving(false);
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
                {t('mainCurrency')}
              </label>
              <CurrencySelect id="main-currency" value={mainCurrency} exclude={secondCurrency} onChange={setOverrideMain} />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="second-currency" className="text-body font-semibold text-ink">
                {t('secondCurrency')}
              </label>
              <CurrencySelect
                id="second-currency"
                value={secondCurrency}
                exclude={mainCurrency}
                noneLabel={t('noSecondCurrency')}
                onChange={setOverrideSecond}
              />
            </div>

            {hasChanges && (
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="h-14 w-full text-heading font-semibold text-accent-ink"
              >
                {saving ? t('saving') : t('saveCurrencies')}
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-line/40 rounded-card border border-line/40 bg-surface shadow-card">
            <div className="px-4 py-3">
              <span className="block text-caption text-ink-muted">{t('mainCurrency')}</span>
              <span className="text-body font-semibold text-ink">
                {currencyName(mainCurrency, locale)} ({currencySymbol(mainCurrency, locale)})
              </span>
            </div>
            {secondCurrency && (
              <div className="px-4 py-3">
                <span className="block text-caption text-ink-muted">{t('secondCurrency')}</span>
                <span className="text-body font-semibold text-ink">
                  {currencyName(secondCurrency, locale)} ({currencySymbol(secondCurrency, locale)})
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
