import React, { useEffect, useState } from 'react';
import { KeyRound, LogOut, Mail, Phone, Shield, Stethoscope, UserCheck, X } from 'lucide-react';
import { useNutrition } from '../context/NutritionContext';
import { ChangePasswordForm } from './ChangePasswordForm';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignOut: () => Promise<void>;
}

export const AccountModal: React.FC<AccountModalProps> = ({ isOpen, onClose, onSignOut }) => {
  const { currentUser, isDietitian } = useNutrition();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSignOut = async () => {
    setSigningOut(true);
    setSignOutError(null);
    try {
      await onSignOut();
    } catch {
      setSignOutError("Couldn't sign out — check your internet connection and try again. You are still signed in.");
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] overflow-y-auto"
      >
        <div className="bg-[#3E6553] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              {isDietitian ? <Stethoscope className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
            </div>
            <h3 id="account-modal-title" className="font-semibold text-sm">
              Your account
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white/80 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-emerald-800 text-white flex items-center justify-center font-semibold shrink-0">
              {currentUser.avatar ? (
                <img src={currentUser.avatar} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
              ) : (
                <span>{currentUser.name.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-bold text-sm text-slate-900 truncate">{currentUser.name}</p>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                    isDietitian ? 'bg-emerald-800 text-white' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  {isDietitian ? 'Admin' : 'Patient'}
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate">{currentUser.assignedProgram ?? 'Clinical Dietitian'}</p>
            </div>
          </div>

          <dl className="space-y-2 text-xs">
            <div className="flex items-center gap-2 text-slate-600">
              <Mail className="w-3.5 h-3.5 text-[#3E6553]" aria-hidden="true" />
              <dt className="sr-only">Email</dt>
              <dd className="truncate">{currentUser.email}</dd>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Phone className="w-3.5 h-3.5 text-[#3E6553]" aria-hidden="true" />
              <dt className="sr-only">Phone</dt>
              <dd>{currentUser.phone}</dd>
            </div>
          </dl>

          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2">
            <Shield className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              {isDietitian
                ? 'You are signed in as the clinic administrator.'
                : 'Only you and Dt. Anchal can see your diet chart and health measurements.'}
            </span>
          </div>

          {changingPassword ? (
            <div className="border-t border-slate-100 pt-4">
              <ChangePasswordForm onDone={() => setChangingPassword(false)} />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setChangingPassword(true)}
              className="w-full py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm flex items-center justify-center gap-2"
            >
              <KeyRound className="w-4 h-4" aria-hidden="true" /> Change password
            </button>
          )}

          {signOutError && (
            <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {signOutError}
            </p>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full py-2.5 rounded-xl border border-red-200 bg-white hover:bg-red-50 disabled:opacity-60 text-red-600 font-semibold text-sm flex items-center justify-center gap-2 transition-all"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </div>
    </div>
  );
};
