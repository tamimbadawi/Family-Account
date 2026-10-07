import * as React from 'react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ChevronLeft } from 'lucide-react';
import { getReportById, REPORTS_REGISTRY } from '@/lib/reports/registry';
import { ReportIcon } from '@/components/reports/ReportIcon';
import { Card } from '@/components/ui/card';
import { ThisVsLastMonthView } from '@/components/reports/views/ThisVsLastMonthView';
import { YearSummaryView } from '@/components/reports/views/YearSummaryView';
import { BiggestExpensesView } from '@/components/reports/views/BiggestExpensesView';
import { SpendingCalendarView } from '@/components/reports/views/SpendingCalendarView';
import { IncomeSourcesView } from '@/components/reports/views/IncomeSourcesView';
import { CategoryDeepDiveView } from '@/components/reports/views/CategoryDeepDiveView';
import { BillsTrackerView } from '@/components/reports/views/BillsTrackerView';
import { MonthlyAveragesView } from '@/components/reports/views/MonthlyAveragesView';
import { WhoSpentWhatView } from '@/components/reports/views/WhoSpentWhatView';
import { SearchExportView } from '@/components/reports/views/SearchExportView';
import { UnusualSpendingView } from '@/components/reports/views/UnusualSpendingView';
import { SpendingPaceView } from '@/components/reports/views/SpendingPaceView';

export function generateStaticParams() {
  return REPORTS_REGISTRY.map((r) => ({ id: r.id }));
}

interface ReportPageProps {
  params: Promise<{
    locale: string;
    id: string;
  }>;
}

export default async function ReportDetailPage({ params }: ReportPageProps) {
  const { id } = await params;
  const report = getReportById(id);

  if (!report) {
    notFound();
  }

  const t = await getTranslations('reports');

  return (
    <div className="flex flex-col gap-2.5 pb-4 select-none">
      {/* 1. Back Navigation & Header */}
      <div className="flex items-center gap-2.5 pt-0.5">
        <Link
          href="/reports?tab=all"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink hover:text-accent active:scale-95 transition-all"
          aria-label={t('library.allReportsBack')}
        >
          <ChevronLeft className="size-5 rtl:rotate-180" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-title font-bold text-ink leading-tight">
            {t(`library.${report.titleKey}`)}
          </h1>
        </div>
      </div>

      {/* 2. Report Body */}
      {report.id === 'this-vs-last-month' && <ThisVsLastMonthView />}
      {report.id === 'year-summary' && <YearSummaryView />}
      {report.id === 'biggest-expenses' && <BiggestExpensesView />}
      {report.id === 'spending-calendar' && <SpendingCalendarView />}
      {report.id === 'income-sources' && <IncomeSourcesView />}
      {report.id === 'category-deep-dive' && <CategoryDeepDiveView />}
      {report.id === 'bills-tracker' && <BillsTrackerView />}
      {report.id === 'monthly-averages' && <MonthlyAveragesView />}
      {report.id === 'who-spent-what' && <WhoSpentWhatView />}
      {report.id === 'search-export' && <SearchExportView />}
      {report.id === 'unusual-spending' && <UnusualSpendingView />}
      {report.id === 'spending-pace' && <SpendingPaceView />}

      {!report.isImplemented && (
        <Card className="rounded-card bg-surface p-8 text-center shadow-card border border-line/60 space-y-3 mt-4">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <ReportIcon name={report.icon} className="size-7" />
          </div>
          <h2 className="text-heading font-bold text-ink">
            {t(`library.${report.titleKey}`)}
          </h2>
          <p className="text-body text-ink-muted max-w-sm mx-auto">
            {t('library.comingSoon')}
          </p>
        </Card>
      )}
    </div>
  );
}
