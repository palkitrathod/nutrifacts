import React from 'react';
import { X, Bell, Calendar, Droplets, Utensils, CheckCheck, TrendingUp, Heart } from 'lucide-react';
import { useNutrition } from '../context/NutritionContext';
import { useEscapeToClose } from './useEscapeToClose';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: string) => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
}) => {
  const { notifications, currentUser, markNotificationRead } = useNutrition();

  useEscapeToClose(isOpen, onClose);

  if (!isOpen) return null;

  const userNotifs = notifications.filter(
    (n) => n.userId === currentUser.id || n.userId === 'all'
  );

  const getIcon = (category: string) => {
    switch (category) {
      case 'appointment':
        return <Calendar className="w-4 h-4 text-emerald-600" />;
      case 'water':
        return <Droplets className="w-4 h-4 text-sky-600" />;
      case 'diet':
        return <Utensils className="w-4 h-4 text-amber-600" />;
      case 'weight':
        return <TrendingUp className="w-4 h-4 text-indigo-600" />;
      default:
        return <Heart className="w-4 h-4 text-rose-600" />;
    }
  };

  const handleItemClick = (notif: any) => {
    markNotificationRead(notif.id);
    if (notif.category === 'diet') onNavigateTab('diet');
    else if (notif.category === 'appointment') onNavigateTab('appointments');
    else if (notif.category === 'weight') onNavigateTab('progress');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-[#3E6553] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Notifications & Reminders</h3>
              <p className="text-xs text-emerald-100 font-light">
                Appointment reminders & daily care updates
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white/80 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-4 overflow-y-auto space-y-2.5">
          {userNotifs.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Bell className="w-10 h-10 mx-auto stroke-1 text-slate-300 mb-2" />
              <p className="text-xs">No notifications right now.</p>
            </div>
          ) : (
            userNotifs.map((item) => (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-3 ${
                  !item.read
                    ? 'bg-emerald-50/60 border-emerald-200/80 shadow-xs'
                    : 'bg-white border-slate-100 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-white border border-slate-200 shadow-2xs flex items-center justify-center shrink-0 mt-0.5">
                  {getIcon(item.category)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <p className={`font-semibold truncate ${!item.read ? 'text-slate-900' : 'text-slate-700'}`}>
                      {item.title}
                    </p>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                      {item.timestamp}
                    </span>
                  </div>
                  <p className="text-slate-600 leading-relaxed text-[11px]">
                    {item.message}
                  </p>
                </div>
                {!item.read && (
                  <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0 mt-2" />
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Active for {currentUser.name}</span>
          <button
            type="button"
            onClick={() => {
              userNotifs.forEach((n) => markNotificationRead(n.id));
            }}
            className="text-emerald-800 hover:text-emerald-950 font-medium flex items-center gap-1"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Mark all read</span>
          </button>
        </div>

      </div>
    </div>
  );
};
