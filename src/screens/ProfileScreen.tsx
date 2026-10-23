import React, { useState } from 'react';
import {
  User,
  Shield,
  Edit2,
  CheckCircle,
  FileText,
  TrendingUp,
  Calendar,
  Lock,
  Stethoscope,
  Users,
  Search,
  Award,
  Phone,
  Mail,
  Heart,
  Droplet,
  CreditCard,
  Tag,
  AlertCircle,
  Send,
  History,
  Activity,
  HeartPulse,
  Flame,
  Check,
  X,
  Clock,
  Sparkles,
  ChevronRight,
  Filter,
  Plus,
  KeyRound,
} from 'lucide-react';
import { useNutrition } from '../context/NutritionContext';
import { ResetPatientPasswordDialog } from '../components/ResetPatientPasswordDialog';
import { EditProfileForm } from '../components/EditProfileForm';
import { ProfilePhoto } from '../components/ProfilePhoto';
import { ageOn } from '../shared/authValidation';
import {
  PackagePayment,
  ClinicalConditionType,
  ClinicalConditionInfo,
  MealAdherenceStatus,
  type User as PatientRecord,
} from '../types/nutrition';
import { DIETITIAN_PROFILE, CLINICAL_CONDITIONS_DATA } from '../data/mockData';
import { FIRST_CONSULTATION_INR, FOLLOW_UP_INR } from '../shared/pricing';

interface ProfileScreenProps {
  onNavigateTab: (tab: string) => void;
  onOpenPdfModal: () => void;
  onViewReceipt?: (payment: PackagePayment) => void;
  /** Open with the "Edit profile" form showing (from "My profile" in the account panel). */
  startEditing?: boolean;
}

