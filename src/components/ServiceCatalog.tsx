import React, { useState } from 'react';
import {
  BadgePercent,
  CalendarRange,
  ChevronRight,
  CircleCheck,
  ClipboardCheck,
  HeartPulse,
  Info,
  ShieldPlus,
  Sprout,
  Stethoscope,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { NutritionPackage, NutritionService, ServiceGroup } from '../types/nutrition';
import { ServiceIcon, serviceTheme } from './ServiceIcon';
import { bundleSavings } from '../shared/plans';
import { useEscapeToClose } from './useEscapeToClose';
import { FIRST_CONSULTATION_INR, FOLLOW_UP_INR } from '../shared/pricing';

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/** Value of n consultations if booked one by one (first consultation, then follow-ups). */
export const consultationsValue = (n: number) => (n > 0 ? FIRST_CONSULTATION_INR + (n - 1) * FOLLOW_UP_INR : 0);

export const SERVICE_GROUPS: Array<{ id: ServiceGroup; label: string; icon: LucideIcon; blurb: string }> = [
  { id: 'conditions', label: 'Lifestyle Conditions', icon: HeartPulse, blurb: 'Diabetes, BP, thyroid, PCOS, heart, iron' },
  { id: 'specialised', label: 'Specialised Care', icon: Stethoscope, blurb: 'Liver, gut, kidney, neuro, children, recovery' },
  { id: 'medical', label: 'Medical Nutrition Support', icon: ShieldPlus, blurb: 'Cancer care, pancreas, tube feeding' },
];

export const CLINICAL_DISCLAIMER =
  'Nutrition guidance is individualised and outcomes vary. Programs support dietary care and do not replace medical diagnosis, prescribed treatment or emergency care. Clinical programs (renal, liver, pancreatic, oncology and tube-feeding support) are aligned with your diagnosis and your treating healthcare team’s guidance.';

/** "₹2,000/month · save ₹1,498" for programs with a 3-month option. */
export function quarterlyOffer(svc: NutritionService) {
  if (!svc.priceInr || !svc.quarterlyPriceInr) return undefined;
  return { priceInr: svc.quarterlyPriceInr, ...bundleSavings(svc.quarterlyPriceInr, svc.priceInr, 3) };
}

export interface ProgramLength {
  months: number;
  priceInr: number;
  perMonthInr: number;
  savingInr: number;
  /** Saving against paying month by month, in whole percent. */
  pct: number;
  consultations?: number;
}

/** The purchasable plan for a program at a given length, from the live price list. */
export function programPackage(svcId: string, months: number, packages: NutritionPackage[] | undefined) {
  return packages?.find((p) => p.serviceId === svcId && (p.bundleOf?.months ?? 1) === months && p.isActive);
}

/**
 * The lengths a program can be taken for (1 / 3 / 6 months), each with what it saves. Prices come from
 * the live price list when given (what checkout charges), otherwise from the catalogue.
 */
export function programLengths(svc: NutritionService, packages?: NutritionPackage[]): ProgramLength[] {
  const live = (months: number, fallback: number | undefined) =>
    packages ? programPackage(svc.id, months, packages)?.priceInr : fallback;
  const base = live(1, svc.priceInr);
  if (!base || svc.assessmentFirst) return [];
  const lengths: ProgramLength[] = [{ months: 1, priceInr: base, perMonthInr: base, savingInr: 0, pct: 0, consultations: svc.consultations }];
  for (const [months, price] of [
    [3, live(3, svc.quarterlyPriceInr)],
    [6, live(6, svc.halfYearlyPriceInr)],
  ] as const) {
    if (!price) continue;
    const { perMonthInr, savingInr } = bundleSavings(price, base, months);
    lengths.push({ months, priceInr: price, perMonthInr, savingInr, pct: Math.round((savingInr / (base * months)) * 100), consultations: svc.consultations && svc.consultations * months });
  }
  return lengths;
}

const lengthLabel = (m: number) => (m === 1 ? '1 month' : `${m} months`);

/** The category tabs. */
export const ServiceGroupTabs: React.FC<{
  value: ServiceGroup;
  onChange: (g: ServiceGroup) => void;
  services: NutritionService[];
  className?: string;
}> = ({ value, onChange, services, className = '' }) => (
  <div role="tablist" aria-label="Program categories" className={`flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 ${className}`}>
    {SERVICE_GROUPS.map((g) => {
      const active = g.id === value;
      const count = services.filter((s) => s.group === g.id).length;
      return (
        <button
          key={g.id}
          type="button"
          role="tab"
          aria-selected={active}
          aria-controls={`programs-${g.id}`}
          id={`programs-tab-${g.id}`}
          onClick={() => onChange(g.id)}
          className={`shrink-0 flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
            active ? 'bg-[#3E6553] border-[#3E6553] text-white shadow-sm' : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-300'
          }`}
        >
          <g.icon className={`w-4 h-4 shrink-0 ${active ? 'text-emerald-200' : 'text-[#3E6553]'}`} aria-hidden="true" />
          <span className="text-sm font-semibold whitespace-nowrap">{g.label}</span>
          <span className={`text-[11px] font-bold rounded-full px-1.5 ${active ? 'bg-white/20' : 'bg-emerald-50 text-[#3E6553]'}`}>{count}</span>
        </button>
      );
    })}
  </div>
);

/** One program: what it is, the price, what's included in value terms, and the 3-month saving. */
export const ServiceCard: React.FC<{
  svc: NutritionService;
  onDetails: () => void;
  /** The main button; told which length the visitor picked. */
  action: React.ReactNode | ((months: number) => React.ReactNode);
  /** Live price list (prices shown = prices charged). */
  packages?: NutritionPackage[];
  /** Extra line under the price for the chosen length (e.g. a credit). */
  note?: (months: number) => React.ReactNode;
}> = ({ svc, onDetails, action, packages, note }) => {
  const theme = serviceTheme(svc.iconName);
  const lengths = programLengths(svc, packages);
  // Starts on 3 months where offered: the better deal for most people.
  const [months, setMonths] = useState(lengths.some((l) => l.months === 3) ? 3 : 1);
  const chosen = lengths.find((l) => l.months === months) ?? lengths[0];
  const best = Math.max(0, ...lengths.map((l) => l.pct));
  const bestLength = lengths.find((l) => l.pct === best && best > 0);
  return (
    <article aria-label={svc.title} className={`bg-white rounded-2xl border ${theme.border} p-5 flex flex-col hover:shadow-md transition-shadow duration-200`}>
      <div className="flex items-start gap-3">
        <div className={`w-11 h-11 rounded-xl ${theme.badge} flex items-center justify-center shrink-0`}>
          <ServiceIcon iconName={svc.iconName} className="w-5.5 h-5.5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-slate-900 font-bold text-base leading-snug">{svc.title}</h3>
          <p className="text-[#3E6553] text-xs font-semibold mt-0.5">{svc.subtitle}</p>
        </div>
      </div>
      <p className="text-slate-500 text-xs leading-relaxed mt-3 flex-1">{svc.tagline}</p>

      <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
        {/* No online price: assessment-first programs, or one the clinic has switched off for now. */}
        {!chosen ? (
          <p className="flex items-start gap-2 text-xs text-slate-700">
            <ClipboardCheck className="w-4 h-4 text-[#3E6553] shrink-0 mt-px" aria-hidden="true" />
            <span>
              <strong className="text-slate-900">Personalised plan &amp; quote</strong> after a first assessment with Dt. Anchal
            </span>
          </p>
        ) : (
          <>
            {lengths.length > 1 && (
              <div role="radiogroup" aria-label={`${svc.title}: choose how long`} className="flex gap-1 p-1 rounded-lg bg-slate-100">
                {lengths.map((l) => {
                  const active = l.months === chosen.months;
                  return (
                    <button
                      key={l.months}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setMonths(l.months)}
                      className={`flex-1 rounded-md px-1 py-1.5 text-[11px] font-semibold transition-colors ${active ? 'bg-white text-[#2D4C3C] shadow-xs' : 'text-slate-600 hover:bg-white/70'}`}
                    >
                      {lengthLabel(l.months)}
                      {l.pct > 0 && <span className={`block text-[10px] font-bold ${l.pct === best ? 'text-amber-700' : 'text-amber-600'}`}>Save {l.pct}%</span>}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex flex-wrap items-baseline gap-x-1.5">
              <span className="text-xl font-bold text-[#2D4C3C]" style={{ fontFamily: "'Playfair Display', serif" }}>
                {inr(chosen.priceInr)}
              </span>
              <span className="text-[11px] text-slate-400">for {chosen.months === 1 ? '30 days' : lengthLabel(chosen.months)} · all inclusive</span>
            </div>
            {chosen.pct > 0 ? (
              <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
                <CalendarRange className="w-3.5 h-3.5 text-[#3E6553] shrink-0" aria-hidden="true" />
                {inr(chosen.perMonthInr)}/month
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 text-amber-950 font-bold px-2 py-0.5 text-[10px]">
                  <BadgePercent className="w-3 h-3" aria-hidden="true" /> You save {chosen.pct}% · {inr(chosen.savingInr)}
                </span>
              </p>
            ) : (
              bestLength && (
                <button type="button" onClick={() => setMonths(bestLength.months)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 hover:underline underline-offset-2">
                  <BadgePercent className="w-3.5 h-3.5" aria-hidden="true" /> Choose {lengthLabel(bestLength.months)} and save {bestLength.pct}%
                </button>
              )
            )}
            {note?.(chosen.months)}
            {!!chosen.consultations && (
              <p className="flex items-start gap-1.5 text-[11px] text-slate-600">
                <Users className="w-3.5 h-3.5 text-[#3E6553] shrink-0 mt-px" aria-hidden="true" />
                <span>
                  {chosen.consultations} consultations included{' '}
                  <span className="text-slate-400">({inr(consultationsValue(chosen.consultations))} if booked separately)</span>
                </span>
              </p>
            )}
          </>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onDetails}
          className="py-2 rounded-xl text-xs font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50 flex items-center justify-center gap-1"
        >
          Details <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
        {typeof action === 'function' ? action(chosen?.months ?? 1) : action}
      </div>
    </article>
  );
};

/** Full details of a program, in a pop-up. */
export const ServiceDetailsDialog: React.FC<{ svc: NutritionService; onClose: () => void; action: React.ReactNode; packages?: NutritionPackage[] }> = ({
  svc,
  onClose,
  action,
  packages,
}) => {
  useEscapeToClose(true, onClose);
  const theme = serviceTheme(svc.iconName);
  const lengths = programLengths(svc, packages);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="service-details-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90dvh]"
      >
        <div className="bg-[#3E6553] text-white px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl ${theme.badge} flex items-center justify-center shrink-0`}>
              <ServiceIcon iconName={svc.iconName} className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 id="service-details-title" className="font-bold text-sm">{svc.title}</h3>
              <p className="text-xs text-emerald-100 truncate">{svc.subtitle}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          <p className="p-3 bg-emerald-50 rounded-xl text-emerald-950 border border-emerald-100 font-medium leading-relaxed">{svc.tagline}</p>

          <section>
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-1.5">Who it helps</h4>
            <ul className="space-y-1 text-slate-600">
              {svc.idealFor.map((item) => (
                <li key={item} className="flex items-start gap-1.5">
                  <CircleCheck className="w-3.5 h-3.5 text-[#3E6553] shrink-0 mt-px" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-1.5">What’s included</h4>
            <ul className="space-y-1 text-slate-600">
              {svc.whatIsIncluded.map((item) => (
                <li key={item} className="flex items-start gap-1.5">
                  <CircleCheck className="w-3.5 h-3.5 text-[#3E6553] shrink-0 mt-px" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-1.5">Our approach</h4>
            <p className="text-slate-600 leading-relaxed">{svc.dietaryPhilosophy}</p>
          </section>

          <section className="rounded-xl border border-slate-200 p-3 space-y-1.5">
            {lengths.length === 0 ? (
              <p className="text-slate-700">
                <strong>Price:</strong> a written, personalised quote after your First Consultation (₹{FIRST_CONSULTATION_INR}), before you pay anything more.
              </p>
            ) : (
              <>
                {lengths.map((l) => (
                  <p key={l.months} className="flex justify-between gap-2">
                    <span className="text-slate-600">
                      {lengthLabel(l.months)} · {l.consultations} consultations{l.months > 1 ? ` · ${inr(l.perMonthInr)}/month` : ''}
                    </span>
                    <strong className="text-slate-900 whitespace-nowrap">
                      {inr(l.priceInr)}
                      {l.pct > 0 && <span className="ml-1 text-amber-700 font-semibold">(save {l.pct}%)</span>}
                    </strong>
                  </p>
                ))}
                <p className="text-[11px] text-slate-500">All inclusive · no automatic renewal</p>
              </>
            )}
          </section>

          <p className="flex items-start gap-1.5 text-[10px] text-slate-400 leading-relaxed">
            <Info className="w-3 h-3 shrink-0 mt-px" aria-hidden="true" />
            <span>{CLINICAL_DISCLAIMER}</span>
          </p>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex justify-end">{action}</div>
      </div>
    </div>
  );
};
