import { describe, expect, it } from 'vitest';
import { validateEntry } from './entry';

describe('entrySchema validation', () => {
  it('validates a valid expense entry', () => {
    const res = validateEntry({
      type: 'expense',
      amount: 150,
      occurredOn: '2026-10-06',
      accountId: 'wallet-1',
      itemId: 'item-1',
    });
    expect(res.success).toBe(true);
  });

  it('rejects an expense without an item', () => {
    const res = validateEntry({
      type: 'expense',
      amount: 150,
      occurredOn: '2026-10-06',
      accountId: 'wallet-1',
    });
    expect(res.success).toBe(false);
  });

  it('validates a valid transfer entry', () => {
    const res = validateEntry({
      type: 'transfer',
      amount: 500,
      occurredOn: '2026-10-06',
      accountId: 'wallet-1',
      toAccountId: 'wallet-2',
    });
    expect(res.success).toBe(true);
  });

  it('rejects a transfer between the same wallet', () => {
    const res = validateEntry({
      type: 'transfer',
      amount: 500,
      occurredOn: '2026-10-06',
      accountId: 'wallet-1',
      toAccountId: 'wallet-1',
    });
    expect(res.success).toBe(false);
  });

  it('rejects zero or negative amount', () => {
    const res = validateEntry({
      type: 'expense',
      amount: 0,
      occurredOn: '2026-10-06',
      accountId: 'wallet-1',
      itemId: 'item-1',
    });
    expect(res.success).toBe(false);
  });
});
