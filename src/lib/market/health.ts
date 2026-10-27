import { calculate, HANDLED_PAYOUTS } from '../calc';
import {
  effectiveConfidence,
  findBankForOffer,
  findManagerForFund,
  toCairoCalendarDate,
} from '../confidence';
import { parseCSVToRecords } from './csv';
import {
  CONFIDENCE_VALUES,
  HANDLED_ACTIVE,
  HANDLED_CURRENCIES,
  HANDLED_FUND_TYPES,
  HANDLED_OFFER_TYPES,
  HANDLED_RATE_KINDS,
  HANDLED_RISKS,
  HANDLED_SHARIA,
  rawBankSchema,
  rawFundSchema,
  rawManagerSchema,
  rawOfferSchema,
  transformBank,
  transformFund,
  transformManager,
  transformOffer,
} from './schemas';
import type { Bank, Fund, Manager, Offer } from './types';

export interface HealthIssue {
  kind: 'problem' | 'note';
  tab: string;
  id: string;
  column?: string;
  message: string;
  line: string;
}

export interface TabStats {
  read: number;
  active: number;
  dropped: number;
  problems: number;
  notes: number;
}

export interface HealthReport {
  issues: HealthIssue[];
  problems: HealthIssue[];
  notes: HealthIssue[];
  stats: Record<string, TabStats>;
  summaryLine: string;
  ok: boolean;
}

