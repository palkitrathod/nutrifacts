import React, { useState } from 'react';
import {
  FileText,
  Download,
  Printer,
  Upload,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Droplet,
  ChevronRight,
  Shield,
  Edit3,
  Save,
  Plus,
  Trash2,
  Sparkles,
  ExternalLink,
  Check,
  X,
  PieChart,
  HelpCircle,
  Flame,
  Award,
  History,
} from 'lucide-react';
import { useNutrition } from '../context/NutritionContext';
import { DietChart, MealItem, MealTiming, DayOfWeek, MealAdherenceStatus } from '../types/nutrition';

interface DietChartScreenProps {
  onOpenPdfModal: () => void;
}

const DAYS_OF_WEEK: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export const DietChartScreen: React.FC<DietChartScreenProps> = ({ onOpenPdfModal }) => {
  const {
    currentUser,
    isDietitian,
    patients,
    selectedPatientId,
    setSelectedPatientId,
    getCurrentUserDietChart,
    getPatientDietChart,
    saveDietChart,
    uploadCustomPdfChart,
    logMealAdherence,
    getPatientAdherenceHistory,
    getAdherenceStats,
  } = useNutrition();

  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Monday');
  const [isEditing, setIsEditing] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  // Meal adherence logging modal state
  const [loggingMeal, setLoggingMeal] = useState<MealItem | null>(null);
  const [intakeStatus, setIntakeStatus] = useState<MealAdherenceStatus>('consumed_full');
  const [portionPercent, setPortionPercent] = useState<number>(100);
  const [skipReason, setSkipReason] = useState('Busy with work meetings');
  const [intakeNotes, setIntakeNotes] = useState('');

  // Modification history modal state
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Determine active patient and chart
  const activePatient = isDietitian
    ? patients.find((p) => p.id === selectedPatientId) || patients[0]
    : currentUser;

  const currentChart = isDietitian
    ? getPatientDietChart(selectedPatientId)
    : getCurrentUserDietChart();

  const adherenceHistory = getPatientAdherenceHistory(activePatient?.id || '');
  const adherenceStats = getAdherenceStats(activePatient?.id || '');

  // Editable form state for Dietitian
  const [editedTitle, setEditedTitle] = useState(currentChart?.title || '');
  const [editedCalories, setEditedCalories] = useState(currentChart?.dailyCalorieTarget || 1500);
  const [editedFollowUp, setEditedFollowUp] = useState(currentChart?.followUpDate || '2026-10-24');
  const [editedNotes, setEditedNotes] = useState(currentChart?.dietitianNotes || '');

  // Get meals for current selected day (fallback to currentChart.meals)
  const dayMeals: MealItem[] =
    currentChart?.weeklyPlan?.[selectedDay] || currentChart?.meals || [];

  // Handle PDF upload from Dietitian's computer
  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      alert('Please select a valid PDF file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      uploadCustomPdfChart(activePatient.id, file.name, dataUrl);
      setUploadNotice(`Successfully attached PDF "${file.name}" to ${activePatient.name}'s account.`);
      setTimeout(() => setUploadNotice(null), 4000);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveEdits = () => {
    if (!currentChart) return;
    const today = new Date().toISOString().split('T')[0];
    const newVersion = (parseFloat(currentChart.version) + 0.1).toFixed(1);

    const updated: DietChart = {
      ...currentChart,
      title: editedTitle,
      dailyCalorieTarget: Number(editedCalories),
      followUpDate: editedFollowUp,
      dietitianNotes: editedNotes,
      version: newVersion,
      modificationHistory: [
        {
          id: `mod-${Date.now()}`,
          version: newVersion,
          modifiedAt: today,
          modifiedBy: 'Dt. Anchal Dewan',
          summaryOfChanges: `Updated daily calorie target to ${editedCalories} kcal and notes.`,
        },
        ...(currentChart.modificationHistory || []),
      ],
    };
    saveDietChart(updated);
    setIsEditing(false);
  };

  const handleOpenIntakeLogger = (meal: MealItem) => {
    setLoggingMeal(meal);
    setIntakeStatus('consumed_full');
    setPortionPercent(100);
    setSkipReason('Busy with work meetings');
    setIntakeNotes('');
  };

  const handleSaveIntakeLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loggingMeal) return;

    logMealAdherence({
      patientId: activePatient.id,
      patientName: activePatient.name,
      date: new Date().toISOString().split('T')[0],
      dayOfWeek: selectedDay,
      mealId: loggingMeal.id,
      mealTiming: loggingMeal.timing,
      mealTimingLabel: loggingMeal.timingLabel,
      mealTitle: loggingMeal.title,
      status: intakeStatus,
      portionPercentage: intakeStatus === 'skipped' ? 0 : portionPercent,
      skipReason: intakeStatus === 'skipped' ? skipReason : undefined,
      notes: intakeNotes.trim() || undefined,
    });

    setLoggingMeal(null);
  };

  return (
    <div className="flex-1 pb-16 space-y-5 px-4 pt-4 md:px-8 md:pt-6 max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto w-full">
      
      {/* Dietitian Admin Patient Selector & Action Bar */}
      {isDietitian && (
        <div className="bg-emerald-950 text-white rounded-2xl p-4 shadow-sm border border-emerald-900 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-emerald-300 text-xs font-semibold uppercase tracking-wider">
                <Shield className="w-3.5 h-3.5" />
                <span>Clinical Weekly Diet Chart Manager</span>
              </div>
              <p className="text-xs text-emerald-100 font-light mt-0.5">
                Manage 7-day meal plans, upload external PDFs, and audit patient food intake adherence
              </p>
            </div>

            {/* Patient dropdown */}
            <div className="flex items-center gap-2 min-w-0 w-full lg:w-auto">
              <span className="text-xs text-emerald-200 shrink-0">Patient:</span>
              <select
                value={selectedPatientId}
                onChange={(e) => {
                  setSelectedPatientId(e.target.value);
                  setIsEditing(false);
                }}
                className="min-w-0 flex-1 lg:flex-none lg:max-w-xs truncate bg-emerald-900 text-white text-xs px-3 py-1.5 rounded-lg border border-emerald-700 focus:outline-hidden"
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.assignedProgram || 'Nutrition'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick PDF Uploader Button for Dietitian */}
          <div className="pt-2 border-t border-emerald-900/60 flex flex-wrap items-center justify-between gap-3 text-xs">
            <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white font-medium transition-colors">
              <Upload className="w-3.5 h-3.5" />
              <span>Upload PDF Diet Chart</span>
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handlePdfUpload}
              />
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowHistoryModal(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-emerald-100 font-medium transition-colors"
              >
                <History className="w-3.5 h-3.5" />
                <span>Modification History</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (currentChart) {
                    setEditedTitle(currentChart.title);
                    setEditedCalories(currentChart.dailyCalorieTarget);
                    setEditedFollowUp(currentChart.followUpDate);
                    setEditedNotes(currentChart.dietitianNotes);
                    setIsEditing(!isEditing);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-emerald-100 font-medium transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isEditing ? 'Cancel Edit' : 'Edit Plan Details'}</span>
              </button>
            </div>
          </div>

          {uploadNotice && (
            <div className="p-2.5 rounded-lg bg-emerald-800/80 text-emerald-100 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              <span>{uploadNotice}</span>
            </div>
          )}
        </div>
      )}

      {/* Main Diet Chart Header Banner */}
      {currentChart ? (
        <>
          <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-200 p-5 md:p-6 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-[#3E6553] uppercase tracking-wider">
                    {activePatient.assignedProgram || 'Clinical 7-Day Protocol'}
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="text-xs text-slate-500 font-mono">v{currentChart.version}</span>
                </div>

                {isEditing ? (
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="text-lg font-serif font-bold text-slate-900 border border-slate-300 rounded-lg p-2 w-full max-w-xl"
                  />
                ) : (
                  <h1 className="text-lg sm:text-xl font-serif font-bold text-slate-900">
                    {currentChart.title}
                  </h1>
                )}

                <p className="text-xs text-slate-500">
                  Prescribed for <strong className="text-slate-800">{activePatient.name}</strong> · Issued on {currentChart.dateIssued}
                </p>
              </div>

              {/* Action Buttons: PDF Preview & Download */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onOpenPdfModal}
                  className="px-3.5 py-2 rounded-xl bg-[#3E6553] hover:bg-[#325243] text-white font-medium text-xs flex items-center gap-1.5 shadow-xs transition-all"
                  title="View formatted PDF"
                >
                  <FileText className="w-4 h-4" />
                  <span>View & Download PDF</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenPdfModal}
                  className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-xs flex items-center gap-1.5 transition-colors"
                  title="Print Diet Plan"
                >
                  <Printer className="w-4 h-4 text-slate-500" />
                  <span className="hidden sm:inline">Print</span>
                </button>
              </div>
            </div>

            {/* Target Metrics Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-[#F7F9F7] border border-emerald-900/5">
                <span className="text-[11px] text-slate-500 block">Daily Target</span>
                {isEditing ? (
                  <input
                    type="number"
                    value={editedCalories}
                    onChange={(e) => setEditedCalories(Number(e.target.value))}
                    className="w-24 text-xs font-bold p-1 border rounded-md"
                  />
                ) : (
                  <span className="text-base font-bold text-[#3E6553] font-mono">
                    {currentChart.dailyCalorieTarget} <span className="text-xs font-normal">kcal</span>
                  </span>
                )}
              </div>

              <div className="p-3 rounded-xl bg-[#F7F9F7] border border-emerald-900/5">
                <span className="text-[11px] text-slate-500 block">Macro Balance</span>
                <span className="text-xs font-mono font-medium text-slate-800">
                  {currentChart.macroDistribution.carbs}C / {currentChart.macroDistribution.protein}P / {currentChart.macroDistribution.fats}F
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[#F7F9F7] border border-emerald-900/5">
                <span className="text-[11px] text-slate-500 block">Weekly Adherence</span>
                <span className="text-base font-bold font-mono text-emerald-800">
                  {adherenceStats.adherencePercentage}%
                </span>
                <span className="text-[10px] text-slate-400 block">
                  {adherenceStats.followed} followed · {adherenceStats.skipped} skipped
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[#F7F9F7] border border-emerald-900/5">
                <span className="text-[11px] text-slate-500 block">Next Follow-up</span>
                {isEditing ? (
                  <input
                    type="date"
                    value={editedFollowUp}
                    onChange={(e) => setEditedFollowUp(e.target.value)}
                    className="w-32 text-xs font-medium p-1 border rounded-md"
                  />
                ) : (
                  <span className="text-xs font-bold text-amber-900 font-mono">
                    {currentChart.followUpDate}
                  </span>
                )}
              </div>
            </div>

            {/* Dietitian Clinical Note */}
            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-950">
              <span className="font-bold text-amber-900 block mb-0.5">Note from Dt. Anchal Dewan:</span>
              {isEditing ? (
                <textarea
                  value={editedNotes}
                  onChange={(e) => setEditedNotes(e.target.value)}
                  rows={2}
                  className="w-full text-xs p-2 border border-amber-300 rounded-md bg-white text-slate-800"
                />
              ) : (
                <p className="italic leading-relaxed">
                  &ldquo;{currentChart.dietitianNotes}&rdquo;
                </p>
              )}
            </div>

            {/* Save Edits button for Dietitian */}
            {isEditing && (
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdits}
                  className="px-4 py-2 rounded-lg bg-[#3E6553] text-white text-xs font-medium flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Plan Updates</span>
                </button>
              </div>
            )}
          </div>

          {/* 7-DAY WEEKLY SCHEDULE SELECTOR */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  7-Day Personalized Meal Timings & Portion Guidance
                </h2>
                <p className="text-xs text-slate-500">
                  Select a day to review prescribed slots and record your daily food intake adherence
                </p>
              </div>
            </div>

            {/* Day Selector Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {DAYS_OF_WEEK.map((day) => {
                const isSelected = selectedDay === day;
                const loggedCount = adherenceHistory.filter((a) => a.dayOfWeek === day).length;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={`py-2 px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-[#3E6553] text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:border-emerald-300'
                    }`}
                  >
                    <span>{day}</span>
                    {loggedCount > 0 && (
                      <span className={`w-4 h-4 rounded-full text-[10px] font-mono flex items-center justify-center font-bold ${
                        isSelected ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-900'
                      }`}>
                        {loggedCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Daily Meal Slots List */}
            <div className="space-y-3 pt-1">
              {dayMeals.map((meal, index) => {
                const logForMeal = adherenceHistory.find(
                  (a) => a.mealId === meal.id && a.dayOfWeek === selectedDay
                );

                return (
                  <div
                    key={meal.id}
                    className={`p-4 rounded-2xl border transition-all bg-white ${
                      logForMeal
                        ? logForMeal.status === 'skipped'
                          ? 'border-rose-200 bg-rose-50/20'
                          : 'border-emerald-300 bg-emerald-50/20'
                        : 'border-slate-200 hover:border-emerald-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-[#3E6553]">
                            {meal.timingLabel}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="text-xs font-mono text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{meal.timeSlot}</span>
                          </span>

                          {/* Adherence badge if logged */}
                          {logForMeal && (
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                logForMeal.status === 'consumed_full'
                                  ? 'bg-emerald-100 text-emerald-900'
                                  : logForMeal.status === 'consumed_partial'
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-rose-100 text-rose-900'
                              }`}
                            >
                              {logForMeal.status === 'consumed_full'
                                ? 'Followed (100%)'
                                : logForMeal.status === 'consumed_partial'
                                ? `Partially Eaten (${logForMeal.portionPercentage}%)`
                                : 'Skipped Meal'}
                            </span>
                          )}
                        </div>

                        <h3 className="text-sm font-semibold text-slate-900">
                          {meal.title}
                        </h3>

                        {meal.description && (
                          <p className="text-xs text-slate-500 leading-relaxed">
                            {meal.description}
                          </p>
                        )}
                      </div>

                      {/* Calorie & Portion Info */}
                      <div className="flex items-center gap-2 shrink-0">
                        {meal.caloriesApprox && (
                          <span className="text-xs font-mono text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md">
                            ~{meal.caloriesApprox} kcal
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenIntakeLogger(meal)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#3E6553] font-medium text-xs flex items-center gap-1 transition-colors border border-emerald-200"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{logForMeal ? 'Update Log' : 'Record Intake'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Prescribed Options & Portion Guidance */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Prescribed Options:
                        </span>
                        <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                          {meal.options.map((opt, optIdx) => (
                            <li key={optIdx}>{opt}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="space-y-1.5">
                        <div className="p-2 rounded-lg bg-[#FAFBF9] border border-slate-200/80 text-[11px]">
                          <strong className="text-slate-800 block">Portion Guidance:</strong>
                          <span className="text-slate-600">
                            {meal.portionGuidance || '1 standard katori (150ml) / 2 small rotis (6-inch) / 1 glass (250ml)'}
                          </span>
                        </div>

                        {meal.healthySwap && (
                          <div className="p-2 rounded-lg bg-amber-50/80 border border-amber-200/60 text-[11px] text-amber-900">
                            <strong>Healthy Swap:</strong> {meal.healthySwap}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Logged Adherence Details Note if present */}
                    {logForMeal && (
                      <div className="mt-2.5 p-2 rounded-lg bg-slate-50 text-[11px] text-slate-600 flex items-center justify-between border border-slate-100">
                        <div>
                          {logForMeal.status === 'skipped' ? (
                            <span className="text-rose-800">
                              <strong>Skipped:</strong> {logForMeal.skipReason || 'Reason not provided'}
                            </span>
                          ) : (
                            <span>
                              <strong>Intake logged:</strong> {logForMeal.portionPercentage}% consumed
                              {logForMeal.notes ? ` · Note: "${logForMeal.notes}"` : ''}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {logForMeal.loggedAt}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Guidelines, Do's & Don'ts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-2.5">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Clinical Dietary Do&apos;s</span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-600">
                {currentChart.dos.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-emerald-700 font-bold shrink-0">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-2.5">
              <div className="flex items-center gap-2 text-rose-900 font-bold text-xs uppercase tracking-wider">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>Dietary Don&apos;ts</span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-600">
                {currentChart.donts.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-rose-700 font-bold shrink-0">✗</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-3xl p-10 text-center space-y-3 border border-slate-200">
          <FileText className="w-12 h-12 text-slate-300 mx-auto" />
          <h2 className="text-base font-bold text-slate-800">No Diet Chart Available</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {isDietitian
              ? 'Upload a PDF chart or create a new meal plan for this patient.'
              : 'Your dietitian Dt. Anchal is preparing your personalized diet chart. It will appear here once ready.'}
          </p>
        </div>
      )}

      {/* Record Food Intake & Adherence Modal */}
      {loggingMeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col p-5 space-y-4 text-xs animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                  {selectedDay} · {loggingMeal.timingLabel}
                </span>
                <h3 className="font-bold text-sm text-slate-900">{loggingMeal.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setLoggingMeal(null)}
                className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveIntakeLog} className="space-y-3.5">
              {/* Adherence Status Selector */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Did you follow this prescribed meal?
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIntakeStatus('consumed_full');
                      setPortionPercent(100);
                    }}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      intakeStatus === 'consumed_full'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold ring-2 ring-emerald-600/20'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    ✓ 100% Full
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIntakeStatus('consumed_partial');
                      setPortionPercent(75);
                    }}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      intakeStatus === 'consumed_partial'
                        ? 'border-amber-600 bg-amber-50 text-amber-950 font-bold ring-2 ring-amber-600/20'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    ~ Partial
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIntakeStatus('skipped');
                      setPortionPercent(0);
                    }}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      intakeStatus === 'skipped'
                        ? 'border-rose-600 bg-rose-50 text-rose-950 font-bold ring-2 ring-rose-600/20'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    ✗ Skipped
                  </button>
                </div>
              </div>

              {/* Portion slider if partial */}
              {intakeStatus === 'consumed_partial' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Portion Consumed: <strong className="font-mono text-amber-800">{portionPercent}%</strong>
                  </label>
                  <div className="flex gap-2">
                    {[25, 50, 75].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setPortionPercent(pct)}
                        className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold ${
                          portionPercent === pct
                            ? 'bg-amber-100 border-amber-600 text-amber-900'
                            : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Reason if skipped */}
              {intakeStatus === 'skipped' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Reason for Skipping Meal
                  </label>
                  <select
                    value={skipReason}
                    onChange={(e) => setSkipReason(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-slate-800"
                  >
                    <option value="Busy with work meetings">Busy with work meetings / deadlines</option>
                    <option value="Was not feeling hungry">Not feeling hungry / Full from prior meal</option>
                    <option value="Ate outside / Social dining">Ate outside / Social function</option>
                    <option value="Ingredients not available">Ingredients not available at home</option>
                    <option value="Acid reflux or nausea">Acid reflux / Digestive fullness</option>
                    <option value="Traveling or commuting">Traveling / Commuting</option>
                  </select>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Food Intake Notes / How Did You Feel? (Optional)
                </label>
                <textarea
                  value={intakeNotes}
                  onChange={(e) => setIntakeNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. Swapped roti with brown rice; digestion felt light."
                  className="w-full p-2.5 rounded-lg border border-slate-300 bg-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setLoggingMeal(null)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#3E6553] text-white rounded-xl font-medium shadow-xs flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Food Record</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Plan Modification History Modal */}
      {showHistoryModal && currentChart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col p-5 space-y-4 text-xs animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#3E6553]" />
                <h3 className="font-bold text-sm text-slate-900">Diet Plan Modification History</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto space-y-2">
              {currentChart.modificationHistory && currentChart.modificationHistory.length > 0 ? (
                currentChart.modificationHistory.map((mod) => (
                  <div key={mod.id} className="pt-2 pb-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">Version {mod.version}</span>
                      <span className="font-mono text-slate-400 text-[10px]">{mod.modifiedAt}</span>
                    </div>
                    <p className="text-slate-600">{mod.summaryOfChanges}</p>
                    <span className="text-[10px] text-emerald-800 font-medium">By {mod.modifiedBy}</span>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-slate-400">
                  No modification records recorded yet.
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-1.5 bg-slate-800 text-white rounded-lg font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
