// =========================================================
// Reports Registry  ·  Family Accounts (حساباتنا)
// 18 reports across three groups: Money Flow, Banks & Cash, Planning
// =========================================================

export type ReportGroup = 'flow' | 'wallets' | 'planning';

export interface ReportDefinition {
  id: string;
  group: ReportGroup;
  icon: string;
  titleKey: string;
  descKey: string;
  route: string;
  isImplemented: boolean;
}

export const REPORT_GROUPS: { id: ReportGroup; titleKey: string }[] = [
  { id: 'flow', titleKey: 'groupFlow' },
  { id: 'wallets', titleKey: 'groupWallets' },
  { id: 'planning', titleKey: 'groupPlanning' },
];

export const REPORTS_REGISTRY: ReportDefinition[] = [
  // --- Group 1: Money Flow (حركة الفلوس) ---
  {
    id: 'this-vs-last-month',
    group: 'flow',
    icon: 'ArrowLeftRight',
    titleKey: 'thisVsLastMonth',
    descKey: 'thisVsLastMonthDesc',
    route: '/reports/r/this-vs-last-month',
    isImplemented: true,
  },
  {
    id: 'year-summary',
    group: 'flow',
    icon: 'BarChart3',
    titleKey: 'yearSummary',
    descKey: 'yearSummaryDesc',
    route: '/reports/r/year-summary',
    isImplemented: true,
  },
  {
    id: 'biggest-expenses',
    group: 'flow',
    icon: 'TrendingUp',
    titleKey: 'biggestExpenses',
    descKey: 'biggestExpensesDesc',
    route: '/reports/r/biggest-expenses',
    isImplemented: true,
  },
  {
    id: 'spending-calendar',
    group: 'flow',
    icon: 'Calendar',
    titleKey: 'spendingCalendar',
    descKey: 'spendingCalendarDesc',
    route: '/reports/r/spending-calendar',
    isImplemented: true,
  },
  {
    id: 'income-sources',
    group: 'flow',
    icon: 'PiggyBank',
    titleKey: 'incomeSources',
    descKey: 'incomeSourcesDesc',
    route: '/reports/r/income-sources',
    isImplemented: true,
  },
  {
    id: 'category-deep-dive',
    group: 'flow',
    icon: 'Layers',
    titleKey: 'categoryDeepDive',
    descKey: 'categoryDeepDiveDesc',
    route: '/reports/r/category-deep-dive',
    isImplemented: true,
  },

  // --- Group 2: Banks & Cash (البنوك والكاش) — Part A5d ---
  {
    id: 'net-worth',
    group: 'wallets',
    icon: 'Wallet',
    titleKey: 'netWorth',
    descKey: 'netWorthDesc',
    route: '/reports/r/net-worth',
    isImplemented: true,
  },
  {
    id: 'balance-over-time',
    group: 'wallets',
    icon: 'LineChart',
    titleKey: 'balanceOverTime',
    descKey: 'balanceOverTimeDesc',
    route: '/reports/r/balance-over-time',
    isImplemented: true,
  },
  {
    id: 'in-out-per-wallet',
    group: 'wallets',
    icon: 'ArrowDownUp',
    titleKey: 'inOutPerWallet',
    descKey: 'inOutPerWalletDesc',
    route: '/reports/r/in-out-per-wallet',
    isImplemented: true,
  },
  {
    id: 'cash-withdrawals',
    group: 'wallets',
    icon: 'Banknote',
    titleKey: 'cashWithdrawals',
    descKey: 'cashWithdrawalsDesc',
    route: '/reports/r/cash-withdrawals',
    isImplemented: true,
  },
  {
    id: 'transfers-log',
    group: 'wallets',
    icon: 'History',
    titleKey: 'transfersLog',
    descKey: 'transfersLogDesc',
    route: '/reports/r/transfers-log',
    isImplemented: true,
  },

  // --- Group 3: Planning (التخطيط) — Part A5e ---
  {
    id: 'budget-vs-actual',
    group: 'planning',
    icon: 'PiggyBank',
    titleKey: 'budgetVsActual',
    descKey: 'budgetVsActualDesc',
    route: '/reports/r/budget-vs-actual',
    isImplemented: true,
  },
  {
    id: 'bills-tracker',
    group: 'planning',
    icon: 'Receipt',
    titleKey: 'billsTracker',
    descKey: 'billsTrackerDesc',
    route: '/reports/r/bills-tracker',
    isImplemented: true,
  },
  {
    id: 'monthly-averages',
    group: 'planning',
    icon: 'Calculator',
    titleKey: 'monthlyAverages',
    descKey: 'monthlyAveragesDesc',
    route: '/reports/r/monthly-averages',
    isImplemented: true,
  },
  {
    id: 'who-spent-what',
    group: 'planning',
    icon: 'Users',
    titleKey: 'whoSpentWhat',
    descKey: 'whoSpentWhatDesc',
    route: '/reports/r/who-spent-what',
    isImplemented: true,
  },
  {
    id: 'search-export',
    group: 'planning',
    icon: 'Search',
    titleKey: 'searchExport',
    descKey: 'searchExportDesc',
    route: '/reports/r/search-export',
    isImplemented: true,
  },
  {
    id: 'unusual-spending',
    group: 'planning',
    icon: 'AlertCircle',
    titleKey: 'unusualSpending',
    descKey: 'unusualSpendingDesc',
    route: '/reports/r/unusual-spending',
    isImplemented: true,
  },
  {
    id: 'spending-pace',
    group: 'planning',
    icon: 'Gauge',
    titleKey: 'spendingPace',
    descKey: 'spendingPaceDesc',
    route: '/reports/r/spending-pace',
    isImplemented: true,
  },
];

export function getReportById(id: string): ReportDefinition | undefined {
  return REPORTS_REGISTRY.find((r) => r.id === id);
}

export function getReportsByGroup(group: ReportGroup): ReportDefinition[] {
  return REPORTS_REGISTRY.filter((r) => r.group === group);
}
