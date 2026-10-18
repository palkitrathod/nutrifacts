import React, { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { ArrowLeft, Mail, MessageCircle, ShieldCheck } from 'lucide-react';
import { validateEmail } from '../../shared/authValidation';
import { IMAGES } from '../../data/mockData';
import { AsidePhoto, AuthLayout, usePageTitle } from './AuthLayout';
import { TextField } from './AuthFields';

const CLINIC_WHATSAPP = '919872154320';

// There is no email service yet, so resets are verified and done by the clinic team.
// When one is added, this page becomes "email me a reset link".
export const ForgotPasswordPage: React.FC = () => {
  usePageTitle('Reset your password');
  const location = useLocation();
  const [email, setEmail] = useState<string>((location.state as { email?: string } | null)?.email ?? '');
  const [error, setError] = useState<string>();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateEmail(email);
    setError(err);
    if (err) return;
    const text = `Hello Dt. Anchal, I can't sign in to Nutrifacts and need a password reset for my account: ${email.trim()}`;
    window.open(`https://wa.me/${CLINIC_WHATSAPP}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <AuthLayout
      aside={
        <AsidePhoto src={IMAGES.clinicConsultation}>
          <ShieldCheck className="w-10 h-10 text-emerald-300 mb-6" aria-hidden="true" />
          <h2 className="text-4xl font-bold text-white leading-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
            Your health records stay private.
          </h2>
          <p className="mt-5 text-emerald-100/80 text-base leading-relaxed max-w-md">
            That's why every password reset is confirmed personally by the clinic before access is restored.
          </p>
        </AsidePhoto>
      }
    >
      <h1 className="text-3xl font-bold text-[#2D4C3C]" style={{ fontFamily: "'Playfair Display', serif" }}>
        Forgot your password?
      </h1>
      <p className="text-slate-500 text-sm mt-2 mb-8">
        Enter the email you signed up with and message the clinic on WhatsApp. Once we've confirmed it's you, we'll send you a temporary password (usually within clinic hours, 10 AM – 7 PM IST). After signing in, change it from your account menu.
      </p>

      <form onSubmit={handleSubmit} noValidate className="space-y-3" aria-label="Request password reset">
        <TextField
          name="email"
          label="Email address"
          icon={Mail}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(undefined);
          }}
          error={error}
          autoFocus
        />
        <button
          type="submit"
          className="w-full bg-[#25D366] hover:bg-[#1ebe5d] text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md"
        >
          <MessageCircle className="w-4 h-4" aria-hidden="true" /> Request reset on WhatsApp
        </button>
      </form>

      <Link to="/signin" className="mt-8 inline-flex items-center gap-1.5 text-sm text-[#3E6553] font-semibold hover:underline">
        <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back to sign in
      </Link>
    </AuthLayout>
  );
};
