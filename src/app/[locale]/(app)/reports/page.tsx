'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

export default function ReportsPage() {
  const t = useTranslations('nav');
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center text-ink-muted">
      <span className="text-heading font-medium">{t('reports')}</span>
    </div>
  );
}
