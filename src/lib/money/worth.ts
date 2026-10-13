import { roundMoney } from '../data/mappers';

export interface InvestmentValueInput {
  value: number;
  createdAt: string;
  valuedOn: string;
  deletedAt: string | null;
}

export interface InvestmentMoveInput {
  signedAmount: number;
  createdAt: string;
}

export interface InvestmentWorthInput {
  putIn: number;
  values: InvestmentValueInput[];
  moves: InvestmentMoveInput[];
}

export interface InvestmentWorthResult {
  worth: number;
  gain: number;
  lastValuedOn: string | null;
}

/**
 * Calculates current worth, overall gain, and last valued date for an investment account.
 * Latest active value anchor is adjusted by any transfer moves that happened strictly after it.
 */
export function investmentWorth(input: {
  putIn: number;
  values: { value: number; createdAt: string; valuedOn: string; deletedAt: string | null }[];
  moves: { signedAmount: number; createdAt: string }[];
}): { worth: number; gain: number; lastValuedOn: string | null } {
  const activeValues = input.values.filter((v) => v.deletedAt === null);

  let latest: (typeof input.values)[0] | null = null;
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

  if (!latest) {
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
