'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronLeft, Info, RefreshCw } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { AmountDisplay } from '@/components/entry/AmountDisplay';
import { AmountPad } from '@/components/entry/AmountPad';
import { formatGoalTargetDate } from '@/lib/goals/progress';
import { previewValue } from '@/lib/format/expression';
import { money, pickName, quantity } from '@/lib/format';
import {
  investmentIdeas,
  type Idea,
  type IdeaGoal,
  type IdeaLength,
  type IdeaNote,
} from '@/lib/offers/ideas';
import type { Offer } from '@/lib/offers/types';

const FIRST_SHOWN = 5;
const LENGTHS: IdeaLength[] = ['any', 'upTo1y', 'upTo3y'];
const PAYOUTS = ['daily', 'monthly', 'quarterly', 'semiannual', 'yearly', 'maturity'];
const NOTE_KEYS: Partial<Record<IdeaNote, string>> = {
  variable: 'noteVariable',
  firstYearOnly: 'noteFirstYearOnly',
  stale: 'noteStale',
};

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; offers: Offer[] };

function useOffers() {
  const [state, setState] = React.useState<LoadState>({ status: 'loading' });

  const load = React.useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const res = await fetch('/api/offers');
      const body = (await res.json()) as { ok: boolean; offers: Offer[] };
      setState(res.ok && body.ok ? { status: 'ready', offers: body.offers } : { status: 'error' });
    } catch {
      setState({ status: 'error' });
    }
  }, []);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching once on open
    void load();
  }, [load]);

  return { state, reload: load };
}

