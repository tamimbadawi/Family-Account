'use client';

import * as React from 'react';
import { Plus } from 'lucide-react';
import { usePathname } from '@/i18n/navigation';
import { useEntrySheet } from '@/components/entry/EntrySheetContext';

export function FloatingAddButton() {
  const pathname = usePathname();
  const { openAdd } = useEntrySheet();
  const isVisible = pathname === '/' || pathname === '' || pathname.startsWith('/history');

  if (!isVisible) return null;

  return (
    <button
      type="button"
      aria-label="Add entry"
      onClick={() => openAdd()}
      className="absolute end-4 bottom-[calc(4rem+env(safe-area-inset-bottom,0px)+0.75rem)] z-30 flex size-14 items-center justify-center rounded-full bg-accent text-accent-ink shadow-card transition-transform active:scale-95 select-none cursor-pointer"
    >
      <Plus className="size-7" strokeWidth={2.25} />
    </button>
  );
}
