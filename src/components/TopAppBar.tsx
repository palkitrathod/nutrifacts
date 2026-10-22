import React from 'react';
import { Bell } from 'lucide-react';
import { useNutrition } from '../context/NutritionContext';
import { appNavItems } from './appNav';

interface TopAppBarProps {
  onOpenNotifications: () => void;
  onOpenAccount: () => void;
  activeTab: string;
  onNavigateTab: (tab: string) => void;
}

export const TopAppBar: React.FC<TopAppBarProps> = ({
  onOpenNotifications,
  onOpenAccount,
  activeTab,
  onNavigateTab,
}) => {
  const { currentUser, isDietitian, notifications } = useNutrition();

  const unreadCount = notifications.filter(
    (n) => n.userId === currentUser.id && !n.read
  ).length;

  return (
    <header className="sticky top-0 z-30 bg-[#3E6553] text-white shadow-sm border-b border-emerald-900/20 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
        {/* Brand Zone */}
        <button
          type="button"
          onClick={() => onNavigateTab('home')}
          className="flex items-center gap-2 text-left focus:outline-hidden min-w-0"
        >
          <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center shrink-0 border border-white/20">
            <span className="text-lg" aria-hidden="true">🥗</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold tracking-tight text-base text-white whitespace-nowrap font-serif">Nutrifacts</span>
              <span className="text-emerald-200 text-xs font-normal whitespace-nowrap hidden min-[380px]:inline">· dt.Anchal</span>
            </div>
            <p className="text-[11px] text-emerald-100/80 truncate font-light tracking-wide hidden sm:block lg:hidden xl:block">
              Nourish Better. Live Healthier.
            </p>
          </div>
        </button>

        {/* Section links on wide screens (phones and tablets use the bottom tab bar) */}
        <nav aria-label="Main" className="hidden lg:flex items-center gap-1 xl:gap-2 text-sm font-medium text-emerald-100">
          {appNavItems(isDietitian).map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigateTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`px-3 py-2 rounded-lg whitespace-nowrap transition-colors ${
                  isActive ? 'bg-white/15 text-white font-semibold' : 'hover:text-white hover:bg-white/10'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Right Actions: Notifications & Account */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenNotifications}
            className="w-11 h-11 rounded-full hover:bg-white/10 active:bg-white/20 flex items-center justify-center transition-colors relative"
            title="Notifications"
            aria-label="View notifications"
          >
            <Bell className="w-5 h-5 text-emerald-50" />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 w-4 h-4 bg-amber-400 text-slate-900 text-[10px] font-bold rounded-full flex items-center justify-center shadow-xs">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenAccount}
            className="flex items-center gap-2 p-1.5 sm:pr-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 transition-all min-h-[44px]"
            title={`Logged in as ${currentUser.name}`}
          >
            <div className="w-8 h-8 rounded-full overflow-hidden bg-emerald-800 shrink-0 border border-white/40 flex items-center justify-center text-xs font-semibold">
              {currentUser.avatar ? (
                <img src={currentUser.avatar} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
              ) : (
                <span>{currentUser.name.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="text-left hidden sm:block max-w-[110px]">
              <p className="text-xs font-medium text-white truncate leading-tight">{currentUser.name.split(' ')[0]}</p>
              <p className="text-[10px] text-emerald-200 uppercase tracking-wider font-semibold">{isDietitian ? 'Dietitian' : 'Patient'}</p>
            </div>
          </button>
        </div>
      </div>
    </header>
  );
};
