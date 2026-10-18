import React, { forwardRef, useId, useState } from 'react';
import { AlertCircle, Eye, EyeOff, type LucideIcon } from 'lucide-react';

interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  icon: LucideIcon;
  error?: React.ReactNode;
  hint?: React.ReactNode;
  /**
   * Height reserved under the input for the hint or error, so a message appearing or
   * disappearing never pushes the rest of the form around. Size it to the tallest content.
   */
  messageClassName?: string;
  /** The hint already shows what is wrong (e.g. a rules checklist): keep it visible instead of the error text. */
  hintShowsError?: boolean;
  /** Extra element shown at the right of the label row (e.g. "Forgot password?"). */
  labelAction?: React.ReactNode;
  name: string;
}

const inputClass = (hasError: boolean, padRight: boolean) =>
  `w-full pl-10 ${padRight ? 'pr-11' : 'pr-4'} py-3 rounded-xl border bg-white text-slate-800 text-base sm:text-sm placeholder:text-slate-400 transition-all focus:outline-none focus:ring-2 ${
    hasError
      ? 'border-red-400 focus:ring-red-200 focus:border-red-500'
      : 'border-slate-200 focus:ring-[#3E6553]/30 focus:border-[#3E6553]'
  }`;

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, icon: Icon, error, hint, labelAction, name, type = 'text', messageClassName = 'min-h-5', hintShowsError = false, ...rest }, ref) => {
    const id = `${name}-${useId()}`;
    const [reveal, setReveal] = useState(false);
    const isPassword = type === 'password';
    // Read each message once: in hintShowsError mode the error text lives inside the hint.
    const describedBy =
      (error && hintShowsError ? `${id}-hint` : [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ')) || undefined;

    return (
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor={id} className="block text-sm font-semibold text-[#2D4C3C]">
            {label}
          </label>
          {labelAction}
        </div>
        <div className="relative">
          <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" aria-hidden="true" />
          <input
            ref={ref}
            id={id}
            name={name}
            type={isPassword && reveal ? 'text' : type}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={inputClass(!!error, isPassword)}
            {...rest}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setReveal((r) => !r)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50"
              aria-label={reveal ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
            >
              {reveal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
        </div>
        <div className={`mt-1.5 text-xs ${messageClassName}`}>
          {error && hintShowsError ? (
            <div id={`${id}-hint`} className="text-slate-500">
              <span id={`${id}-error`} className="sr-only">{error} </span>
              {hint}
            </div>
          ) : error ? (
            <p id={`${id}-error`} className="text-red-600 flex items-start gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" />
              <span>{error}</span>
            </p>
          ) : (
            hint && (
              <div id={`${id}-hint`} className="text-slate-500">
                {hint}
              </div>
            )
          )}
        </div>
      </div>
    );
  }
);
TextField.displayName = 'TextField';

/**
 * Form-level error (network, server, rate limit). It slides open instead of popping in, so the
 * fields below glide down once rather than jumping.
 */
export const FormAlert: React.FC<{ message?: string }> = ({ message }) => (
  <div
    className="grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
    style={{ gridTemplateRows: message ? '1fr' : '0fr' }}
  >
    <div className="overflow-hidden">
      {message && (
        <div role="alert" className="mb-3 flex items-start gap-2.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <div>{message}</div>
        </div>
      )}
    </div>
  </div>
);

export const SubmitButton: React.FC<{ loading: boolean; loadingText: string; children: React.ReactNode }> = ({
  loading,
  loadingText,
  children,
}) => (
  <button
    type="submit"
    disabled={loading}
    aria-busy={loading}
    className="w-full bg-[#3E6553] hover:bg-[#2D4C3C] disabled:opacity-70 disabled:cursor-wait text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 shadow-md hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3E6553]"
  >
    {loading ? (
      <>
        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        {loadingText}
      </>
    ) : (
      children
    )}
  </button>
);

/**
 * Only allow redirects to paths inside this app. Resolved the way the browser would, so tricks like
 * "//evil.com", "/\\evil.com" or "/\t/evil.com" (control characters are stripped by URL parsing)
 * can never leave the site.
 */
export function safeNextPath(next: string | null, fallback = '/app'): string {
  if (!next || !next.startsWith('/')) return fallback;
  try {
    const here = window.location.origin;
    const url = new URL(next, here);
    if (url.origin !== here) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
