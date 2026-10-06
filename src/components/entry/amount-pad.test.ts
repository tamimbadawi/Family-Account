import { describe, expect, it } from 'vitest';
import { applyKey } from './amount-pad';

describe('applyKey state machine', () => {
  it('appends digits sequentially', () => {
    let val = '';
    val = applyKey(val, '1');
    expect(val).toBe('1');
    val = applyKey(val, '2');
    expect(val).toBe('12');
    val = applyKey(val, '5');
    expect(val).toBe('125');
  });

  it('replaces leading zero with non-zero digit', () => {
    let val = '0';
    val = applyKey(val, '5');
    expect(val).toBe('5');
  });

  it('handles multiple zeros correctly', () => {
    let val = '0';
    val = applyKey(val, '0');
    expect(val).toBe('0');
  });

  it('handles decimal dot and prevents duplicates', () => {
    let val = '';
    val = applyKey(val, '.');
    expect(val).toBe('0.');

    val = applyKey(val, '5');
    expect(val).toBe('0.5');

    // Second decimal dot should be ignored
    val = applyKey(val, '.');
    expect(val).toBe('0.5');
  });

  it('limits decimals to maximum 2 places', () => {
    let val = '10.5';
    val = applyKey(val, '5');
    expect(val).toBe('10.55');

    // 3rd decimal should be rejected
    val = applyKey(val, '9');
    expect(val).toBe('10.55');
  });

  it('handles backspace properly', () => {
    expect(applyKey('123.45', 'backspace')).toBe('123.4');
    expect(applyKey('123.', 'backspace')).toBe('123');
    expect(applyKey('1', 'backspace')).toBe('');
    expect(applyKey('', 'backspace')).toBe('');
  });

  it('enforces maximum amount limit (9,999,999.99)', () => {
    const val = '9999999';
    expect(applyKey(val, '9')).toBe('9999999'); // exceeds MAX_AMOUNT

    const withDec = applyKey(val, '.');
    expect(withDec).toBe('9999999.');
    const withDec2 = applyKey(withDec, '9');
    expect(withDec2).toBe('9999999.9');
    const withDec3 = applyKey(withDec2, '9');
    expect(withDec3).toBe('9999999.99');
  });

  it('normalises Arabic-Indic digits passed as key', () => {
    let val = '';
    val = applyKey(val, '٥');
    expect(val).toBe('5');
    val = applyKey(val, '٫');
    expect(val).toBe('5.');
    val = applyKey(val, '٢');
    expect(val).toBe('5.2');
  });
});
