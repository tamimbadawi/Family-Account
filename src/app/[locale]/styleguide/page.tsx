'use client';

import * as React from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  ArrowDownLeft,
  Check,
  ChevronRight,
  Plus,
  ShoppingBag,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Toaster } from '@/components/ui/sonner';
import { money } from '@/lib/format';
import { Link } from '@/i18n/navigation';

export default function StyleguidePage() {
  const t = useTranslations('styleguide');
  const locale = useLocale();
  const [selectedFilter, setSelectedFilter] = React.useState('all');
  const [switchChecked, setSwitchChecked] = React.useState(false);

  const otherLocale = locale === 'ar' ? 'en' : 'ar';
  const otherLocaleLabel = locale === 'ar' ? 'English' : 'العربية';

  const handleTestToast = () => {
    toast(t('toastMessage'), {
      description: money(450, locale),
      action: {
        label: t('toastAction'),
        onClick: () => toast.success(t('undoSuccess')),
      },
    });
  };

  return (
    <main className="mx-auto min-h-screen max-w-[540px] px-5 py-8 pb-24 text-ink">
      <Toaster position="bottom-center" />

      {/* Header */}
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-title font-bold text-ink">{t('title')}</h1>
          <p className="mt-1 text-caption text-ink-muted">{t('subtitle')}</p>
        </div>
        <Link
          href="/styleguide"
          locale={otherLocale}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-surface-2 px-3.5 text-caption font-semibold text-ink transition-colors hover:bg-line/70"
        >
          {otherLocaleLabel}
        </Link>
      </header>

      {/* Color Tokens */}
      <section className="mb-10 space-y-4">
        <h2 className="text-heading font-semibold text-ink">{t('colorsTitle')}</h2>
        
        {/* Surfaces */}
        <div className="space-y-2">
          <span className="text-caption font-medium text-ink-muted">{t('surfaces')}</span>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="flex flex-col gap-1.5 rounded-2xl border border-line bg-canvas p-3 shadow-xs">
              <div className="h-10 rounded-xl border border-line bg-canvas" />
              <span className="text-caption font-medium text-ink">{t('canvas')}</span>
            </div>
            <div className="flex flex-col gap-1.5 rounded-2xl border border-line bg-surface p-3 shadow-xs">
              <div className="h-10 rounded-xl border border-line bg-surface shadow-xs" />
              <span className="text-caption font-medium text-ink">{t('surface')}</span>
            </div>
            <div className="flex flex-col gap-1.5 rounded-2xl border border-line bg-surface p-3 shadow-xs">
              <div className="h-10 rounded-xl bg-surface-2" />
              <span className="text-caption font-medium text-ink">{t('surface2')}</span>
            </div>
            <div className="flex flex-col gap-1.5 rounded-2xl border border-line bg-surface p-3 shadow-xs">
              <div className="h-10 rounded-xl bg-line" />
              <span className="text-caption font-medium text-ink">{t('line')}</span>
            </div>
          </div>
        </div>

        {/* Brand & Meaning */}
        <div className="space-y-2">
          <span className="text-caption font-medium text-ink-muted">{t('brandAndMeaning')}</span>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-card">
              <div className="size-10 shrink-0 rounded-xl bg-accent" />
              <span className="text-caption font-medium text-ink">{t('accent')}</span>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-card">
              <div className="size-10 shrink-0 rounded-xl bg-income" />
              <span className="text-caption font-medium text-ink">{t('income')}</span>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-card">
              <div className="size-10 shrink-0 rounded-xl bg-expense" />
              <span className="text-caption font-medium text-ink">{t('expense')}</span>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-card">
              <div className="size-10 shrink-0 rounded-xl bg-transfer" />
              <span className="text-caption font-medium text-ink">{t('transfer')}</span>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-card">
              <div className="size-10 shrink-0 rounded-xl bg-warning" />
              <span className="text-caption font-medium text-ink">{t('warning')}</span>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-card">
              <div className="size-10 shrink-0 rounded-xl bg-danger" />
              <span className="text-caption font-medium text-ink">{t('danger')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Typography & Amounts */}
      <section className="mb-10 space-y-4">
        <h2 className="text-heading font-semibold text-ink">{t('typographyTitle')}</h2>
        
        <div className="space-y-4 rounded-card bg-surface p-5 shadow-card">
          <div className="border-b border-line pb-3">
            <span className="text-caption text-ink-muted">{t('heroLabel')}</span>
            <div className="text-hero font-bold tabular-nums text-ink">
              {money(5000, locale)}
            </div>
          </div>

          <div className="border-b border-line pb-3">
            <span className="text-caption text-ink-muted">{t('displayLabel')}</span>
            <div className="text-display font-semibold tabular-nums text-accent">
              {money(3250.5, locale)}
            </div>
          </div>

          <div className="border-b border-line pb-3">
            <span className="text-caption text-ink-muted">{t('titleLabel')}</span>
            <div className="text-title font-bold text-ink">
              {t('titleSample')}
            </div>
          </div>

          <div className="border-b border-line pb-3">
            <span className="text-caption text-ink-muted">{t('headingLabel')}</span>
            <div className="text-heading font-semibold text-ink">
              {t('headingSample')}
            </div>
          </div>

          <div className="border-b border-line pb-3">
            <span className="text-caption text-ink-muted">{t('bodyLabel')}</span>
            <div className="text-body text-ink">
              {t('bodySample')}
            </div>
          </div>

          <div>
            <span className="text-caption text-ink-muted">{t('captionLabel')}</span>
            <div className="text-caption text-ink-muted">
              {t('captionSample')}
            </div>
          </div>
        </div>
      </section>

      {/* Buttons */}
      <section className="mb-10 space-y-4">
        <h2 className="text-heading font-semibold text-ink">{t('buttonsTitle')}</h2>
        
        <div className="space-y-3">
          <Button className="w-full">
            <Plus />
            {t('primaryButton')}
          </Button>

          <Button variant="secondary" className="w-full">
            {t('secondaryButton')}
          </Button>

          <Button variant="outline" className="w-full">
            {t('outlineButton')}
          </Button>

          <Button variant="destructive" className="w-full">
            {t('destructiveButton')}
          </Button>

          <Button disabled className="w-full">
            {t('disabledButton')}
          </Button>

          <div className="flex items-center gap-3 pt-2">
            <Button size="sm">
              <Check />
              Small
            </Button>
            <Button size="icon">
              <Plus />
            </Button>
            <Button size="icon" variant="outline">
              <ChevronRight className="rtl:rotate-180" />
            </Button>
          </div>
        </div>
      </section>

      {/* Cards & Hero Card */}
      <section className="mb-10 space-y-4">
        <h2 className="text-heading font-semibold text-ink">{t('cardsTitle')}</h2>

        {/* Hero Card as specified in docs/DESIGN.md */}
        <Card className="bg-surface p-6 shadow-card">
          <span className="text-heading text-ink-muted">{t('heroCardLabel')}</span>
          <div className="text-hero font-bold tabular-nums text-expense">
            {money(4649, locale)}
          </div>
          <div className="mt-1 flex items-center gap-2 text-caption text-ink-muted">
            <span>{t('heroCardSub')}</span>
          </div>
        </Card>

        {/* Regular Card */}
        <Card>
          <CardHeader>
            <CardTitle>{t('headingSample')}</CardTitle>
            <CardDescription>{t('captionSample')}</CardDescription>
          </CardHeader>
          <CardContent>
            {t('bodySample')}
          </CardContent>
        </Card>
      </section>

      {/* Segmented Control & Tabs */}
      <section className="mb-10 space-y-4">
        <h2 className="text-heading font-semibold text-ink">{t('segmentedTitle')}</h2>
        
        <Tabs defaultValue="expense">
          <TabsList className="w-full">
            <TabsTrigger value="expense">{t('tabExpense')}</TabsTrigger>
            <TabsTrigger value="income">{t('tabIncome')}</TabsTrigger>
            <TabsTrigger value="transfer">{t('tabTransfer')}</TabsTrigger>
          </TabsList>
        </Tabs>
      </section>

      {/* Chips & Filter */}
      <section className="mb-10 space-y-4">
        <h2 className="text-heading font-semibold text-ink">{t('chipsTitle')}</h2>
        
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedFilter('all')}
            className={`inline-flex h-10 items-center justify-center rounded-full px-5 text-body font-medium transition-all ${
              selectedFilter === 'all'
                ? 'bg-accent text-accent-ink shadow-xs'
                : 'bg-surface-2 text-ink hover:bg-line/70'
            }`}
          >
            {t('chipAll')}
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('expenses')}
            className={`inline-flex h-10 items-center justify-center rounded-full px-5 text-body font-medium transition-all ${
              selectedFilter === 'expenses'
                ? 'bg-accent text-accent-ink shadow-xs'
                : 'bg-surface-2 text-ink hover:bg-line/70'
            }`}
          >
            {t('chipExpenses')}
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('income')}
            className={`inline-flex h-10 items-center justify-center rounded-full px-5 text-body font-medium transition-all ${
              selectedFilter === 'income'
                ? 'bg-accent text-accent-ink shadow-xs'
                : 'bg-surface-2 text-ink hover:bg-line/70'
            }`}
          >
            {t('chipIncome')}
          </button>
        </div>
      </section>

      {/* Inputs */}
      <section className="mb-10 space-y-4">
        <h2 className="text-heading font-semibold text-ink">Input</h2>
        <Input placeholder={t('headingSample')} />
      </section>

      {/* Entry Rows */}
      <section className="mb-10 space-y-4">
        <h2 className="text-heading font-semibold text-ink">{t('entryRowsTitle')}</h2>
        
        <div className="divide-y divide-line rounded-card bg-surface shadow-card">
          {/* Row 1: Expense */}
          <div className="flex items-center justify-between p-4 transition-colors hover:bg-surface-2/40">
            <div className="flex items-center gap-3.5">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-expense-soft text-expense">
                <ShoppingBag className="size-6" />
              </div>
              <div>
                <div className="text-heading font-medium text-ink">{t('sampleItem1')}</div>
                <div className="text-caption text-ink-muted">{t('sampleSub1')}</div>
              </div>
            </div>
            <div className="text-heading font-bold tabular-nums text-expense">
              -{money(120, locale)}
            </div>
          </div>

          {/* Row 2: Income */}
          <div className="flex items-center justify-between p-4 transition-colors hover:bg-surface-2/40">
            <div className="flex items-center gap-3.5">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-income-soft text-income">
                <ArrowDownLeft className="size-6" />
              </div>
              <div>
                <div className="text-heading font-medium text-ink">{t('sampleItem2')}</div>
                <div className="text-caption text-ink-muted">{t('sampleSub2')}</div>
              </div>
            </div>
            <div className="text-heading font-bold tabular-nums text-income">
              +{money(15000, locale)}
            </div>
          </div>
        </div>
      </section>

      {/* Empty State */}
      <section className="mb-10 space-y-4">
        <h2 className="text-heading font-semibold text-ink">{t('emptyStateTitle')}</h2>
        
        <div className="flex flex-col items-center justify-center rounded-card bg-surface p-8 text-center shadow-card">
          <div className="mb-4 flex size-20 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Sparkles className="size-10" />
          </div>
          <h3 className="text-heading font-bold text-ink">{t('emptyHeadline')}</h3>
          <p className="mt-1.5 max-w-xs text-body text-ink-muted">{t('emptyDescription')}</p>
          <Button className="mt-6 w-full max-w-xs">
            <Plus />
            {t('emptyAction')}
          </Button>
        </div>
      </section>

      {/* Skeletons */}
      <section className="mb-10 space-y-4">
        <h2 className="text-heading font-semibold text-ink">{t('skeletonsTitle')}</h2>
        
        <div className="space-y-3 rounded-card bg-surface p-5 shadow-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="size-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
            <Skeleton className="h-6 w-24" />
          </div>
          <Skeleton className="h-14 w-full" />
        </div>
      </section>

      {/* Interactive Sheet & Toast & Switch */}
      <section className="space-y-4">
        <h2 className="text-heading font-semibold text-ink">{t('interactiveTitle')}</h2>

        <div className="space-y-4 rounded-card bg-surface p-5 shadow-card">
          {/* Switch */}
          <div className="flex items-center justify-between">
            <Label htmlFor="styleguide-switch" className="cursor-pointer">
              {t('switchLabel')}
            </Label>
            <Switch
              id="styleguide-switch"
              checked={switchChecked}
              onCheckedChange={setSwitchChecked}
            />
          </div>

          {/* Toast Trigger */}
          <Button variant="secondary" className="w-full" onClick={handleTestToast}>
            {t('triggerToast')}
          </Button>

          {/* Drawer Trigger */}
          <Drawer>
            <DrawerTrigger asChild>
              <Button variant="outline" className="w-full">
                {t('openDrawer')}
              </Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>{t('drawerTitle')}</DrawerTitle>
                <DrawerDescription>{t('drawerDescription')}</DrawerDescription>
              </DrawerHeader>
              <div className="p-5">
                <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-4">
                  <Wallet className="size-6 text-accent" />
                  <span className="text-body font-medium">{money(1500, locale)}</span>
                </div>
              </div>
              <DrawerFooter>
                <DrawerClose asChild>
                  <Button>{t('close')}</Button>
                </DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        </div>
      </section>
    </main>
  );
}
