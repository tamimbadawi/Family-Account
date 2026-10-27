'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  Bookmark,
  ChevronDown,
  Check,
  Share2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Donut } from './Donut';
import { KindIcon, kindColorVar } from './KindIcon';
import { CertaintyTag } from './CertaintyTag';
import { useCountUp } from './useCountUp';
import { AmountInput } from './AmountInput';
import { SavedPlansDrawer } from './SavedPlansDrawer';
import { ProductDetailDrawer } from './ProductDetailDrawer';
import { AddInvestmentDrawer, type InitialInvestmentData } from '@/components/money/AddInvestmentDrawer';
import type { Fund, Offer } from '@/lib/market/types';
import {
  GOAL_HORIZONS,
  goalPlan,
  useLastAmount,
  useOwnFigures,
  type HowSure,
} from '@/lib/calc';
import type { Certainty } from '@/lib/calc/plan';
import { isFund } from '@/lib/calc/fund';
import {
  savePlan,
  getSavedPlans,
  subscribeSavedPlans,
  MAX_SAVED_PLANS,
  type SavedPlan,
} from '@/lib/calc/saved-plans';
import { money, wholeMoney } from '@/lib/format';
import { cn } from '@/lib/utils';

type GoalChoice = 'max' | '10' | '25' | '50' | '100' | 'pct' | 'amt';

const SURE: { id: HowSure; emoji: string }[] = [
  { id: 'safe', emoji: '🛡️' },
  { id: 'balanced', emoji: '⚖️' },
  { id: 'bold', emoji: '🚀' },
];

function chanceTone(c: number) {
  return c >= 0.8
    ? 'var(--income)'
    : c >= 0.5
      ? 'var(--accent)'
      : c >= 0.25
        ? 'var(--kind-gold)'
        : 'var(--expense)';
}

