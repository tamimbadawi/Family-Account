'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { Certainty } from '@/lib/calc/plan';
import { cn } from '@/lib/utils';

/** Fixed · Likely · Uncertain: how set the outcome is (written rule in src/lib/calc/plan.ts). */
export function CertaintyTag({ c }: { c: Certainty }) {
  const t = useTranslations('goal.certainty');
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-caption font-semibold leading-snug',
        c === 'fixed'
          ? 'bg-income-soft text-income'
          : c === 'likely'
            ? 'bg-accent-soft text-accent'
            : 'bg-surface-2 text-ink-muted'
      )}
    >
      {t(c)}
    </span>
  );
}
