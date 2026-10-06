'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ChevronRight } from 'lucide-react';
import {
  REPORT_GROUPS,
  REPORTS_REGISTRY,
  type ReportGroup,
} from '@/lib/reports/registry';
import { ReportIcon } from './ReportIcon';
import { Card } from '@/components/ui/card';

export function AllReportsTab() {
  const t = useTranslations('reports');
  const [activeGroup, setActiveGroup] = React.useState<ReportGroup>('flow');

  const currentReports = React.useMemo(() => {
    return REPORTS_REGISTRY.filter((r) => r.group === activeGroup);
  }, [activeGroup]);

  return (
    <div className="flex flex-col gap-2 select-none">
      {/* 1. Group Selector Chips */}
      <div className="flex items-center gap-1.5 p-0.5">
        {REPORT_GROUPS.map((g) => {
          const isSelected = activeGroup === g.id;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => setActiveGroup(g.id)}
              className={`flex-1 h-9 rounded-full text-caption font-semibold transition-all active:scale-95 text-center px-1.5 ${
                isSelected
                  ? 'bg-accent text-accent-ink shadow-xs'
                  : 'bg-surface-2 text-ink-muted hover:text-ink'
              }`}
            >
              {t(`library.${g.titleKey}`)}
            </button>
          );
        })}
      </div>

      {/* 2. Group Reports List Card */}
      <Card className="rounded-card bg-surface shadow-card divide-y divide-line/40 border border-line/60 overflow-hidden p-0 gap-0">
        {currentReports.map((report) => (
          <Link
            key={report.id}
            href={report.route}
            className="flex items-center justify-between gap-3 px-3.5 py-2.5 transition-colors hover:bg-surface-2/40 active:bg-surface-2/70 min-h-[58px]"
          >
            {/* Leading: Icon Circle + Titles */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                <ReportIcon name={report.icon} className="size-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-body font-semibold text-ink leading-tight">
                  {t(`library.${report.titleKey}`)}
                </h3>
                <p className="text-caption text-ink-muted leading-tight mt-0.5">
                  {t(`library.${report.descKey}`)}
                </p>
              </div>
            </div>

            {/* Trailing: Chevron */}
            <ChevronRight className="size-4 shrink-0 text-ink-faint rtl:rotate-180" />
          </Link>
        ))}
      </Card>
    </div>
  );
}
