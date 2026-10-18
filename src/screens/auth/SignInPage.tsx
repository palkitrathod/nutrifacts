import React, { useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { ArrowRight, Info, Lock, Mail, Sparkles, Star } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { ApiError } from '../../auth/authApi';
import { validateSignIn, type FieldErrors, type SignInInput } from '../../shared/authValidation';
import { IMAGES } from '../../data/mockData';
import { AsidePhoto, AuthLayout, usePageTitle } from './AuthLayout';
import { FormAlert, SubmitButton, TextField, safeNextPath } from './AuthFields';

// Matches the accounts the API seeds in development (server/db.ts). Never shown in production builds.
const DEMO_ACCOUNTS = [
  { label: 'Priya (patient)', email: 'priya.sharma@example.com' },
  { label: 'Rohan (patient)', email: 'rohan.verma@example.com' },
  { label: 'Dt. Anchal (admin)', email: 'anchaldewan380@gmail.com' },
];
const DEMO_PASSWORD = 'Demo@1234';

const SignInAside = () => (
  <AsidePhoto src={IMAGES.healthyMealBowl}>
    <p className="text-emerald-300 text-xs font-bold tracking-widest uppercase mb-4">Welcome back</p>
    <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
      Your plan is <br />
      <span className="text-emerald-300 italic">right where you left it.</span>
    </h2>
    <p className="mt-5 text-emerald-100/80 text-base leading-relaxed max-w-md">
      Check today's meals, log your weight, and see what Dt. Anchal has updated since your last visit.
    </p>

    <figure className="mt-12 bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl p-6 max-w-md">
      <div className="flex gap-0.5 mb-3" aria-label="5 out of 5 stars">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" aria-hidden="true" />
        ))}
      </div>
      <blockquote className="text-emerald-50/90 text-sm italic leading-relaxed">
        "I still eat rice and roti — just in a smarter sequence. My 90-day blood report shocked my doctor."
      </blockquote>
      <figcaption className="mt-4 text-xs text-emerald-200">
        <span className="font-semibold text-white">Suresh K.</span> · Type 2 Diabetes · HbA1c 6.8 → 5.9
      </figcaption>
    </figure>
  </AsidePhoto>
);

export const SignInPage: React.FC = () => {
  usePageTitle('Sign in');
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const location = useLocation();
  const [values, setValues] = useState<SignInInput>({
    email: (location.state as { email?: string } | null)?.email ?? '',
    password: '',
  });
  // Set by the app when a session ended unexpectedly; shown once.
  const [sessionEnded] = useState(() => {
    try {
      const on = sessionStorage.getItem('nf_session_notice') === '1';
      sessionStorage.removeItem('nf_session_notice');
      return on;
    } catch {
      return false;
    }
  });
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<FieldErrors<keyof SignInInput>>({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const update = (field: keyof SignInInput) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    if (errors[field]) setErrors((er) => ({ ...er, [field]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setFormError('');

    const fieldErrors = validateSignIn(values);
    setErrors(fieldErrors);
    if (fieldErrors.email) return emailRef.current?.focus();
    if (fieldErrors.password) return passwordRef.current?.focus();

    setLoading(true);
    try {
      await signIn({ email: values.email.trim(), password: values.password, remember });
      navigate(safeNextPath(params.get('next')), { replace: true });
    } catch (err) {
      setLoading(false);
      if (err instanceof ApiError) {
        if (err.code === 'invalid_credentials') {
          // Shown in the password field's reserved space, so nothing on the page moves.
          setErrors({ password: err.message });
          setValues((v) => ({ ...v, password: '' }));
          passwordRef.current?.focus();
        } else if (Object.keys(err.fields).length) {
          setErrors(err.fields);
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    }
  };

  const signUpLink = `/signup${params.toString() ? `?${params}` : ''}`;

  return (
    <AuthLayout aside={<SignInAside />}>
      <h1 className="text-3xl font-bold text-[#2D4C3C]" style={{ fontFamily: "'Playfair Display', serif" }}>
        Sign in
      </h1>
      <p className="text-slate-500 text-sm mt-2 mb-8">
        Welcome back. Enter the email and password you registered with.
      </p>

      {sessionEnded && (
        <div role="status" className="-mt-4 mb-6 flex items-start gap-2.5 text-sm text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>Your session ended (signed out or expired). Please sign in again.</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-3" aria-label="Sign in">
        <FormAlert message={formError} />

        <TextField
          ref={emailRef}
          name="email"
          label="Email address"
          icon={Mail}
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={values.email}
          onChange={update('email')}
          error={errors.email}
          autoFocus
        />

        <TextField
          ref={passwordRef}
          name="password"
          label="Password"
          icon={Lock}
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={values.password}
          onChange={update('password')}
          error={errors.password}
        />

        {/* "Forgot password?" sits after the password field so Tab goes email → password. */}
        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-4 h-4 accent-[#3E6553]"
            />
            <span className="text-sm text-slate-600">Keep me signed in for 30 days</span>
          </label>
          <Link
            to="/forgot-password"
            state={{ email: values.email }}
            className="text-sm text-[#3E6553] font-semibold hover:underline shrink-0"
          >
            Forgot password?
          </Link>
        </div>

        <SubmitButton loading={loading} loadingText="Signing in…">
          Sign in <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </SubmitButton>
      </form>

      <p className="text-center text-sm text-slate-500 mt-8">
        New to Nutrifacts?{' '}
        <Link to={signUpLink} state={{ email: values.email }} className="text-[#3E6553] font-semibold hover:underline">
          Create an account
        </Link>
      </p>

      {import.meta.env.DEV && (
        <div className="mt-8 rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 p-4">
          <p className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" /> Development sample accounts
          </p>
          <p className="text-[11px] text-amber-800/80 mt-1">
            Password for all: <code className="font-mono">{DEMO_PASSWORD}</code>. Hidden in production builds.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={() => {
                  setValues({ email: a.email, password: DEMO_PASSWORD });
                  setErrors({});
                  setFormError('');
                }}
                className="text-xs px-3 py-1.5 rounded-lg bg-white border border-amber-200 text-amber-900 hover:bg-amber-100"
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </AuthLayout>
  );
};
