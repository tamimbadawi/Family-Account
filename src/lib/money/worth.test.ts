import { describe, expect, it } from 'vitest';
import { investmentWorth } from './worth';

describe('investmentWorth', () => {
  it('no values, putIn 80000 -> worth 80000, gain 0, lastValuedOn null', () => {
    const result = investmentWorth({
      putIn: 80000,
      values: [],
      moves: [],
    });
    expect(result).toEqual({
      worth: 80000,
      gain: 0,
      lastValuedOn: null,
    });
  });

  it('putIn 80000, value 96000 -> worth 96000, gain 16000', () => {
    const result = investmentWorth({
      putIn: 80000,
      values: [
        {
          value: 96000,
          createdAt: '2026-10-01T10:00:00.000Z',
          valuedOn: '2026-10-01',
          deletedAt: null,
        },
      ],
      moves: [],
    });
    expect(result).toEqual({
      worth: 96000,
      gain: 16000,
      lastValuedOn: '2026-10-01',
    });
  });

  it('putIn 90000 (80000 then +10000 AFTER the value 96000) -> worth 106000, gain 16000', () => {
    const result = investmentWorth({
      putIn: 90000,
      values: [
        {
          value: 96000,
          createdAt: '2026-10-01T10:00:00.000Z',
          valuedOn: '2026-10-01',
          deletedAt: null,
        },
      ],
      moves: [
        {
          signedAmount: 10000,
          createdAt: '2026-10-05T10:00:00.000Z',
        },
      ],
    });
    expect(result).toEqual({
      worth: 106000,
      gain: 16000,
      lastValuedOn: '2026-10-01',
    });
  });

  it('a +10000 move BEFORE the value 96000 is not added again -> worth 96000', () => {
    const result = investmentWorth({
      putIn: 90000,
      values: [
        {
          value: 96000,
          createdAt: '2026-10-05T10:00:00.000Z',
          valuedOn: '2026-10-05',
          deletedAt: null,
        },
      ],
      moves: [
        {
          signedAmount: 10000,
          createdAt: '2026-10-01T10:00:00.000Z',
        },
      ],
    });
    expect(result).toEqual({
      worth: 96000,
      gain: 6000,
      lastValuedOn: '2026-10-05',
    });
  });

  it('value 96000, then a -96000 move after it, putIn -16000 -> worth 0, gain 16000', () => {
    const result = investmentWorth({
      putIn: -16000,
      values: [
        {
          value: 96000,
          createdAt: '2026-10-01T10:00:00.000Z',
          valuedOn: '2026-10-01',
          deletedAt: null,
        },
      ],
      moves: [
        {
          signedAmount: -96000,
          createdAt: '2026-10-05T10:00:00.000Z',
        },
      ],
    });
    expect(result).toEqual({
      worth: 0,
      gain: 16000,
      lastValuedOn: '2026-10-01',
    });
  });

  it('a deleted latest value is ignored, the previous one is used', () => {
    const result = investmentWorth({
      putIn: 80000,
      values: [
        {
          value: 90000,
          createdAt: '2026-10-01T10:00:00.000Z',
          valuedOn: '2026-10-01',
          deletedAt: null,
        },
        {
          value: 120000,
          createdAt: '2026-10-05T10:00:00.000Z',
          valuedOn: '2026-10-05',
          deletedAt: '2026-10-06T10:00:00.000Z',
        },
      ],
      moves: [],
    });
    expect(result).toEqual({
      worth: 90000,
      gain: 10000,
      lastValuedOn: '2026-10-01',
    });
  });

  it('value 70000 with putIn 80000 -> gain -10000', () => {
    const result = investmentWorth({
      putIn: 80000,
      values: [
        {
          value: 70000,
          createdAt: '2026-10-01T10:00:00.000Z',
          valuedOn: '2026-10-01',
          deletedAt: null,
        },
      ],
      moves: [],
    });
    expect(result).toEqual({
      worth: 70000,
      gain: -10000,
      lastValuedOn: '2026-10-01',
    });
  });

  describe('unit-based investments', () => {
    it('unit account with no price (worth = putIn)', () => {
      const result = investmentWorth({
        putIn: 80000,
        unit: 'gram',
        openingQuantity: 20,
        values: [],
        moves: [],
      });
      expect(result).toEqual({
        worth: 80000,
        gain: 0,
        lastValuedOn: null,
        quantity: 20,
        unitPrice: null,
      });
    });

    it('with a price', () => {
      const result = investmentWorth({
        putIn: 80000,
        unit: 'gram',
        openingQuantity: 20,
        values: [
          {
            unitPrice: 4800,
            value: 96000,
            createdAt: '2026-10-01T10:00:00.000Z',
            valuedOn: '2026-10-01',
            deletedAt: null,
          },
        ],
        moves: [],
      });
      expect(result).toEqual({
        worth: 96000,
        gain: 16000,
        lastValuedOn: '2026-10-01',
        quantity: 20,
        unitPrice: 4800,
      });
    });

    it('buy more', () => {
      const result = investmentWorth({
        putIn: 128000,
        unit: 'gram',
        openingQuantity: 20,
        values: [
          {
            unitPrice: 5000,
            value: 100000,
            createdAt: '2026-10-01T10:00:00.000Z',
            valuedOn: '2026-10-01',
            deletedAt: null,
          },
        ],
        moves: [
          {
            signedAmount: 48000,
            signedQuantity: 10,
            createdAt: '2026-10-05T10:00:00.000Z',
          },
        ],
      });
      // 20 + 10 = 30 g, worth = 30 * 5000 = 150000, gain = 150000 - 128000 = 22000
      expect(result).toEqual({
        worth: 150000,
        gain: 22000,
        lastValuedOn: '2026-10-01',
        quantity: 30,
        unitPrice: 5000,
      });
    });

    it('sell some', () => {
      const result = investmentWorth({
        putIn: 55000,
        unit: 'gram',
        openingQuantity: 20,
        values: [
          {
            unitPrice: 5000,
            value: 100000,
            createdAt: '2026-10-01T10:00:00.000Z',
            valuedOn: '2026-10-01',
            deletedAt: null,
          },
        ],
        moves: [
          {
            signedAmount: -25000,
            signedQuantity: -5,
            createdAt: '2026-10-05T10:00:00.000Z',
          },
        ],
      });
      // 20 - 5 = 15 g, worth = 15 * 5000 = 75000, gain = 75000 - 55000 = 20000
      expect(result).toEqual({
        worth: 75000,
        gain: 20000,
        lastValuedOn: '2026-10-01',
        quantity: 15,
        unitPrice: 5000,
      });
    });

    it('sell all (worth 0)', () => {
      const result = investmentWorth({
        putIn: -20000,
        unit: 'gram',
        openingQuantity: 20,
        values: [
          {
            unitPrice: 5000,
            value: 100000,
            createdAt: '2026-10-01T10:00:00.000Z',
            valuedOn: '2026-10-01',
            deletedAt: null,
          },
        ],
        moves: [
          {
            signedAmount: -100000,
            signedQuantity: -20,
            createdAt: '2026-10-05T10:00:00.000Z',
          },
        ],
      });
      // 20 - 20 = 0 g, worth = 0, gain = 0 - (-20000) = 20000
      expect(result).toEqual({
        worth: 0,
        gain: 20000,
        lastValuedOn: '2026-10-01',
        quantity: 0,
        unitPrice: 5000,
      });
    });

    it('deleted price row ignored', () => {
      const result = investmentWorth({
        putIn: 80000,
        unit: 'gram',
        openingQuantity: 20,
        values: [
          {
            unitPrice: 4800,
            value: 96000,
            createdAt: '2026-10-01T10:00:00.000Z',
            valuedOn: '2026-10-01',
            deletedAt: null,
          },
          {
            unitPrice: 6000,
            value: 120000,
            createdAt: '2026-10-05T10:00:00.000Z',
            valuedOn: '2026-10-05',
            deletedAt: '2026-10-06T10:00:00.000Z',
          },
        ],
        moves: [],
      });
      expect(result).toEqual({
        worth: 96000,
        gain: 16000,
        lastValuedOn: '2026-10-01',
        quantity: 20,
        unitPrice: 4800,
      });
    });

    it('unit null unchanged', () => {
      const result = investmentWorth({
        putIn: 80000,
        unit: null,
        values: [
          {
            value: 96000,
            createdAt: '2026-10-01T10:00:00.000Z',
            valuedOn: '2026-10-01',
            deletedAt: null,
          },
        ],
        moves: [],
      });
      expect(result).toEqual({
        worth: 96000,
        gain: 16000,
        lastValuedOn: '2026-10-01',
      });
    });
  });
});
