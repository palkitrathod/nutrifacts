import React from 'react';
import {
  Activity,
  Baby,
  Bean,
  Brain,
  Citrus,
  Droplets,
  HeartPulse,
  Hospital,
  Leaf,
  Microscope,
  Ribbon,
  Soup,
  Sunrise,
  Syringe,
  Venus,
} from 'lucide-react';

type IconComponent = React.ComponentType<{ className?: string; strokeWidth?: number; 'aria-hidden'?: boolean | 'true' }>;

/** A bathroom weighing scale (dial + needle), drawn in the same line style as the other icons. */
const WeighingScale: IconComponent = ({ className, strokeWidth = 2, ...rest }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`icon-weighing-scale ${className ?? ''}`}
    {...rest}
  >
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <path d="M7.5 10.5a4.5 4.5 0 0 1 9 0" />
    <path d="M12 10.5 13.6 7.6" />
    <path d="M9 17h6" />
  </svg>
);

/**
 * One icon per program, chosen to show what it is about, each with its own soft colour:
 * lifestyle reset → sunrise; weight → a weighing scale; women's wellness → ♀; lifestyle diseases → vital
 * signs; heart → heart pulse; anemia → blood drops; liver → citrus; gastro → a bowl of soup; renal → a
 * kidney bean; neuro → brain; children → baby; post-hospital → hospital; oncology → awareness ribbon;
 * pancreatic → microscope; enteral/parenteral → syringe.
 */
interface Theme {
  icon: IconComponent;
  /** Classes for the rounded square behind the icon. */
  badge: string;
  /** Border colour for the card the icon sits on. */
  border: string;
}

const SERVICE_ICONS: Record<string, Theme> = {
  Sunrise: { icon: Sunrise, badge: 'bg-amber-50 text-amber-600', border: 'border-amber-100' },
  Weight: { icon: WeighingScale, badge: 'bg-emerald-50 text-[#3E6553]', border: 'border-emerald-100' },
  Venus: { icon: Venus, badge: 'bg-rose-50 text-rose-600', border: 'border-rose-100' },
  Activity: { icon: Activity, badge: 'bg-sky-50 text-sky-600', border: 'border-sky-100' },
  HeartPulse: { icon: HeartPulse, badge: 'bg-red-50 text-red-600', border: 'border-red-100' },
  Droplets: { icon: Droplets, badge: 'bg-rose-50 text-rose-700', border: 'border-rose-100' },
  Citrus: { icon: Citrus, badge: 'bg-lime-50 text-lime-700', border: 'border-lime-100' },
  Soup: { icon: Soup, badge: 'bg-orange-50 text-orange-600', border: 'border-orange-100' },
  Bean: { icon: Bean, badge: 'bg-violet-50 text-violet-600', border: 'border-violet-100' },
  Brain: { icon: Brain, badge: 'bg-purple-50 text-purple-600', border: 'border-purple-100' },
  Baby: { icon: Baby, badge: 'bg-pink-50 text-pink-600', border: 'border-pink-100' },
  Hospital: { icon: Hospital, badge: 'bg-teal-50 text-teal-700', border: 'border-teal-100' },
  Ribbon: { icon: Ribbon, badge: 'bg-fuchsia-50 text-fuchsia-600', border: 'border-fuchsia-100' },
  Microscope: { icon: Microscope, badge: 'bg-indigo-50 text-indigo-600', border: 'border-indigo-100' },
  Syringe: { icon: Syringe, badge: 'bg-cyan-50 text-cyan-700', border: 'border-cyan-100' },
};
const FALLBACK: Theme = { icon: Leaf, badge: 'bg-emerald-50 text-[#3E6553]', border: 'border-emerald-100' };

export const serviceTheme = (iconName: string) => SERVICE_ICONS[iconName] ?? FALLBACK;

export const ServiceIcon: React.FC<{ iconName: string; className?: string }> = ({ iconName, className = 'w-5 h-5' }) => {
  const Icon = serviceTheme(iconName).icon;
  return <Icon className={className} aria-hidden="true" strokeWidth={1.75} />;
};
