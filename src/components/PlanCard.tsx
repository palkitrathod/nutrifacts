import React from 'react';
import {
  BadgeIndianRupee,
  BadgePercent,
  CalendarHeart,
  CalendarPlus,
  CircleArrowUp,
  CircleCheck,
  ClipboardList,
  Gift,
  HeartPulse,
  Info,
  Leaf,
  PiggyBank,
  RefreshCwOff,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react';
import type { NutritionPackage } from '../types/nutrition';
import { bundleSavings, EARLY_RENEWAL_WINDOW_DAYS, RENEWAL_BONUS_DAYS } from '../shared/plans';
import { REFUND_PROMISE_DAYS } from '../shared/pricing';

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

/** A plan, presented so its value is obvious: what you get, what it costs per month, and why it's a good deal. */
export const PlanCard: React.FC<PlanCardProps> = ({
  pkg,
  all,
  family,
  onSelectLength,
  footer,
  priceNote,
  dark = false,
  showTerms = false,
  className = '',
}) => {
  const withLengths = !!family && family.length > 1 && !!onSelectLength;
  const name = withLengths ? family![0].familyTitle ?? family![0].title : pkg.title;
  const Icon = planIcon(withLengths ? family![0] : pkg);
  const hook = planHook(pkg, all, withLengths);
  const HookIcon = hook.icon;
  const bundle = withLengths ? undefined : bundleInfo(pkg, all);
  const saving = withLengths ? lengthSaving(pkg, family!) : undefined;
  const bestLength = withLengths ? family!.reduce((a, b) => (lengthSaving(b, family!).pct > lengthSaving(a, family!).pct ? b : a)) : undefined;
  const bestSaving = bestLength ? lengthSaving(bestLength, family!) : undefined;
  const popular = withLengths ? family!.some((p) => p.isPopular) : pkg.isPopular;
  const ribbon = !withLengths && pkg.isBestValue ? 'Best value' : popular ? 'Most popular' : null;
  const amber = !withLengths && pkg.isBestValue;

  return (
    <article
      aria-label={name}
      className={`relative rounded-2xl border p-5 sm:p-6 flex flex-col transition-[box-shadow,border-color] duration-200 ${
        dark
          ? 'bg-[#2D4C3C] border-[#3E6553] text-white shadow-xl'
          : amber
            ? 'bg-white border-amber-300 shadow-md ring-1 ring-amber-200'
            : popular
              ? 'bg-white border-emerald-400 shadow-md ring-1 ring-emerald-200'
              : 'bg-white border-slate-200 hover:border-emerald-300 hover:shadow-md'
      } ${className}`}
    >
      {ribbon && (
        <span
          className={`absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-sm ${
            amber || dark ? 'bg-amber-400 text-amber-950' : 'bg-[#3E6553] text-white'
          }`}
        >
          <Sparkles className="w-3 h-3" aria-hidden="true" /> {ribbon}
        </span>
      )}

      <div className="flex items-start gap-3">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
            dark ? 'bg-white/10 text-emerald-200' : amber ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-[#3E6553]'
          }`}
        >
          <Icon className="w-5 h-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className={`text-[10px] font-bold uppercase tracking-widest ${dark ? 'text-emerald-300' : 'text-[#3E6553]'}`}>{pkg.durationLabel}</p>
          <h3 className={`text-base sm:text-lg font-bold leading-snug ${dark ? 'text-white' : 'text-slate-900'}`} style={{ fontFamily: "'Playfair Display', serif" }}>
            {name}
          </h3>
        </div>
      </div>

      <p className={`mt-2 text-xs leading-relaxed ${dark ? 'text-emerald-100/80' : 'text-slate-500'}`}>{pkg.tagline}</p>

      {withLengths && <LengthPicker family={family!} selected={pkg} onSelect={onSelectLength!} dark={dark} name={name} />}

      {/* Price */}
      <div className={`mt-4 pb-4 border-b ${dark ? 'border-white/10' : 'border-slate-100'}`}>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className={`text-3xl font-bold ${dark ? 'text-white' : 'text-[#2D4C3C]'}`} style={{ fontFamily: "'Playfair Display', serif" }}>
            {inr(pkg.priceInr)}
          </span>
          <span className={`text-xs ${dark ? 'text-emerald-200/80' : 'text-slate-400'}`}>
            {saving && saving.months > 1
              ? `for ${saving.months} months`
              : bundle
                ? `for ${bundle.months} months`
                : `for ${pkg.validityDays} days`}{' '}
            · all inclusive
          </span>
        </div>
        {saving && saving.pct > 0 && (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className={dark ? 'text-emerald-100' : 'text-slate-600'}>{inr(saving.perMonthInr)}/month</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 text-amber-950 font-bold px-2.5 py-1 text-[11px] shadow-sm">
              <BadgePercent className="w-3.5 h-3.5" aria-hidden="true" /> You save {saving.pct}% · {inr(saving.savingInr)}
            </span>
          </p>
        )}
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
        {bundle && bundle.savingInr > 0 && (
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
            <span className={dark ? 'text-emerald-100' : 'text-slate-600'}>{inr(bundle.perMonthInr)}/month</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-900 font-semibold px-2 py-0.5 text-[11px]">
              <BadgeIndianRupee className="w-3 h-3" aria-hidden="true" /> Save {inr(bundle.savingInr)}
            </span>
          </p>
        )}
        {priceNote && <div className="mt-1.5 text-xs">{priceNote}</div>}
      </div>

      {/* Why it's a good deal */}
      <p
        className={`mt-4 flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs font-medium ${
          dark ? 'bg-white/10 text-emerald-50' : 'bg-emerald-50 text-emerald-900 border border-emerald-100'
        }`}
      >
        <HookIcon className={`w-4 h-4 shrink-0 mt-px ${dark ? 'text-amber-300' : 'text-[#3E6553]'}`} aria-hidden="true" />
        <span>{hook.text}</span>
      </p>

      {/* What's included */}
      <ul className="mt-4 space-y-2 text-xs flex-1">
        {pkg.inclusions.map((inc) => (
          <li key={inc} className="flex items-start gap-2">
            <CircleCheck className={`w-4 h-4 shrink-0 mt-px ${dark ? 'text-emerald-300' : 'text-[#3E6553]'}`} aria-hidden="true" />
            <span className={dark ? 'text-emerald-50' : 'text-slate-700'}>{inc}</span>
          </li>
        ))}
      </ul>

      {pkg.notIncluded && pkg.notIncluded.length > 0 && (
        <p className={`mt-3 flex items-start gap-2 text-[11px] ${dark ? 'text-emerald-200/70' : 'text-slate-500'}`}>
          <Info className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" />
          <span>Not included: {pkg.notIncluded.join(' · ')}</span>
        </p>
      )}

      {footer && <div className="mt-5 space-y-2">{footer}</div>}

      {showTerms && <p className={`mt-3 text-[10px] leading-snug ${dark ? 'text-emerald-200/60' : 'text-slate-400'}`}>{pkg.terms}</p>}
    </article>
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
