import React from 'react';
import { Bell, UserCheck, Stethoscope, Sparkles } from 'lucide-react';
import { useNutrition } from '../context/NutritionContext';

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
  const { currentUser, isDietitian, notifications, viewMode } = useNutrition();

  const unreadCount = notifications.filter(
    (n) => n.userId === currentUser.id && !n.read
  ).length;

  return (
    <header className="sticky top-0 z-30 bg-[#3E6553] text-white shadow-sm border-b border-emerald-900/20">
      <div className="px-4 py-3 flex items-center justify-between gap-4">
        {/* Brand Zone */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => onNavigateTab('home')}
            className="flex items-center gap-2 text-left focus:outline-hidden group"
          >
            <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center shrink-0 border border-white/20">
              <span className="text-lg">🥗</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold tracking-tight text-base text-white whitespace-nowrap truncate font-serif">
                  Nutrifacts
                </span>
                <span className="text-emerald-200 text-xs font-normal whitespace-nowrap">
                  · dt.Anchal
                </span>
              </div>
              <p className="text-[11px] text-emerald-100/80 truncate font-light tracking-wide">
                Nourish Better. Live Healthier.
              </p>
            </div>
          </button>
        </div>

        {/* Desktop Nav Links (Visible in Responsive View) */}
        {viewMode === 'responsive' && (
          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-emerald-100">
            <button
              type="button"
              onClick={() => onNavigateTab('home')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 ${
                activeTab === 'home' ? 'text-white border-b-2 border-emerald-300 font-semibold' : ''
              }`}
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('diet')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 ${
                activeTab === 'diet' ? 'text-white border-b-2 border-emerald-300 font-semibold' : ''
              }`}
            >
              {isDietitian ? 'Diet Plans' : 'My Diet Chart'}
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('progress')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 ${
                activeTab === 'progress' ? 'text-white border-b-2 border-emerald-300 font-semibold' : ''
              }`}
            >
              Progress & Logs
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('plans')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 ${
                activeTab === 'plans' ? 'text-white border-b-2 border-emerald-300 font-semibold' : ''
              }`}
            >
              Plans & Pricing
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('appointments')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 ${
                activeTab === 'appointments' ? 'text-white border-b-2 border-emerald-300 font-semibold' : ''
              }`}
            >
              Appointments
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('profile')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 ${
                activeTab === 'profile' ? 'text-white border-b-2 border-emerald-300 font-semibold' : ''
              }`}
            >
              {isDietitian ? 'Dietitian Admin' : 'My Profile'}
            </button>
          </nav>
        )}

        {/* Right Actions: Notifications & Switch Account */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Notifications Button */}
          <button
            type="button"
            onClick={onOpenNotifications}
            className="w-10 h-10 rounded-full hover:bg-white/10 active:bg-white/20 flex items-center justify-center transition-colors relative min-w-[44px] min-h-[44px]"
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

          {/* Profile / Role Avatar Button */}
          <button
            type="button"
            onClick={onOpenAccount}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 transition-all min-h-[44px]"
            title={`Logged in as ${currentUser.name}`}
          >
            <div className="w-7 h-7 rounded-full overflow-hidden bg-emerald-800 shrink-0 border border-white/40 flex items-center justify-center text-xs font-semibold">
              {currentUser.avatar ? (
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{currentUser.name.charAt(0)}</span>
              )}
            </div>
            <div className="text-left hidden sm:block max-w-[100px] truncate">
              <p className="text-xs font-medium text-white truncate leading-tight">
                {currentUser.name.split(' ')[0]}
              </p>
              <p className="text-[10px] text-emerald-200 uppercase tracking-wider font-semibold">
                {isDietitian ? 'Dietitian' : 'Patient'}
              </p>
            </div>
          </button>
        </div>
      </div>
    </header>
  );
};
