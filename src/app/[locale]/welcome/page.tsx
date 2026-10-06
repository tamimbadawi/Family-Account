'use client';

import * as React from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { db } from '@/lib/offline/db';
import { DEMO_HOUSEHOLD_ID, USER_MAMA_ID } from '@/lib/data/mock-seed';

export default function WelcomePage() {
  const tAuth = useTranslations('auth');
  const router = useRouter();

  const [householdName, setHouseholdName] = React.useState('بيت العيلة');
  const [yourName, setYourName] = React.useState('ماما');
  const [saving, setSaving] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);

    try {
      // Store names in the local database
      await db.households.update(DEMO_HOUSEHOLD_ID, {
        name: householdName.trim() || 'عائلتنا',
      });
      await db.household_members.update([DEMO_HOUSEHOLD_ID, USER_MAMA_ID], {
        display_name: yourName.trim() || 'ماما',
      });
    } catch (err) {
      console.error('Failed to update local household name:', err);
    } finally {
      router.push('/');
    }
  };

  return (
    <div className="mx-auto flex h-dvh max-w-[520px] flex-col justify-between overflow-hidden bg-canvas px-6 py-8 text-ink select-none">
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
            className="h-14 bg-surface text-body shadow-xs"
          />
        </div>

        <Button
          type="submit"
          disabled={saving}
          className="h-14 w-full text-heading font-semibold mt-3"
        >
          {tAuth('getStarted')}
        </Button>
      </form>

      <div className="text-center pb-2">
        <p className="text-caption text-ink-muted">
          {tAuth('appName')}
        </p>
      </div>
    </div>
  );
}