type AdminTab =
  | 'patients'
  | 'clinical_plans'
  | 'intake_adherence'
  | 'consultations'
  | 'reminders'
  | 'modification_history';

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  onNavigateTab,
  onOpenPdfModal,
  onViewReceipt,
  startEditing = false,
}) => {
  const {
    currentUser,
    isDietitian,
    patients,
    appointments,
    dietCharts,
    setSelectedPatientId,
    updatePatientProfile,
    getPatientPayments,
    adherenceRecords,
    getAdherenceStats,
    assignClinicalConditionDiet,
    addNotification,
  } = useNutrition();

  // Admin Dashboard Active Tab
  const [adminTab, setAdminTab] = useState<AdminTab>('patients');

  // Search & Filtering
  const [searchTerm, setSearchTerm] = useState('');
  const [adherenceFilter, setAdherenceFilter] = useState<'all' | 'skipped' | 'partial' | 'consumed'>('all');

  // Clinical condition assignment modal
  const [assigningCondition, setAssigningCondition] = useState<ClinicalConditionInfo | null>(null);
  const [targetPatientId, setTargetPatientId] = useState(patients[0]?.id || '');
  const [assignSuccessMsg, setAssignSuccessMsg] = useState<string | null>(null);

  // Custom reminder dispatch state
  const [reminderPatientId, setReminderPatientId] = useState<string>('all');
  const [resetPasswordFor, setResetPasswordFor] = useState<PatientRecord | null>(null);
  const [reminderCategory, setReminderCategory] = useState<'diet' | 'appointment' | 'weight' | 'water'>('diet');
  const [reminderTitle, setReminderTitle] = useState('Weekly Follow-up Review Notice');
  const [reminderMessage, setReminderMessage] = useState(
    'Please record your morning weigh-in and review your assigned 7-day diet chart before our upcoming session.'
  );
  const [reminderSentNotice, setReminderSentNotice] = useState<string | null>(null);

  // My profile (patient view)
  const [isEditingProfile, setIsEditingProfile] = useState(startEditing);
  const [profileSavedNotice, setProfileSavedNotice] = useState<string | null>(null);
  const finishEditing = (message?: string) => {
    setIsEditingProfile(false);
    if (message) {
      setProfileSavedNotice(message);
      setTimeout(() => setProfileSavedNotice(null), 4000);
    }
  };

  const handleExecuteClinicalAssignment = () => {
    if (!assigningCondition || !targetPatientId) return;
    assignClinicalConditionDiet(targetPatientId, assigningCondition.conditionType);
    const pt = patients.find((p) => p.id === targetPatientId);
    setAssignSuccessMsg(
      `Successfully assigned "${assigningCondition.title}" to ${pt?.name || 'patient'}.`
    );
    setAssigningCondition(null);
    setTimeout(() => setAssignSuccessMsg(null), 4000);
  };

  const handleSendReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (reminderPatientId === 'all') {
      patients.forEach((p) => {
        addNotification({
          userId: p.id,
          title: reminderTitle,
          message: reminderMessage,
          category: reminderCategory,
        });
      });
      setReminderSentNotice(`Broadcast notification sent to all ${patients.length} patients.`);
    } else {
      const target = patients.find((p) => p.id === reminderPatientId);
      addNotification({
        userId: reminderPatientId,
        title: reminderTitle,
        message: reminderMessage,
        category: reminderCategory,
      });
      setReminderSentNotice(`Notification sent to ${target?.name || 'patient'}.`);
    }
    setTimeout(() => setReminderSentNotice(null), 4000);
  };

  // If Dietitian Admin: Render the Detailed Admin Dashboard
  if (isDietitian) {
    const filteredPatients = patients.filter(
      (p) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.assignedProgram?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.medicalConditions?.some((c) => c.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // Filter adherence records
    const filteredAdherence = adherenceRecords.filter((rec) => {
      if (adherenceFilter === 'skipped') return rec.status === 'skipped';
      if (adherenceFilter === 'partial') return rec.status === 'consumed_partial';
      if (adherenceFilter === 'consumed') return rec.status === 'consumed_full';
      return true;
    });

    // Consultations calculations
    const firstConsultations = appointments.filter((a) => a.consultationTier === 'first_consultation');
    const followUpConsultations = appointments.filter((a) => a.consultationTier === 'follow_up');
    const totalConsultationRevenue =
      [...firstConsultations, ...followUpConsultations].reduce((sum, a) => sum + (a.consultationFeeInr ?? 0), 0);

    return (
      <div className="flex-1 pb-16 space-y-5 px-4 pt-4 md:px-8 md:pt-6 max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto w-full">
        {/* Dietitian Profile Banner */}
        <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-200 p-5 md:p-6 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl overflow-hidden bg-emerald-800 shrink-0 border-2 border-emerald-700 shadow-xs">
                <img
                  src={DIETITIAN_PROFILE.avatar}
                  alt={DIETITIAN_PROFILE.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-serif font-bold text-slate-900">
                    {DIETITIAN_PROFILE.name}
                  </h1>
                  <span className="text-[10px] bg-emerald-800 text-white font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    Dietitian Admin
                  </span>
                </div>
                <p className="text-xs text-slate-600 font-medium">
                  Nutrifacts Practice · 4+ Years Clinical Nutrition Experience
                </p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-emerald-800" />
                    <span>{DIETITIAN_PROFILE.email}</span>
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-emerald-800" />
                    <span>{DIETITIAN_PROFILE.phone}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-[#3E6553] text-xs font-semibold border border-emerald-200">
                <Shield className="w-4 h-4 text-emerald-700" />
                <span>Clinical Nutrition Management Console</span>
              </span>
            </div>
          </div>

          {/* Admin KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-3.5 rounded-xl bg-[#F7F9F7] border border-emerald-900/5">
              <span className="text-[11px] text-slate-500 block">Active Patients</span>
              <span className="text-2xl font-bold font-mono text-slate-900">{patients.length}</span>
              <span className="text-[10px] text-emerald-800 block">Personalized rosters</span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F7F9F7] border border-emerald-900/5">
              <span className="text-[11px] text-slate-500 block">Diet Charts Issued</span>
              <span className="text-2xl font-bold font-mono text-slate-900">{dietCharts.length}</span>
              <span className="text-[10px] text-emerald-800 block">7-Day weekly plans</span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F7F9F7] border border-emerald-900/5">
              <span className="text-[11px] text-slate-500 block">Consultation Sessions</span>
              <span className="text-2xl font-bold font-mono text-slate-900">{appointments.length}</span>
              <span className="text-[10px] text-emerald-800 block">₹500 / ₹300 Model</span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F7F9F7] border border-emerald-900/5">
              <span className="text-[11px] text-slate-500 block">Intake Adherence Logs</span>
              <span className="text-2xl font-bold font-mono text-slate-900">{adherenceRecords.length}</span>
              <span className="text-[10px] text-emerald-800 block">Food & compliance tracking</span>
            </div>
          </div>
        </div>

        {/* Global Success Banner */}
        {assignSuccessMsg && (
          <div className="p-3 rounded-xl bg-emerald-100 text-emerald-950 text-xs font-medium flex items-center gap-2 border border-emerald-200">
            <CheckCircle className="w-4 h-4 text-emerald-700" />
            <span>{assignSuccessMsg}</span>
          </div>
        )}

        {/* DETAILED ADMIN DASHBOARD NAVIGATION TABS */}
        <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-200 p-2 shadow-2xs overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 min-w-max">
            <button
              type="button"
              onClick={() => setAdminTab('patients')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                adminTab === 'patients'
                  ? 'bg-[#3E6553] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Patient Profiles & Medical Histories ({patients.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setAdminTab('clinical_plans')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                adminTab === 'clinical_plans'
                  ? 'bg-[#3E6553] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <HeartPulse className="w-3.5 h-3.5" />
              <span>Clinical Diet Plans (10 Conditions)</span>
            </button>

            <button
              type="button"
              onClick={() => setAdminTab('intake_adherence')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                adminTab === 'intake_adherence'
                  ? 'bg-[#3E6553] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Food Intake & Adherence Reports</span>
            </button>

            <button
              type="button"
              onClick={() => setAdminTab('consultations')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                adminTab === 'consultations'
                  ? 'bg-[#3E6553] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Consultations & Schedule</span>
            </button>

            <button
              type="button"
              onClick={() => setAdminTab('reminders')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                adminTab === 'reminders'
                  ? 'bg-[#3E6553] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Reminders & Notifications</span>
            </button>

            <button
              type="button"
              onClick={() => setAdminTab('modification_history')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                adminTab === 'modification_history'
                  ? 'bg-[#3E6553] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Modification History</span>
            </button>
          </div>
        </div>

        {/* TAB 1: PATIENT PROFILES & MEDICAL HISTORIES */}
        {resetPasswordFor && (
          <ResetPatientPasswordDialog patient={resetPasswordFor} onClose={() => setResetPasswordFor(null)} />
        )}

        {adminTab === 'patients' && (
          <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-200 overflow-hidden shadow-2xs space-y-0">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-sm text-slate-900">
                  Patient Medical Profiles & Diagnostics Roster
                </h2>
                <p className="text-xs text-slate-500">
                  Detailed health histories, medical conditions, diet adherence, and clinical assignments
                </p>
              </div>

              <div className="relative max-w-xs w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search patient, diagnosis, or condition..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-600/30"
                />
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {filteredPatients.map((patient) => {
                const chart = dietCharts.find((c) => c.patientId === patient.id);
                const adherence = getAdherenceStats(patient.id);

                return (
                  <div
                    key={patient.id}
                    className="p-5 hover:bg-slate-50/50 transition-colors flex flex-col lg:flex-row lg:items-start justify-between gap-4 text-xs"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-200 border border-slate-300 shrink-0 mt-0.5">
                        <img
                          src={patient.avatar}
                          alt={patient.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">
                            {patient.name}
                          </span>
                          <span className="text-slate-400">·</span>
                          {[patient.age != null && `${patient.age} yrs`, patient.gender, patient.heightCm != null && `${patient.heightCm} cm`].some(Boolean) && (
                            <span className="text-slate-600 font-medium">
                              {[patient.age != null && `${patient.age} yrs`, patient.gender, patient.heightCm != null && `${patient.heightCm} cm`]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          )}
                          <span className="text-slate-400">·</span>
                          <span className="text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded-md font-semibold">
                            {patient.dietaryPreference}
                          </span>
                        </div>

                        <div className="text-slate-600">
                          Program: <strong className="text-slate-800">{patient.assignedProgram}</strong>
                        </div>

                        {/* Medical Conditions & Diagnoses */}
                        <div className="space-y-1 pt-0.5">
                          <span className="text-[11px] text-slate-500 font-medium block">
                            Clinical Diagnoses & Conditions:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {patient.medicalConditions && patient.medicalConditions.length > 0 ? (
                              patient.medicalConditions.map((cond, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-950 font-semibold border border-rose-200 text-[10px]"
                                >
                                  {cond}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400 text-[11px]">No chronic conditions</span>
                            )}
                          </div>
                        </div>

                        {/* Allergies & Biometrics */}
                        <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-600 pt-1">
                          <span>
                            Weight: <strong className="font-mono">{patient.currentWeightKg} kg</strong> (Target: <strong className="font-mono text-emerald-800">{patient.targetWeightKg} kg</strong>)
                          </span>
                          <span>·</span>
                          <span>
                            Adherence Score: <strong className="font-mono text-emerald-800">{adherence.adherencePercentage}%</strong>
                          </span>
                          {patient.followUpDate && (
                            <>
                              <span>·</span>
                              <span className="text-amber-800 font-semibold">
                                Follow-up: {patient.followUpDate}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions for Dietitian */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0 self-end lg:self-center">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPatientId(patient.id);
                          onNavigateTab('diet');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#3E6553] font-medium text-xs flex items-center gap-1 transition-colors border border-emerald-200 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>{chart ? 'Weekly Diet Chart' : 'Create Chart'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPatientId(patient.id);
                          onNavigateTab('progress');
                        }}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium text-xs flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>Weight Progress</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setTargetPatientId(patient.id);
                          setAdminTab('clinical_plans');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <HeartPulse className="w-3.5 h-3.5" />
                        <span>Assign Clinical Plan</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setResetPasswordFor(patient)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium text-xs flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>Reset Password</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: CLINICAL DIET PLANS FOR 10 MEDICAL CONDITIONS */}
        {adminTab === 'clinical_plans' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-200 p-5 shadow-2xs space-y-2">
              <div className="flex items-center gap-2">
                <HeartPulse className="w-5 h-5 text-emerald-800" />
                <h2 className="font-bold text-sm text-slate-900">
                  Clinical Diet Plans for Different Health Conditions
                </h2>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Specialized evidence-based nutrition protocols designed for specific medical diagnoses. Each plan establishes customized macro distributions, clinical principles, key foods to include & avoid, and a 7-day schedule. Assign any plan to an individual patient with 1 click.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {CLINICAL_CONDITIONS_DATA.map((plan) => (
                <div
                  key={plan.conditionType}
                  className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-emerald-300 transition-all shadow-2xs space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-[#3E6553] border border-emerald-100">
                        Clinical Protocol
                      </span>
                      <span className="text-xs font-mono font-semibold text-slate-600">
                        {plan.recommendedMacros.carbs}C / {plan.recommendedMacros.protein}P / {plan.recommendedMacros.fats}F
                      </span>
                    </div>

                    <h3 className="text-base font-serif font-bold text-slate-900">
                      {plan.title}
                    </h3>
                    <p className="text-xs text-[#3E6553] font-medium">
                      {plan.subtitle}
                    </p>

                    {/* Primary Goals */}
                    <div className="pt-1">
                      <span className="text-[11px] font-bold text-slate-800 block mb-1">
                        Clinical Objectives:
                      </span>
                      <ul className="space-y-0.5 text-xs text-slate-600">
                        {plan.primaryGoals.map((goal, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-emerald-700 font-bold">•</span>
                            <span>{goal}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Foods to Include & Avoid */}
                    <div className="grid grid-cols-2 gap-2 pt-2 text-[11px]">
                      <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100">
                        <span className="font-bold text-emerald-950 block mb-1">Include Regularly:</span>
                        <p className="text-slate-600 leading-snug">
                          {plan.keyFoodsToInclude.slice(0, 3).join(', ')}...
                        </p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-rose-50/60 border border-rose-100">
                        <span className="font-bold text-rose-950 block mb-1">Strictly Avoid:</span>
                        <p className="text-slate-600 leading-snug">
                          {plan.keyFoodsToAvoid.slice(0, 3).join(', ')}...
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">
                      7-day outline included
                    </span>
                    <button
                      type="button"
                      onClick={() => setAssigningCondition(plan)}
                      className="px-3.5 py-1.5 rounded-lg bg-[#3E6553] hover:bg-[#325243] text-white font-medium text-xs flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Assign to Patient</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: DAILY FOOD INTAKE & ADHERENCE REPORTS */}
        {adminTab === 'intake_adherence' && (
          <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-200 overflow-hidden shadow-2xs space-y-0">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-sm text-slate-900">
                  Daily Food Intake & Diet Adherence Reports
                </h2>
                <p className="text-xs text-slate-500">
                  Audit which meals were consumed, partially eaten, or skipped by patients with recorded reasons
                </p>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setAdherenceFilter('all')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    adherenceFilter === 'all' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600'
                  }`}
                >
                  All Logs
                </button>
                <button
                  type="button"
                  onClick={() => setAdherenceFilter('consumed')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    adherenceFilter === 'consumed' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Full (100%)
                </button>
                <button
                  type="button"
                  onClick={() => setAdherenceFilter('partial')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    adherenceFilter === 'partial' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Partial
                </button>
                <button
                  type="button"
                  onClick={() => setAdherenceFilter('skipped')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    adherenceFilter === 'skipped' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Skipped Meals
                </button>
              </div>
            </div>

            {/* Adherence Summary Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-[#FAFBF9] border-b border-slate-100 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">Total Logs Logged</span>
                <span className="text-lg font-bold font-mono text-slate-900">{adherenceRecords.length}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Fully Consumed</span>
                <span className="text-lg font-bold font-mono text-emerald-800">
                  {adherenceRecords.filter((a) => a.status === 'consumed_full').length}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Partially Consumed</span>
                <span className="text-lg font-bold font-mono text-amber-800">
                  {adherenceRecords.filter((a) => a.status === 'consumed_partial').length}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Skipped Meals</span>
                <span className="text-lg font-bold font-mono text-rose-800">
                  {adherenceRecords.filter((a) => a.status === 'skipped').length}
                </span>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {filteredAdherence.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No meal intake records found matching filter.
                </div>
              ) : (
                filteredAdherence.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-4 hover:bg-slate-50/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900">
                          {rec.patientName}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-600 font-medium">
                          {rec.dayOfWeek}, {rec.date}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-500 font-mono">
                          {rec.mealTimingLabel} ({rec.loggedAt})
                        </span>
                        
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            rec.status === 'consumed_full'
                              ? 'bg-emerald-100 text-emerald-900'
                              : rec.status === 'consumed_partial'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-rose-100 text-rose-900'
                          }`}
                        >
                          {rec.status === 'consumed_full'
                            ? 'Consumed 100%'
                            : rec.status === 'consumed_partial'
                            ? `Partially Eaten (${rec.portionPercentage}%)`
                            : 'Skipped'}
                        </span>
                      </div>

                      <div className="font-medium text-slate-800">
                        Meal: {rec.mealTitle}
                      </div>

                      {rec.status === 'skipped' && rec.skipReason && (
                        <div className="p-2 rounded-lg bg-rose-50 text-rose-950 font-medium text-[11px] border border-rose-200">
                          Skipped Reason: <strong>{rec.skipReason}</strong>
                        </div>
                      )}

                      {rec.notes && (
                        <p className="text-slate-500 text-[11px] italic">
                          Patient notes: &ldquo;{rec.notes}&rdquo;
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPatientId(rec.patientId);
                        onNavigateTab('diet');
                      }}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium text-xs self-start sm:self-auto cursor-pointer"
                    >
                      View Diet Chart
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 4: CONSULTATIONS & SCHEDULE */}
        {adminTab === 'consultations' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-200 p-5 shadow-2xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-sm text-slate-900">
                    Consultation & Follow-up Schedule
                  </h2>
                  <p className="text-xs text-slate-500">
                    Track first consultations (₹{FIRST_CONSULTATION_INR}) and follow-up sessions (₹{FOLLOW_UP_INR}); sessions included in a plan are ₹0
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-right">
                  <span className="text-[10px] text-emerald-950 uppercase font-semibold block">
                    Consultations Revenue
                  </span>
                  <span className="text-lg font-bold font-mono text-[#3E6553]">
                    ₹{totalConsultationRevenue}
                  </span>
                </div>
              </div>

              {/* Pricing Model Info Box */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                <div className="p-3 rounded-xl bg-[#FAFBF9] border border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">First Consultations</span>
                    <span className="font-mono font-bold text-emerald-800">₹500 / session</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Understand health condition, dietary habits, lifestyle, and nutritional requirements.
                  </p>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Logged: {firstConsultations.length} sessions
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#FAFBF9] border border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">Follow-up Consultations</span>
                    <span className="font-mono font-bold text-emerald-800">₹300 / session</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Monitor progress, evaluate adherence, and make necessary changes to the diet plan.
                  </p>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Logged: {followUpConsultations.length} sessions
                  </span>
                </div>
              </div>
            </div>

            {/* Appointments list */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs divide-y divide-slate-100 text-xs">
              {appointments.map((appt) => {
                const isFirst = appt.consultationTier === 'first_consultation';
                const fee = appt.consultationFeeInr ?? (isFirst ? FIRST_CONSULTATION_INR : FOLLOW_UP_INR);

                return (
                  <div
                    key={appt.id}
                    className="p-4 hover:bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">
                          {appt.patientName}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isFirst ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-950'
                        }`}>
                          {isFirst ? 'First Consultation' : 'Follow-up Session'} (₹{fee})
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-600">
                          {appt.consultationType === 'online_video' ? 'Video Telehealth' : 'In-Clinic'}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-500 font-mono">
                          {appt.date} ({appt.timeSlot})
                        </span>
                      </div>

                      <div className="text-slate-600">
                        Service: <strong>{appt.serviceCategory}</strong> · Phone: {appt.patientPhone}
                      </div>

                      {appt.patientNotes && (
                        <p className="text-slate-500 text-[11px] italic">
                          Agenda: &ldquo;{appt.patientNotes}&rdquo;
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                        appt.status === 'confirmed'
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-amber-100 text-amber-900'
                      }`}>
                        {appt.status}
                      </span>
                      <button
                        type="button"
                        onClick={() => onNavigateTab('appointments')}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium text-xs cursor-pointer"
                      >
                        Manage
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 5: REMINDERS & NOTIFICATIONS DISPATCHER */}
        {adminTab === 'reminders' && (
          <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-200 p-5 md:p-6 shadow-2xs space-y-4 text-xs">
            <div>
              <h2 className="font-bold text-sm text-slate-900">
                Patient Notifications & Reminders Dispatcher
              </h2>
              <p className="text-xs text-slate-500">
                Send appointment reminders, diet follow-up alerts, hydration prompts, and adherence check-ins
              </p>
            </div>

            {reminderSentNotice && (
              <div className="p-3 rounded-xl bg-emerald-100 text-emerald-950 font-medium flex items-center gap-2 border border-emerald-200">
                <CheckCircle className="w-4 h-4 text-emerald-700" />
                <span>{reminderSentNotice}</span>
              </div>
            )}

            <form onSubmit={handleSendReminder} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Patient</label>
                  <select
                    value={reminderPatientId}
                    onChange={(e) => setReminderPatientId(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="all">Broadcast to All Patients ({patients.length})</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.assignedProgram || 'Patient'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Notification Category</label>
                  <select
                    value={reminderCategory}
                    onChange={(e) => setReminderCategory(e.target.value as any)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="appointment">Appointment & Follow-up Reminder</option>
                    <option value="diet">Diet Chart Update & Meal Timing</option>
                    <option value="weight">Weight Log Check-in Prompt</option>
                    <option value="water">Hydration Target Reminder</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notification Title</label>
                <input
                  type="text"
                  value={reminderTitle}
                  onChange={(e) => setReminderTitle(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Message Content</label>
                <textarea
                  value={reminderMessage}
                  onChange={(e) => setReminderMessage(e.target.value)}
                  rows={3}
                  className="w-full p-2.5 rounded-lg border border-slate-300"
                  required
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#3E6553] hover:bg-[#325243] text-white font-medium text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Notification Now</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 6: DIET PLAN MODIFICATION HISTORY */}
        {adminTab === 'modification_history' && (
          <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-200 overflow-hidden shadow-2xs space-y-0">
            <div className="p-4 sm:p-5 border-b border-slate-100">
              <h2 className="font-bold text-sm text-slate-900">
                History of Diet Plan Modifications & Revisions
              </h2>
              <p className="text-xs text-slate-500">
                Audit trail of personalized adjustments made to patient diet charts
              </p>
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              {dietCharts.map((chart) => {
                const history = chart.modificationHistory || [];
                return (
                  <div key={chart.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900 text-sm">
                          {chart.title}
                        </span>
                        <p className="text-slate-500 text-[11px]">
                          Patient: <strong className="text-slate-700">{chart.patientName}</strong> · Current Version: <span className="font-mono font-bold text-emerald-800">v{chart.version}</span>
                        </p>
                      </div>
                      <span className="text-slate-400 text-[11px]">
                        Issued: {chart.dateIssued}
                      </span>
                    </div>

                    {history.length === 0 ? (
                      <p className="text-slate-400 italic text-[11px]">
                        Initial baseline diet chart created on {chart.dateIssued}.
                      </p>
                    ) : (
                      <div className="space-y-1.5 pl-2 border-l-2 border-emerald-300">
                        {history.map((rev) => (
                          <div key={rev.id} className="text-[11px]">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-800">
                                Version {rev.version}
                              </span>
                              <span className="text-slate-400">·</span>
                              <span className="text-slate-500">{rev.modifiedAt}</span>
                              <span className="text-slate-400">·</span>
                              <span className="text-emerald-800 font-medium">By {rev.modifiedBy}</span>
                            </div>
                            <p className="text-slate-600 mt-0.5">{rev.summaryOfChanges}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CLINICAL CONDITION ASSIGNMENT MODAL */}
        {assigningCondition && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200 text-xs">
              <div className="bg-[#3E6553] text-white px-5 py-4 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm">Assign Clinical Protocol</h3>
                  <p className="text-xs text-emerald-100">{assigningCondition.title}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAssigningCondition(null)}
                  className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Select Target Patient
                  </label>
                  <select
                    value={targetPatientId}
                    onChange={(e) => setTargetPatientId(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white"
                  >
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.medicalConditions?.join(', ') || 'No chronic condition logged'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3 rounded-xl bg-[#FAFBF9] border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-800 block">
                    Protocol Summary & Macros:
                  </span>
                  <div className="flex items-center gap-3 text-slate-600 font-mono">
                    <span>Carbs: {assigningCondition.recommendedMacros.carbs}%</span>
                    <span>Protein: {assigningCondition.recommendedMacros.protein}%</span>
                    <span>Fats: {assigningCondition.recommendedMacros.fats}%</span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    {assigningCondition.dietaryPrinciples[0]}
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setAssigningCondition(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteClinicalAssignment}
                    className="px-4 py-2 rounded-xl bg-[#3E6553] text-white font-medium flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Confirm Assignment</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  // If Patient: Render the Patient Health Profile & Customization Screen
  return (
    <div className="flex-1 pb-16 space-y-5 px-4 pt-4 md:px-8 md:pt-6 max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto w-full">
      
      {/* Profile Header Card */}
      <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-200 p-5 md:p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <ProfilePhoto
              name={currentUser.name}
              avatar={currentUser.avatar}
              onChange={(avatar) => {
                updatePatientProfile({ avatar });
                setProfileSavedNotice(avatar ? 'Your profile photo has been updated.' : 'Your profile photo has been removed.');
                setTimeout(() => setProfileSavedNotice(null), 4000);
              }}
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-serif font-bold text-slate-900">
                  {currentUser.name}
                </h1>
                <span className="text-[10px] bg-emerald-100 text-emerald-900 font-semibold px-2 py-0.5 rounded-full">
                  Patient
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {currentUser.assignedProgram || 'Clinical Nutrition Care'}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Enrolled since {currentUser.joinedDate} · Supervised by Dt. Anchal Dewan
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => (isEditingProfile ? finishEditing() : setIsEditingProfile(true))}
            className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-xs flex items-center gap-1.5 transition-colors self-start sm:self-auto cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>{isEditingProfile ? 'Cancel' : 'Edit profile'}</span>
          </button>
        </div>

        {/* Biometrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3.5 rounded-xl bg-[#F7F9F7] border border-emerald-900/5">
            <span className="text-[11px] text-slate-500 block">Current Weight</span>
            <span className="text-xl font-bold font-mono text-slate-900">
              {currentUser.currentWeightKg != null ? `${currentUser.currentWeightKg} kg` : '—'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#F7F9F7] border border-emerald-900/5">
            <span className="text-[11px] text-slate-500 block">Target Weight</span>
            <span className="text-xl font-bold font-mono text-emerald-800">
              {currentUser.targetWeightKg != null ? `${currentUser.targetWeightKg} kg` : '—'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#F7F9F7] border border-emerald-900/5">
            <span className="text-[11px] text-slate-500 block">Height</span>
            <span className="text-xl font-bold font-mono text-slate-900">
              {currentUser.heightCm != null ? `${currentUser.heightCm} cm` : '—'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#F7F9F7] border border-emerald-900/5">
            <span className="text-[11px] text-slate-500 block">Dietary Preference</span>
            <span className="text-base font-semibold text-slate-800">
              {currentUser.dietaryPreference || 'Vegetarian'}
            </span>
          </div>
        </div>
      </div>

      {profileSavedNotice && (
        <div role="status" className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-700" aria-hidden="true" />
          {profileSavedNotice}
        </div>
      )}

      {/* My profile: edit form, or personal / medical / goals cards */}
      {isEditingProfile ? (
        <EditProfileForm onDone={finishEditing} />
      ) : (
        /* View personal, medical & goals details */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-3 md:col-span-2">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">Personal Details</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {[
                { label: 'Email', value: currentUser.email },
                { label: 'Mobile', value: currentUser.phone },
                {
                  label: 'Date of Birth',
                  value: currentUser.dateOfBirth
                    ? `${new Date(currentUser.dateOfBirth + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} (${ageOn(currentUser.dateOfBirth)} yrs)`
                    : currentUser.age != null
                      ? `Age ${currentUser.age}`
                      : undefined,
                },
                { label: 'Gender', value: currentUser.gender },
              ].map((item) => (
                <div key={item.label} className="min-w-0">
                  <dt className="text-slate-400 text-[11px]">{item.label}</dt>
                  <dd className="text-slate-800 font-medium break-all">{item.value || <span className="text-slate-400 font-normal">Not added</span>}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">
              Medical Conditions & Allergies
            </h3>
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Reported Health Conditions:</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {currentUser.medicalConditions && currentUser.medicalConditions.length > 0 ? (
                    currentUser.medicalConditions.map((cond, i) => (
                      <span key={i} className="text-xs bg-emerald-50 text-emerald-950 px-2 py-0.5 rounded-md font-medium border border-emerald-100">
                        {cond}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-500">None reported</span>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <span className="text-slate-400 block text-[11px]">Allergies / Dislikes:</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {currentUser.allergies && currentUser.allergies.length > 0 ? (
                    currentUser.allergies.map((all, i) => (
                      <span key={i} className="text-xs bg-rose-50 text-rose-950 px-2 py-0.5 rounded-md font-medium border border-rose-100">
                        {all}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-500">No known allergies</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">
              Primary Nutrition Goals
            </h3>
            <div className="space-y-1.5 text-xs text-slate-600">
              {currentUser.healthGoals?.map((goal, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-700" />
                  <span>{goal}</span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Next Follow-up Consultation:</span>
              <span className="font-mono font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md">
                {currentUser.followUpDate || 'Oct 24, 2026'} (₹300 session)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Security & Confidentiality Card */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-3">
        <Lock className="w-5 h-5 text-emerald-800 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-bold text-slate-800">
            Confidential Healthcare Records
          </h4>
          <p className="text-[11px] leading-relaxed">
            Your diet plans, weight logs, and medical history are strictly isolated to your profile and authorized clinical personnel (Dt. Anchal Dewan). Records are never exposed to public indexes or shared without consent.
          </p>
        </div>
      </div>

    </div>
  );
};
