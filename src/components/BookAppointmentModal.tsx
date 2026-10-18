import React, { useEffect, useState } from 'react';
import { X, Calendar, Clock, Video, MapPin, CheckCircle, Sparkles, User, Phone, Tag, ShieldCheck, HeartPulse } from 'lucide-react';
import { useNutrition } from '../context/NutritionContext';
import { ConsultationType, ConsultationTier } from '../types/nutrition';

interface BookAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedService?: string;
}

export const BookAppointmentModal: React.FC<BookAppointmentModalProps> = ({
  isOpen,
  onClose,
  preselectedService,
}) => {
  const { currentUser, services, appointments, bookAppointment } = useNutrition();

  // Check if patient already has previous appointments to recommend follow-up vs first consultation
  const patientPastAppointments = appointments.filter((a) => a.patientId === currentUser.id);
  const defaultTier: ConsultationTier = patientPastAppointments.length === 0 ? 'first_consultation' : 'follow_up';

  const [consultationTier, setConsultationTier] = useState<ConsultationTier>(defaultTier);
  const [consultationType, setConsultationType] = useState<ConsultationType>('online_video');
  const [serviceCategory, setServiceCategory] = useState(
    preselectedService || services[0]?.title || 'Weight Management'
  );

  // Default to 2 days ahead
  const defaultDate = new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0];
  const [date, setDate] = useState(defaultDate);
  const [timeSlot, setTimeSlot] = useState('11:00 AM – 11:30 AM');
  const [patientNotes, setPatientNotes] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  // The modal stays mounted, so refresh its defaults every time it opens: the service the person
  // picked, and "follow-up" once they already have a booking.
  useEffect(() => {
    if (!isOpen) return;
    setServiceCategory(preselectedService || services[0]?.title || 'Weight Management');
    setConsultationTier(defaultTier);
    setIsSubmitted(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, preselectedService]);

  if (!isOpen) return null;

  const consultationFee = consultationTier === 'first_consultation' ? 500 : 300;

  const timeSlots = [
    '10:00 AM – 10:30 AM',
    '11:00 AM – 11:30 AM',
    '12:15 PM – 12:45 PM',
    '04:00 PM – 04:30 PM',
    '05:15 PM – 05:45 PM',
    '06:30 PM – 07:00 PM',
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    bookAppointment({
      patientId: currentUser.id,
      patientName: currentUser.name,
      patientPhone: currentUser.phone || '+91 98000 00000',
      consultationType,
      consultationTier,
      consultationFeeInr: consultationFee,
      serviceCategory,
      date,
      timeSlot,
      patientNotes: patientNotes.trim() || (consultationTier === 'first_consultation'
        ? 'First comprehensive nutrition intake, health condition, and lifestyle assessment'
        : 'Follow-up progress review and diet plan adaptation'),
    });
    setIsSubmitted(true);
    setTimeout(() => {
      setIsSubmitted(false);
      onClose();
    }, 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-[#3E6553] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Book Consultation with Dt. Anchal</h3>
              <p className="text-xs text-emerald-100 font-light">
                Affordable Clinical Nutrition Care & Diet Planning
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white/80 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSubmitted ? (
          <div className="p-10 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-[#3E6553] flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h4 className="text-base font-bold text-slate-900">Consultation Scheduled!</h4>
            <p className="text-xs text-slate-600 max-w-xs mx-auto">
              Your {consultationTier === 'first_consultation' ? 'First Consultation' : 'Follow-up Session'} with Dt. Anchal is booked for {date} at {timeSlot}.
            </p>
            <div className="inline-block px-3 py-1 bg-emerald-50 text-[#3E6553] font-bold text-xs rounded-full">
              Consultation Fee: ₹{consultationFee}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
            
            {/* PRICING MODEL SELECTION (₹500 FIRST vs ₹300 FOLLOW-UP) */}
            <div className="space-y-1.5">
              <label className="block font-semibold text-slate-800">
                Consultation Type & Pricing
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setConsultationTier('first_consultation')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    consultationTier === 'first_consultation'
                      ? 'border-[#3E6553] bg-emerald-50/70 ring-2 ring-emerald-600/30'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 text-xs">First Consultation</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-800 text-white font-mono font-bold text-xs">
                      ₹500
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    Comprehensive assessment of health condition, dietary habits, lifestyle & nutritional requirements.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setConsultationTier('follow_up')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    consultationTier === 'follow_up'
                      ? 'border-[#3E6553] bg-emerald-50/70 ring-2 ring-emerald-600/30'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 text-xs">Follow-up Session</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-800 text-white font-mono font-bold text-xs">
                      ₹300
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    Review progress, evaluate diet adherence & make necessary adjustments to the diet chart.
                  </p>
                </button>
              </div>
            </div>

            {/* Consultation Mode Selector */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Consultation Format
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setConsultationType('online_video')}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-center ${
                    consultationType === 'online_video'
                      ? 'border-[#3E6553] bg-emerald-50/80 text-emerald-950 font-semibold ring-2 ring-emerald-600/30'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Video className="w-5 h-5 text-emerald-700" />
                  <span>Online Telehealth</span>
                  <span className="text-[10px] text-slate-500 font-normal">Video Consultation via Google Meet</span>
                </button>

                <button
                  type="button"
                  onClick={() => setConsultationType('in_person_clinic')}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-center ${
                    consultationType === 'in_person_clinic'
                      ? 'border-[#3E6553] bg-emerald-50/80 text-emerald-950 font-semibold ring-2 ring-emerald-600/30'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <MapPin className="w-5 h-5 text-emerald-700" />
                  <span>In-Clinic Visit</span>
                  <span className="text-[10px] text-slate-500 font-normal">Nutrifacts Wellness Centre</span>
                </button>
              </div>
            </div>

            {/* Service Category */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Nutrition Service / Clinical Focus
              </label>
              <select
                value={serviceCategory}
                onChange={(e) => setServiceCategory(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-slate-800"
              >
                {services.map((svc) => (
                  <option key={svc.id} value={svc.title}>
                    {svc.title} — {svc.subtitle}
                  </option>
                ))}
                <option value="Fatty Liver & Hepatic Care">Fatty Liver & Hepatic Care (NAFLD)</option>
                <option value="Irritable Bowel Syndrome (IBS)">Irritable Bowel Syndrome (IBS / Low-FODMAP)</option>
                <option value="Kidney & Renal Health">Kidney & Renal Health</option>
                <option value="Cardiovascular & Hypertension">Cardiovascular & Hypertension (DASH)</option>
                <option value="GERD & Acid Reflux">GERD & Acid Reflux Care</option>
              </select>
            </div>

            {/* Date Picker */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Preferred Date
                </label>
                <input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Time Slot
                </label>
                <select
                  value={timeSlot}
                  onChange={(e) => setTimeSlot(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-slate-800"
                >
                  {timeSlots.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Patient Context & Symptoms */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Health Notes, Symptoms, or Specific Goals
              </label>
              <textarea
                value={patientNotes}
                onChange={(e) => setPatientNotes(e.target.value)}
                rows={3}
                placeholder={
                  consultationTier === 'first_consultation'
                    ? "Share your dietary habits, health history, or specific health goals you'd like Dt. Anchal to address..."
                    : "Mention recent weigh-ins, how you felt with the current diet chart, or questions for your follow-up..."
                }
                className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-600/30"
              />
            </div>

            {/* Pricing Summary Card */}
            <div className="bg-[#FAFBF9] p-3.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <Tag className="w-3.5 h-3.5 text-emerald-800" />
                  <span>
                    {consultationTier === 'first_consultation'
                      ? 'First Consultation Fee'
                      : 'Follow-up Session Fee'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">
                  No hidden charges · Includes follow-up diet chart review
                </p>
              </div>
              <div className="text-right">
                <span className="text-base font-bold font-mono text-[#3E6553]">
                  ₹{consultationFee}
                </span>
                <span className="text-[10px] text-slate-400 block">per session</span>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-[#3E6553] hover:bg-[#325243] text-white font-medium text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Calendar className="w-4 h-4" />
              <span>Confirm Booking (Payable: ₹{consultationFee})</span>
            </button>
          </form>
        )}

      </div>
    </div>
  );
};
