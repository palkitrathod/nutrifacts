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

export function validateName(input: string): string | undefined {
  const name = normalizeName(input ?? '');
  if (!name) return 'Enter your full name.';
  if (name.length > 80) return 'Use at most 80 characters.';
  if (!NAME_RE.test(name)) return 'Use letters only (spaces, . \' - allowed).';
  return undefined;
}

export function validatePhone(input: string): string | undefined {
  if (!(input ?? '').trim()) return 'Enter your mobile number.';
  if (!normalizePhone(input)) return 'Enter a 10-digit mobile, or add the country code.';
  return undefined;
}

/** Date of birth as YYYY-MM-DD: a real, past date for someone aged 1–120. Empty is allowed (not given). */
export function validateDateOfBirth(value: string, today = new Date()): string | undefined {
  if (!value) return undefined;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = m && new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (!m || !date || date.getUTCMonth() !== +m[2] - 1 || date.getUTCDate() !== +m[3]) return 'Enter a valid date.';
  if (date.getTime() > Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) return 'Date of birth must be in the past.';
  const age = ageOn(value, today);
  if (age < 1 || age > 120) return 'Please check the year.';
  return undefined;
}

/** Whole years between a YYYY-MM-DD birth date and `today`. */
export function ageOn(dateOfBirth: string, today = new Date()): number {
  const [y, mo, d] = dateOfBirth.split('-').map(Number);
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < mo || (today.getMonth() + 1 === mo && today.getDate() < d)) age--;
  return age;
}

export function validateSignUp(input: SignUpInput): FieldErrors<keyof SignUpInput> {
  const errors: FieldErrors<keyof SignUpInput> = {};

  const nameError = validateName(input.name);
  if (nameError) errors.name = nameError;

  const emailError = validateEmail(input.email ?? '');
  if (emailError) errors.email = emailError;

  const phoneError = validatePhone(input.phone);
  if (phoneError) errors.phone = phoneError;

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
