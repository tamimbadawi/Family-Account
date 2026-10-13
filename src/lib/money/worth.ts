import { roundMoney } from '../data/mappers';
import type { InvestmentUnit } from '../data/types';

export interface InvestmentValueInput {
  value?: number;
  unitPrice?: number | null;
  createdAt: string;
  valuedOn: string;
  deletedAt: string | null;
}

export interface InvestmentMoveInput {
  signedAmount: number;
  signedQuantity?: number | null;
  quantity?: number | null;
  createdAt: string;
}

export interface InvestmentWorthInput {
  putIn: number;
  values: InvestmentValueInput[];
  moves: InvestmentMoveInput[];
  unit?: InvestmentUnit | null;
  openingQuantity?: number | null;
}

export interface InvestmentWorthResult {
  worth: number;
  gain: number;
  lastValuedOn: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
}

/**
 * Calculates current worth, overall gain, and last valued date for an investment account.
 * - When unit is set ('gram' | 'share'):
 *     quantity = openingQuantity + sum(transfers in) - sum(transfers out)
 *     latest price = newest non-deleted value row whose unitPrice is not null
 *     worth = latest price ? roundMoney(quantity x latest price) : putIn
 *     gain = worth - putIn
 * - When unit is null:
 *     Latest active value anchor is adjusted by any transfer moves that happened strictly after it.
 */
export function investmentWorth(input: InvestmentWorthInput): InvestmentWorthResult {
  if (input.unit) {
    const openingQuantity = input.openingQuantity ?? 0;
    let quantity = openingQuantity;
    for (const m of input.moves) {
      if (m.signedQuantity !== undefined && m.signedQuantity !== null) {
        quantity += m.signedQuantity;
      } else if (m.quantity !== undefined && m.quantity !== null) {
        quantity += m.signedAmount >= 0 ? m.quantity : -m.quantity;
      }
    }
    quantity = Math.round(quantity * 10000) / 10000;

    const activePricedValues = input.values.filter(
      (v) => v.deletedAt === null && v.unitPrice !== null && v.unitPrice !== undefined
    );

    let latest: InvestmentValueInput | null = null;
    let latestTime = -Infinity;

    for (const v of activePricedValues) {
      const time = Date.parse(v.createdAt);
      if (time > latestTime) {
        latestTime = time;
        latest = v;
      }
    }

    let worth: number;
    let lastValuedOn: string | null = null;
    let unitPrice: number | null = null;

    if (!latest || latest.unitPrice == null) {
      worth = input.putIn;
    } else {
      lastValuedOn = latest.valuedOn;
      unitPrice = latest.unitPrice;
      worth = roundMoney(quantity * latest.unitPrice);
    }

    const gain = worth - input.putIn;

    return {
      worth: roundMoney(worth),
      gain: roundMoney(gain),
      lastValuedOn,
      quantity,
      unitPrice,
    };
  }

  // Unit null: today's behaviour
  const activeValues = input.values.filter((v) => v.deletedAt === null);

  let latest: InvestmentValueInput | null = null;
  let latestTime = -Infinity;

  for (const v of activeValues) {
    const time = Date.parse(v.createdAt);
    if (time > latestTime) {
      latestTime = time;
      latest = v;
    }
  }

  let worth: number;
  let lastValuedOn: string | null = null;

  if (!latest || latest.value === undefined) {
    worth = input.putIn;
  } else {
    lastValuedOn = latest.valuedOn;
    let subsequentMoves = 0;
    for (const m of input.moves) {
      if (Date.parse(m.createdAt) > latestTime) {
        subsequentMoves += m.signedAmount;
      }
    }
    worth = latest.value + subsequentMoves;
  }

  const gain = worth - input.putIn;

  return {
    worth: roundMoney(worth),
    gain: roundMoney(gain),
    lastValuedOn,
  };
}