function isValidHttpUrl(urlStr: string): boolean {
  if (!urlStr || urlStr.trim() === '') return false;
  try {
    const u = new URL(urlStr.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidDateFormat(dateStr: string): boolean {
  const trimmed = dateStr.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;
  const parts = trimmed.split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

export function checkDataHealth({
  offersCsv,
  fundsCsv,
  banksCsv,
  managersCsv,
  today = new Date(),
}: {
  offersCsv: string;
  fundsCsv: string;
  banksCsv: string;
  managersCsv: string;
  today?: Date | string;
}): HealthReport {
  const issues: HealthIssue[] = [];
  const todayCairo = toCairoCalendarDate(today);

  const stats: Record<string, TabStats> = {
    offers: { read: 0, active: 0, dropped: 0, problems: 0, notes: 0 },
    funds: { read: 0, active: 0, dropped: 0, problems: 0, notes: 0 },
    banks: { read: 0, active: 0, dropped: 0, problems: 0, notes: 0 },
    managers: { read: 0, active: 0, dropped: 0, problems: 0, notes: 0 },
  };

  function addProblem(tab: string, id: string, column: string, message: string, value?: string) {
    const valDisplay = value !== undefined ? ` (value: '${value}')` : '';
    const line = `[problem] ${tab} ${id || 'unknown'} column '${column}': ${message}${valDisplay}`;
    const issue: HealthIssue = { kind: 'problem', tab, id, column, message, line };
    issues.push(issue);
    stats[tab].problems++;
  }

  function addDropped(tab: string, id: string, column: string, message: string, value?: string) {
    const valDisplay = value !== undefined ? ` (value: '${value}')` : '';
    const line = `[dropped-row] ${tab} ${id || 'unknown'} column '${column}': ${message}${valDisplay}`;
    const issue: HealthIssue = { kind: 'problem', tab, id, column, message, line };
    issues.push(issue);
    stats[tab].dropped++;
    stats[tab].problems++;
  }

  function addNote(tab: string, id: string, message: string) {
    const line = `[note] ${tab} ${id}: ${message}`;
    const issue: HealthIssue = { kind: 'note', tab, id, message, line };
    issues.push(issue);
    stats[tab].notes++;
  }

  // Common checkers
  function checkDateColumn(tab: string, id: string, col: string, val: string | undefined): boolean {
    if (!val || val.trim() === '') return false;
    const trimmed = val.trim();
    if (!isValidDateFormat(trimmed)) {
      addProblem(tab, id, col, 'date is not strict YYYY-MM-DD', val);
      return true; // flagged as bad date
    }
    if (todayCairo) {
      const rowCairo = toCairoCalendarDate(trimmed);
      if (rowCairo && rowCairo.getTime() > todayCairo.getTime()) {
        addProblem(tab, id, col, 'date is in the future', val);
        return true; // flagged as future date
      }
    }
    return false;
  }

  function checkUrlColumn(tab: string, id: string, col: string, val: string | undefined) {
    if (!val || val.trim() === '') return;
    if (!isValidHttpUrl(val)) {
      addProblem(tab, id, col, 'not a valid http(s) URL', val);
    }
  }

  function checkNumericColumn(
    tab: string,
    id: string,
    col: string,
    val: string | undefined,
    opts?: { min?: number; max?: number; allowZero?: boolean }
  ) {
    if (!val || val.trim() === '') return;
    const clean = val.replace(/,/g, '').trim();
    const num = Number(clean);
    if (Number.isNaN(num) || !Number.isFinite(num)) {
      addProblem(tab, id, col, 'present but not a number', val);
      return;
    }
    if (opts?.min !== undefined && num < opts.min) {
      addProblem(tab, id, col, `number must be >= ${opts.min}`, val);
    }
    if (opts?.max !== undefined && num > opts.max) {
      addProblem(tab, id, col, `number must be <= ${opts.max}`, val);
    }
  }

  // --- 1. Banks ---
  const rawBanks = parseCSVToRecords(banksCsv);
  stats.banks.read = rawBanks.length;
  const activeBanks: Bank[] = [];
  const seenBankCodes = new Set<string>();

  for (const b of rawBanks) {
    const id = b.code ? b.code.trim().toLowerCase() : '';

    // Check active on every row of the tab before filtering
    if (b.active && !HANDLED_ACTIVE.includes(b.active.trim().toUpperCase() as 'TRUE')) {
      addProblem('banks', id, 'active', 'unhandled active value', b.active);
    }

    const active = (b.active || 'TRUE').trim().toUpperCase();
    const country = (b.country || '').trim().toUpperCase();
    if (active !== 'TRUE' || country !== 'EG') continue;
    stats.banks.active++;

    if (!id) {
      addDropped('banks', '', 'code', 'Bank code is missing', b.code);
      continue;
    }

    if (seenBankCodes.has(id)) {
      addProblem('banks', id, 'code', 'duplicate id', id);
    }
    seenBankCodes.add(id);

    // Schema validation
    const parsed = rawBankSchema.safeParse(b);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const col = issue.path.join('.') || 'row';
        addDropped('banks', id, col, issue.message, b[col] ?? '');
      }
      continue;
    }

    // Date check
    checkDateColumn('banks', id, 'checked_on', b.checked_on);
    // URL checks
    checkUrlColumn('banks', id, 'website', b.website);
    checkUrlColumn('banks', id, 'logo_url', b.logo_url);
    checkUrlColumn('banks', id, 'source_url', b.source_url);

    // Missing source: website does NOT count as a source
    if (!b.source_url || b.source_url.trim() === '') {
      addProblem('banks', id, 'source_url', 'missing source', '');
    }

    activeBanks.push(transformBank(parsed.data));
  }

  if (stats.banks.active === 0) {
    const line = `[problem] banks: no active rows`;
    issues.push({ kind: 'problem', tab: 'banks', id: '', message: 'no active rows', line });
    stats.banks.problems++;
  }

  // --- 2. Managers ---
  const rawManagers = parseCSVToRecords(managersCsv);
  stats.managers.read = rawManagers.length;
  const activeManagers: Manager[] = [];
  const seenManagerIds = new Set<string>();

  for (const m of rawManagers) {
    const id = m.manager_ar ? m.manager_ar.trim() : (m.manager_en ? m.manager_en.trim() : '');

    // Check active if column exists
    if (m.active && !HANDLED_ACTIVE.includes(m.active.trim().toUpperCase() as 'TRUE')) {
      addProblem('managers', id, 'active', 'unhandled active value', m.active);
    }

    const country = (m.country || '').trim().toUpperCase();
    if (country !== 'EG') continue;
    stats.managers.active++;

    if (!id) {
      addDropped('managers', '', 'manager_ar', 'Manager name is missing', '');
      continue;
    }

    if (seenManagerIds.has(id)) {
      addProblem('managers', id, 'manager_ar', 'duplicate id', id);
    }
    seenManagerIds.add(id);

    const parsed = rawManagerSchema.safeParse(m);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const col = issue.path.join('.') || 'row';
        addDropped('managers', id, col, issue.message, m[col] ?? '');
      }
      continue;
    }

    // Date check
    checkDateColumn('managers', id, 'checked_on', m.checked_on);
    // URL checks
    checkUrlColumn('managers', id, 'website', m.website);
    checkUrlColumn('managers', id, 'logo_url', m.logo_url);
    checkUrlColumn('managers', id, 'source_url', m.source_url);

    // Missing source on managers, same as banks (website does NOT count)
    if (!m.source_url || m.source_url.trim() === '') {
      addProblem('managers', id, 'source_url', 'missing source', '');
    }

    activeManagers.push(transformManager(parsed.data));
  }

  if (stats.managers.active === 0) {
    const line = `[problem] managers: no active rows`;
    issues.push({ kind: 'problem', tab: 'managers', id: '', message: 'no active rows', line });
    stats.managers.problems++;
  }

  // --- 3. Offers ---
  const rawOffers = parseCSVToRecords(offersCsv);
  stats.offers.read = rawOffers.length;
  const seenOfferIds = new Set<string>();

  for (const o of rawOffers) {
    const id = (o.id || '').trim();

    // Check active on every row of the tab before filter
    if (o.active && !HANDLED_ACTIVE.includes(o.active.trim().toUpperCase() as 'TRUE')) {
      addProblem('offers', id, 'active', 'unhandled active value', o.active);
    }

    const active = (o.active || '').trim().toUpperCase();
    const country = (o.country || '').trim().toUpperCase();
    if (active !== 'TRUE' || country !== 'EG') continue;
    stats.offers.active++;

    if (!id) {
      addDropped('offers', '', 'id', 'Offer id is missing', o.id);
      continue;
    }

    if (seenOfferIds.has(id)) {
      addProblem('offers', id, 'id', 'duplicate id', id);
    }
    seenOfferIds.add(id);

    // Run real schema safeParse
    const parsed = rawOfferSchema.safeParse(o);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const col = issue.path.join('.') || 'row';
        addDropped('offers', id, col, issue.message, o[col] ?? '');
      }
      continue;
    }

    // Dates check
    checkDateColumn('offers', id, 'checked_on', o.checked_on);
    const pubColToCheck = (o.published_on && o.published_on.trim() !== '') ? 'published_on' : 'checked_on';
    const pubValToCheck = (o.published_on && o.published_on.trim() !== '') ? o.published_on : o.checked_on;
    // Check published_on date (or checked_on if acting as published_on)
    let publishedDateProblem = false;
    if (pubColToCheck === 'published_on') {
      publishedDateProblem = checkDateColumn('offers', id, 'published_on', o.published_on);
    } else if (pubValToCheck && pubValToCheck.trim() !== '') {
      const trimmed = pubValToCheck.trim();
      if (!isValidDateFormat(trimmed)) {
        addProblem('offers', id, 'published_on', 'date is not strict YYYY-MM-DD', pubValToCheck);
        publishedDateProblem = true;
      } else if (todayCairo) {
        const rowCairo = toCairoCalendarDate(trimmed);
        if (rowCairo && rowCairo.getTime() > todayCairo.getTime()) {
          addProblem('offers', id, 'published_on', 'date is in the future', pubValToCheck);
          publishedDateProblem = true;
        }
      }
    }

    // Numeric checks
    checkNumericColumn('offers', id, 'rate_percent', o.rate_percent, { min: 0, max: 100 });
    checkNumericColumn('offers', id, 'term_months', o.term_months, { min: 1 });
    checkNumericColumn('offers', id, 'term_days', o.term_days, { min: 1 });
    checkNumericColumn('offers', id, 'min_amount', o.min_amount, { min: 0 });

    // URLs check
    checkUrlColumn('offers', id, 'source_url', o.source_url);

    // Track column-level causes that affect calculation
    let hadCalcColumnCause = false;

    // Check empty term_months or empty payout for certificates
    const offerType = o.type ? o.type.trim().toLowerCase() : '';
    if (offerType === 'certificate') {
      if (!o.term_months || o.term_months.trim() === '') {
        addProblem('offers', id, 'term_months', 'empty term_months on certificate');
        hadCalcColumnCause = true;
      }
      if (!o.payout || o.payout.trim() === '') {
        addProblem('offers', id, 'payout', 'empty payout on certificate');
        hadCalcColumnCause = true;
      }
    }

    // Enumerated values check against consuming code
    if (o.type && !HANDLED_OFFER_TYPES.includes(o.type.trim().toLowerCase() as 'certificate')) {
      addProblem('offers', id, 'type', 'unhandled offer type', o.type);
    }
    if (o.rate_kind && !HANDLED_RATE_KINDS.includes(o.rate_kind.trim().toLowerCase() as 'fixed')) {
      addProblem('offers', id, 'rate_kind', 'unhandled rate_kind', o.rate_kind);
    }
    if (o.payout && !HANDLED_PAYOUTS.includes(o.payout.trim().toLowerCase() as 'daily')) {
      addProblem('offers', id, 'payout', 'unhandled payout value', o.payout);
      hadCalcColumnCause = true;
    }
    if (o.currency && !HANDLED_CURRENCIES.includes(o.currency.trim().toUpperCase() as 'EGP')) {
      addProblem('offers', id, 'currency', 'unhandled currency value', o.currency);
    }
    if (o.confidence && !CONFIDENCE_VALUES.includes(o.confidence.trim().toLowerCase() as 'single')) {
      addProblem('offers', id, 'confidence', 'unhandled confidence value', o.confidence);
    }

    // Missing source
    const hasSource =
      (o.sources && o.sources.trim() !== '') || (o.source_url && o.source_url.trim() !== '');
    if (!hasSource) {
      addProblem('offers', id, 'source_url', 'missing source', '');
    }

    // Transform offer using real pipeline
    const transformedOffer: Offer = transformOffer(parsed.data);

    // Bank lookup via app's own bankCode and findBankForOffer
    const matchedBank = findBankForOffer(transformedOffer, activeBanks);
    if (!matchedBank) {
      addProblem(
        'offers',
        id,
        'bank_code',
        `bank code '${transformedOffer.bankCode}' not found in active banks`,
        transformedOffer.bankCode
      );
    }

    // Treasury bill days check
    if (transformedOffer.type === 'tbill') {
      const match = id.match(/-(\d+)d\b/i) || id.match(/^tbill-(\d+)d/i);
      if (transformedOffer.termDays == null && !match) {
        addProblem('offers', id, 'term_days', 'treasury bill has neither term_days nor days in id', id);
        hadCalcColumnCause = true;
      }
    }

    // Calculation check: run through calculate(offer, max(minAmount, 100000))
    const calcAmount = Math.max(transformedOffer.minAmount ?? 0, 100000);
    const calcRes = calculate(transformedOffer, calcAmount);
    if (!calcRes.ok && calcRes.reason === 'notCalculable') {
      if (!hadCalcColumnCause) {
        addProblem('offers', id, 'calculate', 'calculation returned notCalculable', id);
      }
    } else if (calcRes.ok && calcRes.assumptions.includes('firstYearOnly')) {
      addNote('offers', id, 'stepped certificate fell back to firstYearOnly');
    }

    // Out of date today: only print if date itself was valid and not already flagged as bad/future
    if (todayCairo && !publishedDateProblem) {
      const sheetConf = o.confidence ? o.confidence.trim().toLowerCase() : 'single';
      if (sheetConf !== 'stale') {
        const effConf = effectiveConfidence(transformedOffer, todayCairo);
        if (effConf === 'stale') {
          addProblem('offers', id, 'published_on', 'out of date today', transformedOffer.publishedOn);
        }
      }
    }
  }

  if (stats.offers.active === 0) {
    const line = `[problem] offers: no active rows`;
    issues.push({ kind: 'problem', tab: 'offers', id: '', message: 'no active rows', line });
    stats.offers.problems++;
  }

  // --- 4. Funds ---
  const rawFunds = parseCSVToRecords(fundsCsv);
  stats.funds.read = rawFunds.length;
  const seenFundIds = new Set<string>();

  for (const f of rawFunds) {
    const id = (f.id || '').trim();

    // Check active on every row of the tab before filter
    if (f.active && !HANDLED_ACTIVE.includes(f.active.trim().toUpperCase() as 'TRUE')) {
      addProblem('funds', id, 'active', 'unhandled active value', f.active);
    }

    const active = (f.active || '').trim().toUpperCase();
    const country = (f.country || '').trim().toUpperCase();
    if (active !== 'TRUE' || country !== 'EG') continue;
    stats.funds.active++;

    if (!id) {
      addDropped('funds', '', 'id', 'Fund id is missing', f.id);
      continue;
    }

    if (seenFundIds.has(id)) {
      addProblem('funds', id, 'id', 'duplicate id', id);
    }
    seenFundIds.add(id);

    // Real schema safeParse
    const parsed = rawFundSchema.safeParse(f);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const col = issue.path.join('.') || 'row';
        addDropped('funds', id, col, issue.message, f[col] ?? '');
      }
      continue;
    }

    // Dates check
    checkDateColumn('funds', id, 'price_date', f.price_date);
    checkDateColumn('funds', id, 'checked_on', f.checked_on);
    const pubFundCol = (f.published_on && f.published_on.trim() !== '') ? 'published_on' : 'checked_on';
    const pubFundVal = (f.published_on && f.published_on.trim() !== '') ? f.published_on : f.checked_on;
    let fundPubProblem = false;
    if (pubFundCol === 'published_on') {
      fundPubProblem = checkDateColumn('funds', id, 'published_on', f.published_on);
    } else if (pubFundVal && pubFundVal.trim() !== '') {
      const trimmed = pubFundVal.trim();
      if (!isValidDateFormat(trimmed)) {
        addProblem('funds', id, 'published_on', 'date is not strict YYYY-MM-DD', pubFundVal);
        fundPubProblem = true;
      } else if (todayCairo) {
        const rowCairo = toCairoCalendarDate(trimmed);
        if (rowCairo && rowCairo.getTime() > todayCairo.getTime()) {
          addProblem('funds', id, 'published_on', 'date is in the future', pubFundVal);
          fundPubProblem = true;
        }
      }
    }

    // Numerics check
    checkNumericColumn('funds', id, 'price', f.price, { min: 0.000001 });
    checkNumericColumn('funds', id, 'change_30d_percent', f.change_30d_percent);
    checkNumericColumn('funds', id, 'change_ytd_percent', f.change_ytd_percent);

    // URLs check
    checkUrlColumn('funds', id, 'source_url', f.source_url);

    // Enums check
    if (f.fund_type && !HANDLED_FUND_TYPES.includes(f.fund_type.trim().toLowerCase() as 'equity')) {
      addProblem('funds', id, 'fund_type', 'unhandled fund_type value', f.fund_type);
    }
    if (f.risk && !HANDLED_RISKS.includes(f.risk.trim().toLowerCase() as 'low')) {
      addProblem('funds', id, 'risk', 'unhandled risk value', f.risk);
    }
    if (f.currency && !HANDLED_CURRENCIES.includes(f.currency.trim().toUpperCase() as 'EGP')) {
      addProblem('funds', id, 'currency', 'unhandled currency value', f.currency);
    }
    if (f.confidence && !CONFIDENCE_VALUES.includes(f.confidence.trim().toLowerCase() as 'single')) {
      addProblem('funds', id, 'confidence', 'unhandled confidence value', f.confidence);
    }
    if (f.sharia && !HANDLED_SHARIA.includes(f.sharia.trim().toUpperCase() as 'TRUE')) {
      addProblem('funds', id, 'sharia', 'unhandled sharia value', f.sharia);
    }

    // Missing source
    const hasSource =
      (f.sources && f.sources.trim() !== '') || (f.source_url && f.source_url.trim() !== '');
    if (!hasSource) {
      addProblem('funds', id, 'source_url', 'missing source', '');
    }

    // Transform fund
    const transformedFund: Fund = transformFund(parsed.data);

    // Manager lookup
    const matchedManager = findManagerForFund(transformedFund, activeManagers);
    if (!matchedManager) {
      addProblem(
        'funds',
        id,
        'manager_ar',
        `manager '${transformedFund.managerAr}' not found in active managers`,
        transformedFund.managerAr
      );
    }

    // Out of date today: only print if date itself was valid and not already flagged
    if (todayCairo && !fundPubProblem) {
      const sheetConf = f.confidence ? f.confidence.trim().toLowerCase() : 'single';
      if (sheetConf !== 'stale') {
        const effConf = effectiveConfidence(transformedFund, todayCairo);
        if (effConf === 'stale') {
          addProblem('funds', id, 'published_on', 'out of date today', transformedFund.publishedOn);
        }
      }
    }
  }

  if (stats.funds.active === 0) {
    const line = `[problem] funds: no active rows`;
    issues.push({ kind: 'problem', tab: 'funds', id: '', message: 'no active rows', line });
    stats.funds.problems++;
  }

  const problems = issues.filter((i) => i.kind === 'problem');
  const notes = issues.filter((i) => i.kind === 'note');

  const summaryParts = Object.entries(stats).map(
    ([tab, s]) =>
      `${tab}: ${s.read} read, ${s.active} active, ${s.dropped} dropped, ${s.problems} problems, ${s.notes} notes`
  );
  const summaryLine = `Summary: ${summaryParts.join(' | ')}`;

  return {
    issues,
    problems,
    notes,
    stats,
    summaryLine,
    ok: problems.length === 0,
  };
}
