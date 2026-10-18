import { describe, expect, it } from 'vitest';
import { formatPhone, normalizePhone, passwordStrength, validateSignIn, validateSignUp } from './authValidation';

describe('normalizePhone', () => {
  it.each([
    ['9876543210', '+919876543210'],
    ['98765 43210', '+919876543210'],
    ['+91 98765-43210', '+919876543210'],
    ['09876543210', '+919876543210'],
    ['919876543210', '+919876543210'],
    ['+44 7911 123456', '+447911123456'],
    ['0091 98765 43210', '+919876543210'],
    ['+1 415 555 2671', '+14155552671'],
  ])('%s → %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(['', '12345', '5876543210', 'abcdefghij', '+0123456789', '+91 12345 67890', '+91 5876543210', '+91987654321012'])('rejects %o', (input) => {
    expect(normalizePhone(input)).toBeNull();
  });

  it('formats Indian numbers for display', () => {
    expect(formatPhone('+919876543210')).toBe('+91 98765 43210');
    expect(formatPhone('+447911123456')).toBe('+447911123456');
  });
});

describe('validateSignUp', () => {
  const ok = { name: 'Priya Sharma', email: 'priya@example.com', phone: '9876543210', password: 'Healthy123' };

  it('accepts valid input', () => {
    expect(validateSignUp(ok)).toEqual({});
  });

  it('accepts names with Indian scripts, apostrophes and hyphens', () => {
    expect(validateSignUp({ ...ok, name: 'प्रिया शर्मा' })).toEqual({});
    expect(validateSignUp({ ...ok, name: "D'Souza Anne-Marie" })).toEqual({});
  });

  it('flags every problem at once', () => {
    const errors = validateSignUp({ name: ' ', email: 'x@', phone: '1', password: 'abc' });
    expect(Object.keys(errors).sort()).toEqual(['email', 'name', 'password', 'phone']);
  });
});

describe('validateSignIn', () => {
  it('requires both fields', () => {
    expect(Object.keys(validateSignIn({ email: '', password: '' })).sort()).toEqual(['email', 'password']);
  });
});

describe('passwordStrength', () => {
  it('rates weak passwords low and strong passwords high', () => {
    expect(passwordStrength('').score).toBe(0);
    expect(passwordStrength('password').score).toBeLessThanOrEqual(1);
    expect(passwordStrength('Healthy12').score).toBe(2);
    expect(passwordStrength('Healthy-Living-2026').score).toBe(4);
  });
});
