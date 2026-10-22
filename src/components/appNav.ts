import { Calendar, CreditCard, Home, ShieldCheck, TrendingUp, User, Utensils, type LucideIcon } from 'lucide-react';

export interface NavItem {
  id: string;
  /** Full name: the top bar text, and the accessible name everywhere. */
  label: string;
  /** Fits the phone tab bar (six tabs on a 320px screen). */
  short: string;
  icon: LucideIcon;
}

/** The signed-in app's sections, shared by the top bar (wide screens) and the bottom tab bar (phones, tablets). */
export function appNavItems(isDietitian: boolean): NavItem[] {
  return isDietitian
    ? [
        { id: 'home', label: 'Home', short: 'Home', icon: Home },
        { id: 'diet', label: 'Diet Plans', short: 'Diet', icon: Utensils },
        { id: 'progress', label: 'Progress', short: 'Progress', icon: TrendingUp },
        { id: 'appointments', label: 'Appointments', short: 'Visits', icon: Calendar },
        { id: 'plans', label: 'Pricing', short: 'Pricing', icon: CreditCard },
        { id: 'profile', label: 'Admin', short: 'Admin', icon: ShieldCheck },
      ]
    : [
        { id: 'home', label: 'Home', short: 'Home', icon: Home },
        { id: 'diet', label: 'Diet Chart', short: 'Diet', icon: Utensils },
        { id: 'progress', label: 'Track', short: 'Track', icon: TrendingUp },
        { id: 'appointments', label: 'Appointments', short: 'Visits', icon: Calendar },
        { id: 'plans', label: 'My Plans', short: 'Plans', icon: CreditCard },
        { id: 'profile', label: 'My Profile', short: 'Profile', icon: User },
      ];
}
