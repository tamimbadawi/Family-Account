'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Pencil } from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { AmountPad } from '@/components/entry/AmountPad';
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';

export function AmountInput({
  value,
  onChange,
  label,
  currency = 'EGP',
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  currency?: string;
  className?: string;
}) {
  const locale = useLocale();
  const t = useTranslations('goal');
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(value ? String(value) : '100000');

  const presets = [50000, 100000, 250000, 500000, 1000000];

  const handleOpen = () => {
    setDraft(value > 0 ? String(Math.round(value)) : '100000');
    setOpen(true);
  };

  const handleDone = () => {
    const num = Math.round(Number(draft) || 0);
    onChange(num > 0 ? num : 100000);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        aria-label={`${label} · ${money(value, locale, { currency })}`}
        onClick={handleOpen}
        className={cn(
          'w-full text-start flex items-center justify-between gap-3 rounded-card bg-surface px-4 py-3 shadow-card border border-line/50 hover:border-accent/40 active:scale-[0.99] transition-transform cursor-pointer',
          className
        )}
      >
        <span className="flex flex-col min-w-0">
          <span className="text-caption font-semibold text-ink-muted">{label}</span>
          <span className="text-title font-bold text-ink tabular-nums tracking-tight">
            {money(value, locale, { currency })}
          </span>
        </span>
        <span className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-ink-muted shrink-0">
          <Pencil className="size-4" aria-hidden />
        </span>
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-w-md mx-auto p-4 select-none">
          <DrawerHeader className="p-0 mb-3 text-start">
            <DrawerTitle className="text-title font-bold text-ink">{label}</DrawerTitle>
            <div className="text-hero font-bold text-accent tabular-nums tracking-tight mt-1">
              {money(Number(draft) || 0, locale, { currency })}
            </div>
          </DrawerHeader>

          {/* Quick presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 mb-3 [scrollbar-width:none]">
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setDraft(String(preset))}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-caption font-semibold tabular-nums shrink-0 transition-colors',
                  Number(draft) === preset
                    ? 'bg-accent text-accent-ink'
                    : 'bg-surface-2 text-ink hover:bg-surface-2/80'
                )}
              >
                {money(preset, locale, { currency, compact: true })}
              </button>
            ))}
          </div>

          <AmountPad value={draft} onChange={setDraft} />

          <DrawerFooter className="p-0 pt-3">
            <Button
              type="button"
              onClick={handleDone}
              className="w-full h-12 rounded-card text-body font-bold"
            >
              {t('done')}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
