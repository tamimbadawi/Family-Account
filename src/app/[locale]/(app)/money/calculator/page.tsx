import * as React from 'react';
import { Suspense } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ChevronLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { loadAllMarket } from '@/lib/market/loader';
import { GoalTool } from '@/components/calculator/GoalTool';

export default async function CalculatorPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('goal');
  const { offers, funds } = await loadAllMarket();

  return (
    <div className="flex flex-col h-full overflow-hidden select-none">
      {/* Header */}
      <div className="px-5 pt-[max(env(safe-area-inset-top,0px),1rem)] pb-3 shrink-0 flex items-center justify-between border-b border-line/30">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href="/money"
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-accent hover:bg-surface-2 transition-colors -ms-2 cursor-pointer"
            aria-label={t('back')}
          >
            <ChevronLeft className="size-6 rtl:rotate-180" />
          </Link>
          <h1 className="text-title font-bold text-ink leading-tight truncate">
            {t('pageTitle')}
          </h1>
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-12 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Suspense fallback={null}>
          <GoalTool offers={offers} funds={funds} initialMode="want" />
        </Suspense>
      </div>
    </div>
  );
}
