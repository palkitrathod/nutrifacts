import React from 'react';
import { ClipboardList, ExternalLink, Gift, GraduationCap, HeartPulse, ReceiptIndianRupee, Salad, ShieldCheck, type LucideIcon } from 'lucide-react';
import { REFUND_PROMISE_DAYS } from '../shared/pricing';

/** Source for the health statement: WHO fact sheet on noncommunicable diseases. */
export const WHO_NCD_URL = 'https://www.who.int/news-room/fact-sheets/detail/noncommunicable-diseases';

interface Reason {
  icon: LucideIcon;
  title: string;
  text: string;
}

// Only claims the clinic can stand behind: about its own dietitian, prices and promises. No competitor is named.
const REASONS: Reason[] = [
  {
    icon: GraduationCap,
    title: 'A qualified clinical dietitian',
    text: 'Dt. Anchal Dewan holds an M.Sc. in Clinical Nutrition & Dietetics, with 4+ years of clinical experience and 2,500+ patients guided. That matters most when a condition like diabetes, thyroid or liver health is involved.',
  },
  {
    icon: ReceiptIndianRupee,
    title: 'Every price in full, upfront',
    text: 'Each plan and program shows its final price for every length it comes in, with nothing added at checkout. For the three medical-support programs, you get a written quote before you pay anything.',
  },
  {
    icon: ShieldCheck,
    title: `A ${REFUND_PROMISE_DAYS}-day promise`,
    text: 'If it isn’t right for you, you get a refund, minus consultations already used and payment processing charges. No automatic renewal, ever.',
  },
  {
    icon: Gift,
    title: 'Nothing you pay is wasted',
    text: 'Your first consultation counts in full towards a plan, and when you move to a bigger plan your unused days are credited.',
  },
  {
    icon: Salad,
    title: 'Built for your kitchen, not a template',
    text: 'Your plan is written around your home food, routine, preferences and reports, with practical choices for eating out.',
  },
  {
    icon: ClipboardList,
    title: 'You know exactly what you get',
    text: 'Every plan lists how many consultations it includes, what is included and what is not, so there are no surprises later.',
  },
];

/** "Why choose Nutrifacts": health first, then the reasons the service is worth it. */
export const WhyChooseSection: React.FC = () => (
  <section id="why-nutrifacts" aria-labelledby="why-title" className="scroll-mt-16 py-20 lg:py-28 bg-white">
    <div className="max-w-6xl 2xl:max-w-7xl mx-auto px-5 sm:px-8">
      <div className="text-center mb-10">
        <span className="inline-block text-[#3E6553] text-xs font-bold tracking-widest uppercase mb-3 bg-emerald-50 px-4 py-1.5 rounded-full border border-emerald-200">
          Why Nutrifacts
        </span>
        <h2 id="why-title" className="text-3xl sm:text-4xl font-bold text-[#2D4C3C] mt-2" style={{ fontFamily: "'Playfair Display', serif" }}>
          Your health first. Then the price.
        </h2>
        <p className="mt-4 text-slate-500 max-w-xl mx-auto text-sm leading-relaxed">
          Good nutrition isn’t a luxury or a diet trend. It is one of the biggest things you control for your long-term health.
        </p>
      </div>

      {/* The health reason, with its source */}
      <figure className="mb-10 rounded-2xl bg-[#2D4C3C] text-white p-6 sm:p-8 flex flex-col sm:flex-row gap-5 sm:items-center">
        <div className="w-14 h-14 rounded-2xl bg-white/10 text-amber-300 flex items-center justify-center shrink-0">
          <HeartPulse className="w-7 h-7" aria-hidden="true" />
        </div>
        <blockquote className="flex-1">
          <p className="text-base sm:text-lg leading-relaxed" style={{ fontFamily: "'Playfair Display', serif" }}>
            Long-term diseases such as heart disease, diabetes and cancers cause <strong className="text-amber-300">75% of non-pandemic deaths</strong> worldwide, and the World
            Health Organization lists <strong className="text-amber-300">unhealthy diets</strong>, high in salt, sugar and fats, among their main risk factors.
          </p>
          <figcaption className="mt-3 text-xs text-emerald-200">
            Source:{' '}
            <a href={WHO_NCD_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-white inline-flex items-center gap-1">
              WHO fact sheet, Noncommunicable diseases <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </a>
          </figcaption>
        </blockquote>
      </figure>

      <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {REASONS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="rounded-2xl border border-emerald-100 bg-[#F7FAF8] p-5">
            <div className="w-11 h-11 rounded-xl bg-white text-[#3E6553] border border-emerald-100 flex items-center justify-center mb-3">
              <Icon className="w-5 h-5" aria-hidden="true" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">{title}</h3>
            <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{text}</p>
          </li>
        ))}
      </ul>
    </div>
  </section>
);
