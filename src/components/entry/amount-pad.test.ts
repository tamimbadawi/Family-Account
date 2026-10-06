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

  it('ignores an operator on an empty value', () => {
    expect(applyKey('', '+')).toBe('');
  });

  it('appends operators and continues typing a new number', () => {
    let val = '120';
    val = applyKey(val, '+');
    expect(val).toBe('120+');
    val = applyKey(val, '8');
    val = applyKey(val, '5');
    expect(val).toBe('120+85');
  });

  it('replaces an operator typed after an operator', () => {
    expect(applyKey('120+', '×')).toBe('120*');
    expect(applyKey('120*', '−')).toBe('120-');
    expect(applyKey('120-', '/')).toBe('120/');
  });

  it('drops a dangling dot before an operator', () => {
    expect(applyKey('12.', '+')).toBe('12+');
  });

  it('applies decimal and zero rules to the current number only', () => {
    expect(applyKey('10.5+', '.')).toBe('10.5+0.');
    expect(applyKey('10.5+3', '.')).toBe('10.5+3.');
    expect(applyKey('10.5+3.25', '1')).toBe('10.5+3.25');
    expect(applyKey('10+0', '5')).toBe('10+5');
    expect(applyKey('10+0', '0')).toBe('10+0');
  });

  it('limits each number to the max amount', () => {
    expect(applyKey('5+9999999', '9')).toBe('5+9999999');
  });

  it('allows at most 12 numbers', () => {
    let val = '1';
    for (let i = 0; i < 11; i++) val = applyKey(applyKey(val, '+'), '1');
    expect(val.split('+')).toHaveLength(12);
    expect(applyKey(val, '+')).toBe(val);
  });

  it('backspace removes an operator', () => {
    expect(applyKey('120+', 'backspace')).toBe('120');
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
