import React from 'react';
import { Home, Utensils, TrendingUp, Calendar, User, ShieldCheck, CreditCard } from 'lucide-react';
import { useNutrition } from '../context/NutritionContext';

interface BottomNavBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({ activeTab, onTabChange }) => {
  const { isDietitian } = useNutrition();

  const tabs = [
    {
      id: 'home',
      label: 'Home',
      icon: Home,
    },
    {
      id: 'diet',
      label: isDietitian ? 'Diet Plans' : 'Diet Chart',
      icon: Utensils,
    },
    {
      id: 'plans',
      label: isDietitian ? 'Pricing' : 'Plans',
      icon: CreditCard,
    },
    {
      id: 'progress',
      label: isDietitian ? 'Progress' : 'Track',
      icon: TrendingUp,
    },
    {
      id: 'profile',
      label: isDietitian ? 'Admin' : 'Profile',
      icon: isDietitian ? ShieldCheck : User,
    },
  ];

  return (
    <nav className="sticky bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_12px_rgba(0,0,0,0.03)] no-print">
      <div className="grid grid-cols-5 items-center h-16 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center h-full min-h-[44px] min-w-[44px] transition-colors relative ${
                isActive ? 'text-[#3E6553]' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    isActive ? 'scale-110 stroke-[2.4]' : 'stroke-[1.8]'
                  }`}
                />
                {isActive && (
                  <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-[#3E6553]" />
                )}
              </div>
              <span
                className={`text-[11px] font-medium tracking-tight mt-1 truncate max-w-[65px] ${
                  isActive ? 'font-semibold text-[#3E6553]' : 'text-slate-500'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
