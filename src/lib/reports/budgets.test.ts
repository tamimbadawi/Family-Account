import { describe, expect, it } from 'vitest';
import type { Budget } from '../data/types';
import { ITEM_EXPENSE_BALANCE_CORRECTION_ID } from '../data/mock-seed';
import {
  budgetLevel,
  budgetPercent,
  budgetProgress,
  budgetThresholdCross,
  budgetTotals,
  budgetWarnings,
  messageVariant,
  type BudgetEntryLike,
} from './budgets';

const budget = (over: Partial<Budget>): Budget => ({
  id: 'b',
  householdId: 'h',
  categoryId: 'food',
  subcategoryId: null,
  amount: 1000,
  isStarter: false,
  isArchived: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...over,
});

const expense = (amount: number, over: Partial<BudgetEntryLike> = {}): BudgetEntryLike => ({
  type: 'expense',
  amount,
  occurredOn: '2026-10-05',
  categoryId: 'food',
  subcategoryId: 'groceries',
  itemId: 'bread',
  ...over,
});

describe('budgetLevel', () => {
  it('is ok under 80%, near from 80% to 100%, over above the budget', () => {
    expect(budgetLevel(799.99, 1000)).toBe('ok');
    expect(budgetLevel(800, 1000)).toBe('near');
    expect(budgetLevel(1000, 1000)).toBe('near');
    expect(budgetLevel(1000.01, 1000)).toBe('over');
  });
});

describe('budgetProgress', () => {
  it('adds up only this month’s expenses in the budget’s category', () => {
    const [p] = budgetProgress(
      [budget({})],
      [
        expense(300),
        expense(550.5, { subcategoryId: 'restaurants' }),
        expense(999, { occurredOn: '2026-09-30' }), // other month
        expense(999, { categoryId: 'transport', subcategoryId: 'fuel' }), // other category
        expense(999, { type: 'income' }),
        expense(999, { itemId: ITEM_EXPENSE_BALANCE_CORRECTION_ID }), // balance correction
      ],
      '2026-10',
    );
    expect(p.spent).toBe(850.5);
    expect(p.remaining).toBe(149.5);
    expect(p.level).toBe('near');
    expect(budgetPercent(p)).toBe(85);
  });

  it('a group budget counts only that group', () => {
    const [p] = budgetProgress(
      [budget({ subcategoryId: 'groceries', amount: 200 })],
      [expense(150), expense(150), expense(500, { subcategoryId: 'restaurants' })],
      '2026-10',
    );
    expect(p.spent).toBe(300);
    expect(p.remaining).toBe(-100);
    expect(p.level).toBe('over');
  });

  it('skips archived budgets and sorts the fullest first', () => {
    const list = budgetProgress(
      [
        budget({ id: 'a', categoryId: 'transport', amount: 1000 }),
        budget({ id: 'b', amount: 100 }),
        budget({ id: 'c', isArchived: true }),
      ],
      [expense(90), expense(100, { categoryId: 'transport', subcategoryId: 'fuel' })],
      '2026-10',
    );
    expect(list.map((p) => p.budget.id)).toEqual(['b', 'a']);
    expect(budgetWarnings(list).map((p) => p.budget.id)).toEqual(['b']);
  });
});

describe('budgetTotals', () => {
  it('does not count a group twice when its category also has a budget', () => {
    const list = budgetProgress(
      [
        budget({ id: 'food', amount: 1000 }),
        budget({ id: 'groceries', subcategoryId: 'groceries', amount: 400 }),
        budget({ id: 'fuel', categoryId: 'transport', subcategoryId: 'fuel', amount: 500 }),
      ],
      [expense(300), expense(100, { categoryId: 'transport', subcategoryId: 'fuel' })],
      '2026-10',
    );
    expect(budgetTotals(list)).toEqual({ budget: 1500, spent: 400, level: 'ok' });
  });
});

describe('messageVariant', () => {
  it('is stable for a seed and always one of the variants', () => {
    expect(messageVariant('food|2026-10-07')).toBe(messageVariant('food|2026-10-07'));
    for (let i = 0; i < 50; i++) {
      expect(['1', '2', '3']).toContain(messageVariant(`seed-${i}`));
      expect(['1', '2', '3']).toContain(messageVariant());
    }
  });
});

describe('budgetThresholdCross', () => {
  it('detects crossing 80% threshold', () => {
    // Under 80% to >= 80%
    expect(budgetThresholdCross(1000, 750, 850)).toEqual({ threshold: '80', level: 'near' });
    expect(budgetThresholdCross(1000, 799, 800)).toEqual({ threshold: '80', level: 'near' });
  });

  it('detects crossing 100% threshold', () => {
    // Under 100% to >= 100%
    expect(budgetThresholdCross(1000, 850, 1050)).toEqual({ threshold: '100', level: 'over' });
    expect(budgetThresholdCross(1000, 999, 1000)).toEqual({ threshold: '100', level: 'over' });
  });

  it('detects crossing both 80% and 100% at once and gives the stronger 100% warning', () => {
    // Jump from 50% directly to 110%
    expect(budgetThresholdCross(1000, 500, 1100)).toEqual({ threshold: '100', level: 'over' });
  });

  it('returns null when remaining in same tier', () => {
    // Still under 80%
    expect(budgetThresholdCross(1000, 500, 700)).toBeNull();
    // Already in 80-100% tier
    expect(budgetThresholdCross(1000, 850, 950)).toBeNull();
    // Already above 100% tier
    expect(budgetThresholdCross(1000, 1050, 1200)).toBeNull();
  });

  it('returns null on zero or negative budget amount', () => {
    expect(budgetThresholdCross(0, 0, 100)).toBeNull();
    expect(budgetThresholdCross(-500, 0, 100)).toBeNull();
  });
});
