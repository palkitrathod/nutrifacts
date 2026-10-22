import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';
import { AlertCircle, CheckCircle2, MailCheck, RotateCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { ApiError, authApi, codeSentRecently } from '../../auth/authApi';
import { IMAGES } from '../../data/mockData';
import { AsidePhoto, AuthLayout, usePageTitle } from './AuthLayout';
import { SubmitButton, safeNextPath } from './AuthFields';

const CODE_LENGTH = 6;
const RESEND_WAIT_SEC = 60;

const VerifyAside = () => (
  <AsidePhoto src={IMAGES.healthyMealBowl}>
    <MailCheck className="w-10 h-10 text-emerald-300 mb-6" aria-hidden="true" />
    <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
      One quick check, <br />
      <span className="text-emerald-300 italic">then you're in.</span>
    </h2>
    <p className="mt-5 text-emerald-100/80 text-base leading-relaxed max-w-md">
      Confirming your email keeps your health records private and makes sure appointment and diet-chart updates reach you.
    </p>
    <div className="mt-12 flex items-center gap-3">
      <img src={IMAGES.dietitianPortrait} alt="" className="w-12 h-12 rounded-full object-cover object-top border-2 border-white/30" />
      <div>
        <p className="text-white text-sm font-semibold">Dt. Anchal Dewan</p>
        <p className="text-emerald-200/80 text-xs">M.Sc. Clinical Nutrition · 2,500+ patients</p>
      </div>
    </div>
  </AsidePhoto>
);

export const VerifyEmailPage: React.FC = () => {
  usePageTitle('Verify your email');
  const { status, user, verifyEmail, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  // Hand-off from sign-up (plan / service picked on the home page), passed on to the app.
  const [entry] = useState(() => location.state);

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [focused, setFocused] = useState(false);
  const [resending, setResending] = useState(false);
  const [wait, setWait] = useState(() => (codeSentRecently() ? RESEND_WAIT_SEC : 0));
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSubmitted = useRef('');
  // Set while this page verifies, so the "already verified" redirect below doesn't skip the success message.
  const verifyingHere = useRef(false);
  const leaving = useRef(false);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const next = safeNextPath(params.get('next'));

  const submit = async (value: string) => {
    if (loading || value.length !== CODE_LENGTH) return;
    lastSubmitted.current = value;
    setLoading(true);
    setError('');
    setNotice('');
    verifyingHere.current = true;
    try {
      await verifyEmail(value);
      setVerified(true);
      setTimeout(() => navigate(next, { replace: true, state: entry }), 900);
    } catch (err) {
      verifyingHere.current = false;
      setLoading(false);
      setError(err instanceof ApiError ? err.fields.code ?? err.message : 'Something went wrong. Please try again.');
      setCode('');
      inputRef.current?.focus();
    }
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(value);
    if (error) setError('');
    // Submit as soon as the last digit is typed or a whole code is pasted / autofilled.
    if (value.length === CODE_LENGTH && value !== lastSubmitted.current) void submit(value);
  };

  const resend = async () => {
    if (resending || wait > 0) return;
    setResending(true);
    setError('');
    setNotice('');
    try {
      const r = await authApi.resendVerificationCode();
      setNotice(`A new code is on its way to ${r.sentTo}. Earlier codes no longer work.`);
      setWait(r.resendAfterSec);
      setCode('');
      lastSubmitted.current = '';
      inputRef.current?.focus();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send a new code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const startOver = async () => {
    leaving.current = true; // signed out below: go to sign-up, not the signed-out redirect to sign-in
    try {
      await signOut();
    } catch {
      /* offline: the sign-up page still lets them start again */
    }
    navigate('/signup', { replace: true });
  };

  if (status === 'loading' || leaving.current) return null;
  if (!user) return <Navigate to="/signin" replace />;
  if (user.emailVerified && !verified && !verifyingHere.current) return <Navigate to={next} replace state={entry} />;

  const activeIndex = Math.min(code.length, CODE_LENGTH - 1);

  return (
    <AuthLayout aside={<VerifyAside />}>
      <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[#3E6553] mb-6">
        {verified ? <CheckCircle2 className="w-7 h-7" aria-hidden="true" /> : <MailCheck className="w-7 h-7" aria-hidden="true" />}
      </div>

      <h1 className="text-3xl font-bold text-[#2D4C3C]" style={{ fontFamily: "'Playfair Display', serif" }}>
        {verified ? 'Email verified!' : 'Check your email'}
      </h1>

      {verified ? (
        <p className="text-slate-500 text-sm mt-2" role="status">
          Thanks, {user.name.split(' ')[0]}. Taking you to your dashboard…
        </p>
      ) : (
        <>
          <p className="text-slate-500 text-sm mt-2 mb-8">
            We sent a {CODE_LENGTH}-digit code to <strong className="text-[#2D4C3C] font-semibold break-all">{user.email}</strong>.
            Enter it below to open your dashboard. The code expires in 10 minutes.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit(code);
            }}
            noValidate
            aria-label="Verify email"
          >
            <label htmlFor="verification-code" className="block text-sm font-semibold text-[#2D4C3C] mb-2">
              Verification code
            </label>
            {/* One real input (so paste, SMS/email autofill and screen readers just work) under six display boxes. */}
            <div className="relative" onClick={() => inputRef.current?.focus()}>
              <div className="grid grid-cols-6 gap-2 sm:gap-3" aria-hidden="true">
                {Array.from({ length: CODE_LENGTH }, (_, i) => {
                  const digit = code[i];
                  const active = focused && i === activeIndex && !loading;
                  return (
                    <div
                      key={i}
                      className={`h-14 sm:h-16 rounded-xl border-2 bg-white flex items-center justify-center text-2xl font-bold text-[#2D4C3C] transition-colors ${
                        error ? 'border-red-400' : active ? 'border-[#3E6553] ring-4 ring-[#3E6553]/15' : digit ? 'border-emerald-300' : 'border-slate-200'
                      }`}
                    >
                      {digit ?? (active ? <span className="w-0.5 h-7 bg-[#3E6553] animate-pulse" /> : '')}
                    </div>
                  );
                })}
              </div>
              <input
                ref={inputRef}
                id="verification-code"
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={CODE_LENGTH}
                value={code}
                onChange={onChange}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                // Read-only rather than disabled while checking, so focus stays put for a retry.
                readOnly={loading}
                aria-invalid={error ? true : undefined}
                aria-describedby="verification-code-message"
                autoFocus
                className="absolute inset-0 w-full h-full opacity-0 cursor-text"
              />
            </div>

            <div id="verification-code-message" className="mt-3 min-h-10 text-sm" aria-live="polite">
              {error ? (
                <p className="text-red-600 flex items-start gap-1.5" role="alert">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{error}</span>
                </p>
              ) : notice ? (
                <p className="text-emerald-700 flex items-start gap-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{notice}</span>
                </p>
              ) : null}
            </div>

            <SubmitButton loading={loading} loadingText="Verifying…">
              <ShieldCheck className="w-4 h-4" aria-hidden="true" /> Verify &amp; continue
            </SubmitButton>
          </form>

          <div className="mt-6 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-600">
            <p>Didn't get it? Check your spam or promotions folder.</p>
            <button
              type="button"
              onClick={resend}
              disabled={resending || wait > 0}
              className="mt-2 inline-flex items-center gap-1.5 font-semibold text-[#3E6553] hover:underline disabled:text-slate-400 disabled:no-underline disabled:cursor-not-allowed"
            >
              <RotateCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} aria-hidden="true" />
              {resending ? 'Sending…' : wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}
            </button>
          </div>

          <p className="text-center text-sm text-slate-500 mt-8">
            Wrong email address?{' '}
            <button type="button" onClick={startOver} className="text-[#3E6553] font-semibold hover:underline">
              Sign up again
            </button>
          </p>
        </>
      )}
    </AuthLayout>
  );
};
