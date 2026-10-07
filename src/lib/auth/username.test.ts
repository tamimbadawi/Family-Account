import { describe, expect, it } from 'vitest';
import { emailToUsername, normalizeUsername, usernameToEmail } from './username';

describe('username', () => {
  it('is case-insensitive and trims spaces', () => {
    expect(usernameToEmail('INJY')).toBe('injy@family.local');
    expect(usernameToEmail('  Injy ')).toBe('injy@family.local');
    expect(normalizeUsername('Ab Cd')).toBe('abcd');
    expect(normalizeUsername("O'Neil")).toBe('oneil');
  });
  it('round-trips to the username', () => {
    expect(emailToUsername(usernameToEmail('Mama'))).toBe('mama');
    expect(emailToUsername(null)).toBe('');
  });
});
