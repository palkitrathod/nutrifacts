import React, { useState } from 'react';
import { Check, Copy, KeyRound, MessageCircle, X } from 'lucide-react';
import { authApi } from '../auth/authApi';
import type { User } from '../types/nutrition';

interface Props {
  patient: User;
  onClose: () => void;
}

/** Dietitian tool: give a patient who forgot their password a temporary one. */
export const ResetPatientPasswordDialog: React.FC<Props> = ({ patient, onClose }) => {
  const [state, setState] = useState<'confirm' | 'working' | 'done'>('confirm');
  const [temporary, setTemporary] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = async () => {
    setState('working');
    setError(null);
    try {
      const { temporaryPassword } = await authApi.resetPatientPassword(patient.id);
      setTemporary(temporaryPassword);
      setState('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset the password.');
      setState('confirm');
    }
  };

  const message = `Hello ${patient.name}, your Nutrifacts password has been reset. Sign in with your email ${patient.email} and this temporary password: ${temporary} — then change it from your account menu (tap your name at the top).`;
  const phoneDigits = patient.phone.replace(/\D/g, '');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(temporary);
      setCopied(true);
    } catch {
      /* clipboard blocked: the password is visible to copy by hand */
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-pw-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-sm"
      >
        <div className="bg-[#3E6553] text-white px-5 py-4 flex items-center justify-between">
          <h3 id="reset-pw-title" className="font-semibold flex items-center gap-2">
            <KeyRound className="w-4 h-4" aria-hidden="true" /> Reset password
          </h3>
          <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {state !== 'done' ? (
            <>
              <p className="text-slate-600">
                Create a temporary password for <strong>{patient.name}</strong> ({patient.email})? Their current password stops
                working and they are signed out on all devices.
              </p>
              {error && (
                <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-300 font-semibold text-slate-700 hover:bg-slate-50">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={reset}
                  disabled={state === 'working'}
                  className="flex-1 py-2.5 rounded-xl bg-[#3E6553] hover:bg-[#2D4C3C] disabled:opacity-60 text-white font-semibold"
                >
                  {state === 'working' ? 'Resetting…' : 'Reset password'}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-slate-600">Share this temporary password with {patient.name}. It is shown only once.</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-base tracking-wide bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 select-all" aria-label="Temporary password">
                  {temporary}
                </code>
                <button type="button" onClick={copy} aria-label="Copy temporary password" className="w-10 h-10 rounded-lg border border-slate-300 flex items-center justify-center hover:bg-slate-50">
                  {copied ? <Check className="w-4 h-4 text-emerald-700" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              {phoneDigits && (
                <a
                  href={`https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-white font-semibold flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" aria-hidden="true" /> Send on WhatsApp
                </a>
              )}
              <button type="button" onClick={onClose} className="w-full py-2.5 rounded-xl border border-slate-300 font-semibold text-slate-700 hover:bg-slate-50">
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
