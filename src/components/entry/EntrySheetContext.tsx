'use client';

import * as React from 'react';
import { markBusy } from '@/lib/busy';
import type { EnrichedEntry, EntryType } from '@/lib/data/types';

interface EntrySheetContextValue {
  isOpen: boolean;
  mode: 'add' | 'edit';
  editingEntry: EnrichedEntry | null;
  initialType?: EntryType;
  openAdd: (type?: EntryType) => void;
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

  const openAdd = React.useCallback((type?: EntryType) => {
    setMode('add');
    setEditingEntry(null);
    setInitialType(type ?? 'expense');
    setIsOpen(true);
  }, []);

  const openEdit = React.useCallback((entry: EnrichedEntry) => {
    setMode('edit');
    setEditingEntry(entry);
    setInitialType(entry.type);
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
      openAdd,
      openEdit,
      close,
    }),
    [isOpen, mode, editingEntry, initialType, openAdd, openEdit, close]
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
