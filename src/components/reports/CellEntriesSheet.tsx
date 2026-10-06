'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Layers } from 'lucide-react';
import type { EnrichedEntry } from '@/lib/data/types';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { EntryRow } from '@/components/entry/EntryRow';
import { useEntrySheet } from '@/components/entry/EntrySheetContext';
import { money } from '@/lib/format';

export interface CellEntriesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  total?: number;
  entries: EnrichedEntry[];
}

export function CellEntriesSheet({
  open,
  onOpenChange,
  title,
  subtitle,
  total,
  entries,
}: CellEntriesSheetProps) {
  const locale = useLocale();
  const t = useTranslations('reports');
  const { openEdit } = useEntrySheet();

  const handleEntryClick = (entry: EnrichedEntry) => {
    onOpenChange(false);
    openEdit(entry);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85dvh] flex flex-col bg-surface text-ink">
        <DrawerHeader className="pb-3 border-b border-line shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <DrawerTitle className="text-heading font-bold text-ink truncate">
                {title}
              </DrawerTitle>
              {subtitle && (
                <p className="text-caption text-ink-muted truncate mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>

            {total !== undefined && (
              <span className="text-heading font-bold tabular-nums text-ink shrink-0">
                {money(total, locale)}
              </span>
            )}
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-5 py-2 divide-y divide-line [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {entries.length === 0 ? (
            <div className="py-12 text-center text-ink-muted">
              <Layers className="size-8 mx-auto text-ink-faint mb-2" />
              <p className="text-body font-medium">{t('emptyEntries')}</p>
            </div>
          ) : (
            entries.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                onClick={() => handleEntryClick(entry)}
              />
            ))
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
