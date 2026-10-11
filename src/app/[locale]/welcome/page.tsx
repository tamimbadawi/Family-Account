'use client';

import * as React from 'react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { db } from '@/lib/offline/db';
import { DEMO_HOUSEHOLD_ID, USER_MAMA_ID } from '@/lib/data/mock-seed';
import { isEnglishName } from '@/lib/members';
import { getSupabaseBrowserClient, isAuthConfigured } from '@/lib/supabase/client';
import { CurrencySelect } from '@/components/family/CurrencySelect';
import { DEFAULT_CURRENCY } from '@/lib/format';

export default function WelcomePage() {
  const tAuth = useTranslations('auth');
  const router = useRouter();
  const locale = useLocale();

  const [householdName, setHouseholdName] = React.useState('بيت العيلة');
  // The name the app shows for this person everywhere ("Added by Injy"); the email is only for signing in
  const [yourName, setYourName] = React.useState(isAuthConfigured() ? '' : 'Mama');
  // The family picks its own currencies: a main one and, if they want, a second one
  const [mainCurrency, setMainCurrency] = React.useState(DEFAULT_CURRENCY);
  const [secondCurrency, setSecondCurrency] = React.useState('');
  const nameIsValid = isEnglishName(yourName);
  const [saving, setSaving] = React.useState(false);

  // Signed in for real: the family name the operator chose when starting this family
  React.useEffect(() => {
    if (!isAuthConfigured()) return;
    getSupabaseBrowserClient()
      .auth.getUser()
      .then(({ data }) => {
        const chosen = data.user?.app_metadata?.family_name;
        if (typeof chosen === 'string' && chosen.trim()) setHouseholdName(chosen.trim());
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !nameIsValid) return;
    setSaving(true);

    if (isAuthConfigured()) {
      // Real sign-in: the first person to sign in creates the household and becomes its owner (admin)
      try {
        const supabase = getSupabaseBrowserClient();
        const { error } = await supabase.rpc('create_family', {
          p_name: householdName.trim() || 'عائلتنا',
          p_display_name: yourName.trim(),
          p_locale: locale,
          p_currencies: secondCurrency ? [mainCurrency, secondCurrency] : [mainCurrency],
        });
        if (error) throw error;
        router.replace('/');
      } catch (err) {
        console.error('create_family failed:', err);
        setSaving(false);
      }
      return;
    }

    try {
      // Store names in the local database
      await db.households.update(DEMO_HOUSEHOLD_ID, {
        name: householdName.trim() || 'عائلتنا',
        currency: mainCurrency,
      });
      await db.household_members.update([DEMO_HOUSEHOLD_ID, USER_MAMA_ID], {
        display_name: yourName.trim(),
      });
    } catch (err) {
      console.error('Failed to update local household name:', err);
    } finally {
      router.push('/');
    }
  };

  return (
    <div className="mx-auto flex h-dvh max-w-[520px] flex-col justify-between overflow-hidden bg-canvas px-6 pt-[max(env(safe-area-inset-top,0px),1.5rem)] pb-[max(env(safe-area-inset-bottom,0px),1.5rem)] text-ink select-none">
      <div className="flex flex-col items-center text-center mt-2">
        <div className="relative size-24 overflow-hidden rounded-[22px] shadow-card bg-surface">
          <Image
            src="/icons/icon-1024.png"
            alt={tAuth('appName')}
            width={96}
            height={96}
            priority
            className="size-full object-cover"
          />
        </div>
        <h1 className="mt-4 text-title font-bold tracking-tight text-ink">
          {tAuth('welcomeTitle')}
        </h1>
        <p className="mt-1 text-caption text-ink-muted">
          {tAuth('welcomeSubtitle')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full space-y-4 my-auto max-w-sm mx-auto">
        <div>
          <label className="mb-1.5 block text-caption font-medium text-ink-muted">
            {tAuth('householdName')}
          </label>
          <Input
            type="text"
            value={householdName}
            onChange={(e) => setHouseholdName(e.target.value)}
            placeholder={tAuth('householdPlaceholder')}
            required
            className="h-14 bg-surface text-body shadow-xs"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-caption font-medium text-ink-muted">
            {tAuth('yourName')}
          </label>
          <Input
            type="text"
            value={yourName}
            onChange={(e) => setYourName(e.target.value)}
            placeholder={tAuth('namePlaceholder')}
            required
            dir="ltr"
            lang="en"
            autoCapitalize="words"
            autoComplete="given-name"
            aria-invalid={!nameIsValid}
            aria-describedby="your-name-hint"
            className="h-14 bg-surface text-body shadow-xs"
          />
          <p
            id="your-name-hint"
            className={`mt-1.5 text-caption ${nameIsValid ? 'text-ink-muted' : 'text-danger'}`}
          >
            {tAuth('nameEnglishOnly')}
          </p>
        </div>

        <div>
          <p className="mb-1.5 block text-caption font-medium text-ink-muted">{tAuth('currencies')}</p>
          <div className="space-y-3">
            <CurrencySelect
              value={mainCurrency}
              exclude={secondCurrency}
              onChange={setMainCurrency}
            />
            <CurrencySelect
              value={secondCurrency}
              exclude={mainCurrency}
              noneLabel={tAuth('noSecondCurrency')}
              onChange={setSecondCurrency}
            />
          </div>
          <p className="mt-1.5 text-caption text-ink-muted">{tAuth('currenciesHint')}</p>
        </div>

        <Button
          type="submit"
          disabled={saving || !nameIsValid}
          className="h-14 w-full text-heading font-semibold mt-3 text-accent-ink"
        >
          {tAuth('getStarted')}
        </Button>
      </form>
    </div>
  );
}
