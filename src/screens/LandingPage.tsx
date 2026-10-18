import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import {
  Calendar,
  ChevronRight,
  Star,
  Award,
  Heart,
  ShieldCheck,
  MessageCircle,
  TrendingUp,
  Utensils,
  Activity,
  CheckCircle2,
  ArrowRight,
  Phone,
  Mail,
  Menu,
  X,
  Sparkles,
  Users,
  Clock,
  Leaf,
} from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { IMAGES, NUTRITION_SERVICES } from '../data/mockData';
import { usePublicPackages } from '../data/usePublicPackages';
import { ServiceIcon, serviceTheme } from '../components/ServiceIcon';
import { useAuth } from '../auth/AuthContext';

const NAV_LINKS = [
  { label: 'Services', id: 'services' },
  { label: 'About', id: 'about' },
  { label: 'Pricing', id: 'pricing' },
  { label: 'How it Works', id: 'how-it-works' },
];

const TESTIMONIALS = [
  {
    name: 'Riya M.',
    condition: 'PCOS · Lost 8 kg',
    quote: '"I had tried 4 diets before Nutrifacts. Dt. Anchal was the first person who actually explained WHY I was gaining weight, not just told me what to eat less of. My hormones are finally balanced."',
    rating: 5,
    avatar: 'RM',
  },
  {
    name: 'Suresh K.',
    condition: 'Type 2 Diabetes · HbA1c 6.8→5.9',
    quote: '"My doctor was shocked at my 90-day blood report. I still eat rice and roti — just in a smarter sequence. Dt. Anchal changed my relationship with food completely."',
    rating: 5,
    avatar: 'SK',
  },
  {
    name: 'Prerna T.',
    condition: 'Hypothyroidism · 6 kg lost',
    quote: '"The thyroid-specific meal plan was something I couldn\'t find anywhere else. Within weeks my energy improved and my TSH numbers started correcting. Highly recommended."',
    rating: 5,
    avatar: 'PT',
  },
];

const STATS = [
  { number: '2,500+', label: 'Patients Transformed', icon: <Users className="w-5 h-5" /> },
  { number: '4+', label: 'Years Clinical Experience', icon: <Award className="w-5 h-5" /> },
  { number: '10', label: 'Clinical Protocols', icon: <Activity className="w-5 h-5" /> },
  { number: '98%', label: 'Satisfaction Rate', icon: <Star className="w-5 h-5" /> },
];

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Book Your Consultation',
    desc: 'Schedule a 30-minute intake session — online video or in-clinic. Available at just ₹500 for your first visit.',
    icon: <Calendar className="w-6 h-6" />,
  },
  {
    step: '02',
    title: 'Receive Your Diet Chart',
    desc: "Dt. Anchal personally crafts your clinical diet plan based on your pathology reports, lifestyle, and cultural food preferences.",
    icon: <Utensils className="w-6 h-6" />,
  },
  {
    step: '03',
    title: 'Track & Transform',
    desc: 'Log meals, monitor weight, get follow-up adjustments, and connect on WhatsApp — all inside the Nutrifacts app.',
    icon: <TrendingUp className="w-6 h-6" />,
  },
];

