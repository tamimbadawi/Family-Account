import { describe, expect, it } from 'vitest';
import { chunk, findOrphanReceipts } from './orphans';

describe('findOrphanReceipts', () => {
  const sampleStorage = [
    'household-1/receipt-a.jpg',
    'household-1/receipt-b.jpg',
    'household-1/receipt-c.jpg',
    'household-2/receipt-d.webp',
  ];

  it('identifies storage objects with no matching live row', () => {
    const live = ['household-1/receipt-a.jpg', 'household-2/receipt-d.webp'];
    const orphans = findOrphanReceipts(sampleStorage, live);

    expect(orphans).toEqual([
      'household-1/receipt-b.jpg',
      'household-1/receipt-c.jpg',
    ]);
  });

  it('returns empty array when all storage objects have live rows', () => {
    const live = [
      'household-1/receipt-a.jpg',
      'household-1/receipt-b.jpg',
      'household-1/receipt-c.jpg',
      'household-2/receipt-d.webp',
      'household-2/receipt-extra.jpg',
    ];
    const orphans = findOrphanReceipts(sampleStorage, live);
    expect(orphans).toEqual([]);
  });

  it('returns empty array when storage is empty', () => {
    const live = ['household-1/receipt-a.jpg'];
    expect(findOrphanReceipts([], live)).toEqual([]);
  });

  it('NEVER deletes anything when live list is empty because of an error', () => {
    // 1. dbError flag passed
    expect(
      findOrphanReceipts(sampleStorage, [], { dbError: new Error('Postgres connection timeout') })
    ).toEqual([]);

    expect(
      findOrphanReceipts(sampleStorage, [], { dbError: true })
    ).toEqual([]);

    // 2. livePhotoPaths is null or undefined
    expect(findOrphanReceipts(sampleStorage, null)).toEqual([]);
    expect(findOrphanReceipts(sampleStorage, undefined)).toEqual([]);
  });

  it('works when livePhotoPaths is passed as a Set', () => {
    const liveSet = new Set(['household-1/receipt-a.jpg']);
    const orphans = findOrphanReceipts(sampleStorage, liveSet);
    expect(orphans).toEqual([
      'household-1/receipt-b.jpg',
      'household-1/receipt-c.jpg',
      'household-2/receipt-d.webp',
    ]);
  });

  it('handles empty strings and falsy paths safely', () => {
    const storageWithEmpty = ['', 'household-1/valid.jpg', 'household-1/orphan.jpg'];
    const live = ['household-1/valid.jpg'];
    expect(findOrphanReceipts(storageWithEmpty, live)).toEqual(['household-1/orphan.jpg']);
  });
});

describe('chunk', () => {
  it('splits array into batches of specified size', () => {
    const items = Array.from({ length: 250 }, (_, i) => `item-${i}`);
    const batches = chunk(items, 100);

    expect(batches).toHaveLength(3);
    expect(batches[0]).toHaveLength(100);
    expect(batches[1]).toHaveLength(100);
    expect(batches[2]).toHaveLength(50);
  });

  it('handles array smaller than chunk size', () => {
    const items = ['a', 'b', 'c'];
    const batches = chunk(items, 100);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toEqual(['a', 'b', 'c']);
  });

  it('handles empty array', () => {
    expect(chunk([], 100)).toEqual([]);
  });
});
