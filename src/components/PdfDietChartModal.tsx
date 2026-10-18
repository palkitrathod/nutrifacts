import React, { useRef } from 'react';
import { X, Printer, Download, FileText, CheckCircle2, AlertCircle, Shield, Award } from 'lucide-react';
import { DietChart, User } from '../types/nutrition';

interface PdfDietChartModalProps {
  chart: DietChart;
  patient: User;
  onClose: () => void;
}

export const PdfDietChartModal: React.FC<PdfDietChartModalProps> = ({ chart, patient, onClose }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadText = () => {
    // Generate clean text export
    let content = `NUTRIFACTS with dt.Anchal - CLINICAL DIET CHART\n`;
    content += `Dietitian: Dt. Anchal Dewan (M.Sc. Clinical Nutrition, CDE)\n`;
    content += `Tagline: Nourish Better. Live Healthier.\n`;
    content += `------------------------------------------------------\n`;
    content += `Patient: ${patient.name} | Age: ${patient.age || 'N/A'} | Height: ${patient.heightCm}cm\n`;
    content += `Current Weight: ${patient.currentWeightKg}kg | Target: ${patient.targetWeightKg}kg\n`;
    content += `Program: ${patient.assignedProgram || 'Clinical Nutrition'}\n`;
    content += `Issued: ${chart.dateIssued} | Next Follow-up: ${chart.followUpDate}\n`;
    content += `Daily Calorie Target: ${chart.dailyCalorieTarget} kcal\n`;
    content += `------------------------------------------------------\n\n`;
    content += `MEAL SCHEDULE & TIMINGS:\n`;

    chart.meals.forEach((m) => {
      content += `\n[${m.timeSlot}] - ${m.timingLabel.toUpperCase()}\n`;
      content += `Menu: ${m.title}\n`;
      m.options.forEach((opt) => {
        content += `  • ${opt}\n`;
      });
      if (m.healthySwap) content += `  Swap: ${m.healthySwap}\n`;
    });

    content += `\n------------------------------------------------------\n`;
    content += `HYDRATION: ${chart.hydrationGuidelines}\n\n`;
    content += `DO'S:\n`;
    chart.dos.forEach((d) => (content += `  ✓ ${d}\n`));
    content += `\nDONT'S:\n`;
    chart.donts.forEach((d) => (content += `  ✗ ${d}\n`));
    content += `\nDIETITIAN NOTE:\n${chart.dietitianNotes}\n`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Nutrifacts_DietChart_${patient.name.replace(/\s+/g, '_')}_v${chart.version}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-4xl max-h-[94vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">

        {/* Modal Header Bar (Hidden during Print) */}
        <div className="no-print bg-[#3E6553] text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Official Clinical Diet Chart (PDF Preview)</h3>
              <p className="text-xs text-emerald-100 font-light">
                {patient.name} · Version {chart.version} · Confidential Patient Record
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="py-1.5 px-3 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
              title="Print or Save as PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print / Save PDF</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadText}
              className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
              title="Download Diet Chart file"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download Chart</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center text-white/90 hover:text-white ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Official Clinical Letterhead Document */}
        <div ref={chartRef} className="flex-1 overflow-y-auto p-6 sm:p-10 bg-white text-slate-800 space-y-6 print:p-0 print:space-y-4">

          {/* Clinic Official Header */}
          <div className="border-b-2 border-[#3E6553] pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">🥗</span>
                <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-[#3E6553]">
                  Nutrifacts
                </h1>
                <span className="text-sm font-sans font-medium text-slate-500">with dt.Anchal</span>
              </div>
              <p className="text-xs font-semibold text-slate-600 tracking-wider uppercase mt-1">
                Clinical Nutrition & Personalized Diet Care Clinic
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Reg No. MED-NUTRI/2018/8841 · ISO 9001:2015 Certified Diet Practice
              </p>
            </div>

            <div className="sm:text-right text-xs text-slate-600 space-y-0.5">
              <p className="font-semibold text-slate-900">Dt. Anchal Dewan</p>
              <p>M.Sc. Clinical Nutrition &amp; Dietetics</p>
              <p className="text-[11px] text-emerald-800 font-medium">4+ Years Clinical Nutrition Experience</p>

              <p>Email: anchaldewan380@gmail.com</p>
            </div>
          </div>

          {/* Patient Details & Confidentiality Strip */}
          <div className="bg-[#F6F9F7] rounded-xl p-4 border border-emerald-900/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-500 block text-[11px]">Patient Name</span>
              <span className="font-semibold text-slate-900">{patient.name}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Age / Gender</span>
              <span className="font-semibold text-slate-900">
                {patient.age || '28'} Yrs · {patient.gender || 'Female'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Height / Weight</span>
              <span className="font-semibold text-slate-900">
                {patient.heightCm} cm · {patient.currentWeightKg} kg
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Target Weight</span>
              <span className="font-semibold text-emerald-800">
                {patient.targetWeightKg} kg (Goal)
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Issue Date</span>
              <span className="font-medium text-slate-900">{chart.dateIssued}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Next Follow-up</span>
              <span className="font-semibold text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded-sm">
                {chart.followUpDate}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Dietary Preference</span>
              <span className="font-medium text-slate-900">{patient.dietaryPreference || 'Vegetarian'}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Daily Calorie Target</span>
              <span className="font-bold text-[#3E6553]">{chart.dailyCalorieTarget} kcal/day</span>
            </div>
          </div>

          {/* Plan Focus & Macro Breakdown */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">
                Plan Focus: {chart.focusArea}
              </h2>
              <span className="text-xs font-mono text-slate-500">
                Carbs {chart.macroDistribution.carbs}% · Protein {chart.macroDistribution.protein}% · Fats {chart.macroDistribution.fats}%
              </span>
            </div>
            <p className="text-xs text-slate-600 italic">
              &ldquo;{chart.dietitianNotes}&rdquo; — Dt. Anchal
            </p>
          </div>

          {/* Uploaded PDF Notice if applicable */}
          {chart.pdfFileName && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-900">
                <FileText className="w-4 h-4 text-emerald-700" />
                <span>
                  Attached External Diet Chart PDF: <strong>{chart.pdfFileName}</strong>
                </span>
              </div>
              {chart.pdfCustomUrl && (
                <a
                  href={chart.pdfCustomUrl}
                  download={chart.pdfFileName}
                  className="px-2.5 py-1 bg-emerald-700 text-white rounded-md text-xs font-medium hover:bg-emerald-800"
                >
                  Download Original
                </a>
              )}
            </div>
          )}

          {/* Meal Schedule Table */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#3E6553] border-b border-emerald-800/20 pb-1">
              Personalized Daily Meal Timings & Menu
            </h3>

            <div className="space-y-3">
              {chart.meals.map((meal, idx) => (
                <div
                  key={meal.id || idx}
                  className="p-3.5 rounded-xl border border-slate-100 bg-[#FAFBF9] hover:border-emerald-200 transition-colors"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#3E6553] text-white text-[10px] font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-900">{meal.timingLabel}</span>
                      <span className="text-[11px] text-slate-500 font-medium">({meal.timeSlot})</span>
                    </div>
                    {meal.caloriesApprox && (
                      <span className="text-[11px] text-emerald-800 font-mono font-medium">
                        ~{meal.caloriesApprox} kcal
                      </span>
                    )}
                  </div>

                  <div className="mt-2 text-xs space-y-1">
                    <p className="font-semibold text-slate-800">{meal.title}</p>
                    <ul className="list-disc list-inside text-slate-600 pl-1 space-y-0.5">
                      {meal.options.map((opt, optIdx) => (
                        <li key={optIdx}>{opt}</li>
                      ))}
                    </ul>
                    {meal.healthySwap && (
                      <p className="text-[11px] text-amber-800 bg-amber-50/70 p-1.5 rounded-md mt-1">
                        <strong>Healthy Swap:</strong> {meal.healthySwap}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Do's and Don'ts Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
            <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-100 space-y-2">
              <div className="flex items-center gap-1.5 text-emerald-900 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Dietary Do&apos;s</span>
              </div>
              <ul className="space-y-1.5 text-emerald-950">
                {chart.dos.map((item, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-emerald-700 font-bold">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-rose-50/60 border border-rose-100 space-y-2">
              <div className="flex items-center gap-1.5 text-rose-900 font-bold">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>Dietary Don&apos;ts</span>
              </div>
              <ul className="space-y-1.5 text-rose-950">
                {chart.donts.map((item, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-rose-700 font-bold">✗</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Hydration & Guidelines */}
          <div className="bg-sky-50/60 border border-sky-100 rounded-xl p-3.5 text-xs text-sky-950 space-y-1">
            <span className="font-bold text-sky-900 block">Hydration & Lifestyle Advisory</span>
            <p className="text-slate-700">{chart.hydrationGuidelines}</p>
          </div>

          {/* Footer Signature & Disclaimer */}
          <div className="border-t border-slate-200 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <div className="text-[11px] text-slate-500 max-w-md">
              <p className="font-medium text-slate-700">Notice of Confidentiality & Health Safety:</p>
              <p>
                This diet chart is customized exclusively for {patient.name} based on clinical health parameters. Do not forward or replicate for other individuals.
              </p>
            </div>

            <div className="text-center sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0">
              {/* Digital Signature representation */}
              <div className="font-serif italic text-lg text-[#3E6553] font-bold tracking-wider">
                Anchal Dewan
              </div>
              <p className="font-semibold text-slate-800 text-[11px]">Dt. Anchal Dewan</p>
              <p className="text-[10px] text-slate-500">Clinical Nutritionist & Founder</p>
              <div className="inline-flex items-center gap-1 text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-sm mt-1">
                <Award className="w-3 h-3 text-emerald-700" />
                <span>Verified Clinical Protocol</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
