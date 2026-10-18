import React, { useId, useState } from 'react';
import { authApi, ApiError } from '../auth/authApi';
import { validatePassword } from '../shared/authValidation';

/** Lets the signed-in person change their password (e.g. after a temporary one from the clinic). */
export const ChangePasswordForm: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const id = useId();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string; form?: string }>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const found: typeof errors = {};
    if (!current) found.current = 'Enter your current password.';
    const p = validatePassword(next);
    if (p) found.next = p;
    if (!found.next && next !== confirm) found.confirm = 'Passwords do not match.';
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    try {
      await authApi.changePassword({ currentPassword: current, newPassword: next });
      setSaved(true);
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      if (err instanceof ApiError && err.fields.currentPassword) setErrors({ current: err.fields.currentPassword });
      else if (err instanceof ApiError && err.fields.newPassword) setErrors({ next: err.fields.newPassword });
      else setErrors({ form: err instanceof Error ? err.message : 'Could not change your password.' });
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <div className="space-y-3">
        <p role="status" className="text-xs text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          Password changed. You stay signed in here; other devices have been signed out.
        </p>
        <button type="button" onClick={onDone} className="w-full py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Done
        </button>
      </div>
    );
  }

  const field = (key: 'current' | 'next' | 'confirm', label: string, value: string, set: (v: string) => void, autoComplete: string) => (
    <div>
      <label htmlFor={`${id}-${key}`} className="block text-xs font-semibold text-slate-700 mb-1">
        {label}
      </label>
      <input
        id={`${id}-${key}`}
        type="password"
        value={value}
        onChange={(e) => {
          set(e.target.value);
          setErrors((er) => ({ ...er, [key]: undefined, form: undefined }));
        }}
        autoComplete={autoComplete}
        maxLength={128}
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={errors[key] ? `${id}-${key}-error` : undefined}
        className={`w-full px-3 py-2 rounded-lg border text-base sm:text-sm ${errors[key] ? 'border-red-400' : 'border-slate-300'}`}
      />
      <p id={`${id}-${key}-error`} className="min-h-4 mt-0.5 text-[11px] text-red-600">
        {errors[key]}
      </p>
    </div>
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-1" aria-label="Change password">
      {field('current', 'Current password', current, setCurrent, 'current-password')}
      {field('next', 'New password (8+ characters, a letter and a number)', next, setNext, 'new-password')}
      {field('confirm', 'Confirm new password', confirm, setConfirm, 'new-password')}
      {errors.form && (
        <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {errors.form}
        </p>
      )}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onDone} className="flex-1 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="flex-1 py-2 rounded-xl bg-[#3E6553] hover:bg-[#2D4C3C] disabled:opacity-60 text-white text-sm font-semibold">
          {saving ? 'Saving…' : 'Change password'}
        </button>
      </div>
    </form>
  );
};
