import { describe, it, expect } from 'vitest';
import { routing } from './routing';

describe('i18n routing configuration', () => {
  it('includes en and ar locales', () => {
    expect(routing.locales).toContain('en');
    expect(routing.locales).toContain('ar');
  });

  it('sets en as default locale', () => {
    expect(routing.defaultLocale).toBe('en');
  });

  it('sets localePrefix to always', () => {
    expect(routing.localePrefix).toBe('always');
  });
});
