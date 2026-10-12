// Creating your own account from the sign-in page. Off unless NEXT_PUBLIC_SIGNUP_ENABLED is "true",
// and Supabase must also allow new sign-ups. Pure helpers here; the page does the network call.

/** Message keys in the `auth` namespace. */
export type SignUpErrorKey =
  | 'emailInvalid'
  | 'signUpPasswordTooShort'
  | 'passwordsDontMatch'
  | 'emailTaken'
  | 'signUpUnavailable'
  | 'tooManyAttempts'
  | 'signUpFailed';

export const SIGNUP_MIN_PASSWORD = 8;

export function isSignUpEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SIGNUP_ENABLED === 'true';
}

/** A new account needs a real address (older usernames without @ are sign-in only). */
export function validateSignUp(email: string, password: string, repeat: string): SignUpErrorKey | null {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return 'emailInvalid';
  if (password.length < SIGNUP_MIN_PASSWORD) return 'signUpPasswordTooShort';
  if (password !== repeat) return 'passwordsDontMatch';
  return null;
}

/** Supabase's error → our wording. Its own text is never shown. */
export function signUpErrorKey(error: { code?: string; status?: number; message?: string }): SignUpErrorKey {
  const code = error.code ?? '';
  const message = (error.message ?? '').toLowerCase();
  if (code === 'user_already_exists' || code === 'email_exists' || message.includes('already registered')) {
    return 'emailTaken';
  }
  if (code === 'signup_disabled' || code === 'email_provider_disabled' || message.includes('signups not allowed')) {
    return 'signUpUnavailable';
  }
  if (code === 'weak_password') return 'signUpPasswordTooShort';
  if (code === 'email_address_invalid' || code === 'validation_failed') return 'emailInvalid';
  if (error.status === 429 || code.startsWith('over_')) return 'tooManyAttempts';
  return 'signUpFailed';
}
