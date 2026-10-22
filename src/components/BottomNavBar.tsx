import React from 'react';
import { useNutrition } from '../context/NutritionContext';
import { appNavItems } from './appNav';

interface BottomNavBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

/** Phone & tablet tab bar; wide screens use the links in the top bar instead. */
export const BottomNavBar: React.FC<BottomNavBarProps> = ({ activeTab, onTabChange }) => {
  const { isDietitian } = useNutrition();

  return (
    <nav
      aria-label="Main"
      className="lg:hidden sticky bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_12px_rgba(0,0,0,0.03)] no-print pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-6 items-center h-16 max-w-2xl mx-auto">
        {appNavItems(isDietitian).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center justify-center h-full min-w-0 transition-colors ${
                isActive ? 'text-[#3E6553]' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110 stroke-[2.4]' : 'stroke-[1.8]'}`} aria-hidden="true" />
              <span className={`text-[11px] tracking-tight mt-1 truncate max-w-full px-0.5 ${isActive ? 'font-semibold' : 'font-medium text-slate-500'}`}>
                {tab.short}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
