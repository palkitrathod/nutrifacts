import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Video,
  MapPin,
  Plus,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
  ExternalLink,
  Shield,
  User,
  Check,
  X,
  Tag,
  Sparkles,
  Info,
} from 'lucide-react';
import { useNutrition } from '../context/NutritionContext';
import { Appointment } from '../types/nutrition';
import { WhatsAppButton } from '../components/WhatsAppButton';
import { FIRST_CONSULTATION_INR, FOLLOW_UP_INR } from '../shared/pricing';

interface AppointmentsScreenProps {
  onOpenBookModal: () => void;
}

export const AppointmentsScreen: React.FC<AppointmentsScreenProps> = ({ onOpenBookModal }) => {
  const {
    currentUser,
    isDietitian,
    appointments,
    updateAppointmentStatus,
  } = useNutrition();

  const [filter, setFilter] = useState<'all' | 'upcoming' | 'completed'>('upcoming');

  // Filter appointments for current user or all if dietitian
  const userAppts = isDietitian
    ? appointments
    : appointments.filter((a) => a.patientId === currentUser.id);

  const filteredList = userAppts.filter((a) => {
    if (filter === 'upcoming') return a.status === 'confirmed' || a.status === 'pending';
    if (filter === 'completed') return a.status === 'completed' || a.status === 'cancelled';
    return true;
  });

  return (
    <div className="flex-1 pb-16 space-y-5 px-4 pt-4 md:px-8 md:pt-6 max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto w-full">
      
      {/* Top Banner */}
      <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-200 p-5 md:p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#3E6553]">
              Nutrifacts Clinical Consultations
            </span>
            <h1 className="text-lg sm:text-xl font-serif font-bold text-slate-900">
              Diet Consultations & Follow-ups
            </h1>
            <p className="text-xs text-slate-500">
              {isDietitian
                ? 'Manage appointment schedule, review patient intake requests, and track consultation fees'
                : '1-on-1 personalized sessions with Dt. Anchal Dewan'}
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenBookModal}
            className="px-4 py-2.5 rounded-xl bg-[#3E6553] hover:bg-[#325243] text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Request Consultation</span>
          </button>
        </div>

        {/* CONSULTATION PRICING MODEL HIGHLIGHT */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-[#FAFBF9] to-emerald-50/50 border border-emerald-100 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#3E6553] flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                <span>Simple & Affordable Pricing Model</span>
              </span>
              <span className="text-[10px] bg-emerald-100 text-[#3E6553] font-semibold px-2 py-0.5 rounded-full">
                No Hidden Fees
              </span>
            </div>
            <p className="text-[11px] text-slate-600">
              Every patient receives thorough initial attention followed by budget-friendly continuous progress care.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-center">
              <span className="text-[10px] text-slate-500 block uppercase font-medium">First Consultation</span>
              <span className="text-sm font-bold font-mono text-[#3E6553]">₹{FIRST_CONSULTATION_INR}</span>
              <span className="text-[9px] text-slate-400 block">Health & Diet Intake</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-center">
              <span className="text-[10px] text-slate-500 block uppercase font-medium">Follow-ups</span>
              <span className="text-sm font-bold font-mono text-[#3E6553]">₹{FOLLOW_UP_INR}</span>
              <span className="text-[9px] text-slate-400 block">Progress & Diet Updates</span>
            </div>
          </div>
        </div>

        {/* Filter Segmented Control */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl max-w-xs text-xs font-medium">
          <button
            type="button"
            onClick={() => setFilter('upcoming')}
            className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer ${
              filter === 'upcoming'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Upcoming
          </button>
          <button
            type="button"
            onClick={() => setFilter('completed')}
            className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer ${
              filter === 'completed'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Completed
          </button>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer ${
              filter === 'all'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All
          </button>
        </div>
      </div>

      {/* Appointments List */}
      <div className="space-y-3">
        {filteredList.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center space-y-3 border border-slate-200">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="font-bold text-sm text-slate-800">No {filter} appointments found</h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Ready to review your progress or start a new program? Book a session with Dt. Anchal.
            </p>
            <button
              type="button"
              onClick={onOpenBookModal}
              className="mt-2 px-4 py-2 rounded-xl bg-[#3E6553] text-white font-medium text-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Book Now (From ₹300)</span>
            </button>
          </div>
        ) : (
          filteredList.map((appt) => {
            const isFirst = appt.consultationTier === 'first_consultation';
            const fee = appt.consultationFeeInr ?? (isFirst ? FIRST_CONSULTATION_INR : FOLLOW_UP_INR);

            return (
              <div
                key={appt.id}
                className="bg-white rounded-2xl p-5 border border-slate-200 hover:border-emerald-200 transition-all shadow-2xs space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">
                        {appt.serviceCategory}
                      </span>
                      <span className="text-slate-300">·</span>
                      
                      {/* Pricing Model Badge */}
                      <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                        isFirst
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-emerald-100 text-emerald-950'
                      }`}>
                        <Tag className="w-3 h-3" />
                        <span>{isFirst ? 'First Consultation' : 'Follow-up Session'}</span>
                        <span className="font-mono font-bold">₹{fee}</span>
                      </span>

                      <span className="text-slate-300">·</span>
                      <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                        {appt.consultationType === 'online_video' ? 'Video Telehealth' : 'In-Clinic Visit'}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          appt.status === 'confirmed'
                            ? 'bg-emerald-100 text-emerald-900'
                            : appt.status === 'pending'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {appt.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 pt-1">
                      <span className="flex items-center gap-1 font-semibold text-slate-800">
                        <Calendar className="w-3.5 h-3.5 text-emerald-800" />
                        <span>{appt.date}</span>
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1 font-mono text-slate-700">
                        <Clock className="w-3.5 h-3.5 text-emerald-800" />
                        <span>{appt.timeSlot}</span>
                      </span>
                      {isDietitian && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-1 text-slate-800">
                            <User className="w-3.5 h-3.5 text-slate-500" />
                            <span>Patient: <strong>{appt.patientName}</strong> ({appt.patientPhone})</span>
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Video Link or Clinic Address button */}
                  <div className="flex items-center gap-2 shrink-0">
                    {appt.consultationType === 'online_video' && appt.meetingLink && appt.status === 'confirmed' && (
                      <a
                        href={appt.meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-medium text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>Join Video Call</span>
                        <ExternalLink className="w-3 h-3 opacity-80" />
                      </a>
                    )}

                    {appt.consultationType === 'in_person_clinic' && (
                      <div className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 font-medium text-xs flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                        <span>Nutrifacts Clinic, Suite 204</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes */}
                {appt.patientNotes && (
                  <div className="text-xs text-slate-600 bg-[#FAFBF9] p-3 rounded-xl border border-slate-100">
                    <span className="font-semibold text-slate-700 block mb-0.5">
                      Session Agenda & Clinical Notes:
                    </span>
                    <p>{appt.patientNotes}</p>
                  </div>
                )}

                {/* Dietitian Controls */}
                {isDietitian && appt.status !== 'completed' && (
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
                    {appt.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => updateAppointmentStatus(appt.id, 'confirmed')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Confirm Appointment</span>
                      </button>
                    )}
                    {appt.status === 'confirmed' && (
                      <button
                        type="button"
                        onClick={() => updateAppointmentStatus(appt.id, 'completed', 'Consultation finished; follow-up chart updated.')}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Mark as Completed</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => updateAppointmentStatus(appt.id, 'cancelled', 'Cancelled by clinic administration.')}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 hover:text-rose-700 text-slate-600 font-medium flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Cancel</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Direct Contact with Dt. Anchal */}
      <div className="bg-emerald-50 rounded-2xl p-4 sm:p-5 border border-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="space-y-0.5">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
            <MessageCircle className="w-4 h-4 text-emerald-800" />
            <span>Have a quick question before booking?</span>
          </h3>
          <p className="text-slate-600">
            Connect directly with Dt. Anchal on WhatsApp for consultation inquiries, rescheduling, or report pre-checks.
          </p>
        </div>
        <WhatsAppButton variant="inline" customMessage="Hi Dt. Anchal, I would like to inquire about booking a consultation." />
      </div>

    </div>
  );
};
