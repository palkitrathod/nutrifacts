import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Mail, RotateCw, Save, X } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { ApiError, authApi } from '../auth/authApi';
import { useNutrition } from '../context/NutritionContext';
import type { DietaryPreference, User } from '../types/nutrition';
import {
  ageOn,
  formatPhone,
  normalizeName,
  normalizePhone,
  validateDateOfBirth,
  validateEmail,
  validateName,
  validatePhone,
} from '../shared/authValidation';

const inputClass = (invalid?: boolean) =>
  `w-full p-2.5 rounded-lg border bg-white text-sm sm:text-xs ${invalid ? 'border-red-400' : 'border-slate-300'}`;

const Field: React.FC<{ label: string; htmlFor: string; error?: string; hint?: string; children: React.ReactNode }> = ({
  label,
  htmlFor,
  error,
  hint,
  children,
}) => (
  <div>
    <label htmlFor={htmlFor} className="block font-semibold text-slate-700 mb-1">
      {label}
    </label>
    {children}
    {error ? (
      <p id={`${htmlFor}-error`} className="mt-1 text-[11px] text-red-600 flex items-start gap-1">
        <AlertCircle className="w-3 h-3 shrink-0 mt-px" aria-hidden="true" />
        {error}
      </p>
    ) : (
      hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>
    )}
  </div>
);

/** A number field's value, or undefined when empty; NaN when it isn't a number. */
const num = (s: string) => (s.trim() === '' ? undefined : Number(s));
const rangeError = (value: number | undefined, min: number, max: number, unit: string) =>
  value === undefined ? undefined : Number.isNaN(value) || value < min || value > max ? `Enter ${min}–${max} ${unit}.` : undefined;

const todayIso = () => new Date().toISOString().split('T')[0];

type Errors = Partial<Record<string, string>>;

/**
 * "Change email": proving the password, then a code sent to the new address. Nothing changes until
 * that code is entered.
 */
