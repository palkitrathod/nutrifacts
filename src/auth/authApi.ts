import type { UserRole } from '../types/nutrition';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  createdAt: string;
  /** False until the code emailed at sign-up has been entered; the app stays locked until then. */
  emailVerified: boolean;
}

/** An error the UI can show as-is; `fields` maps form field names to messages. */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public fields: Record<string, string> = {}
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      credentials: 'same-origin',
      ...init,
      headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
    });
  } catch {
    throw new ApiError('Could not reach Nutrifacts. Check your internet connection and try again.', 0, 'network_error');
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = data?.error;
    throw new ApiError(
      err?.message ?? 'Something went wrong. Please try again.',
      res.status,
      err?.code ?? 'unknown_error',
      err?.fields ?? {}
    );
  }
  return data as T;
}

// When sign-up / sign-in last emailed a verification code, so the code screen can hold "resend" briefly.
let codeSentAt = 0;
export const codeSentRecently = () => Date.now() - codeSentAt < 60_000;

const noteCodeSent = (r: { user: AuthUser; codeSent?: boolean }) => {
  if (r.codeSent) codeSentAt = Date.now();
  return r.user;
};

export const authApi = {
  me: () => request<{ user: AuthUser }>('/auth/me').then((r) => r.user),

  signIn: (body: { email: string; password: string; remember: boolean }) =>
    request<{ user: AuthUser; codeSent?: boolean }>('/auth/signin', { method: 'POST', body: JSON.stringify(body) }).then(noteCodeSent),

  signUp: (body: { name: string; email: string; phone: string; password: string; acceptedTerms: boolean; remember: boolean }) =>
    request<{ user: AuthUser; codeSent?: boolean }>('/auth/signup', { method: 'POST', body: JSON.stringify(body) }).then(noteCodeSent),

  signOut: () => request<void>('/auth/signout', { method: 'POST', body: '{}' }),

  verifyEmail: (code: string) =>
    request<{ user: AuthUser }>('/auth/verify-email', { method: 'POST', body: JSON.stringify({ code }) }).then((r) => r.user),

  /** My profile: name and mobile live on the account. */
  updateAccount: (body: { name: string; phone: string }) =>
    request<{ user: AuthUser }>('/account/profile', { method: 'POST', body: JSON.stringify(body) }).then((r) => r.user),

  /** Step 1 of changing email: checks the password and emails a code to the new address. */
  requestEmailChange: (body: { newEmail: string; currentPassword: string }) =>
    request<{ sentTo: string; resendAfterSec: number }>('/account/email', { method: 'POST', body: JSON.stringify(body) }),

  /** Step 2: the code from the new inbox moves the account to that address. */
  confirmEmailChange: (code: string) =>
    request<{ user: AuthUser }>('/account/email/confirm', { method: 'POST', body: JSON.stringify({ code }) }).then((r) => r.user),

  /** Emails a fresh code; earlier codes stop working. */
  resendVerificationCode: () =>
    request<{ sentTo: string; resendAfterSec: number }>('/auth/verify-email/resend', { method: 'POST', body: '{}' }),

  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    request<void>('/auth/password', { method: 'POST', body: JSON.stringify(body) }),

  /** Dietitian only: sets a temporary password for a patient and signs them out everywhere. */
  resetPatientPassword: (patientId: string) =>
    request<{ temporaryPassword: string; email: string }>(`/admin/patients/${encodeURIComponent(patientId)}/reset-password`, {
      method: 'POST',
      body: '{}',
    }),
};
