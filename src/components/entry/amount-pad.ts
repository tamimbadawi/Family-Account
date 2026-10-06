import { normalizeDigits } from '@/lib/format';

export const MAX_AMOUNT = 9999999.99;

/**
 * State machine for AmountPad input.
 * Handles digits 0–9, decimal point '.', and 'backspace'.
 * Enforces max 2 decimals, max 9,999,999.99.
 */
export function applyKey(value: string, key: string): string {
  const normKey = normalizeDigits(key).toLowerCase();

  if (normKey === 'backspace' || normKey === 'delete' || normKey === '⌫') {
    if (!value || value.length <= 1) return '';
    return value.slice(0, -1);
  }

  if (normKey === '.' || normKey === 'decimal') {
    if (value.includes('.')) return value;
    if (!value) return '0.';
    return value + '.';
  }

  // Digits 0–9
  if (/^[0-9]$/.test(normKey)) {
    // If value is just '0' and no dot
    if (value === '0') {
      if (normKey === '0') return '0';
      return normKey;
    }

    // Check decimal places
    if (value.includes('.')) {
      const parts = value.split('.');
      if (parts[1] && parts[1].length >= 2) {
        return value; // already has 2 decimals
      }
    }

    const nextValue = value + normKey;
    const num = parseFloat(nextValue);

    if (num > MAX_AMOUNT) {
      return value;
    }

    return nextValue;
  }

  return value;
}
