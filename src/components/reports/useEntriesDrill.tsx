'use client';

import * as React from 'react';
import type { EnrichedEntry } from '@/lib/data/types';
import { CellEntriesSheet } from './CellEntriesSheet';

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Tap a total in a report → a sheet listing the entries behind it (newest first); tap one to open it.
 * Render `sheet` once in the view and call `show()` from any row.
 */
export function useEntriesDrill() {
  const [open, setOpen] = React.useState(false);
  const [state, setState] = React.useState<{ title: string; subtitle?: string; entries: EnrichedEntry[]; total?: number } | null>(
    null
  );

  const show = React.useCallback((title: string, entries: EnrichedEntry[], opts: { subtitle?: string; total?: number } = {}) => {
    const sorted = [...entries].sort(
      (a, b) => b.occurredOn.localeCompare(a.occurredOn) || b.createdAt.localeCompare(a.createdAt)
    );
    setState({ title, entries: sorted, subtitle: opts.subtitle, total: opts.total ?? round2(entries.reduce((s, e) => s + e.amount, 0)) });
    setOpen(true);
  }, []);

  const sheet = state ? (
    <CellEntriesSheet
      open={open}
      onOpenChange={setOpen}
      title={state.title}
      subtitle={state.subtitle}
      total={state.total}
      entries={state.entries}
    />
  ) : null;

  return { show, sheet };
}