export default function InvestmentIdeasPage() {
  const locale = useLocale();
  const t = useTranslations('money.ideas');
  const tMoney = useTranslations('money');
  const { state, reload } = useOffers();

  const [amount, setAmount] = React.useState(0);
  const [amountStr, setAmountStr] = React.useState('');
  const [isAmountOpen, setIsAmountOpen] = React.useState(false);
  const [goal, setGoal] = React.useState<IdeaGoal>('monthly');
  const [length, setLength] = React.useState<IdeaLength>('any');
  const [showAll, setShowAll] = React.useState(false);

  const result = React.useMemo(
    () =>
      state.status === 'ready'
        ? investmentIdeas(state.offers, amount, goal, length)
        : { ideas: [], needMore: 0, latestDate: null },
    [state, amount, goal, length],
  );

  const typedAmount = previewValue(amountStr) ?? 0;

  const openAmount = () => {
    setAmountStr(amount > 0 ? String(amount) : '');
    setIsAmountOpen(true);
  };

  const confirmAmount = () => {
    setAmount(Math.round(typedAmount * 100) / 100);
    setShowAll(false);
    setIsAmountOpen(false);
  };

  const shown = showAll ? result.ideas : result.ideas.slice(0, FIRST_SHOWN);
  const checkedOn = result.latestDate ? formatGoalTargetDate(result.latestDate, locale) : null;

  const termLabel = (idea: Idea) => {
    const days = idea.offer.type === 'tbill' ? Math.round((idea.termMonths * 365) / 12) : null;
    if (days != null) return t('termDays', { n: days });
    const months = idea.termMonths;
    return months >= 12 && months % 12 === 0
      ? t('termYears', { n: months / 12 })
      : t('termMonths', { n: quantity(months, locale) });
  };

  const payoutLabel = (payout: string | null) => {
    const p = (payout ?? '').trim().toLowerCase();
    return PAYOUTS.includes(p) ? t(`payout.${p}`) : null;
  };

  const renderIdea = (idea: Idea, index: number) => {
    const { offer } = idea;
    const bank = pickName({ name_ar: offer.bankAr, name_en: offer.bankEn }, locale);
    const product = pickName({ name_ar: offer.nameAr, name_en: offer.nameEn }, locale);
    const rate = `${quantity(offer.ratePercent, locale)}%`;
    const details = [
      offer.rateKind === 'stepped' ? t('rateYearOne', { rate }) : rate,
      termLabel(idea),
      payoutLabel(offer.payout),
    ]
      .filter(Boolean)
      .join(' · ');
    const notes = idea.notes.map((n) => NOTE_KEYS[n]).filter((k): k is string => Boolean(k));
    const coversWholeTerm = !idea.notes.includes('firstYearOnly');

    return (
      <div key={offer.id} className="flex w-full items-start gap-3 px-3.5 py-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-caption font-bold tabular-nums text-accent">
          {index + 1}
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="text-body font-semibold text-ink leading-tight">{bank}</div>
          <div className="text-caption text-ink-muted leading-tight">{product}</div>
          <div className="text-caption text-ink-muted tabular-nums leading-tight">{details}</div>
          <div className="flex flex-wrap items-baseline gap-x-2 pt-1">
            <span className="text-body font-bold tabular-nums text-income">
              {t(goal === 'monthly' ? 'perMonth' : 'perYear', {
                amount: money(Math.round(goal === 'monthly' ? idea.perMonth : idea.perYear), locale, {
                  currency: 'EGP',
                }),
              })}
            </span>
            {goal === 'grow' && coversWholeTerm && (
              <span className="text-caption text-ink-muted tabular-nums">
                {t('backAtEnd', {
                  amount: money(Math.round(idea.result.endAmount), locale, { currency: 'EGP' }),
                })}
              </span>
            )}
          </div>
          {notes.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {notes.map((k) => (
                <span
                  key={k}
                  className="rounded-full bg-surface-2 px-2 py-0.5 text-caption text-ink-muted"
                >
                  {t(k)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden select-none">
      {/* Header */}
      <div className="px-5 pt-[max(env(safe-area-inset-top,0px),1rem)] pb-3 shrink-0 flex items-center gap-2 border-b border-line/30">
        <Link
          href="/money?tab=saving"
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-accent hover:bg-surface-2 transition-colors -ms-2 cursor-pointer"
          aria-label={tMoney('back')}
        >
          <ChevronLeft className="size-6 rtl:rotate-180" />
        </Link>
        <h1 className="text-title font-bold text-ink leading-tight truncate">{t('title')}</h1>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-6 pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden space-y-4">
        {/* Disclaimer: always on screen, above everything else */}
        <div
          role="note"
          className="flex gap-3 rounded-2xl border border-warning/40 bg-surface px-4 py-3"
        >
          <Info className="size-5 shrink-0 text-warning mt-0.5" />
          <p className="text-caption text-ink leading-relaxed">
            {t('disclaimer')}
            {checkedOn && <> {t('ratesFrom', { date: checkedOn })}</>}
          </p>
        </div>

        {/* Amount */}
        <button
          type="button"
          onClick={openAmount}
          className="w-full rounded-card bg-surface px-4 py-3 shadow-card border border-line/60 text-center cursor-pointer active:scale-[0.99] transition-transform"
        >
          <span className="block text-caption text-ink-muted">{t('amountLabel')}</span>
          <span className="block text-display font-bold tabular-nums text-ink leading-tight">
            {amount > 0 ? money(amount, locale, { currency: 'EGP' }) : t('tapToEnter')}
          </span>
        </button>

        {/* Goal */}
        <div
          role="tablist"
          aria-label={t('goalLabel')}
          className="inline-flex h-14 w-full items-center rounded-2xl bg-surface-2 p-1"
        >
          {(['monthly', 'grow'] as const).map((g) => (
            <button
              key={g}
              type="button"
              role="tab"
              aria-selected={goal === g}
              onClick={() => {
                setGoal(g);
                setShowAll(false);
              }}
              className={`flex h-12 flex-1 items-center justify-center rounded-xl text-body font-semibold transition-all cursor-pointer ${
                goal === g ? 'bg-surface shadow-card text-ink' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {t(g === 'monthly' ? 'goalMonthly' : 'goalGrow')}
            </button>
          ))}
        </div>

        {/* Length */}
        <div className="space-y-1.5">
          <span className="text-caption font-semibold text-ink-muted px-1">{t('lengthLabel')}</span>
          <div className="flex gap-2">
            {LENGTHS.map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={length === l}
                onClick={() => {
                  setLength(l);
                  setShowAll(false);
                }}
                className={`flex min-h-12 flex-1 items-center justify-center rounded-2xl px-2 text-body font-semibold transition-transform active:scale-95 cursor-pointer ${
                  length === l ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-ink'
                }`}
              >
                {t(`length.${l}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        {state.status === 'loading' ? (
          <div className="space-y-2">
            <Skeleton className="h-20 rounded-card" />
            <Skeleton className="h-20 rounded-card" />
            <Skeleton className="h-20 rounded-card" />
          </div>
        ) : state.status === 'error' ? (
          <div className="rounded-card bg-surface p-4 shadow-card text-center space-y-3 border border-line/60">
            <p className="text-body text-ink-muted">{t('loadError')}</p>
            <Button variant="secondary" onClick={() => void reload()} className="h-12 text-body font-semibold">
              <RefreshCw className="size-4" />
              {t('tryAgain')}
            </Button>
          </div>
        ) : amount <= 0 ? (
          <div className="rounded-card bg-surface p-4 shadow-card text-center border border-line/60">
            <p className="text-body text-ink-muted">{t('enterAmountFirst')}</p>
          </div>
        ) : result.ideas.length === 0 ? (
          <div className="rounded-card bg-surface p-4 shadow-card text-center border border-line/60">
            <p className="text-body text-ink-muted">{t('noIdeas')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <h2 className="text-body font-semibold text-ink px-1">
              {t(goal === 'monthly' ? 'headingMonthly' : 'headingGrow')}
            </h2>
            <Card className="rounded-card bg-surface shadow-card border border-line/60 divide-y divide-line/30 p-0 overflow-hidden">
              {shown.map(renderIdea)}
            </Card>
            {result.ideas.length > FIRST_SHOWN && (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="w-full min-h-12 text-body font-semibold text-accent cursor-pointer"
              >
                {showAll ? t('showFewer') : t('showAll', { n: result.ideas.length })}
              </button>
            )}
          </div>
        )}

        {state.status === 'ready' && amount > 0 && result.needMore > 0 && (
          <p className="text-caption text-ink-muted text-center px-2">
            {t('needMore', { n: result.needMore })}
          </p>
        )}
      </div>

      <Drawer open={isAmountOpen} onOpenChange={setIsAmountOpen}>
        <DrawerContent className="max-h-[92dvh]">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(env(safe-area-inset-bottom,0px),1.5rem)] space-y-3">
            <DrawerHeader className="px-0 pt-4 pb-2">
              <DrawerTitle className="text-title font-bold text-ink text-start">
                {t('amountQuestion')}
              </DrawerTitle>
            </DrawerHeader>
            <AmountDisplay value={amountStr} type="transfer" currency="EGP" />
            <AmountPad value={amountStr} onChange={setAmountStr} />
            <Button
              type="button"
              onClick={confirmAmount}
              disabled={!(typedAmount > 0)}
              className="h-14 w-full rounded-2xl bg-accent text-body font-semibold text-accent-ink transition-transform active:scale-98 cursor-pointer disabled:opacity-40"
            >
              {t('showIdeas')}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
