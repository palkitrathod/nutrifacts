import React, { useEffect } from 'react';
import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';

export const BrandLogo: React.FC<{ light?: boolean }> = ({ light }) => (
  <Link to="/" className="flex items-center gap-2.5 w-fit" aria-label="Nutrifacts home">
    <div className="w-9 h-9 rounded-xl bg-[#3E6553] flex items-center justify-center text-xl shadow-sm" aria-hidden="true">
      🥗
    </div>
    <div>
      <p
        className={`font-bold text-base leading-none tracking-tight ${light ? 'text-white' : 'text-[#2D4C3C]'}`}
        style={{ fontFamily: "'Playfair Display', serif" }}
      >
        Nutrifacts
      </p>
      <p className={`text-[10px] font-light tracking-widest uppercase ${light ? 'text-emerald-200' : 'text-[#3E6553]'}`}>
        with dt. Anchal
      </p>
    </div>
  </Link>
);

export function usePageTitle(title: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · Nutrifacts`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}

interface AuthLayoutProps {
  /** Visual story panel shown beside the form on large screens. */
  aside: React.ReactNode;
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ aside, children }) => (
  <div className="min-h-screen bg-[#F7FAF8] lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
    <aside className="hidden lg:flex relative overflow-hidden">{aside}</aside>

    <main className="flex flex-col min-h-screen">
      <header className="flex items-center justify-between px-5 sm:px-10 py-5">
        <div className="lg:invisible">
          <BrandLogo />
        </div>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-[#2D4C3C] transition-colors rounded-lg px-2 py-1 focus-visible:outline-2 focus-visible:outline-[#3E6553]"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back to home
        </Link>
      </header>

      {/* Top-anchored (not vertically centred) so the form never jumps when messages appear. */}
      <div className="flex-1 flex items-start justify-center px-5 sm:px-10 pt-2 sm:pt-[6vh] pb-12">
        <div className="w-full max-w-[440px]">{children}</div>
      </div>
    </main>
  </div>
);

/** Full-bleed photo with the brand gradient on top, used by the aside panels. */
export const AsidePhoto: React.FC<{ src: string; children: React.ReactNode }> = ({ src, children }) => (
  <div className="relative w-full flex flex-col">
    <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" />
    <div className="absolute inset-0 bg-gradient-to-br from-[#1C3328]/95 via-[#2D4C3C]/90 to-[#3E6553]/80" />
    <div
      className="absolute inset-0 opacity-5"
      style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }}
    />
    <div className="relative z-10 flex flex-col h-full p-10 xl:p-14">
      <BrandLogo light />
      <div className="flex-1 flex flex-col justify-center py-10">{children}</div>
    </div>
  </div>
);