export function GoalTool({
  offers,
  funds,
  initialMode = 'want',
}: {
  offers: Offer[];
  funds: Fund[];
  initialMode?: 'have' | 'want';
}) {
  const t = useTranslations('goal');
  const locale = useLocale();
  const ar = locale.startsWith('ar');
  const params = useSearchParams();

  const [stored, setStored] = useLastAmount();
  const paramAmount = Number(params.get('amount'));
  const amount =
    Number.isFinite(paramAmount) && paramAmount > 0
      ? paramAmount
      : stored ?? 100000;

  const [choice, setChoice] = React.useState<GoalChoice>(() => {
    const g = params.get('goal');
    if (g === 'max') return 'max';
    if (['10', '25', '50', '100'].includes(g || '')) return g as GoalChoice;
    if (g && !Number.isNaN(Number(g))) return 'amt';
    if (params.get('mode') === 'have' || initialMode === 'have') return 'max';
    return '25';
  });

  const [customPct, setCustomPct] = React.useState(30);
  const [goalAmount, setGoalAmount] = React.useState(
    Number(params.get('goal')) || 25000
  );
  const [horizon, setHorizon] = React.useState<number>(
    Number(params.get('months')) || 12
  );
  const [sure, setSure] = React.useState<HowSure>(
    (params.get('sure') as HowSure) || 'balanced'
  );

  // Saved plans state
  const [isSavedDrawerOpen, setIsSavedDrawerOpen] = React.useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = React.useState(false);
  const [planTitle, setPlanTitle] = React.useState('');
  const savedPlans = React.useSyncExternalStore(subscribeSavedPlans, getSavedPlans, () => []);
  const savedCount = savedPlans.length;

  // Product detail & add investment state
  const [selectedProduct, setSelectedProduct] = React.useState<{
    product: Offer | Fund;
    amount: number;
    expectedGain: number;
    certainty: Certainty;
  } | null>(null);
  const [isAddInvestmentOpen, setIsAddInvestmentOpen] = React.useState(false);
  const [addInvestmentData, setAddInvestmentData] = React.useState<InitialInvestmentData | null>(null);

  const want = choice !== 'max';
  const { figures } = useOwnFigures();

  const goal =
    choice === 'max'
      ? 1
      : choice === 'amt'
        ? goalAmount
        : (amount * (choice === 'pct' ? customPct : Number(choice))) / 100;

  const all = React.useMemo(() => [...offers, ...funds], [offers, funds]);

  const plan = React.useMemo(
    () =>
      goalPlan(all, {
        amount,
        goal,
        horizonMonths: horizon,
        howSure: sure,
        ownPercents: figures,
        maximize: want ? 'chance' : 'gain',
      }),
    [all, amount, goal, horizon, sure, figures, want]
  );

  const mix = plan.mix;
  const chance = mix?.chance ?? 0;
  const shownChance = useCountUp(Math.round(chance * 100));
  const shownGain = useCountUp(mix?.expectedGain ?? 0);

  const time = (m: number) =>
    m % 12 === 0 ? t('years', { n: m / 12 }) : t('months', { n: m });

  const mood = !mix
    ? 'none'
    : chance >= 0.9
      ? 'great'
      : chance >= 0.6
        ? 'good'
        : chance >= 0.3
          ? 'stretch'
          : 'bigAsk';

  const better = plan.chanceByHorizon.find(
    (c) => c.months > horizon && c.chance >= Math.max(0.5, chance + 0.15)
  );

  const name = (p: Offer | Fund) =>
    isFund(p)
      ? ar
        ? p.fundAr
        : p.fundEn
      : ar
        ? (p as Offer).nameAr
        : (p as Offer).nameEn;

  const who = (p: Offer | Fund) =>
    isFund(p)
      ? ar
        ? p.managerAr
        : p.managerEn
      : ar
        ? (p as Offer).bankAr
        : (p as Offer).bankEn;

  // Handle plan loading from saved list
  const handleLoadPlan = (saved: SavedPlan) => {
    setStored(saved.amount);
    setChoice(saved.choice);
    if (saved.customPct) setCustomPct(saved.customPct);
    if (saved.goalAmount) setGoalAmount(saved.goalAmount);
    setHorizon(saved.horizon);
    setSure(saved.sure);
    toast.success(t('planLoaded'));
  };

  // Open save modal
  const handleOpenSave = () => {
    if (savedCount >= MAX_SAVED_PLANS) {
      toast.error(t('maxPlansReached', { max: MAX_SAVED_PLANS }));
      setIsSavedDrawerOpen(true);
      return;
    }
    const defaultName = `${wholeMoney(amount, 'EGP', locale)} · ${time(horizon)}`;
    setPlanTitle(defaultName);
    setIsSaveModalOpen(true);
  };

  // Commit save plan
  const handleConfirmSave = () => {
    if (!mix) return;
    const res = savePlan({
      name: planTitle.trim() || `${wholeMoney(amount, 'EGP', locale)} · ${time(horizon)}`,
      amount,
      choice,
      customPct: choice === 'pct' ? customPct : undefined,
      goalAmount: choice === 'amt' ? goalAmount : undefined,
      horizon,
      sure,
      expectedGain: mix.expectedGain,
      chance: mix.chance,
      lines: mix.lines.map((l) => ({
        id: l.product.id,
        nameEn: isFund(l.product) ? l.product.fundEn : l.product.nameEn,
        nameAr: isFund(l.product) ? l.product.fundAr : l.product.nameAr,
        amount: l.amount,
        share: l.share,
        kind: isFund(l.product) ? l.product.fundType : l.product.type,
      })),
    });

    if (res.ok) {
      setIsSaveModalOpen(false);
      toast.success(t('planSavedSuccess'));
    } else {
      toast.error(t('maxPlansReached', { max: MAX_SAVED_PLANS }));
    }
  };

  // Share with a friend or advisor
  const handleShare = async () => {
    if (!mix) return;

    const shareUrl = `${window.location.origin}${window.location.pathname}?amount=${amount}&goal=${choice === 'amt' ? goalAmount : choice}&months=${horizon}&sure=${sure}`;

    const linesList = mix.lines
      .map(
        (l) =>
          `• ${wholeMoney(l.amount, 'EGP', locale)}: ${name(l.product)} (${who(l.product)})`
      )
      .join('\n');

    const shareTitle = ar
      ? 'خطة استثمار مقترحة - حساباتنا'
      : 'Proposed Investment Plan - Family Accounts';

    const shareText = ar
      ? `📊 *خطة استثمار مقترحة للرأي والمشورة*\n\n` +
        `💰 المبلغ: ${wholeMoney(amount, 'EGP', locale)}\n` +
        `⏱️ المدة: ${time(horizon)}\n` +
        `📈 العائد المتوقع: +${wholeMoney(mix.expectedGain, 'EGP', locale)} (احتمالية: ${Math.round(chance * 100)}%)\n` +
        `⚖️ مستوى الأمان: ${t(`sure.${sure}`)}\n\n` +
        `📋 *التوزيع المقترح:*\n${linesList}\n\n` +
        `ما رأيك في هذه الخطة؟\n`
      : `📊 *Proposed Investment Plan (For Advice)*\n\n` +
        `💰 Amount: ${wholeMoney(amount, 'EGP', locale)}\n` +
        `⏱️ Duration: ${time(horizon)}\n` +
        `📈 Expected Gain: +${wholeMoney(mix.expectedGain, 'EGP', locale)} (Chance: ${Math.round(chance * 100)}%)\n` +
        `⚖️ Risk: ${t(`sure.${sure}`)}\n\n` +
        `📋 *Recommended Mix:*\n${linesList}\n\n` +
        `What do you think of this plan?\n`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: `${shareText}\n${shareUrl}`,
          url: shareUrl,
        });
        return;
      } catch {
        // Fall through to clipboard if user cancelled
      }
    }

    // Fallback: Copy to clipboard
    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      toast.success(t('planCopied'));
    } catch {
      toast.error(t('copyFailed'));
    }
  };

  return (
    <div className="flex flex-col gap-3 py-1 select-none">
      {/* Top Header bar with Saved Plans count */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-title font-bold text-ink">{t('helloOne')}</h2>
        <button
          type="button"
          onClick={() => setIsSavedDrawerOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-2 text-caption font-semibold text-ink hover:bg-surface-2/80 transition-colors cursor-pointer"
        >
          <Bookmark className="size-4 text-accent" />
          <span>{t('savedPlansBtn', { count: savedCount })}</span>
        </button>
      </div>

      {/* The questions. "I have" and "I want" are the hero: big, tinted, first. */}
      <Card className="flex flex-col gap-3 !p-3.5 border-0 shadow-card">
        <div data-goal-hero className="flex flex-col gap-2 rounded-card bg-accent-soft p-2">
          <AmountInput
            label={t('have')}
            value={amount}
            onChange={(v) => setStored(v || null)}
            className="border-0"
          />

          <label className="relative flex flex-col rounded-card bg-surface px-4 py-3 shadow-card focus-within:ring-2 focus-within:ring-accent">
            <span className="text-caption font-semibold text-ink-muted">{t('want')}</span>
            <select
              value={choice}
              onChange={(e) => setChoice(e.target.value as GoalChoice)}
              aria-label={t('want')}
              className="w-full appearance-none bg-transparent pe-7 text-title font-bold text-ink tabular-nums tracking-tight cursor-pointer focus:outline-none"
            >
              <option value="max">{t('maxOption')}</option>
              {['10', '25', '50', '100'].map((p) => (
                <option key={p} value={p}>
                  {`${String.fromCharCode(0x200e)}+${p}%`}
                </option>
              ))}
              <option value="pct">{t('customPct')}</option>
              <option value="amt">{t('customAmount')}</option>
            </select>
            <ChevronDown
              className="pointer-events-none absolute end-4 top-1/2 size-5 -translate-y-1/2 text-ink-muted"
              aria-hidden
            />
          </label>

          {choice === 'pct' && (
            <label className="flex items-center min-h-12 px-4 rounded-card bg-surface">
              <span className="text-body text-ink-muted shrink-0 me-2">{t('customPct')}</span>
              <input
                data-goal-input
                inputMode="decimal"
                dir="ltr"
                lang="en"
                value={customPct ? String(customPct) : ''}
                onChange={(e) =>
                  setCustomPct(Number(e.target.value.replace(/[^\d.]/g, '')) || 0)
                }
                placeholder="30"
                aria-label={t('customPct')}
                className="w-full min-w-0 bg-transparent text-body font-bold tabular-nums text-ink text-end focus:outline-none"
              />
              <span className="text-body text-ink-muted ms-1">%</span>
            </label>
          )}

          {choice === 'amt' && (
            <label className="flex items-center min-h-12 px-4 rounded-card bg-surface">
              <span className="text-body text-ink-muted shrink-0 me-2">
                {t('customAmount')}
              </span>
              <input
                data-goal-input
                inputMode="numeric"
                dir="ltr"
                lang="en"
                value={goalAmount ? goalAmount.toLocaleString('en-US') : ''}
                onChange={(e) =>
                  setGoalAmount(Number(e.target.value.replace(/[^\d]/g, '')) || 0)
                }
                placeholder="25,000"
                aria-label={t('customAmount')}
                className="w-full min-w-0 bg-transparent text-body font-bold tabular-nums text-ink text-end focus:outline-none"
              />
              <span className="text-caption text-ink-muted ms-1">{t('egp')}</span>
            </label>
          )}

          {want && (
            <p className="px-2 text-caption font-semibold text-accent tabular-nums">
              {t('goalIs', { amount: money(Math.round(goal), locale, { currency: 'EGP' }) })}
            </p>
          )}
        </div>

        <label className="flex items-center gap-2">
          <span className="text-body font-semibold text-ink shrink-0">{t('within')}</span>
          <select
            value={horizon}
            onChange={(e) => setHorizon(Number(e.target.value))}
            aria-label={t('within')}
            className="min-h-12 flex-1 min-w-0 px-3 rounded-2xl bg-surface-2 text-body font-bold text-ink cursor-pointer focus:outline-none"
          >
            {GOAL_HORIZONS.map((h) => (
              <option key={h} value={h}>
                {time(h)}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-body font-semibold text-ink">{t('howSure')}</span>
          <div role="radiogroup" aria-label={t('howSure')} className="grid grid-cols-3 gap-2">
            {SURE.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={sure === s.id}
                onClick={() => setSure(s.id)}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 rounded-2xl py-2 min-h-16 transition-transform active:scale-95 cursor-pointer',
                  sure === s.id
                    ? 'bg-accent text-accent-ink shadow-card'
                    : 'bg-surface-2 text-ink hover:bg-surface-2/80'
                )}
              >
                <span className="text-title leading-none" aria-hidden>
                  {s.emoji}
                </span>
                <span className="text-caption font-semibold">{t(`sure.${s.id}`)}</span>
              </button>
            ))}
          </div>
          <p className="text-caption text-ink-muted">{t(`sureHint.${sure}`)}</p>
        </div>
      </Card>

      {/* The answer */}
      <Card data-goal-result className="flex flex-col gap-3 !p-3.5 border-0 shadow-card">
        {!mix ? (
          <p className="text-body text-ink">{t('noMix')}</p>
        ) : (
          <>
            <div className="flex items-center gap-4">
              {want && (
                <Donut
                  slices={[{ value: chance, color: chanceTone(chance) }]}
                  size={116}
                  label={t('chanceLabel', { n: Math.round(chance * 100) })}
                >
                  <span
                    data-chance
                    className="text-heading font-bold tabular-nums leading-none"
                    style={{ color: chanceTone(chance) }}
                  >
                    {Math.round(shownChance)}%
                  </span>
                  <span className="text-caption text-ink-muted leading-tight">
                    {t('chance')}
                  </span>
                </Donut>
              )}
              <div className="flex flex-col min-w-0">
                <span className="text-heading font-bold text-ink">
                  {want ? t(`mood.${mood}`) : t('haveMood')}
                </span>
                <span className="text-caption text-ink-muted">
                  {t('expected', { time: time(horizon) })}
                </span>
                <span className="text-title font-bold tabular-nums text-income leading-tight">
                  <bdi dir="ltr">+{wholeMoney(shownGain, 'EGP', locale)}</bdi>
                </span>
                {mix.high - mix.low > 1 && (
                  <span className="text-caption text-ink-muted tabular-nums">
                    {t('range', {
                      low: wholeMoney(Math.max(mix.low, -amount), 'EGP', locale),
                      high: wholeMoney(mix.high, 'EGP', locale),
                    })}
                  </span>
                )}
              </div>
            </div>

            {want && better && (
              <button
                type="button"
                onClick={() => setHorizon(better.months)}
                className="flex items-center justify-between gap-2 rounded-2xl bg-accent-soft px-3 min-h-12 text-start text-body font-semibold text-accent cursor-pointer active:scale-[0.99] transition-transform"
              >
                <span>
                  {t('better', {
                    time: time(better.months),
                    n: Math.round(better.chance * 100),
                  })}
                </span>
                <ArrowRight className="size-5 shrink-0 rtl:rotate-180" />
              </button>
            )}

            {/* Actions: Save Plan & Share with Friend/Advisor */}
            <div className="flex items-center gap-2 pt-2 border-t border-line/40">
              <Button
                type="button"
                variant="outline"
                onClick={handleOpenSave}
                className="flex-1 h-12 rounded-xl text-body font-semibold gap-1.5 cursor-pointer"
              >
                <Bookmark className="size-4 text-accent" />
                <span>{t('savePlanBtn')}</span>
              </Button>

              <Button
                type="button"
                onClick={handleShare}
                className="flex-1 h-12 rounded-xl text-body font-semibold gap-1.5 cursor-pointer bg-accent text-accent-ink"
              >
                <Share2 className="size-4" />
                <span>{t('shareWithExpertBtn')}</span>
              </Button>
            </div>
          </>
        )}
      </Card>

      {/* The Recommended Mix Breakdown */}
      {mix && (
        <Card data-goal-mix className="flex flex-col gap-3 !p-3.5 border-0 shadow-card">
          <div className="flex items-center gap-4">
            <Donut
              size={88}
              label={t('mixTitle')}
              slices={mix.lines.map((l) => ({
                value: l.share,
                color: kindColorVar(l.product),
              }))}
            >
              <span className="text-heading font-bold text-ink tabular-nums">
                {mix.lines.length}
              </span>
            </Donut>
            <div className="flex flex-col">
              <h2 className="text-heading font-bold text-ink">{t('mixTitle')}</h2>
              <p className="text-caption font-semibold text-accent">
                {t('products', { count: mix.lines.length })}
              </p>
              <p className="text-caption text-ink-muted">{t('mixText')}</p>
            </div>
          </div>

          <p className="text-caption text-ink-muted -mt-1">{t('tapForDetails')}</p>

          <ul className="flex flex-col divide-y divide-line/50">
            {mix.lines.map((l) => (
              <li
                key={l.product.id}
                onClick={() => setSelectedProduct(l)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedProduct(l);
                  }
                }}
                className="flex items-start gap-3 py-3 cursor-pointer rounded-xl -mx-2 px-2 hover:bg-surface-2 active:bg-surface-2 transition-colors select-none"
              >
                <KindIcon product={l.product} />
                <span className="flex flex-col min-w-0 flex-1 gap-1">
                  <span className="text-body font-semibold text-ink leading-tight">
                    {name(l.product)}
                  </span>
                  <span className="text-caption text-ink-muted leading-tight">
                    {who(l.product)}
                  </span>
                  <span className="flex items-center gap-2 pt-0.5">
                    <CertaintyTag c={l.certainty} />
                    <span className="text-caption font-semibold text-ink-muted tabular-nums">
                      {Math.round(l.share * 100)}%
                    </span>
                  </span>
                </span>
                <span className="flex flex-col items-end shrink-0">
                  <span className="text-body font-bold tabular-nums text-ink">
                    {wholeMoney(l.amount, 'EGP', locale)}
                  </span>
                  <span className="text-caption text-income font-semibold tabular-nums">
                    +{wholeMoney(l.expectedGain, 'EGP', locale)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Product Detail Drawer */}
      <ProductDetailDrawer
        open={!!selectedProduct}
        onOpenChange={(open) => !open && setSelectedProduct(null)}
        item={selectedProduct}
        onAddToInvestments={(data) => {
          setAddInvestmentData(data);
          setIsAddInvestmentOpen(true);
        }}
      />

      {/* Add Investment Drawer */}
      <AddInvestmentDrawer
        open={isAddInvestmentOpen}
        onOpenChange={setIsAddInvestmentOpen}
        initialData={addInvestmentData}
      />

      {/* Save Plan Dialog / Drawer */}
      <Drawer open={isSaveModalOpen} onOpenChange={setIsSaveModalOpen}>
        <DrawerContent className="max-w-md mx-auto p-4 select-none">
          <DrawerHeader className="p-0 mb-3 text-start">
            <DrawerTitle className="text-title font-bold text-ink">
              {t('savePlanModalTitle')}
            </DrawerTitle>
            <p className="text-caption text-ink-muted">
              {t('savePlanModalDesc', { count: savedCount + 1, max: MAX_SAVED_PLANS })}
            </p>
          </DrawerHeader>

          <div className="space-y-3 py-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-caption font-semibold text-ink-muted">
                {t('planNameLabel')}
              </span>
              <Input
                value={planTitle}
                onChange={(e) => setPlanTitle(e.target.value)}
                placeholder={t('planNamePlaceholder')}
                className="h-12 text-body"
              />
            </label>

            <div className="rounded-xl bg-surface-2 p-3 text-caption text-ink space-y-1">
              <div className="flex justify-between">
                <span className="text-ink-muted">{t('amountPlaced')}:</span>
                <span className="font-bold tabular-nums">
                  {wholeMoney(amount, 'EGP', locale)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">{t('duration')}:</span>
                <span className="font-bold">{time(horizon)}</span>
              </div>
              {mix && (
                <div className="flex justify-between">
                  <span className="text-ink-muted">{t('expectedGainLabel')}:</span>
                  <span className="font-bold text-income tabular-nums">
                    +{wholeMoney(mix.expectedGain, 'EGP', locale)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <DrawerFooter className="p-0 pt-3 flex flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsSaveModalOpen(false)}
              className="flex-1 h-12"
            >
              {t('cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleConfirmSave}
              className="flex-1 h-12 bg-accent text-accent-ink font-bold"
            >
              <Check className="size-4 me-1.5" />
              {t('save')}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Saved Plans List Drawer */}
      <SavedPlansDrawer
        open={isSavedDrawerOpen}
        onOpenChange={setIsSavedDrawerOpen}
        onSelectPlan={handleLoadPlan}
      />
    </div>
  );
}
