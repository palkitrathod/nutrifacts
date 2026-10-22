import React, { useState } from 'react';
import {
  BadgePercent,
  CircleCheck,
  Sparkles,
  Utensils,
  TrendingUp,
  Calendar,
  MessageCircle,
  Droplet,
  ChevronRight,
  ShieldCheck,
  Check,
  ArrowRight,
  Heart,
  Award,
  Clock,
  Plus,
  X,
  CreditCard,
  Tag,
} from 'lucide-react';
import { useNutrition, trackerForToday } from '../context/NutritionContext';
import { ServiceIcon, serviceTheme } from '../components/ServiceIcon';
import { lengthSaving, planFamilies, planHook, planIcon, sortPlans } from '../components/PlanCard';
import { IMAGES } from '../data/mockData';
import { NutritionService, NutritionPackage, ServiceGroup } from '../types/nutrition';
import { ServiceCard, ServiceDetailsDialog, ServiceGroupTabs } from '../components/ServiceCatalog';

interface HomeScreenProps {
  onNavigateTab: (tab: string) => void;
  onOpenBookAppointment: (serviceTitle?: string) => void;
  onOpenPdfChart: () => void;
  onOpenCheckout?: (pkg: NutritionPackage) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigateTab,
  onOpenBookAppointment,
  onOpenPdfChart,
  onOpenCheckout,
}) => {
  const {
    currentUser,
    isDietitian,
    getCurrentUserDietChart,
    services,
    packages,
    dailyTrackers,
    updateWaterIntake,
    toggleMealCompletion,
    patients,
    appointments,
  } = useNutrition();
  const homePlans = sortPlans(packages.filter((p) => p.isActive));
  const [lengthChoice, setLengthChoice] = useState<Record<string, string>>({});

  const [selectedService, setSelectedService] = useState<NutritionService | null>(null);
  const [serviceGroup, setServiceGroup] = useState<ServiceGroup>('everyday');

  const currentChart = getCurrentUserDietChart();
  const todayKey = currentUser.id;
  // Same rule as the + / − actions: a new day (or a new account) starts from zero.
  const tracker = trackerForToday(dailyTrackers[todayKey]);

  const waterGoal = Math.round((currentUser.waterGoalLitres || 3.0) * 4); // ~4 glasses per litre = 12 glasses
  const waterPercentage = Math.min(100, Math.round((tracker.waterGlasses / waterGoal) * 100));

  // Determine next pending meal for the patient
  const pendingMeal = currentChart?.meals.find((m) => !tracker.mealsChecked[m.id]) || currentChart?.meals[0];

  return (
    <div className="flex-1 pb-16 space-y-5 px-4 pt-4 md:px-8 md:pt-6 max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto w-full">
      
      {/* Welcome Banner */}
      <section className="bg-gradient-to-br from-[#3E6553] via-[#48735F] to-[#2D4C3C] rounded-2xl md:rounded-3xl p-5 md:p-7 text-white shadow-md relative overflow-hidden">
        {/* Subtle decorative circles */}
        <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-white/5 pointer-events-none blur-2xl" />
        <div className="absolute right-8 bottom-0 w-32 h-32 rounded-full bg-emerald-300/10 pointer-events-none blur-xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2 max-w-xl">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-emerald-200 block">
              Nutrifacts with dt.Anchal
            </span>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-serif font-bold tracking-tight text-white leading-tight">
              &ldquo;Your Health, Your Nutrition, Your Journey.&rdquo;
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed font-light">
              Welcome back, <strong className="font-semibold text-white">{currentUser.name}</strong>. Nourish better, live healthier with science-backed, sustainable clinical nutrition.
            </p>

            {/* Micro proof line */}
            <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px] text-emerald-200">
              <span className="flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-amber-300" />
                <span>4+ Yrs Clinical Nutrition Experience</span>
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Heart className="w-3.5 h-3.5 text-rose-300" />
                <span>2,500+ Transformed Lives</span>
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                <span>No Crash Diets</span>
              </span>
            </div>
          </div>

          {/* Quick CTA on Desktop */}
          <div className="flex flex-row md:flex-col gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onOpenBookAppointment()}
              className="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-white text-[#3E6553] font-semibold text-xs hover:bg-emerald-50 active:scale-98 transition-all shadow-xs flex items-center justify-center gap-1.5"
            >
              <Calendar className="w-4 h-4" />
              <span>Book Consultation</span>
            </button>
            {currentChart && (
              <button
                type="button"
                onClick={onOpenPdfChart}
                className="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-medium text-xs transition-all border border-white/20 flex items-center justify-center gap-1.5"
              >
                <Utensils className="w-4 h-4" />
                <span>View Diet Chart</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Consultation Pricing Model Highlight */}
      <section className="bg-white rounded-2xl border border-emerald-100 p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#3E6553] flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                <span>Affordable Consultation Pricing</span>
              </span>
              <span className="text-[10px] bg-emerald-50 text-emerald-800 font-semibold px-2 py-0.5 rounded-full border border-emerald-200">
                Transparent & Direct
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Personalized clinical care without expensive lock-ins. Pay per session as you progress.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onOpenBookAppointment()}
              className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-left transition-colors cursor-pointer"
            >
              <span className="text-[10px] text-slate-500 block uppercase font-medium">First Session</span>
              <span className="text-sm font-bold font-mono text-[#3E6553]">₹500</span>
              <span className="text-[9px] text-slate-500 block">Health & Diet Intake</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenBookAppointment()}
              className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-left transition-colors cursor-pointer"
            >
              <span className="text-[10px] text-slate-500 block uppercase font-medium">Follow-ups</span>
              <span className="text-sm font-bold font-mono text-[#3E6553]">₹300</span>
              <span className="text-[9px] text-slate-500 block">Progress & Updates</span>
            </button>
          </div>
        </div>
      </section>

      {/* Quick Action Grid (Android Thumb Zone Friendly) */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => onNavigateTab('diet')}
          className="p-3.5 rounded-2xl bg-white border border-slate-200/80 hover:border-emerald-300 hover:shadow-xs transition-all text-left flex flex-col justify-between min-h-[92px] group"
        >
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#3E6553] flex items-center justify-center group-hover:scale-105 transition-transform">
            <Utensils className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-800 block">
              {isDietitian ? 'Manage Diet Plans' : 'My Diet Chart'}
            </span>
            <span className="text-[11px] text-slate-500">
              {currentChart ? `v${currentChart.version} Active` : 'Review charts'}
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('progress')}
          className="p-3.5 rounded-2xl bg-white border border-slate-200/80 hover:border-emerald-300 hover:shadow-xs transition-all text-left flex flex-col justify-between min-h-[92px] group"
        >
          <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center group-hover:scale-105 transition-transform">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-800 block">
              {isDietitian ? 'Patient Progress' : 'Track Weight'}
            </span>
            <span className="text-[11px] text-slate-500">
              {currentUser.currentWeightKg ? `${currentUser.currentWeightKg} kg recorded` : 'View chart'}
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onOpenBookAppointment()}
          className="p-3.5 rounded-2xl bg-white border border-slate-200/80 hover:border-emerald-300 hover:shadow-xs transition-all text-left flex flex-col justify-between min-h-[92px] group"
        >
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-800 block">Book Consult</span>
            <span className="text-[11px] text-slate-500">Video & In-Clinic</span>
          </div>
        </button>

        <a
          href="https://wa.me/919872154320?text=Hello%20Dt.%20Anchal%2C%20I%20am%20consulting%20via%20the%20Nutrifacts%20app."
          target="_blank"
          rel="noopener noreferrer"
          className="p-3.5 rounded-2xl bg-white border border-slate-200/80 hover:border-emerald-300 hover:shadow-xs transition-all text-left flex flex-col justify-between min-h-[92px] group"
        >
          <div className="w-9 h-9 rounded-xl bg-[#25D366]/15 text-[#128C7E] flex items-center justify-center group-hover:scale-105 transition-transform">
            <MessageCircle className="w-4 h-4 fill-[#25D366] text-[#25D366]" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-800 block">WhatsApp Chat</span>
            <span className="text-[11px] text-slate-500">Direct consultation</span>
          </div>
        </a>
      </section>

      {/* Dietitian Spotlight & Philosophy Card */}
      <section className="bg-white rounded-2xl md:rounded-3xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="flex flex-col md:flex-row items-center">
          <div className="w-full md:w-2/5 h-64 md:h-72 relative bg-emerald-900/10 overflow-hidden">
            <img
              src={IMAGES.dietitianPortrait}
              alt="Dt. Anchal Dewan"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-top"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent md:hidden" />
            <div className="absolute bottom-3 left-3 text-white md:hidden">
              <span className="text-xs font-semibold">Dt. Anchal Dewan</span>
              <span className="text-[10px] block opacity-90">Founder, Nutrifacts</span>
            </div>
          </div>

          <div className="p-5 md:p-6 md:w-3/5 space-y-3">
            <div className="hidden md:block">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#3E6553] tracking-wide uppercase">
                  Your Clinical Nutritionist
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                <span className="text-xs text-slate-500">Nutrifacts Practice</span>
              </div>
              <h2 className="text-xl font-serif font-bold text-slate-900 mt-0.5">
                Dt. Anchal Dewan
              </h2>
              <p className="text-xs text-slate-600 font-medium">
                M.Sc. Clinical Nutrition &amp; Dietetics · Clinical Nutritionist &amp; Dietitian
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-[11px] bg-emerald-50 text-[#3E6553] font-semibold px-2.5 py-0.5 rounded-full border border-emerald-200">
                  4+ Years Experience in Clinical Nutrition
                </span>
                <span className="text-[11px] text-slate-500">
                  Medical Nutrition Therapy (MNT)
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              &ldquo;Healthy nutrition is not about starvation, guilt, or unrealistic crash diet fads. It is about understanding your unique metabolism, honoring your cultural food preferences, and building habits that heal from the inside out.&rdquo;
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1 text-xs text-slate-700">
              <div className="p-2.5 rounded-xl bg-[#F7F9F7] border border-emerald-900/5">
                <span className="font-semibold text-slate-900 block text-[11px]">Personalized Care</span>
                <span className="text-[11px] text-slate-500">Every diet chart hand-crafted for your lifestyle.</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#F7F9F7] border border-emerald-900/5">
                <span className="font-semibold text-slate-900 block text-[11px]">Clinical Grounding</span>
                <span className="text-[11px] text-slate-500">PCOS, Diabetes, Thyroid & Gut medical therapy.</span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <span className="text-xs font-mono text-emerald-800 font-medium">
                Clinic: +91 98721 54320
              </span>
              <button
                type="button"
                onClick={() => onOpenBookAppointment()}
                className="text-xs font-semibold text-[#3E6553] hover:text-[#2D4C3C] flex items-center gap-1 group"
              >
                <span>Book 1-on-1 Consultation</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Two Column Grid: Today's Diet Snapshot & Hydration Tracker */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Next Meal & Plan Snapshot */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Utensils className="w-4 h-4 text-[#3E6553]" />
                <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                  Today&apos;s Diet Schedule
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('diet')}
                className="text-[11px] text-emerald-800 font-medium hover:underline flex items-center gap-0.5"
              >
                <span>Full Chart</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {currentChart && pendingMeal ? (
              <div className="p-3.5 rounded-xl bg-[#FAFBF9] border border-emerald-900/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#3E6553]">
                    {pendingMeal.timingLabel}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {pendingMeal.timeSlot}
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-800">
                  {pendingMeal.title}
                </p>
                <p className="text-[11px] text-slate-500 leading-snug">
                  {pendingMeal.options[0]}
                </p>

                <div className="pt-1 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">
                    Follow-up date: <strong className="text-slate-700">{currentChart.followUpDate}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleMealCompletion(pendingMeal.id)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-all ${
                      tracker.mealsChecked[pendingMeal.id]
                        ? 'bg-emerald-700 text-white'
                        : 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200'
                    }`}
                  >
                    <Check className="w-3 h-3" />
                    <span>{tracker.mealsChecked[pendingMeal.id] ? 'Completed' : 'Mark Eaten'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-slate-400 text-xs">
                <p>No active diet chart assigned yet.</p>
                <button
                  type="button"
                  onClick={() => onOpenBookAppointment()}
                  className="mt-2 text-emerald-800 font-semibold underline text-xs"
                >
                  Book assessment with Dt. Anchal
                </button>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Program: {currentUser.assignedProgram || 'Clinical Nutrition'}</span>
            {currentChart && (
              <button
                type="button"
                onClick={onOpenPdfChart}
                className="text-[#3E6553] font-semibold hover:underline"
              >
                Print / Save PDF
              </button>
            )}
          </div>
        </div>

        {/* Daily Hydration Logger */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Droplet className="w-4 h-4 text-sky-600 fill-sky-600" />
                <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                  Hydration Tracker
                </h3>
              </div>
              <span className="text-[11px] text-sky-800 font-medium">
                Goal: {currentUser.waterGoalLitres || 3.0} Litres
              </span>
            </div>

            <div className="flex items-center justify-between gap-4 py-2">
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-slate-900 tabular-nums font-mono">
                    {tracker.waterGlasses}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">/ {waterGoal} glasses</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {(tracker.waterGlasses * 0.25).toFixed(1)} L consumed today ({waterPercentage}%)
                </p>
              </div>

              {/* Quick Stepper Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => updateWaterIntake(-1)}
                  disabled={tracker.waterGlasses <= 0}
                  className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-base transition-colors disabled:opacity-40 min-w-[36px]"
                  title="Remove 1 glass"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={() => updateWaterIntake(1)}
                  className="px-3 h-9 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs flex items-center gap-1 transition-colors shadow-xs"
                  title="Add 1 glass"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+250ml</span>
                </button>
              </div>
            </div>

            {/* Visual Glass Pill Bar */}
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden mt-1">
              <div
                className="bg-sky-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${waterPercentage}%` }}
              />
            </div>
          </div>

          <p className="text-[11px] text-slate-500 italic pt-2 border-t border-slate-100">
            Tip from Dt. Anchal: Drink 1 glass of warm water 20 mins before lunch to promote digestive satiety.
          </p>
        </div>

      </section>

      {/* Nutrition Care Packages & Online Payment Section */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-[#3E6553] text-xs font-bold uppercase tracking-wider">
              <CreditCard className="w-3.5 h-3.5" />
              <span>Nutrition Packages & Pricing</span>
            </div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight mt-0.5">
              Choose Your Nutrition Care Plan
            </h2>
            <p className="text-xs text-slate-500">
              One-time consultations or ongoing monthly care. Pay online via UPI, Cards, or Net Banking.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('plans')}
            className="text-xs text-[#3E6553] font-semibold hover:underline hidden sm:block"
          >
            Compare all packages &rarr;
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 pt-2">
          {planFamilies(homePlans).map((family) => {
            const pkg = family.find((p) => p.id === lengthChoice[family[0].id]) ?? family.find((p) => p.bundleOf?.months === 3) ?? family[0];
            const withLengths = family.length > 1;
            const Icon = planIcon(family[0]);
            const hook = planHook(pkg, homePlans, withLengths);
            const HookIcon = hook.icon;
            const saving = lengthSaving(pkg, family);
            const best = Math.max(...family.map((p) => lengthSaving(p, family).pct));
            // A plan offered in several lengths is "Most popular"; "Best value" is shown on its longest length instead.
            const bestValue = !withLengths && !!pkg.isBestValue;
            const highlighted = bestValue || family.some((p) => p.isPopular);
            return (
              <div
                key={family[0].id}
                className={`relative p-4 rounded-2xl bg-white border flex flex-col justify-between transition-all ${
                  bestValue
                    ? 'border-amber-300 shadow-md ring-1 ring-amber-200'
                    : pkg.isPopular
                      ? 'border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                      : 'border-slate-200 hover:border-emerald-200'
                }`}
              >
                {highlighted && (
                  <span className={`absolute -top-2.5 left-4 inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${bestValue ? 'bg-amber-400 text-amber-950' : 'bg-[#3E6553] text-white'}`}>
                    <Sparkles className="w-2.5 h-2.5" aria-hidden="true" /> {bestValue ? 'Best value' : 'Most popular'}
                  </span>
                )}
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${bestValue ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-[#3E6553]'}`}>
                      <Icon className="w-4.5 h-4.5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[10px] font-bold text-emerald-800 uppercase tracking-wider truncate">{pkg.durationLabel}</span>
                      <h3 className="font-bold text-sm text-slate-900 leading-snug">{withLengths ? family[0].familyTitle ?? family[0].title : pkg.title}</h3>
                    </div>
                  </div>

                  {withLengths && (
                    <div role="radiogroup" aria-label="Choose how long" className="flex gap-1 p-1 rounded-lg bg-slate-100">
                      {family.map((p) => {
                        const s = lengthSaving(p, family);
                        const active = p.id === pkg.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => setLengthChoice((c) => ({ ...c, [family[0].id]: p.id }))}
                            className={`flex-1 rounded-md px-1 py-1 text-[11px] font-semibold transition-colors ${active ? 'bg-white text-[#2D4C3C] shadow-xs' : 'text-slate-600 hover:bg-white/70'}`}
                          >
                            {s.months === 1 ? '1 mo' : `${s.months} mo`}
                            {s.pct > 0 && <span className={`ml-1 text-[10px] font-bold ${s.pct === best ? 'text-amber-700' : 'text-amber-600'}`}>−{s.pct}%</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex flex-wrap items-baseline gap-x-1.5">
                    <span className="text-2xl font-bold text-[#2D4C3C]" style={{ fontFamily: "'Playfair Display', serif" }}>
                      ₹{pkg.priceInr.toLocaleString('en-IN')}
                    </span>
                    <span className="text-[11px] text-slate-400">{saving.months > 1 ? `for ${saving.months} months` : `for ${pkg.validityDays} days`}</span>
                    {saving.pct > 0 && (
                      <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-400 text-amber-950 font-bold px-2 py-0.5 text-[10px]">
                        <BadgePercent className="w-3 h-3" aria-hidden="true" /> You save {saving.pct}%
                      </span>
                    )}
                  </div>

                  <p className="flex items-start gap-1.5 rounded-lg bg-emerald-50 border border-emerald-100 px-2.5 py-2 text-[11px] font-medium text-emerald-900">
                    <HookIcon className="w-3.5 h-3.5 shrink-0 mt-px text-[#3E6553]" aria-hidden="true" />
                    <span>{hook.text}</span>
                  </p>

                  <ul className="space-y-1 text-[11px] text-slate-600">
                    {pkg.inclusions.slice(0, 2).map((inc, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <CircleCheck className="w-3.5 h-3.5 text-[#3E6553] shrink-0 mt-px" aria-hidden="true" />
                        <span>{inc}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenCheckout) onOpenCheckout(pkg);
                      else onNavigateTab('plans');
                    }}
                    className={`w-full py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-all ${
                      highlighted
                        ? 'bg-[#3E6553] hover:bg-[#2D4C3C] text-white shadow-xs'
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border border-emerald-200'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Select & Pay Online</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Nutrition programs: 15 programs in 4 categories */}
      {/* @container: columns follow the space the app actually has, not the window. */}
      <section className="@container space-y-3 pt-2">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">Nutrition Programs</h2>
          <p className="text-xs text-slate-500">15 programs built around your goals, food preferences, routine and reports</p>
        </div>

        <ServiceGroupTabs value={serviceGroup} onChange={setServiceGroup} services={services} />

        <div id={`programs-${serviceGroup}`} role="tabpanel" aria-labelledby={`programs-tab-${serviceGroup}`} className="grid grid-cols-1 @lg:grid-cols-2 @4xl:grid-cols-3 gap-3">
          {services
            .filter((svc) => svc.group === serviceGroup)
            .map((svc) => (
              <ServiceCard
                key={svc.id}
                svc={svc}
                onDetails={() => setSelectedService(svc)}
                action={(months) => (
                  <button
                    type="button"
                    onClick={() => onOpenBookAppointment(months > 1 ? `${svc.title} (${months} months)` : svc.title)}
                    className="py-2 rounded-xl text-xs font-semibold bg-[#3E6553] hover:bg-[#2D4C3C] text-white flex items-center justify-center gap-1"
                  >
                    <Calendar className="w-3.5 h-3.5" aria-hidden="true" /> {svc.assessmentFirst ? 'Book assessment' : 'Book'}
                  </button>
                )}
              />
            ))}
        </div>
      </section>

      {selectedService && (
        <ServiceDetailsDialog
          svc={selectedService}
          onClose={() => setSelectedService(null)}
          action={
            <button
              type="button"
              onClick={() => {
                const svc = selectedService.title;
                setSelectedService(null);
                onOpenBookAppointment(svc);
              }}
              className="px-5 py-2.5 rounded-xl bg-[#3E6553] hover:bg-[#2D4C3C] text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm"
            >
              <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Book Consultation</span>
            </button>
          }
        />
      )}

    </div>
  );
};
