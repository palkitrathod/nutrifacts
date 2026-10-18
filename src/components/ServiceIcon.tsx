import React from 'react';
import { BicepsFlexed, Droplet, Leaf, Salad, Stethoscope, Venus } from 'lucide-react';

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
 * One icon per clinical service, chosen to show what the service is about, with a matching colour:
 * weight → a weighing scale; PCOS/PCOD → ♀ (women's hormonal health); diabetes → a blood-sugar drop in
 * diabetes blue; weight gain → flexed biceps; therapeutic diets → stethoscope; meal planning → salad.
 */
interface Theme {
  icon: IconComponent;
  /** Classes for the rounded square behind the icon. */
  badge: string;
  /** Border colour for the card the icon sits on. */
  border: string;
}

const SERVICE_ICONS: Record<string, Theme> = {
  Weight: { icon: WeighingScale, badge: 'bg-emerald-50 text-[#3E6553]', border: 'border-emerald-100' },
  Venus: { icon: Venus, badge: 'bg-rose-50 text-rose-600', border: 'border-rose-100' },
  Droplet: { icon: Droplet, badge: 'bg-sky-50 text-sky-600', border: 'border-sky-100' },
  BicepsFlexed: { icon: BicepsFlexed, badge: 'bg-amber-50 text-amber-600', border: 'border-amber-100' },
  Stethoscope: { icon: Stethoscope, badge: 'bg-violet-50 text-violet-600', border: 'border-violet-100' },
  Salad: { icon: Salad, badge: 'bg-lime-50 text-lime-700', border: 'border-lime-100' },
};
const FALLBACK: Theme = { icon: Leaf, badge: 'bg-emerald-50 text-[#3E6553]', border: 'border-emerald-100' };

export const serviceTheme = (iconName: string) => SERVICE_ICONS[iconName] ?? FALLBACK;

export const ServiceIcon: React.FC<{ iconName: string; className?: string }> = ({ iconName, className = 'w-5 h-5' }) => {
  const Icon = serviceTheme(iconName).icon;
  return <Icon className={className} aria-hidden="true" strokeWidth={1.75} />;
};
