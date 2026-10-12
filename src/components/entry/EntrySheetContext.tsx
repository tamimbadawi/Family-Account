'use client';

import * as React from 'react';
import { markBusy } from '@/lib/busy';
import type { EnrichedEntry, EntryType } from '@/lib/data/types';

export interface OpenAddOptions {
  initialRecurring?: boolean;
}

interface EntrySheetContextValue {
  isOpen: boolean;
  mode: 'add' | 'edit';
  editingEntry: EnrichedEntry | null;
  initialType?: EntryType;
  initialRecurring: boolean;
  openAdd: (type?: EntryType, options?: OpenAddOptions) => void;
  openEdit: (entry: EnrichedEntry) => void;
  close: () => void;
}

const EntrySheetContext = React.createContext<EntrySheetContextValue | null>(null);

export function EntrySheetProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false);

  // While an entry is open (even while the camera app is in front) the app must not reload for an update
  React.useEffect(() => (isOpen ? markBusy() : undefined), [isOpen]);
  const [mode, setMode] = React.useState<'add' | 'edit'>('add');
  const [editingEntry, setEditingEntry] = React.useState<EnrichedEntry | null>(null);
  const [initialType, setInitialType] = React.useState<EntryType | undefined>(undefined);
  const [initialRecurring, setInitialRecurring] = React.useState(false);

  const openAdd = React.useCallback((type?: EntryType, options?: OpenAddOptions) => {
    setMode('add');
    setEditingEntry(null);
    setInitialType(type ?? 'expense');
    setInitialRecurring(options?.initialRecurring ?? false);
    setIsOpen(true);
  }, []);

  const openEdit = React.useCallback((entry: EnrichedEntry) => {
    setMode('edit');
    setEditingEntry(entry);
    setInitialType(entry.type);
    setInitialRecurring(false);
    setIsOpen(true);
  }, []);

  const close = React.useCallback(() => {
    setIsOpen(false);
  }, []);

  const value = React.useMemo(
    () => ({
      isOpen,
      mode,
      editingEntry,
      initialType,
      initialRecurring,
      openAdd,
      openEdit,
      close,
    }),
    [isOpen, mode, editingEntry, initialType, initialRecurring, openAdd, openEdit, close]
  );

  return (
    <EntrySheetContext.Provider value={value}>
      {children}
    </EntrySheetContext.Provider>
  );
}

export function useEntrySheet(): EntrySheetContextValue {
  const ctx = React.useContext(EntrySheetContext);
  if (!ctx) {
    throw new Error('useEntrySheet must be used within an EntrySheetProvider');
  }
  return ctx;
}
