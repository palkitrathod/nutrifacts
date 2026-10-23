import React, { useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { ArrowRight, Calendar, Check, Lock, Mail, Phone, TrendingUp, User, Utensils, X } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { ApiError } from '../../auth/authApi';
import {
  PASSWORD_MIN_LENGTH,
  passwordStrength,
  validateSignUp,
  type FieldErrors,
  type SignUpInput,
} from '../../shared/authValidation';
import { IMAGES, NUTRITION_SERVICES } from '../../data/mockData';
import { usePublicPackages } from '../../data/usePublicPackages';
import { AsidePhoto, AuthLayout, usePageTitle } from './AuthLayout';
import { FormAlert, SubmitButton, TextField, safeNextPath } from './AuthFields';
import { FIRST_CONSULTATION_INR } from '../../shared/pricing';

type Field = keyof SignUpInput | 'confirmPassword' | 'acceptedTerms';

const STEPS = [
  { icon: Calendar, title: 'Book your first consultation', desc: `30-minute intake, online or in-clinic: ₹${FIRST_CONSULTATION_INR}, credited to your plan.` },
  { icon: Utensils, title: 'Get your personal diet chart', desc: 'Built around your reports, routine and home kitchen.' },
  { icon: TrendingUp, title: 'Track progress together', desc: 'Log meals and weight; follow-ups adjust your plan.' },
];

const SignUpAside = () => (
  <AsidePhoto src={IMAGES.freshIngredients}>
    <p className="text-emerald-300 text-xs font-bold tracking-widest uppercase mb-4">Get started</p>
    <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
      Nourish better, <br />
      <span className="text-emerald-300 italic">starting this week.</span>
    </h2>
    <p className="mt-5 text-emerald-100/80 text-base leading-relaxed max-w-md">
      Your free account is your home for everything with Dt. Anchal — no crash diets, no guesswork.
    </p>

    <ol className="mt-10 space-y-5 max-w-md">
      {STEPS.map((s, i) => (
        <li key={s.title} className="flex gap-4">
          <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-emerald-200 shrink-0">
            <s.icon className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">
              <span className="text-emerald-300 mr-1.5">0{i + 1}</span>
              {s.title}
            </p>
            <p className="text-emerald-100/70 text-sm mt-0.5">{s.desc}</p>
          </div>
        </li>
      ))}
    </ol>

    <div className="mt-12 flex items-center gap-3">
      <img src={IMAGES.dietitianPortrait} alt="" className="w-12 h-12 rounded-full object-cover object-top border-2 border-white/30" />
      <div>
        <p className="text-white text-sm font-semibold">Dt. Anchal Dewan</p>
        <p className="text-emerald-200/80 text-xs">M.Sc. Clinical Nutrition · 2,500+ patients</p>
      </div>
    </div>
  </AsidePhoto>
);

const STRENGTH_COLORS = ['bg-slate-200', 'bg-red-500', 'bg-amber-500', 'bg-lime-500', 'bg-emerald-600'];

const PasswordRules: React.FC<{ password: string; invalid?: boolean }> = ({ password, invalid }) => {
  const { score, label } = passwordStrength(password);
  const rules = [
    { ok: password.length >= PASSWORD_MIN_LENGTH, text: `${PASSWORD_MIN_LENGTH}+ characters` },
    { ok: /\p{L}/u.test(password), text: 'A letter' },
    { ok: /\d/.test(password), text: 'A number' },
  ];
  return (
    <div className="space-y-2">
      {/* Always rendered (grey when empty) so typing the first character doesn't shift the form. */}
      <div className="flex items-center gap-2">
        <div className="flex-1 grid grid-cols-4 gap-1" aria-hidden="true">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className={`h-1 rounded-full ${score >= n ? STRENGTH_COLORS[score] : 'bg-slate-200'}`} />
          ))}
        </div>
        <span className="text-[11px] font-semibold text-slate-500 w-14 text-right" aria-live="polite">
          {label}
        </span>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {rules.map((r) => (
          <li key={r.text} className={`flex items-center gap-1 ${r.ok ? 'text-emerald-700' : invalid ? 'text-red-600 font-medium' : 'text-slate-500'}`}>
            {r.ok ? <Check className="w-3 h-3" aria-hidden="true" /> : <X className="w-3 h-3" aria-hidden="true" />}
            <span>
              {r.text}
              <span className="sr-only">{r.ok ? ' (met)' : ' (not met)'}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const SignUpPage: React.FC = () => {
  usePageTitle('Create your account');
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // Arriving from a pricing card or service card on the home page.
  const { packages } = usePublicPackages();
  const selectedPlan = useMemo(() => packages?.find((p) => p.id === params.get('plan')), [packages, params]);
  const selectedService = useMemo(() => NUTRITION_SERVICES.find((s) => s.id === params.get('service')), [params]);

  const location = useLocation();
  const [values, setValues] = useState({
    name: '',
    email: (location.state as { email?: string } | null)?.email ?? '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [remember, setRemember] = useState(true);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [serverErrors, setServerErrors] = useState<FieldErrors<Field>>({});
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const refs = {
    name: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    phone: useRef<HTMLInputElement>(null),
    password: useRef<HTMLInputElement>(null),
    confirmPassword: useRef<HTMLInputElement>(null),
    acceptedTerms: useRef<HTMLInputElement>(null),
  };

  const clientErrors = useMemo(() => {
    const e: FieldErrors<Field> = validateSignUp(values);
    if (!values.confirmPassword) e.confirmPassword = 'Re-enter your password.';
    else if (values.confirmPassword !== values.password) e.confirmPassword = 'Passwords do not match.';
    if (!acceptedTerms) e.acceptedTerms = 'Please accept to continue.';
    return e;
  }, [values, acceptedTerms]);

  // Show a field's error once the person has left it, or after they try to submit.
  const errorFor = (f: Field) => serverErrors[f] ?? (submitted || touched[f] ? clientErrors[f] : undefined);

  const update = (field: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    if (serverErrors[field]) setServerErrors((er) => ({ ...er, [field]: undefined }));
  };
  const blur = (field: Field) => () => setTouched((t) => ({ ...t, [field]: true }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setSubmitted(true);
    setFormError('');

    const order: Field[] = ['name', 'email', 'phone', 'password', 'confirmPassword', 'acceptedTerms'];
    const firstInvalid = order.find((f) => clientErrors[f]);
    if (firstInvalid) {
      refs[firstInvalid].current?.focus();
      return;
    }

    setLoading(true);
    try {
      await signUp({
        name: values.name,
        email: values.email,
        phone: values.phone,
        password: values.password,
        acceptedTerms,
        remember,
      });
      navigate(safeNextPath(params.get('next')), {
        replace: true,
        state: selectedPlan
          ? { openTab: 'plans' }
          : selectedService
            ? { bookService: selectedService.title }
            : { openTab: 'home' },
      });
    } catch (err) {
      setLoading(false);
      if (err instanceof ApiError) {
        setServerErrors(err.fields as FieldErrors<Field>);
        const firstServerField = order.find((f) => err.fields[f]);
        if (firstServerField) refs[firstServerField].current?.focus();
        else setFormError(err.message);
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    }
  };

  // Keep ?next=, ?plan=, ?service= when switching between sign-up and sign-in.
  const signInLink = `/signin${params.toString() ? `?${params}` : ''}`;
  const emailTaken = serverErrors.email && /already exists/.test(serverErrors.email);
  const emailError = emailTaken ? (
    <>
      This email already has an account.{' '}
      <Link to={signInLink} state={{ email: values.email }} className="font-semibold underline">
        Sign in
      </Link>
    </>
  ) : (
    errorFor('email')
  );

  return (
    <AuthLayout aside={<SignUpAside />}>
      <h1 className="text-3xl font-bold text-[#2D4C3C]" style={{ fontFamily: "'Playfair Display', serif" }}>
        Create your account
      </h1>
      <p className="text-slate-500 text-sm mt-2 mb-6">
        Takes under a minute. Then book your first consultation from your dashboard.
      </p>

      {(selectedPlan || selectedService) && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#3E6553]">
              {selectedPlan ? 'Selected plan' : 'Selected service'}
            </p>
            <p className="text-sm font-semibold text-[#2D4C3C] truncate">
              {selectedPlan
                ? `${selectedPlan.title} · ₹${selectedPlan.priceInr.toLocaleString('en-IN')}`
                : `${selectedService!.title} · ${selectedService!.priceDisplay}`}
            </p>
          </div>
          <Link to={selectedPlan ? '/#pricing' : '/#services'} className="text-xs font-semibold text-[#3E6553] hover:underline shrink-0">
            Change
          </Link>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-3" aria-label="Create account">
        <FormAlert message={formError} />

        <TextField
          ref={refs.name}
          name="name"
          label="Full name"
          icon={User}
          autoComplete="name"
          placeholder="e.g. Priya Sharma"
          value={values.name}
          onChange={update('name')}
          onBlur={blur('name')}
          error={errorFor('name')}
          maxLength={80}
          autoFocus
        />

        <TextField
          ref={refs.email}
          name="email"
          label="Email address"
          icon={Mail}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={values.email}
          onChange={update('email')}
          onBlur={blur('email')}
          error={emailError}
        />

        <TextField
          ref={refs.phone}
          name="phone"
          label="Mobile number (WhatsApp)"
          icon={Phone}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="98765 43210"
          value={values.phone}
          onChange={update('phone')}
          onBlur={blur('phone')}
          error={errorFor('phone')}
          hint="Used for appointment reminders and diet chart updates."
        />

        <TextField
          ref={refs.password}
          name="password"
          label="Password"
          icon={Lock}
          type="password"
          autoComplete="new-password"
          placeholder="Create a password"
          value={values.password}
          onChange={update('password')}
          onBlur={blur('password')}
          error={errorFor('password')}
          hint={<PasswordRules password={values.password} invalid={!!errorFor('password')} />}
          hintShowsError
          messageClassName="min-h-[42px]"
          maxLength={128}
        />

        <TextField
          ref={refs.confirmPassword}
          name="confirmPassword"
          label="Confirm password"
          icon={Lock}
          type="password"
          autoComplete="new-password"
          placeholder="Re-enter your password"
          value={values.confirmPassword}
          onChange={update('confirmPassword')}
          onBlur={blur('confirmPassword')}
          error={errorFor('confirmPassword')}
          maxLength={128}
        />

        <div>
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              ref={refs.acceptedTerms}
              type="checkbox"
              name="acceptedTerms"
              checked={acceptedTerms}
              onChange={(e) => {
                setAcceptedTerms(e.target.checked);
                setTouched((t) => ({ ...t, acceptedTerms: true }));
              }}
              aria-invalid={errorFor('acceptedTerms') ? true : undefined}
              aria-describedby="terms-error"
              className="w-4 h-4 mt-0.5 accent-[#3E6553] shrink-0"
            />
            <span className="text-sm text-slate-600 leading-snug">
              I agree that Nutrifacts may store my details to provide nutrition care, and contact me by phone or WhatsApp about my consultations.
            </span>
          </label>
          <p id="terms-error" className="mt-1.5 ml-6.5 min-h-5 text-xs text-red-600">
            {errorFor('acceptedTerms')}
          </p>
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer w-fit -mt-1 mb-1">
          <input
            type="checkbox"
            name="remember"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="w-4 h-4 accent-[#3E6553]"
          />
          <span className="text-sm text-slate-600">Keep me signed in for 30 days</span>
        </label>

        <SubmitButton loading={loading} loadingText="Creating your account…">
          Create account <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </SubmitButton>
      </form>

      <p className="text-center text-sm text-slate-500 mt-8">
        Already have an account?{' '}
        <Link to={signInLink} state={{ email: values.email }} className="text-[#3E6553] font-semibold hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
};
