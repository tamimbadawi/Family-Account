import { normalizeDigits } from '@/lib/format';
import { isOperator, type Operator } from '@/lib/format/expression';

export const MAX_AMOUNT = 9999999.99;
export const MAX_NUMBERS = 12;

const OPERATOR_KEYS: Record<string, Operator> = {
  '+': '+',
  '-': '-',
  '−': '-',
  '*': '*',
  '×': '*',
  x: '*',
  '/': '/',
  '÷': '/',
};

/**
 * State machine for AmountPad input.
 * Handles digits 0–9, decimal point '.', 'backspace' and the operators + − × ÷.
 * Rules apply to the number being typed (the part after the last operator):
 * max 2 decimals, max 9,999,999.99. An operator after an operator replaces it;
 * at most 12 numbers per expression.
 */
export function applyKey(value: string, key: string): string {
  const normKey = normalizeDigits(key).toLowerCase();

  if (normKey === 'backspace' || normKey === 'delete' || normKey === '⌫') {
    if (!value || value.length <= 1) return '';
    return value.slice(0, -1);
  }

  const op = OPERATOR_KEYS[normKey];
  if (op) {
    if (!value) return value;
    const last = value[value.length - 1];
    if (isOperator(last)) return value.slice(0, -1) + op;
    const operatorCount = (value.match(/[+\-*/]/g) ?? []).length;
    if (operatorCount + 1 >= MAX_NUMBERS) return value;
    const base = last === '.' ? value.slice(0, -1) : value;
    return base + op;
  }

  const lastOpIndex = Math.max(
    value.lastIndexOf('+'),
    value.lastIndexOf('-'),
    value.lastIndexOf('*'),
    value.lastIndexOf('/'),
  );
  const head = value.slice(0, lastOpIndex + 1);
  const current = value.slice(lastOpIndex + 1);

  if (normKey === '.' || normKey === 'decimal') {
    if (current.includes('.')) return value;
    if (!current) return head + '0.';
    return value + '.';
  }

  // Digits 0–9
  if (/^[0-9]$/.test(normKey)) {
    // Leading zero is replaced by the next digit
    if (current === '0') {
      if (normKey === '0') return value;
      return head + normKey;
    }

    // Check decimal places
    const decimals = current.split('.')[1];
    if (decimals !== undefined && decimals.length >= 2) return value;

    const nextCurrent = current + normKey;
    if (parseFloat(nextCurrent) > MAX_AMOUNT) return value;

    return head + nextCurrent;
  }

  return value;
}
