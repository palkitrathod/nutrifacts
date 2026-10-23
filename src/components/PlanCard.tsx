import React, { useState } from 'react';
import {
  BadgeIndianRupee,
  BadgePercent,
  CalendarHeart,
  CalendarPlus,
  ChevronDown,
  CircleArrowUp,
  CircleCheck,
  ClipboardList,
  Coffee,
  Columns3,
  FileSearch,
  Gift,
  HeartPulse,
  Info,
  Leaf,
  MessageCircle,
  Minus,
  PiggyBank,
  RefreshCwOff,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Target,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import type { NutritionPackage } from '../types/nutrition';
import { bundleSavings, EARLY_RENEWAL_WINDOW_DAYS, RENEWAL_BONUS_DAYS } from '../shared/plans';
import { REFUND_PROMISE_DAYS } from '../shared/pricing';
import { ServiceIcon } from './ServiceIcon';

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/** One icon per kind of plan. */
export function planIcon(pkg: NutritionPackage): LucideIcon {
  if (pkg.bundleOf) return CalendarHeart;
  switch (pkg.category) {
    case 'consultation':
      return Stethoscope;
    case 'diet_plan':
      return ClipboardList;
    case 'monthly_care':
      return HeartPulse;
    default:
      return Leaf;
  }
}

/** Plans in the clinic's order (the dietitian's own new plans go last). */
export const sortPlans = (list: NutritionPackage[]) =>
  [...list].sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));

/** A bundle's price per month and saving against its base plan (if that plan is on sale). */
export function bundleInfo(pkg: NutritionPackage, all: NutritionPackage[]) {
  if (!pkg.bundleOf) return undefined;
  const base = all.find((p) => p.id === pkg.bundleOf!.packageId);
  if (!base) return undefined;
  return { ...bundleSavings(pkg.priceInr, base.priceInr, pkg.bundleOf.months), months: pkg.bundleOf.months, base };
}

/**
 * Plans grouped for display: a plan together with its longer bundles (1 / 3 / 6 months), shortest first.
 * A bundle whose base plan isn't on sale is shown on its own.
 */
export function planFamilies(list: NutritionPackage[]): NutritionPackage[][] {
  const sorted = sortPlans(list);
  const ids = new Set(sorted.map((p) => p.id));
  const families: NutritionPackage[][] = [];
  for (const p of sorted) {
    if (p.bundleOf && ids.has(p.bundleOf.packageId)) continue; // shown inside its base plan's card
    const bundles = sorted
      .filter((b) => b.bundleOf?.packageId === p.id)
      .sort((a, b) => a.bundleOf!.months - b.bundleOf!.months);
    families.push([p, ...bundles]);
  }
  return families;
}

/** How a length compares with paying month by month: "save 27% (₹3,995)". */
export function lengthSaving(pkg: NutritionPackage, family: NutritionPackage[]) {
  const months = pkg.bundleOf?.months ?? 1;
  const base = family[0];
  if (months <= 1 || base.id === pkg.id) return { months: 1, perMonthInr: pkg.priceInr, savingInr: 0, pct: 0 };
  const { perMonthInr, savingInr } = bundleSavings(pkg.priceInr, base.priceInr, months);
  return { months, perMonthInr, savingInr, pct: Math.round((savingInr / (base.priceInr * months)) * 100) };
}

/** The "why this is a good deal for you" line on each plan. */
export function planHook(pkg: NutritionPackage, all: NutritionPackage[], inFamily = false): { icon: LucideIcon; text: string } {
  const bundle = bundleInfo(pkg, all);
  if (inFamily && pkg.category === 'monthly_care') {
    return { icon: CalendarPlus, text: `Renew in your last ${EARLY_RENEWAL_WINDOW_DAYS} days and get ${RENEWAL_BONUS_DAYS} days free` };
  }
  if (bundle && bundle.savingInr > 0) {
    return { icon: PiggyBank, text: `${inr(bundle.perMonthInr)}/month · you save ${inr(bundle.savingInr)} vs paying monthly` };
  }
  if (pkg.creditInFull) return { icon: Gift, text: `Fully credited if you continue with a bigger plan within ${pkg.validityDays} days` };
  if (pkg.category === 'diet_plan') return { icon: CircleArrowUp, text: 'Upgrade any time: your unused days are credited' };
  return { icon: CalendarPlus, text: `Renew in your last ${EARLY_RENEWAL_WINDOW_DAYS} days and get ${RENEWAL_BONUS_DAYS} days free` };
}

