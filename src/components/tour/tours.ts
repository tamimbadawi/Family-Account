/**
 * Guided tours: a spotlight moves to one part of the screen at a time and a short bubble says
 * what it is for. Each step points at an element marked `data-tour="<target>"`; its words live
 * in messages/<locale>/tour.json under `<tourId>.<stepId>.title` and `.body`.
 */

export type TourId = 'welcome' | 'addEntry' | 'money' | 'history' | 'reports' | 'settings';

export interface TourStep {
  id: string;
  /** `data-tour` value to point at; no target shows the bubble in the middle of the screen. */
  target?: string;
  /** Screen the step lives on (without the locale); the tour goes there first. */
  route?: string;
  /** True while the Add sheet must be open for this step. */
  sheet?: boolean;
}

export const TOURS: Record<TourId, TourStep[]> = {
  welcome: [
    { id: 'hello', route: '/' },
    { id: 'spent', route: '/', target: 'home-spent' },
    { id: 'money', route: '/', target: 'our-money' },
    { id: 'add', route: '/', target: 'tab-add' },
    { id: 'history', route: '/', target: 'tab-history' },
    { id: 'reports', route: '/', target: 'tab-reports' },
    { id: 'help', route: '/', target: 'help-button' },
  ],
  addEntry: [
    { id: 'plus', target: 'tab-add' },
    { id: 'type', target: 'entry-type', sheet: true },
    { id: 'amount', target: 'entry-amount', sheet: true },
    { id: 'category', target: 'entry-category', sheet: true },
    { id: 'details', target: 'entry-details', sheet: true },
    { id: 'save', target: 'entry-save', sheet: true },
  ],
  money: [
    { id: 'toSpend', route: '/', target: 'money-to-spend' },
    { id: 'saved', route: '/', target: 'money-saved' },
    { id: 'tabs', route: '/money', target: 'money-tabs' },
    { id: 'goals', route: '/money' },
    { id: 'investments', route: '/money' },
    { id: 'value', route: '/money' },
  ],
  history: [
    { id: 'search', route: '/history', target: 'history-search' },
    { id: 'period', route: '/history', target: 'history-period' },
    { id: 'filter', route: '/history', target: 'history-filter' },
    { id: 'list', route: '/history', target: 'history-list' },
  ],
  reports: [
    { id: 'tabs', route: '/reports', target: 'reports-tabs' },
    { id: 'overview', route: '/reports', target: 'reports-body' },
  ],
  settings: [
    { id: 'lists', route: '/settings', target: 'settings-lists' },
    { id: 'more', route: '/settings', target: 'settings-more' },
    { id: 'support', route: '/settings', target: 'settings-support' },
  ],
};

/** The order guides are listed in the Help sheet. */
export const GUIDE_ORDER: TourId[] = ['welcome', 'addEntry', 'money', 'history', 'reports', 'settings'];

/** Which guide fits the screen the person is on, listed first in the Help sheet. */
export function guideForPath(pathname: string): TourId {
  if (pathname.startsWith('/money')) return 'money';
  if (pathname.startsWith('/history')) return 'history';
  if (pathname.startsWith('/reports')) return 'reports';
  if (pathname.startsWith('/settings')) return 'settings';
  return 'addEntry';
}

export function isTourId(value: string | null | undefined): value is TourId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(TOURS, value);
}
