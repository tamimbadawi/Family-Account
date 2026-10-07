'use client';

// =========================================================
// Repository Provider & React Hooks  ·  Family Accounts
// Built on Dexie useLiveQuery so screens update automatically
// on local writes and background sync pulls.
// Selected by NEXT_PUBLIC_DATA_MODE (default 'mock').
// =========================================================

import { useLiveQuery } from 'dexie-react-hooks';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { mockRepository } from './mock-repository';
import { LiveRepository } from './live-repository';
import { getLastNMonths } from '@/lib/reports/months';
import { budgetProgress, type BudgetProgress } from '@/lib/reports/budgets';
import type { ListEntriesParams, Repository } from './repository';
import type {
  Budget,
  Category,
  CategoryKind,
  CategoryLevel,
  CategoryTotal,
  EnrichedEntry,
  Household,
  Item,
  Member,
  MonthSummary,
  RecentItem,
  Subcategory,
  SyncStatus,
  Wallet,
  WalletBalance,
} from './types';

let liveRepository: LiveRepository | null = null;

// Resolves repository implementation based on NEXT_PUBLIC_DATA_MODE
export function getDefaultRepository(): Repository {
  if (process.env.NEXT_PUBLIC_DATA_MODE === 'live') {
    liveRepository ??= new LiveRepository();
    return liveRepository;
  }
  return mockRepository;
}

const RepositoryContext = createContext<Repository | null>(null);

export interface RepositoryProviderProps {
  children: React.ReactNode;
  repository?: Repository;
}

export function RepositoryProvider({ children, repository }: RepositoryProviderProps) {
  const activeRepo = useMemo(() => repository ?? getDefaultRepository(), [repository]);
  const [isReady, setIsReady] = useState(
    () => typeof activeRepo.ensureSeeded !== 'function'
  );

  useEffect(() => {
    let cancelled = false;

    if (typeof activeRepo.ensureSeeded === 'function') {
      activeRepo
        .ensureSeeded()
        .then(() => {
          if (!cancelled) {
            setIsReady(true);
          }
        })
        .catch((err) => {
          console.error('[RepositoryProvider] Failed to seed repository:', err);
          if (!cancelled) {
            setIsReady(true);
          }
        });
    }

    return () => {
      cancelled = true;
    };
  }, [activeRepo]);

  // Live mode: fetch what the rest of the family saved whenever the app comes back to the front
  // or the connection returns.
  useEffect(() => {
    const refresh = activeRepo.refresh?.bind(activeRepo);
    if (!refresh) return;
    const run = () => void refresh().catch((err) => console.warn('[sync] pull failed', err));
    const onVisible = () => document.visibilityState === 'visible' && run();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', run);
    window.addEventListener('focus', run);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', run);
      window.removeEventListener('focus', run);
    };
  }, [activeRepo]);

  if (!isReady) {
    return (
      <RepositoryContext.Provider value={activeRepo}>
        <div className="fixed inset-0 bg-canvas" aria-hidden="true" />
      </RepositoryContext.Provider>
    );
  }

  return (
    <RepositoryContext.Provider value={activeRepo}>
      <MembersProvider>{children}</MembersProvider>
    </RepositoryContext.Provider>
  );
}

// One live members list for the whole app, so every entry row can show who added it
// without opening its own database subscription.
const MembersContext = createContext<Member[]>([]);

function MembersProvider({ children }: { children: React.ReactNode }) {
  const members = useMembers();
  return <MembersContext.Provider value={members ?? []}>{children}</MembersContext.Provider>;
}

/** Household members from the shared list (empty until loaded). */
export function useHouseholdMembers(): Member[] {
  return useContext(MembersContext);
}

export function useRepository(): Repository {
  const context = useContext(RepositoryContext);
  return context ?? getDefaultRepository();
}

// ---------- Live Query Hooks ----------

export function useEntries(params?: ListEntriesParams): EnrichedEntry[] | undefined {
  const repo = useRepository();
  const paramsKey = JSON.stringify(params);

  return useLiveQuery(
    async () => {
      if (typeof window === 'undefined') return [];
      return repo.listEntries(params);
    },
    [repo, paramsKey],
    undefined
  );
}

export function useEntry(id: string | null | undefined): EnrichedEntry | null | undefined {
  const repo = useRepository();

  return useLiveQuery(
    async () => {
      if (typeof window === 'undefined' || !id) return null;
      return repo.getEntry(id);
    },
    [repo, id],
    undefined
  );
}

