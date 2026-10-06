/**
 * Tiny calculator for the AmountPad: + − × ÷ with normal precedence.
 * No eval / Function. Internal operator chars are ASCII: + - * /
 */

export type Operator = '+' | '-' | '*' | '/';
export const OPERATORS: readonly Operator[] = ['/', '*', '-', '+'];

export const MAX_RESULT = 9999999.99;

export function isOperator(ch: string): ch is Operator {
  return ch === '+' || ch === '-' || ch === '*' || ch === '/';
}

/** Splits "120+85.5*2" into ["120", "+", "85.5", "*", "2"]. */
export function tokenize(expr: string): string[] {
  const tokens: string[] = [];
  let num = '';
  for (const ch of expr) {
    if (isOperator(ch)) {
      tokens.push(num, ch);
      num = '';
    } else {
      num += ch;
    }
  }
  tokens.push(num);
  return tokens;
}

export function hasOperator(expr: string): boolean {
  return /[+\-*/]/.test(expr);
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Evaluates tokens (number, op, number, …). Returns the result rounded to 2 dp,
 * or null when incomplete, dividing by zero, ≤ 0, or above the max amount.
 */
export function evaluateExpression(tokens: string[]): number | null {
  if (tokens.length === 0 || tokens.length % 2 === 0) return null;

  const nums: number[] = [];
  const ops: Operator[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (i % 2 === 0) {
      if (!/^\d+(\.\d*)?$|^\.\d+$/.test(tok)) return null;
      nums.push(parseFloat(tok));
    } else {
      if (!isOperator(tok)) return null;
      ops.push(tok);
    }
  }

  // Pass 1: × ÷
  const sumNums: number[] = [nums[0]];
  const sumOps: Operator[] = [];
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    const right = nums[i + 1];
    if (op === '*' || op === '/') {
      const left = sumNums.pop() as number;
      if (op === '/' && right === 0) return null;
      sumNums.push(op === '*' ? left * right : left / right);
    } else {
      sumOps.push(op);
      sumNums.push(right);
    }
  }

  // Pass 2: + −
  let result = sumNums[0];
  for (let i = 0; i < sumOps.length; i++) {
    result = sumOps[i] === '+' ? result + sumNums[i + 1] : result - sumNums[i + 1];
  }

  const rounded = round2(result);
  if (!Number.isFinite(rounded) || rounded <= 0 || rounded > MAX_RESULT) return null;
  return rounded;
}

/** Convenience: evaluate a pad string such as "120+85+40". */
export function evaluate(expr: string): number | null {
  return evaluateExpression(tokenize(expr));
}

/** Drops a dangling operator ("120+" → "120") so a half-typed expression still has a value. */
export function trimTrailingOperator(expr: string): string {
  return expr.replace(/[+\-*/]$/, '');
}

/** The value the pad currently stands for, ignoring a dangling operator. */
export function previewValue(expr: string): number | null {
  return evaluate(trimTrailingOperator(expr));
}

/** Pretty form for display: "120 + 85 × 2" (Western digits). */
export function formatExpression(expr: string): string {
  const symbol: Record<Operator, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' };
  return tokenize(expr)
    .map((tok) => (isOperator(tok) ? symbol[tok] : tok))
    .join(' ')
    .trim();
}
