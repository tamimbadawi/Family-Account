export interface SavedPlanLine {
  id: string;
  nameEn: string;
  nameAr: string;
  amount: number;
  share: number;
  kind: string;
}

export interface SavedPlan {
  id: string;
  name: string;
  createdAt: string;
  amount: number;
  choice: 'max' | '10' | '25' | '50' | '100' | 'pct' | 'amt';
  customPct?: number;
  goalAmount?: number;
  horizon: number;
  sure: 'safe' | 'balanced' | 'bold';
  expectedGain: number;
  chance: number;
  lines: SavedPlanLine[];
}

const STORAGE_KEY = 'family_accounts_saved_plans_v1';
export const MAX_SAVED_PLANS = 10;

let cachedPlans: SavedPlan[] | null = null;
const EMPTY_PLANS: SavedPlan[] = [];

function readPlansFromStorage(): SavedPlan[] {
  if (typeof window === 'undefined') return EMPTY_PLANS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_PLANS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : EMPTY_PLANS;
  } catch {
    return EMPTY_PLANS;
  }
}

export function getSavedPlans(): SavedPlan[] {
  if (typeof window === 'undefined') return EMPTY_PLANS;
  if (cachedPlans === null) {
    cachedPlans = readPlansFromStorage();
  }
  return cachedPlans;
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {}
  });
}

export function subscribeSavedPlans(callback: () => void): () => void {
  listeners.add(callback);

  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) {
      cachedPlans = readPlansFromStorage();
      notify();
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
  }

  return () => {
    listeners.delete(callback);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage);
    }
  };
}

export function savePlan(
  data: Omit<SavedPlan, 'id' | 'createdAt'>
): { ok: boolean; plan?: SavedPlan; reason?: 'max_reached' } {
  const current = getSavedPlans();
  if (current.length >= MAX_SAVED_PLANS) {
    return { ok: false, reason: 'max_reached' };
  }

  const newPlan: SavedPlan = {
    ...data,
    id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };

  const updated = [newPlan, ...current];
  cachedPlans = updated;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    notify();
  } catch {
    // quota exceeded fallback
  }

  return { ok: true, plan: newPlan };
}

export function deleteSavedPlan(id: string): SavedPlan | null {
  const current = getSavedPlans();
  const target = current.find((p) => p.id === id) ?? null;
  if (!target) return null;

  const updated = current.filter((p) => p.id !== id);
  cachedPlans = updated;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    notify();
  } catch {}

  return target;
}

export function restoreSavedPlan(plan: SavedPlan): void {
  const current = getSavedPlans();
  if (current.some((p) => p.id === plan.id)) return;
  const updated = [plan, ...current].slice(0, MAX_SAVED_PLANS);
  cachedPlans = updated;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    notify();
  } catch {}
}
