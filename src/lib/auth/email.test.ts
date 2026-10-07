import { describe, expect, it } from 'vitest';
import { isEmail, loginLabel, normalizeEmail, toLoginEmail } from './email';

describe('email', () => {
  it('is case-insensitive and trims spaces', () => {
    expect(normalizeEmail('  Injy@Gmail.COM ')).toBe('injy@gmail.com');
  });
  it('accepts real addresses, including +tags for parents without email', () => {
    expect(isEmail('injy@gmail.com')).toBe(true);
    expect(isEmail('injy+mama@gmail.com')).toBe(true);
    expect(isEmail('injy')).toBe(false);
    expect(isEmail('injy@gmail')).toBe(false);
    expect(isEmail('a b@gmail.com')).toBe(false);
  });
  it('keeps older username logins working', () => {
    expect(toLoginEmail(' Injy ')).toBe('injy@family.local');
    expect(toLoginEmail('Injy@Gmail.com')).toBe('injy@gmail.com');
    expect(loginLabel('fatma@family.local')).toBe('fatma');
    expect(loginLabel('mama@gmail.com')).toBe('mama@gmail.com');
  });
});
