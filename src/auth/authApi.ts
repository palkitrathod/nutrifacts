import type { UserRole } from '../types/nutrition';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  createdAt: string;
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

export const authApi = {
  me: () => request<{ user: AuthUser }>('/auth/me').then((r) => r.user),

  signIn: (body: { email: string; password: string; remember: boolean }) =>
    request<{ user: AuthUser }>('/auth/signin', { method: 'POST', body: JSON.stringify(body) }).then((r) => r.user),

  signUp: (body: { name: string; email: string; phone: string; password: string; acceptedTerms: boolean; remember: boolean }) =>
    request<{ user: AuthUser }>('/auth/signup', { method: 'POST', body: JSON.stringify(body) }).then((r) => r.user),

  signOut: () => request<void>('/auth/signout', { method: 'POST', body: '{}' }),

  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    request<void>('/auth/password', { method: 'POST', body: JSON.stringify(body) }),

  /** Dietitian only: sets a temporary password for a patient and signs them out everywhere. */
  resetPatientPassword: (patientId: string) =>
    request<{ temporaryPassword: string; email: string }>(`/admin/patients/${encodeURIComponent(patientId)}/reset-password`, {
      method: 'POST',
      body: '{}',
    }),
};