export const LandingPage: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const { status } = useAuth();
  const location = useLocation();
  const signedIn = status === 'authenticated';
  const { packages: livePackages, failed: pricingFailed } = usePublicPackages();

  // Layout effect: decided before the first paint, so after a refresh mid-page the navbar doesn't
  // flash transparent and then turn white.
  useLayoutEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Support deep links such as /#pricing (used by "Change plan" on the sign-up page).
  useEffect(() => {
    const id = location.hash.slice(1);
    if (id) requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
  }, [location.hash]);

  useEffect(() => {
    document.title = 'Nutrifacts — Nourish with Anchal | Personalized Nutrition & Diet Care';
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ══ STICKY NAVBAR ══════════════════════════════════════════════ */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-md shadow-md border-b border-emerald-100'
          : 'bg-transparent'
      }`}>
        <div className="max-w-6xl mx-auto px-5 py-3.5 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#3E6553] flex items-center justify-center text-xl shadow-sm">
              🥗
            </div>
            <div>
              <p className={`font-bold text-base leading-none tracking-tight transition-colors ${scrolled ? 'text-[#2D4C3C]' : 'text-white'}`}
                 style={{ fontFamily: "'Playfair Display', serif" }}>
                Nutrifacts
              </p>
              <p className={`text-[10px] font-light tracking-widest uppercase transition-colors ${scrolled ? 'text-[#3E6553]' : 'text-emerald-200'}`}>
                with dt. Anchal
              </p>
            </div>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map(n => (
              <button
                key={n.id}
                type="button"
                onClick={() => scrollTo(n.id)}
                className={`text-sm font-medium transition-colors hover:text-[#3E6553] ${scrolled ? 'text-slate-600' : 'text-white/90 hover:text-white'}`}
              >
                {n.label}
              </button>
            ))}
          </div>

          {/* Auth CTAs */}
          <div className="hidden md:flex items-center gap-2">
            {signedIn ? (
              <Link
                id="nav-dashboard"
                to="/app"
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-[#3E6553] hover:bg-[#2D4C3C] text-white transition-all shadow-md inline-flex items-center gap-1.5"
              >
                Open my dashboard <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link
                  id="nav-signin"
                  to="/signin"
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    scrolled
                      ? 'text-[#3E6553] hover:bg-emerald-50 border border-[#3E6553]'
                      : 'text-white border border-white/30 hover:bg-white/10'
                  }`}
                >
                  Sign In
                </Link>
                <Link
                  id="nav-signup"
                  to="/signup"
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-md ${
                    scrolled ? 'bg-[#3E6553] hover:bg-[#2D4C3C] text-white' : 'bg-white text-[#2D4C3C] hover:bg-emerald-50'
                  }`}
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(p => !p)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
            className={`md:hidden w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${
              scrolled ? 'text-slate-700 hover:bg-slate-100' : 'text-white hover:bg-white/10'
            }`}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div id="mobile-menu" className="md:hidden bg-white border-t border-slate-100 shadow-lg">
            <div className="px-5 py-4 space-y-2">
              {NAV_LINKS.map(n => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => scrollTo(n.id)}
                  className="w-full text-left py-2.5 text-sm font-medium text-slate-700 hover:text-[#3E6553] transition-colors border-b border-slate-50"
                >
                  {n.label}
                </button>
              ))}
              <div className="pt-2 flex gap-2">
                {signedIn ? (
                  <Link
                    to="/app"
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-center bg-[#3E6553] text-white hover:bg-[#2D4C3C] transition-all"
                  >
                    Open my dashboard
                  </Link>
                ) : (
                  <>
                    <Link
                      to="/signin"
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-center text-[#3E6553] border border-[#3E6553] hover:bg-emerald-50 transition-all"
                    >
                      Sign In
                    </Link>
                    <Link
                      to="/signup"
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-center bg-[#3E6553] text-white hover:bg-[#2D4C3C] transition-all"
                    >
                      Get Started
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ══ HERO SECTION ══════════════════════════════════════════════ */}
      <section ref={heroRef} className="relative min-h-screen flex items-center overflow-hidden">
        {/* Background image */}
        <img
          src={IMAGES.healthyMealBowl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1C3328]/95 via-[#2D4C3C]/88 to-[#3E6553]/75" />
        {/* Subtle pattern */}
        <div className="absolute inset-0 opacity-5"
             style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />

        <div className="relative z-10 max-w-6xl mx-auto px-5 py-32 lg:py-40 w-full">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left — headline */}
            <div className="space-y-7">
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-200 text-xs font-semibold tracking-wide">Clinical Nutrition Practice · Est. 2022</span>
              </div>

              <div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight"
                    style={{ fontFamily: "'Playfair Display', serif" }}>
                  Nourish Better.<br />
                  <span className="text-emerald-300 italic">Live Healthier.</span>
                </h1>
                <p className="mt-5 text-emerald-100/85 text-base sm:text-lg leading-relaxed max-w-lg">
                  Personalised clinical diet charts, science-backed nutrition protocols, and continuous support from{' '}
                  <strong className="text-white font-semibold">Dt. Anchal Dewan</strong>, M.Sc. Clinical Nutrition & Dietetics — all without crash diets or hunger pangs.
                </p>
              </div>

              {/* Proof points */}
              <div className="flex flex-wrap gap-3 text-sm">
                {[
                  { icon: <Award className="w-4 h-4 text-amber-300" />, text: '4+ Yrs Experience' },
                  { icon: <Heart className="w-4 h-4 text-rose-300" />, text: '2,500+ Transformed' },
                  { icon: <ShieldCheck className="w-4 h-4 text-emerald-300" />, text: 'No Crash Diets' },
                ].map(p => (
                  <span key={p.text} className="flex items-center gap-1.5 text-emerald-100">
                    {p.icon} {p.text}
                  </span>
                ))}
              </div>

              {/* CTAs */}
              <div className="flex flex-wrap gap-3 pt-1">
                <Link
                  id="hero-get-started"
                  to={signedIn ? '/app' : '/signup'}
                  className="px-7 py-3.5 rounded-2xl bg-white text-[#2D4C3C] font-bold text-sm hover:bg-emerald-50 transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
                >
                  {signedIn ? 'Open my dashboard' : 'Start Your Journey'} <ArrowRight className="w-4 h-4" />
                </Link>
                {!signedIn && (
                  <Link
                    id="hero-signin"
                    to="/signin"
                    className="px-7 py-3.5 rounded-2xl border border-white/30 text-white font-semibold text-sm hover:bg-white/10 transition-all backdrop-blur-sm"
                  >
                    I already have an account
                  </Link>
                )}
              </div>

              {/* Pricing hint */}
              <p className="text-emerald-200/70 text-xs">
                First consultation from <strong className="text-emerald-200">₹500</strong> · Follow-ups at <strong className="text-emerald-200">₹300</strong> · No hidden fees
              </p>
            </div>

            {/* Right — Dietitian card */}
            <div className="hidden lg:block">
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-6 space-y-5">
                <img
                  src={IMAGES.dietitianPortrait}
                  alt="Dt. Anchal Dewan"
                  className="w-full h-56 object-cover object-top rounded-2xl border border-white/10"
                />
                <div>
                  <p className="text-white font-bold text-xl" style={{ fontFamily: "'Playfair Display', serif" }}>
                    Dt. Anchal Dewan
                  </p>
                  <p className="text-emerald-200 text-sm">M.Sc. Clinical Nutrition & Dietetics</p>
                  <p className="text-emerald-300/70 text-xs mt-0.5">Founder, Nutrifacts Practice</p>
                </div>
                <blockquote className="text-emerald-100/80 text-sm italic leading-relaxed border-l-2 border-emerald-400/40 pl-4">
                  "Healthy nutrition is not about starvation or guilt. It is about understanding your unique metabolism and building habits that heal from the inside out."
                </blockquote>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white/10 rounded-xl px-3 py-2.5 text-center">
                    <p className="text-white font-bold text-lg">2,500+</p>
                    <p className="text-emerald-200/70 text-[11px]">Patients</p>
                  </div>
                  <div className="bg-white/10 rounded-xl px-3 py-2.5 text-center">
                    <p className="text-white font-bold text-lg">4+ Yrs</p>
                    <p className="text-emerald-200/70 text-[11px]">Experience</p>
                  </div>
                </div>
                <a
                  href="https://wa.me/919872154320?text=Hello%20Dt.%20Anchal%2C%20I%20found%20Nutrifacts%20and%20would%20like%20to%20know%20more."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-[#25D366] text-white text-sm font-semibold hover:bg-[#1ebe5d] transition-all"
                >
                  <MessageCircle className="w-4 h-4 fill-white" />
                  WhatsApp Dt. Anchal
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-white/40 animate-bounce">
          <div className="w-5 h-8 rounded-full border-2 border-white/30 flex items-start justify-center pt-1.5">
            <div className="w-1 h-2 bg-white/50 rounded-full" />
          </div>
        </div>
      </section>

      {/* ══ STATS STRIP ════════════════════════════════════════════════ */}
      <section className="bg-[#2D4C3C] py-10">
        <div className="max-w-5xl mx-auto px-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {STATS.map(s => (
              <div key={s.label} className="text-center space-y-1">
                <div className="flex justify-center text-emerald-300 mb-2">{s.icon}</div>
                <p className="text-white text-3xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>{s.number}</p>
                <p className="text-emerald-200/70 text-xs font-medium tracking-wide">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ SERVICES ═══════════════════════════════════════════════════ */}
      <section id="services" className="scroll-mt-16 py-20 lg:py-28 bg-[#F7FAF8]">
        <div className="max-w-6xl mx-auto px-5">
          {/* Header */}
          <div className="text-center mb-14">
            <span className="inline-block text-[#3E6553] text-xs font-bold tracking-widest uppercase mb-3 bg-emerald-50 px-4 py-1.5 rounded-full border border-emerald-200">
              Clinical Nutrition Services
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#2D4C3C] mt-2"
                style={{ fontFamily: "'Playfair Display', serif" }}>
              Specialised Care for Every Condition
            </h2>
            <p className="mt-4 text-slate-500 max-w-xl mx-auto text-sm leading-relaxed">
              From PCOS and Diabetes to Thyroid and Weight Management — Dt. Anchal brings clinical expertise to your plate.
            </p>
          </div>

          {/* Service grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {NUTRITION_SERVICES.map((svc) => {
              const theme = serviceTheme(svc.iconName);
              return (
                <div
                  key={svc.id}
                  className={`bg-white rounded-2xl border ${theme.border} p-5 hover:shadow-md transition-shadow duration-200 group`}
                >
                  <div className={`w-12 h-12 rounded-xl ${theme.badge} flex items-center justify-center mb-4`}>
                    <ServiceIcon iconName={svc.iconName} className="w-6 h-6" />
                  </div>
                  <h3 className="text-slate-900 font-bold text-base mb-1">{svc.title}</h3>
                  <p className="text-[#3E6553] text-xs font-semibold mb-2">{svc.subtitle}</p>
                  <p className="text-slate-500 text-xs leading-relaxed mb-4">{svc.tagline}</p>
                  <div className="flex items-start justify-between gap-3 pt-3 border-t border-slate-100">
                    <div className="shrink-0">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide block">Starting from</span>
                      <span className="text-[#3E6553] font-bold text-sm font-mono whitespace-nowrap">{svc.priceDisplay}</span>
                    </div>
                    <span className="text-[11px] text-slate-400 text-right min-w-0 pt-3.5 leading-snug">
                      <Clock className="w-3 h-3 inline-block align-[-2px] mr-1" aria-hidden="true" />
                      {svc.duration}
                    </span>
                  </div>
                  <Link
                    to={signedIn ? '/app' : `/signup?service=${encodeURIComponent(svc.id)}`}
                    state={signedIn ? { bookService: svc.title } : undefined}
                    className="mt-3 w-full py-2 rounded-xl text-[#3E6553] text-xs font-semibold border border-emerald-200 hover:bg-emerald-50 transition-colors flex items-center justify-center gap-1"
                  >
                    Book this service <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══ ABOUT / DIETITIAN ═════════════════════════════════════════ */}
      <section id="about" className="scroll-mt-16 py-20 lg:py-28 bg-white">
        <div className="max-w-6xl mx-auto px-5">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Image side */}
            <div className="relative">
              <div className="rounded-3xl overflow-hidden aspect-[4/5] lg:aspect-[3/4]">
                <img
                  src={IMAGES.clinicConsultation}
                  alt="Dt. Anchal Dewan in consultation"
                  className="w-full h-full object-cover"
                />
              </div>
              {/* Floating badge */}
              <div className="absolute -bottom-5 -right-4 lg:-right-8 bg-white rounded-2xl shadow-xl border border-slate-100 px-5 py-4 flex items-center gap-3">
                <img
                  src={IMAGES.dietitianPortrait}
                  alt="Dt. Anchal Dewan"
                  className="w-12 h-12 rounded-full object-cover border-2 border-[#3E6553]/20"
                />
                <div>
                  <p className="text-slate-900 font-bold text-sm">Dt. Anchal Dewan</p>
                  <p className="text-[#3E6553] text-xs font-semibold">M.Sc. Clinical Nutrition</p>
                  <div className="flex gap-0.5 mt-0.5">
                    {Array(5).fill(0).map((_, i) => (
                      <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Text side */}
            <div className="space-y-6 lg:pt-0 pt-6">
              <div>
                <span className="inline-block text-[#3E6553] text-xs font-bold tracking-widest uppercase mb-3 bg-emerald-50 px-4 py-1.5 rounded-full border border-emerald-200">
                  Your Clinical Nutritionist
                </span>
                <h2 className="text-3xl sm:text-4xl font-bold text-[#2D4C3C] mt-3 leading-tight"
                    style={{ fontFamily: "'Playfair Display', serif" }}>
                  Meet Dt. Anchal Dewan
                </h2>
                <p className="text-[#3E6553] font-semibold text-sm mt-1">
                  M.Sc. Clinical Nutrition & Dietetics · Clinical Nutritionist & Dietitian
                </p>
              </div>

              <blockquote className="text-slate-600 text-base leading-relaxed italic border-l-4 border-[#3E6553] pl-5">
                "Healthy nutrition is not about starvation, guilt, or unrealistic crash diet fads. It is about understanding your unique metabolism, honoring your cultural food preferences, and building habits that heal from the inside out."
              </blockquote>

              <div className="space-y-3">
                {[
                  { title: 'Personalized Care', desc: 'Every diet chart is hand-crafted around your family kitchen, allergies, and daily lifestyle.' },
                  { title: 'Clinical Grounding', desc: 'Specialized in PCOS, Type 2 Diabetes, Thyroid, Fatty Liver, and Gut medical nutrition therapy.' },
                  { title: 'No Crash Diets', desc: 'Science-backed, sustainable nutritional rewiring. Not a starvation plan.' },
                ].map(item => (
                  <div key={item.title} className="flex gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[#3E6553] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-slate-900 font-semibold text-sm">{item.title}</p>
                      <p className="text-slate-500 text-xs leading-relaxed mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <a href="tel:+919872154320" className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 hover:bg-emerald-100 transition-colors">
                  <Phone className="w-4 h-4 text-[#3E6553]" />
                  <span className="text-[#3E6553] text-xs font-semibold">+91 98721 54320</span>
                </a>
                <a href="mailto:anchaldewan380@gmail.com" className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 hover:bg-emerald-100 transition-colors min-w-0">
                  <Mail className="w-4 h-4 text-[#3E6553] shrink-0" />
                  <span className="text-[#3E6553] text-xs font-semibold truncate">anchaldewan380@gmail.com</span>
                </a>
              </div>

              <Link
                id="about-book-btn"
                to={signedIn ? '/app' : '/signup'}
                className="px-7 py-3.5 rounded-2xl bg-[#3E6553] hover:bg-[#2D4C3C] text-white font-bold text-sm transition-all shadow-md hover:shadow-lg flex items-center gap-2 w-fit"
              >
                Book 1-on-1 Consultation <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ══ HOW IT WORKS ══════════════════════════════════════════════ */}
      <section id="how-it-works" className="scroll-mt-16 py-20 lg:py-28 bg-[#F7FAF8]">
        <div className="max-w-5xl mx-auto px-5">
          <div className="text-center mb-14">
            <span className="inline-block text-[#3E6553] text-xs font-bold tracking-widest uppercase mb-3 bg-emerald-50 px-4 py-1.5 rounded-full border border-emerald-200">
              Simple Process
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#2D4C3C] mt-2"
                style={{ fontFamily: "'Playfair Display', serif" }}>
              How Nutrifacts Works
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-10 relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-12 left-[20%] right-[20%] h-0.5 bg-gradient-to-r from-emerald-200 via-[#3E6553] to-emerald-200" />

            {HOW_IT_WORKS.map((step, i) => (
              <div key={step.step} className="relative flex flex-col items-center text-center gap-4">
                <div className="relative z-10 w-24 h-24 rounded-full bg-[#3E6553] flex flex-col items-center justify-center text-white shadow-lg">
                  {step.icon}
                  <span className="text-[10px] font-bold tracking-widest text-emerald-200 mt-0.5">STEP {step.step}</span>
                </div>
                <div>
                  <h3 className="text-slate-900 font-bold text-base mb-2">{step.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link
              id="how-it-works-cta"
              to={signedIn ? '/app' : '/signup'}
              className="px-8 py-4 rounded-2xl bg-[#3E6553] hover:bg-[#2D4C3C] text-white font-bold text-sm transition-all shadow-md hover:shadow-lg inline-flex items-center gap-2"
            >
              {signedIn ? 'Open my dashboard' : 'Create Your Free Account'} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ══ PRICING ════════════════════════════════════════════════════ */}
      <section id="pricing" className="scroll-mt-16 py-20 lg:py-28 bg-white">
        <div className="max-w-5xl mx-auto px-5">
          <div className="text-center mb-14">
            <span className="inline-block text-[#3E6553] text-xs font-bold tracking-widest uppercase mb-3 bg-emerald-50 px-4 py-1.5 rounded-full border border-emerald-200">
              Transparent Pricing
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#2D4C3C] mt-2"
                style={{ fontFamily: "'Playfair Display', serif" }}>
              Simple, Affordable Plans
            </h2>
            <p className="mt-4 text-slate-500 text-sm max-w-md mx-auto">
              No hidden fees. No automatic renewals. Pay only for what you need.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {!livePackages && !pricingFailed && [0, 1, 2].map(i => (
              <div key={i} className="rounded-2xl border border-slate-200 p-6 min-h-[550px] md:min-h-[720px] lg:min-h-[550px] animate-pulse bg-slate-50" aria-hidden="true" />
            ))}
            {pricingFailed && (
              <p className="md:col-span-3 text-center text-sm text-slate-500" role="status">
                Plans couldn't be loaded right now. Message us on{' '}
                <a href="https://wa.me/919872154320" target="_blank" rel="noopener noreferrer" className="text-[#3E6553] font-semibold underline">WhatsApp</a>{' '}
                for current pricing.
              </p>
            )}
            {livePackages?.map(pkg => (
              <div
                key={pkg.id}
                className={`rounded-2xl border p-6 flex flex-col relative min-h-[550px] md:min-h-[720px] lg:min-h-[550px] transition-[box-shadow,border-color] duration-200 ${
                  pkg.isPopular
                    ? 'bg-[#2D4C3C] border-[#3E6553] text-white shadow-2xl scale-[1.03]'
                    : 'bg-white border-slate-200 hover:border-emerald-200 hover:shadow-md'
                }`}
              >
                {pkg.isPopular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 text-[10px] font-bold uppercase tracking-widest px-4 py-1 rounded-full shadow-md">
                    ✦ Most Recommended
                  </div>
                )}

                <div className="mb-5">
                  <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${pkg.isPopular ? 'text-emerald-300' : 'text-[#3E6553]'}`}>
                    {pkg.durationLabel}
                  </p>
                  <h3 className={`text-lg font-bold mb-1 ${pkg.isPopular ? 'text-white' : 'text-slate-900'}`}>
                    {pkg.title}
                  </h3>
                  <p className={`text-xs leading-relaxed ${pkg.isPopular ? 'text-emerald-200/80' : 'text-slate-500'}`}>
                    {pkg.tagline}
                  </p>
                </div>

                <div className="mb-5">
                  <span className={`text-4xl font-bold ${pkg.isPopular ? 'text-white' : 'text-[#2D4C3C]'}`}
                        style={{ fontFamily: "'Playfair Display', serif" }}>
                    ₹{pkg.priceInr.toLocaleString('en-IN')}
                  </span>
                  <span className={`text-sm ml-1 ${pkg.isPopular ? 'text-emerald-300' : 'text-slate-400'}`}>
                    incl. all taxes
                  </span>
                </div>

                <ul className="space-y-2.5 mb-6 flex-1">
                  {pkg.inclusions.map(inc => (
                    <li key={inc} className="flex gap-2.5 text-xs">
                      <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${pkg.isPopular ? 'text-emerald-300' : 'text-[#3E6553]'}`} />
                      <span className={pkg.isPopular ? 'text-emerald-100' : 'text-slate-600'}>{inc}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  to={signedIn ? '/app' : `/signup?plan=${encodeURIComponent(pkg.id)}`}
                  state={signedIn ? { openTab: 'plans' } : undefined}
                  className={`w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                    pkg.isPopular
                      ? 'bg-white text-[#2D4C3C] hover:bg-emerald-50'
                      : 'bg-[#3E6553] text-white hover:bg-[#2D4C3C]'
                  }`}
                >
                  Choose this plan <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-slate-400 mt-8">
            UPI · Cards · Net Banking accepted · All payments fully secure
          </p>
        </div>
      </section>

      {/* ══ TESTIMONIALS ══════════════════════════════════════════════ */}
      <section className="py-20 lg:py-28 bg-[#F7FAF8]">
        <div className="max-w-5xl mx-auto px-5">
          <div className="text-center mb-14">
            <span className="inline-block text-[#3E6553] text-xs font-bold tracking-widest uppercase mb-3 bg-emerald-50 px-4 py-1.5 rounded-full border border-emerald-200">
              Patient Stories
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#2D4C3C] mt-2"
                style={{ fontFamily: "'Playfair Display', serif" }}>
              Real Results, Real People
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs hover:shadow-md transition-all">
                <div className="flex gap-0.5 mb-4">
                  {Array(t.rating).fill(0).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-slate-600 text-sm leading-relaxed italic mb-5">{t.quote}</p>
                <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                  <div className="w-10 h-10 rounded-full bg-[#3E6553] text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-slate-900 font-bold text-sm">{t.name}</p>
                    <p className="text-[#3E6553] text-xs font-medium">{t.condition}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FINAL CTA BANNER ══════════════════════════════════════════ */}
      <section className="relative py-20 overflow-hidden bg-gradient-to-br from-[#1C3328] via-[#2D4C3C] to-[#3E6553]">
        <div className="absolute inset-0 opacity-5"
             style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        <div className="relative z-10 max-w-3xl mx-auto px-5 text-center space-y-7">
          <h2 className="text-3xl sm:text-4xl font-bold text-white"
              style={{ fontFamily: "'Playfair Display', serif" }}>
            Begin Your Nutrition Journey Today
          </h2>
          <p className="text-emerald-100/80 text-base leading-relaxed max-w-xl mx-auto">
            Thousands of patients have already transformed their health with Dt. Anchal's clinical approach. Your personalised diet chart is one step away.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              id="cta-get-started"
              to={signedIn ? '/app' : '/signup'}
              className="px-8 py-4 rounded-2xl bg-white text-[#2D4C3C] font-bold text-sm hover:bg-emerald-50 transition-all shadow-lg flex items-center gap-2"
            >
              {signedIn ? 'Open my dashboard' : 'Create Free Account'} <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="https://wa.me/919872154320?text=Hello%20Dt.%20Anchal%2C%20I%20would%20like%20to%20know%20more%20about%20Nutrifacts."
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 rounded-2xl border border-white/30 text-white font-semibold text-sm hover:bg-white/10 transition-all backdrop-blur-sm flex items-center gap-2"
            >
              <MessageCircle className="w-4 h-4" /> WhatsApp Us
            </a>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ════════════════════════════════════════════════════ */}
      <footer className="bg-[#1C3328] py-12">
        <div className="max-w-6xl mx-auto px-5">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
            {/* Brand */}
            <div className="sm:col-span-2 lg:col-span-1 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#3E6553] flex items-center justify-center text-xl">🥗</div>
                <p className="text-white font-bold text-base" style={{ fontFamily: "'Playfair Display', serif" }}>Nutrifacts</p>
              </div>
              <p className="text-emerald-200/60 text-xs leading-relaxed">
                Clinical nutrition platform by Dt. Anchal Dewan. Nourish Better. Live Healthier.
              </p>
              <a
                href="https://wa.me/919872154320"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-[#25D366]/10 border border-[#25D366]/20 text-[#25D366] text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-[#25D366]/20 transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" /> Chat on WhatsApp
              </a>
            </div>

            {/* Quick Links */}
            <div>
              <p className="text-emerald-200 text-xs font-bold uppercase tracking-widest mb-4">Quick Links</p>
              <ul className="space-y-2.5">
                {NAV_LINKS.map(l => (
                  <li key={l.id}>
                    <button type="button" onClick={() => scrollTo(l.id)}
                      className="text-emerald-100/60 text-xs hover:text-emerald-200 transition-colors">
                      {l.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Services */}
            <div>
              <p className="text-emerald-200 text-xs font-bold uppercase tracking-widest mb-4">Services</p>
              <ul className="space-y-2.5">
                {NUTRITION_SERVICES.slice(0, 4).map(s => (
                  <li key={s.id}>
                    <span className="text-emerald-100/60 text-xs">{s.title}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <p className="text-emerald-200 text-xs font-bold uppercase tracking-widest mb-4">Contact</p>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <Phone className="w-3.5 h-3.5 text-[#3E6553] mt-0.5 shrink-0" />
                  <a href="tel:+919872154320" className="text-emerald-100/60 text-xs hover:text-emerald-200">+91 98721 54320</a>
                </li>
                <li className="flex items-start gap-2">
                  <Mail className="w-3.5 h-3.5 text-[#3E6553] mt-0.5 shrink-0" />
                  <a href="mailto:anchaldewan380@gmail.com" className="text-emerald-100/60 text-xs hover:text-emerald-200 break-all">anchaldewan380@gmail.com</a>
                </li>
                <li className="flex items-start gap-2">
                  <Clock className="w-3.5 h-3.5 text-[#3E6553] mt-0.5 shrink-0" />
                  <span className="text-emerald-100/60 text-xs">Clinic Hours: 10:00 AM – 7:00 PM IST</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-emerald-100/30 text-xs">
              © 2026 Nutrifacts · Dt. Anchal Dewan · M.Sc. Clinical Nutrition & Dietetics
            </p>
            {!signedIn && (
              <div className="flex gap-3">
                <Link to="/signin" className="text-emerald-100/50 text-xs hover:text-emerald-200 transition-colors">
                  Sign In
                </Link>
                <span className="text-emerald-100/20">·</span>
                <Link to="/signup" className="text-emerald-100/50 text-xs hover:text-emerald-200 transition-colors">
                  Create Account
                </Link>
              </div>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};
