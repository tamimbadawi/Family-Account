'use client';

import { useCallback, useSyncExternalStore } from 'react';

const COMPARE_STORAGE_KEY = 'bank_offers_compare_ids';
const LAST_AMOUNT_STORAGE_KEY = 'bank_offers_last_amount';
export const MAX_COMPARE = 3 as const;

// Check storage availability once and remember it
let storageAvailable: boolean | null = null;

export function checkStorageAvailable(): boolean {
  if (storageAvailable !== null) return storageAvailable;
  if (typeof window === 'undefined') {
    storageAvailable = false;
    return false;
  }
  try {
    const testKey = '__test_storage__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    storageAvailable = true;
  } catch {
    storageAvailable = false;
  }
  return storageAvailable;
}

// In-memory fallback if localStorage is disabled or throws
let memoryCompareIds: string[] = [];
let memoryLastAmount: number | null = null;

// Stable cached snapshot references
let cachedCompareIdsSnapshot: string[] = [];
let cachedLastAmountSnapshot: number | null = null;

const compareListeners = new Set<() => void>();
const amountListeners = new Set<() => void>();

function areArraysEqual(a: string[], b: string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function readStoredCompareIds(): string[] {
  if (!checkStorageAvailable()) return [...memoryCompareIds];
  try {
    const raw = window.localStorage.getItem(COMPARE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((id): id is string => typeof id === 'string' && id.trim() !== '')
        .slice(0, MAX_COMPARE);
    }
    return [];
  } catch {
    return [...memoryCompareIds];
  }
}

export function readStoredLastAmount(): number | null {
  if (!checkStorageAvailable()) return memoryLastAmount;
  try {
    const raw = window.localStorage.getItem(LAST_AMOUNT_STORAGE_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isNaN(n) ? null : n;
  } catch {
    return memoryLastAmount;
  }
}

// Initialize snapshots
if (typeof window !== 'undefined') {
  cachedCompareIdsSnapshot = readStoredCompareIds();
  cachedLastAmountSnapshot = readStoredLastAmount();
}

function updateCompareSnapshotAndNotify() {
  const newIds = readStoredCompareIds();
  if (!areArraysEqual(cachedCompareIdsSnapshot, newIds)) {
    cachedCompareIdsSnapshot = newIds;
  }
  compareListeners.forEach((l) => l());
}

function updateAmountSnapshotAndNotify() {
  const newAmount = readStoredLastAmount();
  if (cachedLastAmountSnapshot !== newAmount) {
    cachedLastAmountSnapshot = newAmount;
  }
  amountListeners.forEach((l) => l());
}

export function saveStoredCompareIds(ids: string[]): void {
  const clean = ids
    .filter((id) => typeof id === 'string' && id.trim() !== '')
    .slice(0, MAX_COMPARE);

  memoryCompareIds = [...clean];

  if (checkStorageAvailable()) {
    try {
      window.localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(clean));
    } catch {
      // Ignore quota/permission errors
    }
  }

  if (!areArraysEqual(cachedCompareIdsSnapshot, clean)) {
    cachedCompareIdsSnapshot = clean;
  }
  compareListeners.forEach((l) => l());
}

export function addCompareId(id: string): string[] {
  if (!id || typeof id !== 'string' || id.trim() === '') {
    return cachedCompareIdsSnapshot;
  }
  const cleanId = id.trim();
  const current = readStoredCompareIds();
  if (current.includes(cleanId)) return current;
  if (current.length >= MAX_COMPARE) return current; // Capped at 3

  const updated = [...current, cleanId];
  saveStoredCompareIds(updated);
  return updated;
}

export function removeCompareId(id: string): string[] {
  const cleanId = id?.trim();
  const current = readStoredCompareIds();
  const updated = current.filter((item) => item !== cleanId);
  saveStoredCompareIds(updated);
  return updated;
}

export function clearCompareIds(): void {
  saveStoredCompareIds([]);
}

export function cleanStaleCompareIds(validIds: string[]): string[] {
  const current = readStoredCompareIds();
  const validSet = new Set(validIds);
  const updated = current.filter((id) => validSet.has(id));
  if (updated.length !== current.length) {
    saveStoredCompareIds(updated);
  }
  return updated;
}

export function setStoredLastAmount(val: number | null): void {
  memoryLastAmount = val;

  if (checkStorageAvailable()) {
    try {
      if (val == null) {
        window.localStorage.removeItem(LAST_AMOUNT_STORAGE_KEY);
      } else {
        window.localStorage.setItem(LAST_AMOUNT_STORAGE_KEY, val.toString());
      }
    } catch {
      // Ignore
    }
  }

  if (cachedLastAmountSnapshot !== val) {
    cachedLastAmountSnapshot = val;
  }
  amountListeners.forEach((l) => l());
}

export function resetStoreForTesting(): void {
  storageAvailable = null;
  memoryCompareIds = [];
  memoryLastAmount = null;
  cachedCompareIdsSnapshot = [];
  cachedLastAmountSnapshot = null;
  compareListeners.clear();
  amountListeners.clear();
}

function subscribeCompare(listener: () => void) {
  compareListeners.add(listener);

  // Storage event covers other tabs ONLY
  const onStorage = (e: StorageEvent) => {
    if (e.key === COMPARE_STORAGE_KEY || e.key === null) {
      updateCompareSnapshotAndNotify();
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
  }

  return () => {
    compareListeners.delete(listener);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage);
    }
  };
}