const ChangeEmail: React.FC<{ currentEmail: string; onChanged: (email: string) => void; onCancel: () => void }> = ({
  currentEmail,
  onChanged,
  onCancel,
}) => {
  const { confirmEmailChange } = useAuth();
  const [step, setStep] = useState<'details' | 'code'>('details');
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const showApiError = (err: unknown) => {
    if (err instanceof ApiError) setErrors(Object.keys(err.fields).length ? err.fields : { form: err.message });
    else setErrors({ form: 'Something went wrong. Please try again.' });
  };

  const sendCode = async () => {
    const emailError = validateEmail(newEmail);
    const next: Errors = {
      newEmail: emailError ?? (newEmail.trim().toLowerCase() === currentEmail ? 'This is already your email address.' : undefined),
      currentPassword: password ? undefined : 'Enter your current password.',
    };
    setErrors(next);
    if (next.newEmail || next.currentPassword) return;
    setBusy(true);
    try {
      const r = await authApi.requestEmailChange({ newEmail, currentPassword: password });
      setSentTo(r.sentTo);
      setWait(r.resendAfterSec);
      setCode('');
      setErrors({});
      setStep('code');
    } catch (err) {
      showApiError(err);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!/^\d{6}$/.test(code.trim())) return setErrors({ code: 'Enter the 6-digit code from the email.' });
    setBusy(true);
    try {
      const user = await confirmEmailChange(code.trim());
      onChanged(user.email);
    } catch (err) {
      showApiError(err);
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  // Enter acts on this panel, never submitting the surrounding profile form.
  const onEnter = (action: () => Promise<void>) => (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    void action();
  };

  return (
    <div className="mt-2 p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-slate-800">Change email address</p>
        <button type="button" onClick={onCancel} aria-label="Cancel email change" className="p-1 rounded-md hover:bg-white text-slate-500">
          <X className="w-4 h-4" />
        </button>
      </div>

      {errors.form && (
        <p role="alert" className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {errors.form}
        </p>
      )}

      {step === 'details' ? (
        // Plain inputs and buttons, not a <form>: this sits inside the profile form (Enter is handled below).
        <div className="space-y-3">
          <Field label="New email address" htmlFor="new-email" error={errors.newEmail}>
            <input
              id="new-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={onEnter(sendCode)}
              aria-invalid={errors.newEmail ? true : undefined}
              className={inputClass(!!errors.newEmail)}
            />
          </Field>
          <Field label="Current password" htmlFor="email-change-password" error={errors.currentPassword} hint="To confirm it's you.">
            <input
              id="email-change-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={onEnter(sendCode)}
              aria-invalid={errors.currentPassword ? true : undefined}
              className={inputClass(!!errors.currentPassword)}
            />
          </Field>
          <button
            type="button"
            onClick={() => void sendCode()}
            disabled={busy}
            className="px-4 py-2 rounded-xl bg-[#3E6553] hover:bg-[#2D4C3C] disabled:opacity-60 text-white font-medium"
          >
            {busy ? 'Sending…' : 'Send verification code'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-slate-600">
            We sent a 6-digit code to <strong className="text-slate-800 break-all">{sentTo}</strong>. Enter it to finish. Your
            email stays <span className="break-all">{currentEmail}</span> until then.
          </p>
          <Field label="Verification code" htmlFor="email-change-code" error={errors.code}>
            <input
              id="email-change-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              onKeyDown={onEnter(confirm)}
              aria-invalid={errors.code ? true : undefined}
              className={`${inputClass(!!errors.code)} font-mono tracking-[0.4em] text-base max-w-[12rem]`}
            />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void confirm()}
              disabled={busy}
              className="px-4 py-2 rounded-xl bg-[#3E6553] hover:bg-[#2D4C3C] disabled:opacity-60 text-white font-medium"
            >
              {busy ? 'Confirming…' : 'Confirm new email'}
            </button>
            <button
              type="button"
              onClick={() => void sendCode()}
              disabled={busy || wait > 0}
              className="inline-flex items-center gap-1 font-semibold text-[#3E6553] hover:underline disabled:text-slate-400 disabled:no-underline"
            >
              <RotateCw className="w-3 h-3" aria-hidden="true" />
              {wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/** My profile: account details (name, email, mobile) and personal & health details, in one form. */
export const EditProfileForm: React.FC<{ onDone: (message?: string) => void }> = ({ onDone }) => {
  const { user: account, updateAccount } = useAuth();
  const { currentUser, updatePatientProfile } = useNutrition();
  const s = (v: number | undefined) => (v == null ? '' : String(v));

  const [values, setValues] = useState({
    name: currentUser.name,
    phone: account ? formatPhone(account.phone) : currentUser.phone,
    dateOfBirth: currentUser.dateOfBirth ?? '',
    gender: currentUser.gender ?? '',
    heightCm: s(currentUser.heightCm),
    currentWeightKg: s(currentUser.currentWeightKg),
    targetWeightKg: s(currentUser.targetWeightKg),
    dietaryPreference: currentUser.dietaryPreference ?? 'Vegetarian',
    waterGoalLitres: s(currentUser.waterGoalLitres ?? 3),
    medicalConditions: currentUser.medicalConditions?.join(', ') ?? '',
    allergies: currentUser.allergies?.join(', ') ?? '',
  });
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [changingEmail, setChangingEmail] = useState(false);
  const [emailNotice, setEmailNotice] = useState('');

  const set = (field: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    if (errors[field]) setErrors((er) => ({ ...er, [field]: undefined }));
  };

  const validate = (): Errors => ({
    name: validateName(values.name),
    phone: validatePhone(values.phone),
    dateOfBirth: validateDateOfBirth(values.dateOfBirth),
    heightCm: rangeError(num(values.heightCm), 50, 250, 'cm'),
    currentWeightKg: rangeError(num(values.currentWeightKg), 20, 300, 'kg'),
    targetWeightKg: rangeError(num(values.targetWeightKg), 20, 300, 'kg'),
    waterGoalLitres: rangeError(num(values.waterGoalLitres), 0.5, 8, 'litres'),
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    const first = Object.keys(found).find((k) => found[k]);
    if (first) {
      document.getElementById(`profile-${first}`)?.focus();
      return;
    }

    setSaving(true);
    const name = normalizeName(values.name);
    const phone = normalizePhone(values.phone)!;
    try {
      // Name and mobile belong to the account, so they're saved (and checked) by the server first.
      if (name !== account?.name || phone !== account?.phone) await updateAccount({ name, phone });
    } catch (err) {
      setSaving(false);
      if (err instanceof ApiError && Object.keys(err.fields).length) setErrors(err.fields);
      else setErrors({ form: err instanceof ApiError ? err.message : 'Could not save your details. Please try again.' });
      return;
    }

    const list = (text: string) => text.split(',').map((x) => x.trim()).filter(Boolean);
    const update: Partial<User> = {
      name,
      phone: formatPhone(phone),
      dateOfBirth: values.dateOfBirth || undefined,
      age: values.dateOfBirth ? ageOn(values.dateOfBirth) : currentUser.age,
      gender: (values.gender || undefined) as User['gender'],
      heightCm: num(values.heightCm),
      currentWeightKg: num(values.currentWeightKg),
      targetWeightKg: num(values.targetWeightKg),
      dietaryPreference: values.dietaryPreference as DietaryPreference,
      waterGoalLitres: num(values.waterGoalLitres) ?? 3,
      medicalConditions: list(values.medicalConditions),
      allergies: list(values.allergies),
    };
    updatePatientProfile(update); // saved to the server by the app's auto-save
    setSaving(false);
    onDone('Your profile has been updated.');
  };

  const err = (f: string) => errors[f];
  const aria = (f: string) => (errors[f] ? { 'aria-invalid': true, 'aria-describedby': `profile-${f}-error` } : {});

  return (
    <form
      onSubmit={handleSave}
      noValidate
      aria-label="Edit profile"
      className="bg-white rounded-2xl md:rounded-3xl border border-slate-200 p-5 md:p-6 shadow-2xs space-y-6 text-xs"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-sm text-slate-900">Edit profile</h2>
        <button type="button" onClick={() => onDone()} className="text-slate-500 hover:text-slate-800 font-medium">
          Cancel
        </button>
      </div>

      {errors.form && (
        <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {errors.form}
        </p>
      )}

      <section className="space-y-3">
        <h3 className="font-bold text-[11px] uppercase tracking-wider text-slate-500">Personal details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Full name" htmlFor="profile-name" error={err('name')}>
            <input id="profile-name" autoComplete="name" maxLength={80} value={values.name} onChange={set('name')} {...aria('name')} className={inputClass(!!err('name'))} />
          </Field>
          <Field label="Mobile number (WhatsApp)" htmlFor="profile-phone" error={err('phone')}>
            <input id="profile-phone" type="tel" inputMode="tel" autoComplete="tel" value={values.phone} onChange={set('phone')} {...aria('phone')} className={inputClass(!!err('phone'))} />
          </Field>
          <Field label="Date of birth" htmlFor="profile-dateOfBirth" error={err('dateOfBirth')} hint={values.dateOfBirth && !err('dateOfBirth') && !validateDateOfBirth(values.dateOfBirth) ? `Age ${ageOn(values.dateOfBirth)}` : undefined}>
            <input id="profile-dateOfBirth" type="date" max={todayIso()} value={values.dateOfBirth} onChange={set('dateOfBirth')} {...aria('dateOfBirth')} className={inputClass(!!err('dateOfBirth'))} />
          </Field>
          <Field label="Gender" htmlFor="profile-gender">
            <select id="profile-gender" value={values.gender} onChange={set('gender')} className={inputClass()}>
              <option value="">Prefer not to say</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Other">Other</option>
            </select>
          </Field>
        </div>

        <div>
          <span className="block font-semibold text-slate-700 mb-1">Email address</span>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 break-all">
              <Mail className="w-3.5 h-3.5 text-[#3E6553] shrink-0" aria-hidden="true" />
              {account?.email ?? currentUser.email}
            </span>
            {!changingEmail && (
              <button type="button" onClick={() => { setChangingEmail(true); setEmailNotice(''); }} className="font-semibold text-[#3E6553] hover:underline">
                Change
              </button>
            )}
          </div>
          {emailNotice && (
            <p role="status" className="mt-1.5 text-[11px] text-emerald-700 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" /> {emailNotice}
            </p>
          )}
          {changingEmail && (
            <ChangeEmail
              currentEmail={account?.email ?? currentUser.email}
              onCancel={() => setChangingEmail(false)}
              onChanged={(email) => {
                updatePatientProfile({ email });
                setChangingEmail(false);
                setEmailNotice(`Your email is now ${email}. Use it next time you sign in.`);
              }}
            />
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-bold text-[11px] uppercase tracking-wider text-slate-500">Health details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Height (cm)" htmlFor="profile-heightCm" error={err('heightCm')}>
            <input id="profile-heightCm" type="number" inputMode="decimal" value={values.heightCm} onChange={set('heightCm')} {...aria('heightCm')} className={inputClass(!!err('heightCm'))} />
          </Field>
          <Field label="Current weight (kg)" htmlFor="profile-currentWeightKg" error={err('currentWeightKg')}>
            <input id="profile-currentWeightKg" type="number" inputMode="decimal" step="0.1" value={values.currentWeightKg} onChange={set('currentWeightKg')} {...aria('currentWeightKg')} className={inputClass(!!err('currentWeightKg'))} />
          </Field>
          <Field label="Target weight (kg)" htmlFor="profile-targetWeightKg" error={err('targetWeightKg')}>
            <input id="profile-targetWeightKg" type="number" inputMode="decimal" step="0.1" value={values.targetWeightKg} onChange={set('targetWeightKg')} {...aria('targetWeightKg')} className={inputClass(!!err('targetWeightKg'))} />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Dietary preference" htmlFor="profile-dietaryPreference">
            <select id="profile-dietaryPreference" value={values.dietaryPreference} onChange={set('dietaryPreference')} className={inputClass()}>
              <option value="Vegetarian">Vegetarian</option>
              <option value="Vegan">Vegan</option>
              <option value="Eggetarian">Eggetarian</option>
              <option value="Non-Vegetarian">Non-Vegetarian</option>
              <option value="Jain">Jain Diet</option>
            </select>
          </Field>
          <Field label="Daily water goal (litres)" htmlFor="profile-waterGoalLitres" error={err('waterGoalLitres')}>
            <input id="profile-waterGoalLitres" type="number" inputMode="decimal" step="0.1" value={values.waterGoalLitres} onChange={set('waterGoalLitres')} {...aria('waterGoalLitres')} className={inputClass(!!err('waterGoalLitres'))} />
          </Field>
          <Field label="Medical conditions (comma-separated)" htmlFor="profile-medicalConditions">
            <input id="profile-medicalConditions" value={values.medicalConditions} onChange={set('medicalConditions')} placeholder="e.g. PCOS, Hypothyroidism" className={inputClass()} />
          </Field>
          <Field label="Food allergies or intolerances" htmlFor="profile-allergies">
            <input id="profile-allergies" value={values.allergies} onChange={set('allergies')} placeholder="e.g. Lactose, Peanuts" className={inputClass()} />
          </Field>
        </div>
      </section>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={() => onDone()} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-medium">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-[#3E6553] hover:bg-[#2D4C3C] disabled:opacity-60 text-white font-medium flex items-center gap-1.5 shadow-sm">
          <Save className="w-4 h-4" aria-hidden="true" />
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
};
