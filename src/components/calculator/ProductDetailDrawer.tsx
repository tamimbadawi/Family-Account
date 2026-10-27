'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ExternalLink, PlusCircle, ShieldCheck } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { KindIcon } from './KindIcon';
import { CertaintyTag } from './CertaintyTag';
import { isFund } from '@/lib/calc/fund';
import { wholeMoney } from '@/lib/format';
import type { Fund, Offer } from '@/lib/market/types';
import type { Certainty } from '@/lib/calc/plan';
import type { InitialInvestmentData } from '@/components/money/AddInvestmentDrawer';

interface ProductDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: {
    product: Offer | Fund;
    amount: number;
    expectedGain: number;
    certainty: Certainty;
  } | null;
  onAddToInvestments?: (data: InitialInvestmentData) => void;
}

export function ProductDetailDrawer({
  open,
  onOpenChange,
  item,
  onAddToInvestments,
}: ProductDetailDrawerProps) {
  const t = useTranslations('goal');
  const locale = useLocale();
  const ar = locale.startsWith('ar');

  if (!item) return null;
  const { product, amount, expectedGain, certainty } = item;

  const fund = isFund(product);
  const name = fund
    ? ar
      ? product.fundAr
      : product.fundEn
    : ar
      ? (product as Offer).nameAr
      : (product as Offer).nameEn;

  const institution = fund
    ? ar
      ? product.managerAr
      : product.managerEn
    : ar
      ? (product as Offer).bankAr
      : (product as Offer).bankEn;

  const handleAdd = () => {
    onOpenChange(false);
    if (!onAddToInvestments) return;

    let investmentKind: InitialInvestmentData['kind'] = 'other';
    if (!fund) {
      investmentKind = 'certificate';
    } else {
      if (product.fundType === 'gold') investmentKind = 'gold';
      else if (product.fundType === 'equity') investmentKind = 'stocks';
      else investmentKind = 'other';
    }

    onAddToInvestments({
      kind: investmentKind,
      name,
      amount,
    });
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-w-md mx-auto p-4 select-none max-h-[90vh] overflow-y-auto">
        <DrawerHeader className="p-0 mb-4 text-start">
          <div className="flex items-start gap-3">
            <KindIcon product={product} size="lg" />
            <div className="flex-1 min-w-0">
              <DrawerTitle className="text-title font-bold text-ink leading-snug">
                {name}
              </DrawerTitle>
              <p className="text-caption font-semibold text-ink-muted mt-0.5">
                {institution}
              </p>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <CertaintyTag c={certainty} />
                {fund && product.grade && (
                  <span className="text-caption font-bold px-2 py-0.5 rounded-full bg-accent-soft text-accent">
                    {t('lineGrade')}: {product.grade}
                  </span>
                )}
                {fund && product.sharia && (
                  <span className="inline-flex items-center gap-1 text-caption font-semibold px-2 py-0.5 rounded-full bg-income-soft text-income">
                    <ShieldCheck className="size-3" />
                    <span>{t('shariaCompliant')}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </DrawerHeader>

        {/* Planned Allocation Card */}
        <div className="rounded-2xl bg-surface-2 p-3.5 mb-3 flex items-center justify-between border border-line/30">
          <div>
            <p className="text-caption text-ink-muted">{t('linePut')}</p>
            <p className="text-title font-bold text-ink tabular-nums">
              {wholeMoney(amount, 'EGP', locale)}
            </p>
          </div>
          <div className="text-end">
            <p className="text-caption text-ink-muted">{t('expectedGainLabel')}</p>
            <p className="text-title font-bold text-income tabular-nums">
              +{wholeMoney(expectedGain, 'EGP', locale)}
            </p>
          </div>
        </div>

        {/* Fact Sheet Grid */}
        <div className="rounded-2xl bg-surface-2 p-3.5 space-y-2.5 text-body text-ink border border-line/30 mb-4">
          {/* Rate / Yield */}
          <div className="flex items-center justify-between py-1 border-b border-line/20">
            <span className="text-caption text-ink-muted">{t('rateOrReturn')}</span>
            <span className="font-bold tabular-nums">
              {!fund ? (
                `${(product as Offer).ratePercent}% ${(product as Offer).rateKind ? `(${(product as Offer).rateKind})` : ''}`
              ) : product.estimate?.estimatePercent ? (
                `~${product.estimate.estimatePercent}% / y`
              ) : product.changeYtdPercent !== null ? (
                `${product.changeYtdPercent > 0 ? '+' : ''}${product.changeYtdPercent}% (YTD)`
              ) : (
                '-'
              )}
            </span>
          </div>

          {/* Duration / Term */}
          <div className="flex items-center justify-between py-1 border-b border-line/20">
            <span className="text-caption text-ink-muted">{t('term')}</span>
            <span className="font-semibold">
              {!fund
                ? (product as Offer).termMonths
                  ? `${(product as Offer).termMonths} ${t('months', { n: (product as Offer).termMonths ?? 0 })}`
                  : (product as Offer).termDays
                    ? `${(product as Offer).termDays}d`
                    : '-'
                : t('dailyLiquidity')}
            </span>
          </div>

          {/* Payout */}
          <div className="flex items-center justify-between py-1 border-b border-line/20">
            <span className="text-caption text-ink-muted">{t('payout')}</span>
            <span className="font-semibold">
              {!fund
                ? (product as Offer).payout ?? t('atMaturity')
                : t('capitalGrowth')}
            </span>
          </div>

          {/* Min Investment */}
          <div className="flex items-center justify-between py-1 border-b border-line/20">
            <span className="text-caption text-ink-muted">{t('minAmount')}</span>
            <span className="font-bold tabular-nums">
              {!fund
                ? (product as Offer).minAmount
                  ? wholeMoney((product as Offer).minAmount!, 'EGP', locale)
                  : '-'
                : product.price
                  ? wholeMoney(product.price, 'EGP', locale)
                  : '-'}
            </span>
          </div>

          {/* Official Link if available */}
          {product.sourceUrl && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-caption text-ink-muted">{t('officialSource')}</span>
              <a
                href={product.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-caption font-semibold text-accent hover:underline"
              >
                <span>{institution}</span>
                <ExternalLink className="size-3" />
              </a>
            </div>
          )}
        </div>

        {/* Actions */}
        <DrawerFooter className="p-0 flex flex-col gap-2">
          {onAddToInvestments && (
            <Button
              type="button"
              onClick={handleAdd}
              className="w-full h-12 bg-accent text-accent-ink font-bold rounded-xl gap-2 cursor-pointer"
            >
              <PlusCircle className="size-4" />
              <span>{t('addToInvestments')}</span>
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full h-12 rounded-xl"
          >
            {t('done')}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
