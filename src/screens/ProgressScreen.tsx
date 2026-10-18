import React, { useState } from 'react';
import {
  TrendingUp,
  Plus,
  Scale,
  Calendar,
  CheckCircle,
  Award,
  ChevronDown,
  ChevronUp,
  Download,
  Activity,
  Heart,
  Droplet,
  X,
} from 'lucide-react';
import { useNutrition } from '../context/NutritionContext';
import { WeightRecord } from '../types/nutrition';

export const ProgressScreen: React.FC = () => {
  const {
    currentUser,
    isDietitian,
    patients,
    selectedPatientId,
    setSelectedPatientId,
    getPatientWeightHistory,
    addWeightRecord,
  } = useNutrition();

  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  // Active patient for progress review
  const activePatient = isDietitian
    ? patients.find((p) => p.id === selectedPatientId) || patients[0]
    : currentUser;

  const history = getPatientWeightHistory(activePatient.id);

  // Form states
  const [newWeight, setNewWeight] = useState(
    activePatient.currentWeightKg?.toString() || '68.0'
  );
  const [newDate, setNewDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [newWaist, setNewWaist] = useState('78');
  const [newEnergy, setNewEnergy] = useState<number>(5);
  const [newNotes, setNewNotes] = useState('');

  // Calculations
  const currentWt = activePatient.currentWeightKg || 70;
  const startWt = activePatient.startingWeightKg || currentWt;
  const targetWt = activePatient.targetWeightKg || 60;
  const heightM = (activePatient.heightCm || 165) / 100;

  // BMI = weight(kg) / (height(m) * height(m))
  const bmi = (currentWt / (heightM * heightM)).toFixed(1);
  const getBmiCategory = (val: number) => {
    if (val < 18.5) return { label: 'Underweight', color: 'text-amber-600' };
    if (val < 25) return { label: 'Normal / Healthy', color: 'text-emerald-700' };
    if (val < 30) return { label: 'Overweight', color: 'text-amber-700' };
    return { label: 'Obese', color: 'text-rose-700' };
  };
  const bmiInfo = getBmiCategory(parseFloat(bmi));

  const weightDiff = (currentWt - startWt).toFixed(1);
  const totalToLose = Math.abs(startWt - targetWt);
  const lostSoFar = Math.abs(startWt - currentWt);
  const progressPercent = totalToLose > 0 ? Math.min(100, Math.round((lostSoFar / totalToLose) * 100)) : 100;

  const handleAddWeight = (e: React.FormEvent) => {
    e.preventDefault();
    const wt = parseFloat(newWeight);
    if (isNaN(wt) || wt <= 0) return;

    addWeightRecord({
      patientId: activePatient.id,
      date: newDate,
      weightKg: wt,
      waistCm: parseFloat(newWaist) || undefined,
      energyLevel: newEnergy as any,
      notes: newNotes.trim() || 'Weekly check-in logged via app',
    });

    setIsLogModalOpen(false);
    setNewNotes('');
  };

  // SVG Chart points calculation
  const chartHeight = 160;
  const chartWidth = 360;
  const padding = 24;

  const weights = history.map((h) => h.weightKg);
  const minWt = Math.min(...weights, targetWt) - 1;
  const maxWt = Math.max(...weights, startWt) + 1;

  const getCoordinates = (index: number, weight: number) => {
    const total = history.length;
    const x = total <= 1 ? chartWidth / 2 : padding + (index / (total - 1)) * (chartWidth - padding * 2);
    const y = chartHeight - padding - ((weight - minWt) / (maxWt - minWt || 1)) * (chartHeight - padding * 2);
    return { x, y };
  };

  const polylinePoints = history
    .map((item, idx) => {
      const { x, y } = getCoordinates(idx, item.weightKg);
      return `${x},${y}`;
    })
    .join(' ');

  const targetLineY = chartHeight - padding - ((targetWt - minWt) / (maxWt - minWt || 1)) * (chartHeight - padding * 2);

  return (
    <div className="flex-1 pb-16 space-y-5 px-4 pt-4 md:px-8 md:pt-6 max-w-5xl mx-auto w-full">
      
      {/* Dietitian Header Selector */}
      {isDietitian && (
        <div className="bg-emerald-950 text-white rounded-2xl p-4 border border-emerald-900 flex items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300 block">
              Patient Progress Analytics
            </span>
            <p className="text-xs text-emerald-100">
              Reviewing body weight metrics for {activePatient.name}
            </p>
          </div>
          <select
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            className="bg-emerald-900 text-white text-xs px-3 py-1.5 rounded-lg border border-emerald-700"
          >
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.currentWeightKg} kg)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Main KPI Stats Card */}
      <section className="bg-white rounded-2xl md:rounded-3xl border border-slate-200 p-5 md:p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h1 className="text-lg font-serif font-bold text-slate-900">
              Weight & Body Metrics Tracker
            </h1>
            <p className="text-xs text-slate-500">
              Tracking progress for {activePatient.name} · Height: {activePatient.heightCm} cm
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsLogModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-[#3E6553] hover:bg-[#325243] text-white font-medium text-xs flex items-center gap-1.5 shadow-xs transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Record New Weight</span>
          </button>
        </div>

        {/* 4 KPI Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-[#F7F9F7] border border-emerald-900/5">
            <span className="text-[11px] text-slate-500 block">Current Weight</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-bold font-mono text-slate-900">
                {currentWt}
              </span>
              <span className="text-xs text-slate-500">kg</span>
            </div>
            <span className="text-[10px] text-slate-400">Recorded this week</span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#F7F9F7] border border-emerald-900/5">
            <span className="text-[11px] text-slate-500 block">Starting Weight</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-bold font-mono text-slate-900">
                {startWt}
              </span>
              <span className="text-xs text-slate-500">kg</span>
            </div>
            <span className="text-[10px] text-slate-400">At program start</span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#F7F9F7] border border-emerald-900/5">
            <span className="text-[11px] text-slate-500 block">Net Progress</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className={`text-2xl font-bold font-mono ${parseFloat(weightDiff) <= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                {parseFloat(weightDiff) > 0 ? `+${weightDiff}` : weightDiff}
              </span>
              <span className="text-xs text-slate-500">kg</span>
            </div>
            <span className="text-[10px] text-emerald-800 font-medium">
              {progressPercent}% towards goal
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#F7F9F7] border border-emerald-900/5">
            <span className="text-[11px] text-slate-500 block">Current BMI</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-bold font-mono text-slate-900">
                {bmi}
              </span>
            </div>
            <span className={`text-[11px] font-semibold ${bmiInfo.color}`}>
              {bmiInfo.label}
            </span>
          </div>
        </div>

        {/* Progress Bar towards Target */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium">
              Journey to Target Weight ({targetWt} kg)
            </span>
            <span className="font-mono font-bold text-emerald-800">
              {progressPercent}% Achieved
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden p-0.5 border border-slate-200">
            <div
              className="bg-gradient-to-r from-[#3E6553] to-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </section>

      {/* Interactive Progress Graph Card */}
      <section className="bg-white rounded-2xl md:rounded-3xl border border-slate-200 p-5 md:p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Weight Trajectory Graph
            </h2>
            <p className="text-xs text-slate-500">
              Weekly weigh-ins mapped against target line ({targetWt} kg)
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full bg-[#3E6553]" />
              <span>Weight (kg)</span>
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-4 h-0.5 border-t border-dashed border-emerald-500" />
              <span>Goal Line</span>
            </span>
          </div>
        </div>

        {/* SVG Curve Container */}
        <div className="w-full overflow-x-auto py-2">
          <div className="min-w-[340px] max-w-2xl mx-auto">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-44 overflow-visible select-none"
            >
              {/* Background horizontal grid lines */}
              <line
                x1={padding}
                y1={padding}
                x2={chartWidth - padding}
                y2={padding}
                stroke="#E2E8F0"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <line
                x1={padding}
                y1={chartHeight / 2}
                x2={chartWidth - padding}
                y2={chartHeight / 2}
                stroke="#E2E8F0"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <line
                x1={padding}
                y1={chartHeight - padding}
                x2={chartWidth - padding}
                y2={chartHeight - padding}
                stroke="#E2E8F0"
                strokeWidth="1"
              />

              {/* Target Goal Dotted Line */}
              <line
                x1={padding}
                y1={targetLineY}
                x2={chartWidth - padding}
                y2={targetLineY}
                stroke="#10B981"
                strokeWidth="1.5"
                strokeDasharray="5 4"
              />
              <text
                x={chartWidth - padding}
                y={targetLineY - 4}
                textAnchor="end"
                className="fill-emerald-700 text-[10px] font-mono font-bold"
              >
                Goal: {targetWt} kg
              </text>

              {/* Progression Polyline */}
              {history.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#3E6553"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={polylinePoints}
                />
              )}

              {/* Plot Points & Data Labels */}
              {history.map((record, index) => {
                const { x, y } = getCoordinates(index, record.weightKg);
                return (
                  <g key={record.id} className="group cursor-pointer">
                    <circle
                      cx={x}
                      cy={y}
                      r="4.5"
                      className="fill-white stroke-[#3E6553] stroke-2 group-hover:r-6 transition-all"
                    />
                    <text
                      x={x}
                      y={y - 8}
                      textAnchor="middle"
                      className="fill-slate-800 text-[10px] font-mono font-bold"
                    >
                      {record.weightKg}
                    </text>
                    <text
                      x={x}
                      y={chartHeight - 4}
                      textAnchor="middle"
                      className="fill-slate-400 text-[9px] font-mono"
                    >
                      {record.date.slice(5)}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </section>

      {/* History Log Table */}
      <section className="bg-white rounded-2xl md:rounded-3xl border border-slate-200 overflow-hidden shadow-2xs space-y-0">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900">
              Weigh-in History & Notes
            </h3>
            <p className="text-xs text-slate-500">
              All chronological measurements recorded
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">
            {history.length} records
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {history.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No weight logs recorded yet. Tap &ldquo;Record New Weight&rdquo; above.
            </div>
          ) : (
            [...history].reverse().map((rec) => (
              <div key={rec.id} className="p-4 hover:bg-slate-50/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#3E6553] flex items-center justify-center font-bold text-xs font-mono shrink-0">
                    <Scale className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm font-mono">
                        {rec.weightKg} kg
                      </span>
                      {rec.waistCm && (
                        <span className="text-slate-500 text-[11px]">
                          · Waist: {rec.waistCm} cm
                        </span>
                      )}
                      {rec.energyLevel && (
                        <span className="text-amber-700 text-[11px]">
                          · Energy: {rec.energyLevel}/5
                        </span>
                      )}
                    </div>
                    {rec.notes && (
                      <p className="text-slate-600 text-[11px] mt-0.5 leading-snug">
                        {rec.notes}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right sm:self-center text-slate-400 text-[11px] font-mono">
                  {rec.date}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Record Weight Modal */}
      {isLogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-[#3E6553] text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Scale className="w-4 h-4" />
                <h3 className="font-bold text-sm">Record Fasting Weight</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsLogModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddWeight} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Weight (kg) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={newWeight}
                    onChange={(e) => setNewWeight(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 text-sm font-bold font-mono focus:ring-2 focus:ring-emerald-600/30"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Waist (cm, optional)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={newWaist}
                    onChange={(e) => setNewWaist(e.target.value)}
                    placeholder="e.g. 78"
                    className="w-full p-2.5 rounded-lg border border-slate-300"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Energy Level (1-5)
                  </label>
                  <select
                    value={newEnergy}
                    onChange={(e) => setNewEnergy(Number(e.target.value))}
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value={5}>⭐⭐⭐⭐⭐ High & Fresh</option>
                    <option value={4}>⭐⭐⭐⭐ Good</option>
                    <option value={3}>⭐⭐⭐ Moderate</option>
                    <option value={2}>⭐⭐ Low / Tired</option>
                    <option value={1}>⭐ Exhausted</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Health Notes or Reflections
                </label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. Completed 10k steps today, avoided late dinner, feeling less bloated."
                  className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-600/30"
                />
              </div>

              <p className="text-[11px] text-slate-500 italic">
                Best practice: Weigh yourself first thing in the morning after voiding, before breakfast.
              </p>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-[#3E6553] hover:bg-[#325243] text-white font-medium text-xs flex items-center justify-center gap-1.5 shadow-sm"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Save Weight Log</span>
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
