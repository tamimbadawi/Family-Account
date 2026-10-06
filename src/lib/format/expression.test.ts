import { describe, expect, it } from 'vitest';
import {
  evaluate,
  evaluateExpression,
  formatExpression,
  hasOperator,
  previewValue,
  tokenize,
} from './expression';

describe('tokenize', () => {
  it('splits numbers and operators', () => {
    expect(tokenize('120+85.5*2')).toEqual(['120', '+', '85.5', '*', '2']);
  });
  it('keeps a trailing empty number when the expression ends with an operator', () => {
    expect(tokenize('12+')).toEqual(['12', '+', '']);
  });
  it('returns a single token for a plain number', () => {
    expect(tokenize('42')).toEqual(['42']);
  });
});

describe('evaluateExpression', () => {
  it('adds a list of numbers: 120+85+40=245', () => {
    expect(evaluate('120+85+40')).toBe(245);
  });
  it('divides: 1000/4=250', () => {
    expect(evaluate('1000/4')).toBe(250);
  });
  it('returns null for a negative result: 10-20', () => {
    expect(evaluate('10-20')).toBeNull();
  });
  it('returns null for a zero result', () => {
    expect(evaluate('10-10')).toBeNull();
  });
  it('returns null when dividing by zero: 5/0', () => {
    expect(evaluate('5/0')).toBeNull();
  });
  it('respects precedence: 2+3×4=14', () => {
    expect(evaluate('2+3*4')).toBe(14);
  });
  it('respects precedence with subtraction and division: 100-20/4=95', () => {
    expect(evaluate('100-20/4')).toBe(95);
  });
  it('evaluates left to right within the same precedence', () => {
    expect(evaluate('100/5/2')).toBe(10);
    expect(evaluate('100-30+5')).toBe(75);
  });
  it('rounds to 2 decimals', () => {
    expect(evaluate('10/3')).toBe(3.33);
    expect(evaluate('0.1+0.2')).toBe(0.3);
    expect(evaluate('1.005*2')).toBe(2.01);
  });
  it('returns null when incomplete', () => {
    expect(evaluate('12+')).toBeNull();
    expect(evaluate('')).toBeNull();
    expect(evaluateExpression([])).toBeNull();
    expect(evaluateExpression(['1', '+'])).toBeNull();
  });
  it('accepts a number with a trailing dot', () => {
    expect(evaluate('12.')).toBe(12);
    expect(evaluate('12.+3')).toBe(15);
  });
  it('rejects garbage tokens', () => {
    expect(evaluateExpression(['1', '%', '2'])).toBeNull();
    expect(evaluateExpression(['abc'])).toBeNull();
  });
  it('returns null above the max amount', () => {
    expect(evaluate('9999999*2')).toBeNull();
  });
  it('treats a plain number as itself', () => {
    expect(evaluate('250')).toBe(250);
    expect(evaluate('0')).toBeNull();
  });
});

describe('previewValue', () => {
  it('ignores a dangling operator', () => {
    expect(previewValue('120+')).toBe(120);
    expect(previewValue('120+85')).toBe(205);
  });
  it('is null for invalid results', () => {
    expect(previewValue('10-20+')).toBeNull();
    expect(previewValue('')).toBeNull();
  });
});

describe('formatExpression / hasOperator', () => {
  it('uses display symbols with spaces', () => {
    expect(formatExpression('120+85-5*2/1')).toBe('120 + 85 − 5 × 2 ÷ 1');
  });
  it('shows a trailing operator', () => {
    expect(formatExpression('120+')).toBe('120 +');
  });
  it('detects operators', () => {
    expect(hasOperator('120')).toBe(false);
    expect(hasOperator('120+5')).toBe(true);
  });
});
