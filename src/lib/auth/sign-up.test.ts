import { describe, expect, it } from 'vitest';
import { signUpErrorKey, validateSignUp } from './sign-up';

describe('validateSignUp', () => {
  it('accepts a real email with a long enough, matching password', () => {
    expect(validateSignUp('mama@example.com', 'abcd1234', 'abcd1234')).toBeNull();
  });

  it('rejects a username with no @', () => {
    expect(validateSignUp('mama', 'abcd1234', 'abcd1234')).toBe('emailInvalid');
  });

  it('rejects a short password before comparing the two', () => {
    expect(validateSignUp('mama@example.com', 'abc1234', 'different')).toBe('signUpPasswordTooShort');
  });

  it('rejects two different passwords', () => {
    expect(validateSignUp('mama@example.com', 'abcd1234', 'abcd1235')).toBe('passwordsDontMatch');
  });
});

describe('signUpErrorKey', () => {
  it('maps an address that already has an account', () => {
    expect(signUpErrorKey({ code: 'user_already_exists' })).toBe('emailTaken');
    expect(signUpErrorKey({ message: 'User already registered' })).toBe('emailTaken');
  });

  it('maps the answers of the sign-up function', () => {
    expect(signUpErrorKey({ code: 'not_invited' })).toBe('notInvited');
    expect(signUpErrorKey({ code: 'email_taken' })).toBe('emailTaken');
    expect(signUpErrorKey({ code: 'short_password' })).toBe('signUpPasswordTooShort');
    expect(signUpErrorKey({ code: 'bad_email' })).toBe('emailInvalid');
  });

  it('maps sign-ups being switched off in Supabase', () => {
    expect(signUpErrorKey({ code: 'signup_disabled' })).toBe('signUpUnavailable');
    expect(signUpErrorKey({ message: 'Signups not allowed for this instance' })).toBe('signUpUnavailable');
  });

  it('maps rate limits', () => {
    expect(signUpErrorKey({ status: 429 })).toBe('tooManyAttempts');
    expect(signUpErrorKey({ code: 'over_email_send_rate_limit' })).toBe('tooManyAttempts');
  });

  it('falls back to a generic message and never passes text through', () => {
    expect(signUpErrorKey({ message: 'Database error saving new user' })).toBe('signUpFailed');
  });
});