export function useMonthSummary(month: string): MonthSummary | undefined {
  const repo = useRepository();

  return useLiveQuery(
    async () => {
      if (typeof window === 'undefined') return undefined;
      return repo.monthSummary(month);
    },
    [repo, month],
    undefined
  );
}

export function useSixMonthSummary(endMonth: string): MonthSummary[] | undefined {
  const repo = useRepository();

  return useLiveQuery(
    async () => {
      if (typeof window === 'undefined') return undefined;
      const months = getLastNMonths(endMonth, 6);
      return Promise.all(months.map((m) => repo.monthSummary(m)));
    },
    [repo, endMonth],
    undefined
  );
}

export function useCategoryTotals(
  month: string,
  kind: CategoryKind,
  level: CategoryLevel,
  parentId?: string
): CategoryTotal[] | undefined {
  const repo = useRepository();

  return useLiveQuery(
    async () => {
      if (typeof window === 'undefined') return [];
      return repo.categoryTotals(month, kind, level, parentId);
    },
    [repo, month, kind, level, parentId],
    undefined
  );
}

export function useRecentItems(limit = 6): RecentItem[] | undefined {
  const repo = useRepository();

  return useLiveQuery(
    async () => {
      if (typeof window === 'undefined') return [];
      return repo.recentItems(limit);
    },
    [repo, limit],
    undefined
  );
}

export function useWalletBalances(): WalletBalance[] | undefined {
  const repo = useRepository();

  return useLiveQuery(
    async () => {
      if (typeof window === 'undefined') return [];
      return repo.walletBalances();
    },
    [repo],
    undefined
  );
}

export function useWallets(includeArchived = false): Wallet[] | undefined {
  const repo = useRepository();

  return useLiveQuery(
    async () => {
      if (typeof window === 'undefined') return [];
      return repo.getWallets(includeArchived);
    },
    [repo, includeArchived],
    undefined
  );
}

export function useCategories(
  kind?: CategoryKind,
  includeArchived = false
): Category[] | undefined {
  const repo = useRepository();

  return useLiveQuery(
    async () => {
      if (typeof window === 'undefined') return [];
      return repo.getCategories(kind, includeArchived);
    },
    [repo, kind, includeArchived],
    undefined
  );
}

export function useSubcategories(
  categoryId?: string,
  includeArchived = false
): Subcategory[] | undefined {
  const repo = useRepository();

  return useLiveQuery(
    async () => {
      if (typeof window === 'undefined') return [];
      return repo.getSubcategories(categoryId, includeArchived);
    },
    [repo, categoryId, includeArchived],
    undefined
  );
}

export function useItems(
  subcategoryId?: string,
  includeArchived = false
): Item[] | undefined {
  const repo = useRepository();

  return useLiveQuery(
    async () => {
      if (typeof window === 'undefined') return [];
      return repo.getItems(subcategoryId, includeArchived);
    },
    [repo, subcategoryId, includeArchived],
    undefined
  );
}

export function useBudgets(includeArchived = false): Budget[] | undefined {
  const repo = useRepository();

  return useLiveQuery(
    async () => {
      if (typeof window === 'undefined') return [];
      return repo.getBudgets(includeArchived);
    },
    [repo, includeArchived],
    undefined
  );
}

/** Actual vs budget for one month ('YYYY-MM'), fullest budget first. */
export function useBudgetProgress(month: string): BudgetProgress[] | undefined {
  const repo = useRepository();

  return useLiveQuery(
    async () => {
      if (typeof window === 'undefined') return [];
      const [budgets, entries] = await Promise.all([
        repo.getBudgets(),
        repo.listEntries({ month, type: 'expense' }),
      ]);
      return budgetProgress(budgets, entries, month);
    },
    [repo, month],
    undefined
  );
}

export function useHousehold(): Household | null | undefined {
  const repo = useRepository();

  return useLiveQuery(
    async () => {
      if (typeof window === 'undefined') return null;
      return repo.getHousehold();
    },
    [repo],
    undefined
  );
}

export function useMembers(): Member[] | undefined {
  const repo = useRepository();

  return useLiveQuery(
    async () => {
      if (typeof window === 'undefined') return [];
      return repo.getMembers();
    },
    [repo],
    undefined
  );
}

export function useSyncStatus(): SyncStatus | undefined {
  const repo = useRepository();

  return useLiveQuery(
    async () => {
      if (typeof window === 'undefined') {
        return { status: 'synced', lastSyncedAt: null, pendingCount: 0 };
      }
      return repo.syncStatus();
    },
    [repo],
    undefined
  );
}