function getCompareSnapshot(): string[] {
  return cachedCompareIdsSnapshot;
}

const emptyCompareServerSnapshot: string[] = [];
function getCompareServerSnapshot(): string[] {
  return emptyCompareServerSnapshot;
}

function subscribeAmount(listener: () => void) {
  amountListeners.add(listener);

  const onStorage = (e: StorageEvent) => {
    if (e.key === LAST_AMOUNT_STORAGE_KEY || e.key === null) {
      updateAmountSnapshotAndNotify();
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
  }

  return () => {
    amountListeners.delete(listener);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage);
    }
  };
}

function getAmountSnapshot(): number | null {
  return cachedLastAmountSnapshot;
}

function getAmountServerSnapshot(): null {
  return null;
}

/**
 * useCompare hook for managing comparison list (capped at 3 items).
 * Stored on device only in localStorage.
 */
export function useCompare(validIds?: string[]) {
  const ids = useSyncExternalStore(
    subscribeCompare,
    getCompareSnapshot,
    getCompareServerSnapshot
  );

  const filteredIds = validIds && validIds.length > 0
    ? ids.filter((id) => validIds.includes(id))
    : ids;

  const add = useCallback((id: string) => {
    addCompareId(id);
  }, []);

  const remove = useCallback((id: string) => {
    removeCompareId(id);
  }, []);

  const clear = useCallback(() => {
    clearCompareIds();
  }, []);

  const has = useCallback(
    (id: string) => {
      return filteredIds.includes(id);
    },
    [filteredIds]
  );

  return {
    ids: filteredIds,
    add,
    remove,
    clear,
    has,
    max: MAX_COMPARE,
  };
}

/**
 * useLastAmount hook for persisting user last typed amount.
 * Can be destructured as [amount, setAmount] or { amount, setAmount }.
 */
export function useLastAmount(): readonly [number | null, (val: number | null) => void] & {
  amount: number | null;
  setAmount: (val: number | null) => void;
} {
  const amount = useSyncExternalStore(
    subscribeAmount,
    getAmountSnapshot,
    getAmountServerSnapshot
  );

  const setAmount = useCallback((val: number | null) => {
    setStoredLastAmount(val);
  }, []);

  const tuple = [amount, setAmount] as const;
  return Object.assign(tuple, { amount, setAmount });
}
