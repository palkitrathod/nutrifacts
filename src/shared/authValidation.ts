// Validation rules shared by the sign-up / sign-in forms and the auth API,
// so the browser and the server always agree on what is acceptable.

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export type FieldErrors<K extends string = string> = Partial<Record<K, string>>;

export interface SignUpInput {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export interface SignInInput {
  email: string;
  password: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// \p{M}: vowel signs in Indic scripts; U+200C/U+200D: zero-width (non-)joiners used in Indic scripts.
const NAME_RE = /^\p{L}[\p{L}\p{M}\u200C\u200D\s.'-]*$/u;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** Trims, collapses spaces, and turns typographic apostrophes (iPhone "Smart Punctuation") into '. */
export const normalizeName = (name: string) => name.trim().replace(/\s+/g, ' ').replace(/[\u2018\u2019\u02BC]/g, "'");

/**
 * Accepts a 10-digit Indian mobile (optionally prefixed with 0, 91 or +91)
 * or any international number in E.164 form. Returns it as "+<digits>",
 * or null when it is not a valid number.
 */
export function normalizePhone(phone: string): string | null {
  // "00" is the international dialling prefix, the same as "+".
  const compact = phone.trim().replace(/[\s\-().]/g, '').replace(/^00/, '+');
  if (!compact) return null;

  const indian = compact.match(/^(?:\+?91|0)?([6-9]\d{9})$/);
  if (indian) return `+91${indian[1]}`;
  // Anything else claiming to be Indian is not a valid mobile (must start 6–9, 10 digits).
  if (compact.startsWith('+91')) return null;

  if (/^\+[1-9]\d{7,14}$/.test(compact)) return compact;
  return null;
}

/** "+919872154320" → "+91 98721 54320"; other countries are left as-is. */
export function formatPhone(phone: string): string {
  const m = phone.match(/^\+91(\d{5})(\d{5})$/);
  return m ? `+91 ${m[1]} ${m[2]}` : phone;
}

export function validateEmail(email: string): string | undefined {
  const value = email.trim();
  if (!value) return 'Enter your email address.';
  if (value.length > 254 || !EMAIL_RE.test(value)) return 'Enter a valid email, like name@example.com.';
  return undefined;
}

export function validatePassword(password: string): string | undefined {
  if (!password) return 'Create a password.';
  if (password.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (password.length > PASSWORD_MAX_LENGTH) return `Use at most ${PASSWORD_MAX_LENGTH} characters.`;
  if (!/\p{L}/u.test(password) || !/\d/.test(password)) return 'Include at least one letter and one number.';
  return undefined;
}

export function validateSignUp(input: SignUpInput): FieldErrors<keyof SignUpInput> {
  const errors: FieldErrors<keyof SignUpInput> = {};

  const name = normalizeName(input.name ?? '');
  if (!name) errors.name = 'Enter your full name.';
  else if (name.length > 80) errors.name = 'Use at most 80 characters.';
  else if (!NAME_RE.test(name)) errors.name = 'Use letters only (spaces, . \' - allowed).';

  const emailError = validateEmail(input.email ?? '');
  if (emailError) errors.email = emailError;

  if (!(input.phone ?? '').trim()) errors.phone = 'Enter your mobile number.';
  else if (!normalizePhone(input.phone)) errors.phone = 'Enter a 10-digit mobile, or add the country code.';

  const passwordError = validatePassword(input.password ?? '');
  if (passwordError) errors.password = passwordError;

  return errors;
}

export function validateSignIn(input: SignInInput): FieldErrors<keyof SignInInput> {
  const errors: FieldErrors<keyof SignInInput> = {};
  const emailError = validateEmail(input.email ?? '');
  if (emailError) errors.email = emailError;
  if (!input.password) errors.password = 'Enter your password.';
  return errors;
}

/** 0–4 score used for the strength meter on the sign-up form. */
export function passwordStrength(password: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  if (!password) return { score: 0, label: '' };
  let score = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) score++;
  if (password.length >= 12) score++;
  if (/\p{Ll}/u.test(password) && /\p{Lu}/u.test(password)) score++;
  if (/\d/.test(password) && /[^\p{L}\d]/u.test(password)) score++;
  if (validatePassword(password)) score = Math.min(score, 1);
  const labels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'] as const;
  return { score: score as 0 | 1 | 2 | 3 | 4, label: labels[score] };
}
