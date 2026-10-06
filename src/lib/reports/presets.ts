// =========================================================
// Pivot Presets  ·  Family Accounts (حساباتنا)
// The 5 ready-made pivot configurations from docs/PLAN.md
// =========================================================

import type { PivotConfig } from './pivot';

export type PresetPeriod = 'this-month' | 'last-3-months' | 'last-6-months' | 'this-year';

export interface PivotPreset {
  id: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  icon: string;
  periodPreset: PresetPeriod;
  config: Omit<PivotConfig, 'period'>;
  filterSubcategoryNameEn?: string;
}

export const PIVOT_PRESETS: PivotPreset[] = [
  {
    id: 'where-did-money-go',
    nameEn: 'Where did our money go?',
    nameAr: 'أين ذهبت أموالنا؟',
    descriptionEn: 'Category breakdown for this month',
    descriptionAr: 'تفاصيل المصاريف حسب الفئات لهذا الشهر',
    icon: 'pie-chart',
    periodPreset: 'this-month',
    config: {
      measure: 'expense',
      rows: 'category',
      columns: 'none',
    },
  },
  {
    id: 'month-by-month',
    nameEn: 'Month by month',
    nameAr: 'شهراً بشهر',
    descriptionEn: 'Category spending over the last 6 months',
    descriptionAr: 'تطور المصاريف عبر الستة أشهر الماضية',
    icon: 'calendar',
    periodPreset: 'last-6-months',
    config: {
      measure: 'expense',
      rows: 'category',
      columns: 'month',
    },
  },
  {
    id: 'bills-tracker',
    nameEn: 'Bills tracker',
    nameAr: 'متابعة الفواتير',
    descriptionEn: 'Utilities items month by month this year',
    descriptionAr: 'فواتير ومصاريف المرافق شهرياً طوال العام',
    icon: 'receipt',
    periodPreset: 'this-year',
    filterSubcategoryNameEn: 'Utilities',
    config: {
      measure: 'expense',
      rows: 'item',
      columns: 'month',
    },
  },
  {
    id: 'which-wallet',
    nameEn: 'Which wallet?',
    nameAr: 'من أي محفظة؟',
    descriptionEn: 'Spending by wallet over the last 3 months',
    descriptionAr: 'المصاريف حسب المحفظة في آخر 3 أشهر',
    icon: 'wallet',
    periodPreset: 'last-3-months',
    config: {
      measure: 'expense',
      rows: 'wallet',
      columns: 'month',
    },
  },
  {
    id: 'who-spent-what',
    nameEn: 'Who spent what',
    nameAr: 'من صرف ماذا',
    descriptionEn: 'Spending by person across categories this month',
    descriptionAr: 'مصاريف كل فرد حسب الفئات لهذا الشهر',
    icon: 'users',
    periodPreset: 'this-month',
    config: {
      measure: 'expense',
      rows: 'person',
      columns: 'category',
    },
  },
];

// Resolves a preset period into concrete local date boundaries
export function resolvePresetPeriod(
  presetPeriod: PresetPeriod,
  baseDate: Date = new Date()
): { from: string; to: string } {
  const y = baseDate.getFullYear();
  const m = baseDate.getMonth();

  function pad(n: number): string {
    return String(n).padStart(2, '0');
  }

  function lastDayOfMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
  }

  if (presetPeriod === 'this-month') {
    const lastDay = lastDayOfMonth(y, m);
    return {
      from: `${y}-${pad(m + 1)}-01`,
      to: `${y}-${pad(m + 1)}-${pad(lastDay)}`,
    };
  }

  if (presetPeriod === 'last-3-months') {
    const startMonthDate = new Date(y, m - 2, 1);
    const startY = startMonthDate.getFullYear();
    const startM = startMonthDate.getMonth();
    const lastDay = lastDayOfMonth(y, m);
    return {
      from: `${startY}-${pad(startM + 1)}-01`,
      to: `${y}-${pad(m + 1)}-${pad(lastDay)}`,
    };
  }

  if (presetPeriod === 'last-6-months') {
    const startMonthDate = new Date(y, m - 5, 1);
    const startY = startMonthDate.getFullYear();
    const startM = startMonthDate.getMonth();
    const lastDay = lastDayOfMonth(y, m);
    return {
      from: `${startY}-${pad(startM + 1)}-01`,
      to: `${y}-${pad(m + 1)}-${pad(lastDay)}`,
    };
  }

  // this-year
  return {
    from: `${y}-01-01`,
    to: `${y}-12-31`,
  };
}
