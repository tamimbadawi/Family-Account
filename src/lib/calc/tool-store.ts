'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { MAX_SPLIT_LINES } from './split';
import type { TargetKind } from './target';

/**
 * Phone-only store for the Split and Target tools (docs/PLAN.md §5). Same rules as the comparison store:
 * localStorage when it works, memory when it does not, nothing ever leaves the browser.
 */
function createStored<T>(key: string, fallback: T, validate: (raw: unknown) => T) {
  let memory = fallback;
  let snapshot: T | undefined;
  const listeners = new Set<() => void>();

  const read = (): T => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw == null ? memory : validate(JSON.parse(raw));
    } catch {
      return memory;
    }
  };
  const get = (): T => {
    if (snapshot === undefined) snapshot = typeof window === 'undefined' ? fallback : read();
    return snapshot;
  };
  const set = (value: T) => {
    memory = value;
    snapshot = value;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage off: memory only
    }
    listeners.forEach((l) => l());
  };
  const subscribe = (l: () => void) => {
    listeners.add(l);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key || e.key === null) {
        snapshot = read();
        l();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(l);
      window.removeEventListener('storage', onStorage);
    };
  };
  const reset = () => {
    memory = fallback;
    snapshot = undefined;
  };
  return { get, set, subscribe, reset, fallback };
}

export interface StoredSplitLine {
  id: string;
  amount: number;
}

export interface StoredSplit {
  total: number;
  lines: StoredSplitLine[];
}

export interface StoredTarget {
  value: number;
  kind: TargetKind;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);

export const splitStore = createStored<StoredSplit>('bank_offers_split', { total: 0, lines: [] }, (raw) => {
  const r = (raw ?? {}) as Partial<StoredSplit>;
  const lines = Array.isArray(r.lines)
    ? r.lines
        .filter((l): l is StoredSplitLine => !!l && typeof l.id === 'string' && l.id.trim() !== '')
        .map((l) => ({ id: l.id, amount: num(l.amount) }))
        .filter((l, i, a) => a.findIndex((x) => x.id === l.id) === i)
        .slice(0, MAX_SPLIT_LINES)
    : [];
  return { total: num(r.total), lines };
});

export const targetStore = createStored<StoredTarget>('bank_offers_target', { value: 5000, kind: 'perMonth' }, (raw) => {
  const r = (raw ?? {}) as Partial<StoredTarget>;
  const kind: TargetKind = r.kind === 'totalReturn' || r.kind === 'perPayout' ? r.kind : 'perMonth';
  return { value: num(r.value), kind };
});

export const ownFigureStore = createStored<Record<string, number>>('bank_offers_own_figures', {}, (raw) => {
  const out: Record<string, number> = {};
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw)) if (typeof v === 'number' && Number.isFinite(v) && v > -100) out[k] = v;
  }
  return out;
});

function useStored<T>(s: ReturnType<typeof createStored<T>>) {
  const value = useSyncExternalStore(s.subscribe, s.get, () => s.fallback);
  const set = useCallback((v: T) => s.set(v), [s]);
  return [value, set] as const;
}

export function useSplit() {
  const [state, set] = useStored(splitStore);
  const addLine = useCallback(
    (id: string) => {
      const cur = splitStore.get();
      if (cur.lines.some((l) => l.id === id) || cur.lines.length >= MAX_SPLIT_LINES) return;
      set({ ...cur, lines: [...cur.lines, { id, amount: 0 }] });
    },
    [set]
  );
  const removeLine = useCallback((id: string) => {
    const cur = splitStore.get();
    set({ ...cur, lines: cur.lines.filter((l) => l.id !== id) });
  }, [set]);
  const setLineAmount = useCallback((id: string, amount: number) => {
    const cur = splitStore.get();
    set({ ...cur, lines: cur.lines.map((l) => (l.id === id ? { ...l, amount: num(amount) } : l)) });
  }, [set]);
  const setTotal = useCallback((total: number) => set({ ...splitStore.get(), total: num(total) }), [set]);
  return { ...state, addLine, removeLine, setLineAmount, setTotal, max: MAX_SPLIT_LINES };
}

export function useTarget() {
  return useStored(targetStore);
}

export function useOwnFigures() {
  const [figures, set] = useStored(ownFigureStore);
  const setFigure = useCallback(
    (id: string, v: number | null) => {
      const next = { ...ownFigureStore.get() };
      if (v == null || !Number.isFinite(v) || v <= -100) delete next[id];
      else next[id] = v;
      set(next);
    },
    [set]
  );
  return { figures, setFigure };
}

export function resetToolStoresForTesting() {
  splitStore.reset();
  targetStore.reset();
  ownFigureStore.reset();
}
