import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, authApi, type AuthUser } from './authApi';

/** 'unreachable': the session could not be checked (offline / server down) — not the same as signed out. */
type AuthStatus = 'loading' | 'authenticated' | 'anonymous' | 'unreachable';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  signIn: typeof authApi.signIn;
  signUp: typeof authApi.signUp;
  /** Confirms the emailed code; on success the user becomes verified. */
  verifyEmail: typeof authApi.verifyEmail;
  /** My profile: saves name / mobile on the account. */
  updateAccount: typeof authApi.updateAccount;
  /** My profile: finishes an email change with the code sent to the new address. */
  confirmEmailChange: typeof authApi.confirmEmailChange;
  /** Throws if the server could not be reached — the person then stays signed in (and is told). */
  signOut: () => Promise<void>;
  /** Re-runs the session check (e.g. "Try again" after 'unreachable'). */
  retry: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Tells the site's other open tabs that someone signed in or out here.
const CHANNEL = 'nutrifacts-auth';
const openChannel = () => (typeof BroadcastChannel === 'function' ? new BroadcastChannel(CHANNEL) : null);
const TAB_ID = Math.random().toString(36).slice(2);

/** Session check that rides out brief network blips before giving up. */
async function fetchSession(): Promise<AuthUser | null> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await authApi.me();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return null;
      if (attempt >= 2) throw err;
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  const userIdRef = useRef<string | null>(null);
  userIdRef.current = user?.id ?? null;
  // Bumped on every sign-in/up/out in this tab, so a re-check that overlapped one is ignored.
  const changeCount = useRef(0);

  const [attempt, setAttempt] = useState(0);

  // Restore the session from the httpOnly cookie on page load. Only a 401 means "signed out";
  // a network/server failure is reported as 'unreachable' so nobody is wrongly sent to sign in.
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    fetchSession()
      .then((u) => {
        if (cancelled) return;
        setUser(u);
        setStatus(u ? 'authenticated' : 'anonymous');
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Session check failed', err);
        setUser(null);
        setStatus('unreachable');
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  // Keep every open tab on the same account: re-check when another tab signs in/out, and when
  // this tab comes back into view. If the account changed, reload so no screen keeps showing
  // (or saving) the previous person's data.
  useEffect(() => {
    const recheck = async () => {
      const startedAt = changeCount.current;
      let current: AuthUser | null;
      try {
        current = await fetchSession();
      } catch {
        return; // offline: leave things as they are
      }
      // Account changed elsewhere: reload, so this tab starts clean on the right account
      // (the app moves on to the dashboard, or back to sign-in).
      if (changeCount.current !== startedAt) return;
      if ((current?.id ?? null) !== userIdRef.current) window.location.reload();
    };
    const channel = openChannel();
    if (channel) channel.onmessage = (e) => e.data !== TAB_ID && void recheck();
    const onVisible = () => document.visibilityState === 'visible' && void recheck();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      channel?.close();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const announce = () => {
    changeCount.current++;
    const channel = openChannel();
    channel?.postMessage(TAB_ID);
    channel?.close();
  };

  const signIn = useCallback<AuthContextValue['signIn']>(async (body) => {
    changeCount.current++; // this tab is changing account: ignore re-checks in flight
    const u = await authApi.signIn(body);
    setUser(u);
    setStatus('authenticated');
    announce();
    return u;
  }, []);

  const signUp = useCallback<AuthContextValue['signUp']>(async (body) => {
    changeCount.current++; // this tab is changing account: ignore re-checks in flight
    const u = await authApi.signUp(body);
    setUser(u);
    setStatus('authenticated');
    announce();
    return u;
  }, []);

  const verifyEmail = useCallback<AuthContextValue['verifyEmail']>(async (code) => {
    const u = await authApi.verifyEmail(code);
    setUser(u);
    return u;
  }, []);

  const updateAccount = useCallback<AuthContextValue['updateAccount']>(async (body) => {
    const u = await authApi.updateAccount(body);
    setUser(u);
    return u;
  }, []);

  const confirmEmailChange = useCallback<AuthContextValue['confirmEmailChange']>(async (code) => {
    const u = await authApi.confirmEmailChange(code);
    setUser(u);
    return u;
  }, []);

  const signOut = useCallback(async () => {
    changeCount.current++;
    try {
      await authApi.signOut();
    } catch (err) {
      // 401 = the session was already gone, which is what we wanted. Anything else (offline,
      // server error) means the server may still hold the session: stay signed in and say so,
      // rather than *looking* signed out on a shared device while the session lives on.
      if (!(err instanceof ApiError && err.status === 401)) throw err;
    }
    setUser(null);
    setStatus('anonymous');
    announce();
  }, []);

  const value = useMemo(
    () => ({ status, user, signIn, signUp, verifyEmail, updateAccount, confirmEmailChange, signOut, retry }),
    [status, user, signIn, signUp, verifyEmail, updateAccount, confirmEmailChange, signOut, retry]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