interface PlanCardProps {
  /** The plan (or the chosen length of a plan family) shown. */
  pkg: NutritionPackage;
  /** All plans on sale (for bundle savings). */
  all: NutritionPackage[];
  /** The plan with its longer lengths (1 / 3 / 6 months), shortest first: shows a length picker. */
  family?: NutritionPackage[];
  onSelectLength?: (pkg: NutritionPackage) => void;
  /** For a plan with goals: the chosen goal's label, and how to change it. */
  goal?: string;
  onSelectGoal?: (label: string) => void;
  /** Buttons / status at the bottom. */
  footer?: React.ReactNode;
  /** Extra line under the price, e.g. "Includes ₹499 credit". */
  priceNote?: React.ReactNode;
  /** Highlighted (dark green) card. */
  dark?: boolean;
  /** Show the plan's terms text. */
  showTerms?: boolean;
  className?: string;
}

const monthsLabel = (m: number) => (m === 1 ? '1 month' : `${m} months`);

/** "1 month · 3 months · 6 months" choice, each length labelled with what it saves. */
const LengthPicker: React.FC<{
  family: NutritionPackage[];
  selected: NutritionPackage;
  onSelect: (pkg: NutritionPackage) => void;
  dark: boolean;
  name: string;
}> = ({ family, selected, onSelect, dark, name }) => {
  const savings = family.map((p) => lengthSaving(p, family));
  const best = Math.max(...savings.map((s) => s.pct));
  return (
    <div role="radiogroup" aria-label={`${name}: choose how long`} className={`mt-4 grid gap-1.5 p-1 rounded-xl ${dark ? 'bg-white/10' : 'bg-slate-100'}`} style={{ gridTemplateColumns: `repeat(${family.length}, minmax(0, 1fr))` }}>
      {family.map((p, i) => {
        const s = savings[i];
        const active = p.id === selected.id;
        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${monthsLabel(s.months)}, ₹${p.priceInr.toLocaleString('en-IN')}${s.pct ? `, save ${s.pct}%` : ''}`}
            onClick={() => onSelect(p)}
            className={`relative rounded-lg px-1.5 pt-2 pb-1.5 text-center transition-colors ${
              active ? (dark ? 'bg-white text-[#2D4C3C] shadow-sm' : 'bg-white text-[#2D4C3C] shadow-sm ring-1 ring-emerald-300') : dark ? 'text-emerald-100 hover:bg-white/10' : 'text-slate-600 hover:bg-white/70'
            }`}
          >
            <span className="block text-xs font-semibold">{monthsLabel(s.months)}</span>
            <span
              className={`mt-1 inline-block rounded-full px-1.5 py-px text-[10px] font-bold ${
                s.pct ? (s.pct === best ? 'bg-amber-400 text-amber-950' : 'bg-amber-100 text-amber-900') : 'invisible'
              }`}
            >
              {s.pct ? `Save ${s.pct}%` : '–'}
            </span>
            {s.pct > 0 && s.pct === best && (
              <span className={`block text-[9px] font-bold uppercase tracking-wide mt-0.5 ${dark && !active ? 'text-amber-300' : 'text-amber-700'}`}>Best value</span>
            )}
          </button>
        );
      })}
    </div>
  );
};

/** Colour scheme per kind of plan: a light mint first step, a warm do-it-yourself plan, and deep green guided care. */
function planTone(pkg: NutritionPackage, dark: boolean) {
  if (dark) {
    return {
      header: 'bg-gradient-to-br from-[#24402F] via-[#2D4C3C] to-[#3E6553] text-white',
      glow: 'bg-amber-300/25',
      chip: 'bg-amber-400 text-amber-950',
      iconBox: 'bg-white/15 text-amber-200 ring-1 ring-white/20',
      body: 'bg-[#2D4C3C] text-white',
      border: 'border-[#3E6553] shadow-xl shadow-emerald-950/20',
    };
  }
  if (pkg.category === 'diet_plan') {
    return {
      header: 'bg-gradient-to-br from-amber-50 via-orange-50/60 to-white text-slate-900',
      glow: 'bg-amber-200/50',
      chip: 'bg-amber-100 text-amber-900 ring-1 ring-amber-200',
      iconBox: 'bg-white text-amber-700 shadow-sm ring-1 ring-amber-100',
      body: 'bg-white text-slate-900',
      border: 'border-amber-200/80',
    };
  }
  return {
    header: 'bg-gradient-to-br from-emerald-50 via-teal-50/60 to-white text-slate-900',
    glow: 'bg-emerald-200/50',
    chip: 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200',
    iconBox: 'bg-white text-[#3E6553] shadow-sm ring-1 ring-emerald-100',
    body: 'bg-white text-slate-900',
    border: 'border-emerald-200/80',
  };
}

/** How many inclusions show before "See everything included". */
const SHOWN_INCLUSIONS = 4;

/** A plan, presented so its value is obvious: who it's for, what you get, what it costs, and why it's a good deal. */
export const PlanCard: React.FC<PlanCardProps> = ({
  pkg,
  all,
  family,
  onSelectLength,
  goal,
  onSelectGoal,
  footer,
  priceNote,
  dark = false,
  showTerms = false,
  className = '',
}) => {
  const [showAll, setShowAll] = useState(false);
  const withLengths = !!family && family.length > 1 && !!onSelectLength;
  const base = withLengths ? family![0] : pkg;
  const name = withLengths ? base.familyTitle ?? base.title : pkg.title;
  const Icon = planIcon(base);
  const hook = planHook(pkg, all, withLengths);
  const HookIcon = hook.icon;
  const bundle = withLengths ? undefined : bundleInfo(pkg, all);
  const saving = withLengths ? lengthSaving(pkg, family!) : undefined;
  const bestLength = withLengths ? family!.reduce((a, b) => (lengthSaving(b, family!).pct > lengthSaving(a, family!).pct ? b : a)) : undefined;
  const bestSaving = bestLength ? lengthSaving(bestLength, family!) : undefined;
  const popular = withLengths ? family!.some((p) => p.isPopular) : pkg.isPopular;
  const ribbon = !withLengths && pkg.isBestValue ? 'Best value' : popular ? 'Most popular' : null;
  const goals = base.goals;
  const chosenGoal = goals?.find((g) => g.label === goal) ?? goals?.[0];
  const stats = pkg.stats ?? base.stats;
  const step = base.step;
  const bestFor = base.bestFor;
  const tone = planTone(base, dark);
  // Ongoing care is easiest to judge per day; one-time plans are judged as a whole.
  const perDay = pkg.category === 'monthly_care' ? Math.round(pkg.priceInr / pkg.validityDays) : undefined;
  const inclusions = showAll ? pkg.inclusions : pkg.inclusions.slice(0, SHOWN_INCLUSIONS);
  const hidden = pkg.inclusions.length - SHOWN_INCLUSIONS;
  const muted = dark ? 'text-emerald-100/80' : 'text-slate-500';

  return (
    <article
      aria-label={name}
      className={`group relative rounded-3xl border flex flex-col motion-safe:transition-[transform,box-shadow] motion-safe:duration-300 motion-safe:hover:-translate-y-1 hover:shadow-2xl ${tone.border} ${tone.body} ${className}`}
    >
      {ribbon && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-1 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-md bg-amber-400 text-amber-950">
          <Sparkles className="w-3 h-3" aria-hidden="true" /> {ribbon}
        </span>
      )}

      {/* Header: step, name, who it's for */}
      <header className={`relative overflow-hidden rounded-t-3xl px-5 sm:px-6 pt-7 pb-5 ${tone.header}`}>
        <span aria-hidden="true" className={`pointer-events-none absolute -right-12 -top-12 w-44 h-44 rounded-full blur-2xl ${tone.glow}`} />
        <span aria-hidden="true" className={`pointer-events-none absolute -left-8 bottom-0 w-24 h-24 rounded-full blur-2xl ${tone.glow} opacity-60`} />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            {step && <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${tone.chip}`}>{step}</span>}
            <h3 className={`mt-2 text-xl sm:text-2xl font-bold leading-tight ${dark ? 'text-white' : 'text-[#24402F]'}`} style={{ fontFamily: "'Playfair Display', serif" }}>
              {name}
            </h3>
            <p className={`mt-0.5 text-[11px] font-semibold uppercase tracking-wider ${dark ? 'text-emerald-200' : 'text-[#3E6553]'}`}>{pkg.durationLabel}</p>
          </div>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 motion-safe:transition-transform motion-safe:duration-300 group-hover:rotate-6 ${tone.iconBox}`}>
            <Icon className="w-6 h-6" aria-hidden="true" />
          </div>
        </div>
        <p className={`relative mt-3 text-xs leading-relaxed ${muted}`}>{pkg.tagline}</p>
        {bestFor && (
          <p className={`relative mt-3 flex items-start gap-1.5 text-xs font-medium ${dark ? 'text-amber-100' : 'text-slate-700'}`}>
            <Target className={`w-3.5 h-3.5 shrink-0 mt-px ${dark ? 'text-amber-300' : 'text-[#3E6553]'}`} aria-hidden="true" />
            <span>
              <span className="font-bold">Best for:</span> {bestFor.charAt(0).toLowerCase() + bestFor.slice(1)}
            </span>
          </p>
        )}
      </header>

      <div className="flex-1 flex flex-col px-5 sm:px-6 pb-5 sm:pb-6">
        {goals && onSelectGoal && (
          <div className="mt-5">
            <p className={`text-[11px] font-bold uppercase tracking-wider mb-1.5 ${dark ? 'text-emerald-200' : 'text-slate-500'}`}>What's your goal?</p>
            <div role="radiogroup" aria-label={`${name}: choose your goal`} className="grid grid-cols-3 gap-1.5">
              {goals.map((g) => {
                const active = g.label === chosenGoal?.label;
                return (
                  <button
                    key={g.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => onSelectGoal(g.label)}
                    className={`rounded-xl border px-1.5 py-2 flex flex-col items-center gap-1 text-center transition-colors ${
                      active
                        ? dark
                          ? 'bg-white text-[#2D4C3C] border-white shadow-sm'
                          : 'bg-emerald-50 text-[#2D4C3C] border-emerald-400 ring-1 ring-emerald-300'
                        : dark
                          ? 'border-white/20 text-emerald-100 hover:bg-white/10'
                          : 'border-slate-200 text-slate-600 hover:border-emerald-300'
                    }`}
                  >
                    <ServiceIcon iconName={g.iconName} className="w-4.5 h-4.5" />
                    <span className="text-[11px] font-semibold leading-tight">{g.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {withLengths && <LengthPicker family={family!} selected={pkg} onSelect={onSelectLength!} dark={dark} name={name} />}

        {/* Price */}
        <div className="mt-5">
          <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
            <span className={`text-4xl font-bold leading-none ${dark ? 'text-white' : 'text-[#24402F]'}`} style={{ fontFamily: "'Playfair Display', serif" }}>
              {inr(pkg.priceInr)}
            </span>
            <span className={`pb-0.5 text-xs ${dark ? 'text-emerald-200/80' : 'text-slate-400'}`}>
              {saving && saving.months > 1 ? `for ${saving.months} months` : bundle ? `for ${bundle.months} months` : `for ${pkg.validityDays} days`} · all inclusive
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            {perDay !== undefined && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ${dark ? 'bg-white/10 text-emerald-50' : 'bg-emerald-50 text-emerald-900'}`}>
                <Coffee className="w-3.5 h-3.5" aria-hidden="true" /> about {inr(perDay)} a day
              </span>
            )}
            {saving && saving.pct > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 text-amber-950 font-bold px-2.5 py-1 text-[11px] shadow-sm">
                <BadgePercent className="w-3.5 h-3.5" aria-hidden="true" /> You save {saving.pct}% · {inr(saving.savingInr)}
              </span>
            )}
            {bundle && bundle.savingInr > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-900 font-semibold px-2 py-0.5 text-[11px]">
                <BadgeIndianRupee className="w-3 h-3" aria-hidden="true" /> {inr(bundle.perMonthInr)}/month · save {inr(bundle.savingInr)}
              </span>
            )}
          </div>
          {saving && saving.pct === 0 && bestSaving && bestLength && (
            <button
              type="button"
              onClick={() => onSelectLength!(bestLength)}
              className={`mt-2 inline-flex items-center gap-1 text-[11px] font-semibold underline-offset-2 hover:underline ${dark ? 'text-amber-300' : 'text-amber-700'}`}
            >
              <BadgePercent className="w-3.5 h-3.5" aria-hidden="true" />
              Choose {monthsLabel(bestSaving.months)} and save {bestSaving.pct}%
            </button>
          )}
          {priceNote && <div className="mt-2 text-xs">{priceNote}</div>}
        </div>

        {/* The headline facts, large */}
        {stats && stats.length > 0 && (
          <dl className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
            {stats.map((st) => (
              <div key={st.label} className={`rounded-2xl px-2 py-2.5 text-center ${dark ? 'bg-white/10' : 'bg-slate-50 ring-1 ring-slate-100'}`}>
                <dt className="sr-only">{st.label}</dt>
                <dd>
                  <span className={`block text-lg font-bold leading-tight ${dark ? 'text-amber-200' : 'text-[#2D4C3C]'}`} style={{ fontFamily: "'Playfair Display', serif" }}>
                    {st.value}
                  </span>
                  <span aria-hidden="true" className={`block mt-0.5 text-[10px] leading-tight ${muted}`}>
                    {st.label}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        )}

        {/* Why it's a good deal */}
        <p
          className={`mt-4 flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs font-medium ${
            dark ? 'bg-amber-300/15 text-amber-50 ring-1 ring-amber-300/30' : 'bg-emerald-50 text-emerald-900 border border-emerald-100'
          }`}
        >
          <HookIcon className={`w-4 h-4 shrink-0 mt-px ${dark ? 'text-amber-300' : 'text-[#3E6553]'}`} aria-hidden="true" />
          <span>{hook.text}</span>
        </p>

        {base.journey && base.journey.length > 0 && (
          <div className="mt-4">
            <p className={`text-[11px] font-bold uppercase tracking-wider mb-2 ${dark ? 'text-emerald-200' : 'text-slate-500'}`}>How it works</p>
            <ol className="relative space-y-2.5 text-xs">
              <span aria-hidden="true" className={`absolute left-[11px] top-3 bottom-3 w-px ${dark ? 'bg-white/20' : 'bg-emerald-200'}`} />
              {base.journey.map((stepText, i) => (
                <li key={stepText} className="relative flex items-start gap-2.5">
                  <span className={`w-[23px] h-[23px] rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold ${dark ? 'bg-amber-300 text-amber-950' : 'bg-[#3E6553] text-white ring-4 ring-white'}`}>
                    {i + 1}
                  </span>
                  <span className={`pt-0.5 ${dark ? 'text-emerald-50' : 'text-slate-700'}`}>{stepText}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {chosenGoal && (
          <div className={`mt-4 rounded-xl p-3 ${dark ? 'bg-white/5 ring-1 ring-white/10' : 'bg-amber-50/60 border border-amber-100'}`}>
            <p className={`text-[11px] font-bold uppercase tracking-wider mb-1.5 ${dark ? 'text-amber-300' : 'text-amber-800'}`}>For your goal: {chosenGoal.label}</p>
            <ul className="space-y-1.5 text-xs">
              {chosenGoal.highlights.map((h) => (
                <li key={h} className="flex items-start gap-2">
                  <Sparkles className={`w-3.5 h-3.5 shrink-0 mt-px ${dark ? 'text-amber-300' : 'text-amber-600'}`} aria-hidden="true" />
                  <span className={dark ? 'text-emerald-50' : 'text-slate-700'}>{h}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* What's included */}
        <div className="mt-4 flex-1">
          <p className={`text-[11px] font-bold uppercase tracking-wider mb-2 ${dark ? 'text-emerald-200' : 'text-slate-500'}`}>What you get</p>
          <ul className="space-y-2 text-xs">
            {inclusions.map((inc) => (
              <li key={inc} className="flex items-start gap-2">
                <CircleCheck className={`w-4 h-4 shrink-0 mt-px ${dark ? 'text-emerald-300' : 'text-[#3E6553]'}`} aria-hidden="true" />
                <span className={dark ? 'text-emerald-50' : 'text-slate-700'}>{inc}</span>
              </li>
            ))}
          </ul>
          {hidden > 0 && (
            <button
              type="button"
              aria-expanded={showAll}
              onClick={() => setShowAll((v) => !v)}
              className={`mt-2 inline-flex items-center gap-1 text-[11px] font-semibold hover:underline underline-offset-2 ${dark ? 'text-emerald-200' : 'text-[#3E6553]'}`}
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAll ? 'rotate-180' : ''}`} aria-hidden="true" />
              {showAll ? 'Show less' : `See everything included (+${hidden})`}
            </button>
          )}
        </div>

        {pkg.notIncluded && pkg.notIncluded.length > 0 && (
          <p className={`mt-3 flex items-start gap-2 text-[11px] ${dark ? 'text-emerald-200/70' : 'text-slate-500'}`}>
            <Info className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" />
            <span>Not included: {pkg.notIncluded.join(' · ')}</span>
          </p>
        )}

        {footer && <div className="mt-5 space-y-2">{footer}</div>}

        {showTerms && <p className={`mt-3 text-[10px] leading-snug ${dark ? 'text-emerald-200/60' : 'text-slate-400'}`}>{pkg.terms}</p>}
      </div>
    </article>
  );
};

type Cell = boolean | string;
/** The three core plans side by side. Each row restates what the plans include. */
const COMPARISON: Array<{ label: string; icon: LucideIcon; cells: [Cell, Cell, Cell] }> = [
  { label: 'One-to-one time with Dt. Anchal', icon: Stethoscope, cells: ['30-min consultation', 'Consultation + review call', '4 sessions a month'] },
  { label: 'Your meal plan', icon: ClipboardList, cells: ['3-day starter plan', '7-day rotating plan', 'Updated every week'] },
  { label: 'Health history & report review', icon: FileSearch, cells: [true, false, true] },
  { label: 'WhatsApp questions (clinic hours)', icon: MessageCircle, cells: [false, 'For 7 days', 'Whole plan'] },
  { label: 'Progress tracking & monthly summary', icon: TrendingUp, cells: [false, false, true] },
  { label: 'Counts towards a bigger plan', icon: Gift, cells: ['Credited in full', 'Unused days credited', 'Unused days credited'] },
];

/** "Compare the 3 plans": a table that answers "what's the difference?" in one look. */
export const PlanComparison: React.FC<{ plans: NutritionPackage[]; className?: string }> = ({ plans, className = '' }) => {
  const pick = (id: string) => plans.find((p) => p.id === id);
  const cols = [pick('pkg-basic-consultation'), pick('pkg-personalized-diet-plan'), pick('pkg-monthly-nutrition-care')];
  if (cols.some((c) => !c)) return null;
  const titles = [cols[0]!.title, cols[1]!.title, cols[2]!.familyTitle ?? cols[2]!.title];
  const cell = (c: Cell) =>
    c === true ? (
      <CircleCheck className="w-4.5 h-4.5 mx-auto text-[#3E6553]" aria-label="Included" />
    ) : c === false ? (
      <Minus className="w-4 h-4 mx-auto text-slate-300" aria-label="Not included" />
    ) : (
      <span className="text-slate-700">{c}</span>
    );
  return (
    <details className={`group/compare rounded-3xl border border-emerald-100 bg-white shadow-sm open:shadow-md ${className}`}>
      <summary className="cursor-pointer list-none flex items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl bg-emerald-50 text-[#3E6553] flex items-center justify-center">
            <Columns3 className="w-4.5 h-4.5" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-sm font-bold text-[#24402F]">Compare the 3 plans</span>
            <span className="block text-xs text-slate-500">See exactly what changes as you move up</span>
          </span>
        </span>
        <ChevronDown className="w-5 h-5 text-slate-400 transition-transform group-open/compare:rotate-180" aria-hidden="true" />
      </summary>
      <div className="overflow-x-auto px-2 pb-4">
        <table className="w-full min-w-[560px] text-xs text-center border-separate border-spacing-0">
          <thead>
            <tr>
              <th scope="col" className="text-left font-semibold text-slate-500 px-3 py-2">What you get</th>
              {titles.map((t, i) => (
                <th key={t} scope="col" className={`px-3 py-2 font-bold ${i === 2 ? 'text-white bg-[#2D4C3C] rounded-t-xl' : 'text-[#24402F]'}`}>
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARISON.map(({ label, icon: RowIcon, cells }) => (
              <tr key={label} className="odd:bg-slate-50/70">
                <th scope="row" className="text-left font-medium text-slate-700 px-3 py-2.5">
                  <span className="flex items-center gap-2">
                    <RowIcon className="w-3.5 h-3.5 text-[#3E6553] shrink-0" aria-hidden="true" /> {label}
                  </span>
                </th>
                {cells.map((c, i) => (
                  <td key={i} className={`px-3 py-2.5 ${i === 2 ? 'bg-emerald-50/80 font-semibold' : ''}`}>
                    {cell(c)}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <th scope="row" className="text-left font-semibold text-slate-700 px-3 py-3">Price</th>
              {cols.map((c, i) => (
                <td key={c!.id} className={`px-3 py-3 ${i === 2 ? 'bg-emerald-50/80 rounded-b-xl' : ''}`}>
                  <span className="text-base font-bold text-[#24402F]" style={{ fontFamily: "'Playfair Display', serif" }}>
                    {inr(c!.priceInr)}
                  </span>
                  <span className="block text-[10px] text-slate-400">{i === 2 ? 'a month, or less for 3 / 6 months' : `one-time · ${c!.validityDays} days`}</span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  );
};

const WIN_WIN = [
  { icon: ShieldCheck, title: `${REFUND_PROMISE_DAYS}-day promise`, text: 'Not right for you? Get a refund, minus consultations used and processing charges.' },
  { icon: Gift, title: 'Nothing is wasted', text: 'Start small. Every step up is credited towards your next plan.' },
  { icon: CalendarPlus, title: `${RENEWAL_BONUS_DAYS} days free`, text: `Renew in the last ${EARLY_RENEWAL_WINDOW_DAYS} days of your plan and get ${RENEWAL_BONUS_DAYS} extra days.` },
  { icon: RefreshCwOff, title: 'No auto-renewal', text: 'You decide when to continue. All prices are all-inclusive, no hidden fees.' },
];

/** The four promises that make every plan a safe choice. */
export const WinWinStrip: React.FC<{ className?: string }> = ({ className = '' }) => (
  <ul aria-label="Why choosing a plan is risk-free" className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 ${className}`}>
    {WIN_WIN.map(({ icon: Icon, title, text }) => (
      <li key={title} className="flex items-start gap-3 rounded-2xl bg-white border border-emerald-100 p-4">
        <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#3E6553] flex items-center justify-center shrink-0">
          <Icon className="w-4.5 h-4.5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#2D4C3C]">{title}</p>
          <p className="text-xs text-slate-500 leading-relaxed mt-0.5">{text}</p>
        </div>
      </li>
    ))}
  </ul>
);
