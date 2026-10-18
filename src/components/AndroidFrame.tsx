import React, { useState, useEffect } from 'react';
import { Smartphone, Monitor, ShieldCheck, UserCheck, Stethoscope } from 'lucide-react';
import { useNutrition } from '../context/NutritionContext';
import { DIETITIAN_PROFILE } from '../data/mockData';

interface AndroidFrameProps {
  children: React.ReactNode;
  onOpenAccount: () => void;
}

export const AndroidFrame: React.FC<AndroidFrameProps> = ({ children, onOpenAccount }) => {
  const { viewMode, toggleViewMode, currentUser, isDietitian } = useNutrition();
  const [currentTime, setCurrentTime] = useState('09:41');

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setCurrentTime(
        d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#F2F5F3] text-slate-800 flex flex-col font-sans selection:bg-[#3E6553] selection:text-white">
      {/* Top Universal Mode & Role Switch Bar */}
      <aside aria-label="Device view and account controls" className="no-print bg-white/95 backdrop-blur-md border-b border-emerald-900/10 px-4 py-2.5 sticky top-0 z-50 shadow-xs">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Brand Wordmark & Tagline */}
          <div className="flex items-center gap-2">
            <span className="text-base" role="img" aria-label="salad">🥗</span>
            <div>
              <span className="font-bold text-slate-900 tracking-tight text-sm">Nutrifacts</span>
              <span className="text-slate-500 hidden sm:inline ml-1.5 font-normal">
                · with dt.Anchal
              </span>
            </div>
            <span className="hidden md:inline text-slate-400 font-normal">
              — Nourish Better. Live Healthier.
            </span>
          </div>

          {/* Quick Controls: Viewport Mode & Active Account */}
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => { if (viewMode !== 'phone') toggleViewMode(); }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all ${
                  viewMode === 'phone'
                    ? 'bg-white text-emerald-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Android Phone Mockup View"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Android View</span>
              </button>
              <button
                type="button"
                onClick={() => { if (viewMode !== 'responsive') toggleViewMode(); }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all ${
                  viewMode === 'responsive'
                    ? 'bg-white text-emerald-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Responsive Desktop View"
              >
                <Monitor className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Desktop View</span>
              </button>
            </div>

            {/* Account button (opens the Account panel) */}
            <button
              type="button"
              onClick={onOpenAccount}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-all border ${
                isDietitian
                  ? 'bg-emerald-800 text-white border-emerald-900 hover:bg-emerald-900'
                  : 'bg-emerald-50 text-emerald-950 border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              {isDietitian ? (
                <Stethoscope className="w-3.5 h-3.5 text-emerald-200" />
              ) : (
                <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
              )}
              <span className="max-w-[130px] truncate">
                {isDietitian ? 'Dietitian Admin' : currentUser.name.split(' ')[0]}
              </span>
              <span className="text-[10px] uppercase font-semibold tracking-wider opacity-80 border-l pl-1.5 border-current">
                Account
              </span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Canvas Area */}
      <main className="flex-1 flex justify-center items-start p-0 md:p-6 overflow-y-auto">
        {viewMode === 'phone' ? (
          /* Android Smartphone Shell */
          <div className="w-full max-w-[430px] my-0 md:my-3 bg-white md:rounded-[44px] shadow-2xl md:ring-12 md:ring-slate-900/10 overflow-hidden flex flex-col min-h-screen md:min-h-[860px] md:max-h-[92vh] border-0 md:border md:border-slate-300 relative transition-all">
            
            {/* Android Status Bar */}
            <div className="bg-[#3E6553] text-white px-6 pt-3 pb-2 flex items-center justify-between text-xs font-semibold select-none z-40">
              <span className="tabular-nums font-mono text-[13px]">{currentTime}</span>
              
              {/* Android Camera Punch Hole */}
              <div className="w-3.5 h-3.5 rounded-full bg-slate-900 mx-auto hidden md:block" />

              {/* Status Icons */}
              <div className="flex items-center gap-2 text-[11px]">
                <span className="tracking-tighter font-mono font-bold">5G</span>
                {/* WiFi SVG */}
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 4C7.31 4 3.07 5.9 0 8.98L12 21 24 8.98C20.93 5.9 16.69 4 12 4zm0 3.5c3.55 0 6.78 1.45 9.15 3.79L12 19.34 2.85 11.29C5.22 8.95 8.45 7.5 12 7.5z"/>
                </svg>
                {/* Battery SVG */}
                <div className="flex items-center">
                  <div className="w-5 h-2.5 border border-white/90 rounded-xs p-0.5 flex items-center">
                    <div className="h-full w-4/5 bg-white rounded-2xs" />
                  </div>
                  <div className="w-0.5 h-1 bg-white/90 rounded-r-xs" />
                </div>
              </div>
            </div>

            {/* App Scrollable Content */}
            <div className="flex-1 overflow-y-auto flex flex-col bg-[#F7F9F7] relative">
              {children}
            </div>

            {/* Android Bottom Navigation Pill */}
            <div className="bg-white py-1.5 flex justify-center items-center select-none z-40 border-t border-slate-100">
              <div className="w-32 h-1 bg-slate-400 rounded-full" />
            </div>
          </div>
        ) : (
          /* Full Responsive Desktop / Tablet View */
          <div className="w-full max-w-6xl bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden min-h-[820px] flex flex-col">
            {children}
          </div>
        )}
      </main>
    </div>
  );
};
