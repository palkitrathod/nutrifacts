import React, { useState } from 'react';
import {
  CreditCard,
  Check,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  FileText,
  Clock,
  Plus,
  Edit2,
  Trash2,
  RotateCcw,
  CheckCircle2,
  X,
  TrendingUp,
  DollarSign,
  Calendar,
  CalendarPlus,
  Gift,
  Wallet,
} from 'lucide-react';
import { useNutrition } from '../context/NutritionContext';
import { NutritionPackage, PackagePayment } from '../types/nutrition';
import { addDays, canRenewEarly, daysLeft, EARLY_RENEWAL_WINDOW_DAYS, isPlanActive, planChange, RENEWAL_BONUS_DAYS, todayIso, upgradeQuote } from '../shared/plans';
import { netAmount, REFUND_PROMISE_DAYS, suggestedRefund } from '../shared/pricing';
import { PlanCard, WinWinStrip, planFamilies, sortPlans } from '../components/PlanCard';

interface PackagesScreenProps {
  onSelectPackageToBuy: (pkg: NutritionPackage, options?: { upgrade?: boolean; renew?: boolean }) => void;
  onViewReceipt: (payment: PackagePayment) => void;
}

export const PackagesScreen: React.FC<PackagesScreenProps> = ({
  onSelectPackageToBuy,
  onViewReceipt,
}) => {
  const {
    currentUser,
    isDietitian,
    packages,
    payments,
    appointments,
    updatePackage,
    addPackage,
    togglePackageActive,
    refundPayment,
    getPatientPayments,
    getActivePackage,
    schedulePlanChange,
    cancelScheduledPlanChange,
  } = useNutrition();

  // Patient: a downgrade / switch waiting for confirmation.
  const [confirmingChange, setConfirmingChange] = useState<NutritionPackage | null>(null);

  const [activeTab, setActiveTab] = useState<'packages' | 'history' | 'admin'>('packages');

  // Edit package state for Dietitian
  const [editingPkg, setEditingPkg] = useState<NutritionPackage | null>(null);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editTitle, setEditTitle] = useState('');
  const [editTagline, setEditTagline] = useState('');

  // Add new package state
  const [isAddingPkg, setIsAddingPkg] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPrice, setNewPrice] = useState(1499);
  const [newDuration, setNewDuration] = useState('30-Day Program');
  const [newTagline, setNewTagline] = useState('');
  const [newInclusions, setNewInclusions] = useState('');

  // Refund prompt state
  const [refundingPaymentId, setRefundingPaymentId] = useState<string | null>(null);
  const [refundReason, setRefundReason] = useState('Requested by patient within 7 days');

  const activePlan = getActivePackage(currentUser.id); // latest purchase (may have ended)
  const today = todayIso();
  const planRunning = isPlanActive(activePlan, today);
  const scheduled = currentUser.scheduledPlanChange;
  // The Starter Consultation counts in full (not just its unused days) towards a bigger plan.
  const currentCreditInFull = planRunning && packages.find((p) => p.id === activePlan.packageId)?.creditInFull === true;
  const visiblePlans = sortPlans(packages.filter((p) => p.isActive || isDietitian));
  // Plans offered in several lengths show one card with a 1 / 3 / 6-month choice. It starts on the
  // patient's current length, otherwise on 3 months (the better deal for most people).
  const [lengthChoice, setLengthChoice] = useState<Record<string, string>>({});
  const chosenLength = (family: NutritionPackage[]) =>
    family.find((p) => p.id === lengthChoice[family[0].id]) ??
    family.find((p) => !isDietitian && planRunning && p.id === activePlan.packageId) ??
    family.find((p) => p.bundleOf?.months === 3) ??
    family[0];
  const myPayments = getPatientPayments(currentUser.id);

  // Revenue calculation for Dietitian
  const totalRevenue = payments
    .filter((p) => p.status === 'successful')
    .reduce((sum, p) => sum + p.amountInr, 0);

  const handleStartEdit = (pkg: NutritionPackage) => {
    setEditingPkg(pkg);
    setEditPrice(pkg.priceInr);
    setEditTitle(pkg.title);
    setEditTagline(pkg.tagline);
  };

  const handleSaveEdit = () => {
    if (!editingPkg) return;
    updatePackage({
      ...editingPkg,
      title: editTitle,
      priceInr: Number(editPrice),
      tagline: editTagline,
    });
    setEditingPkg(null);
  };

  const handleAddNewPackage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    addPackage({
      title: newTitle.trim(),
      priceInr: Number(newPrice),
      durationLabel: newDuration,
      validityDays: 30,
      isActive: true,
      tagline: newTagline.trim() || 'Clinical nutrition care protocol',
      description: 'Comprehensive personalized diet care and consultation.',
      inclusions: newInclusions.split('\n').filter(Boolean),
      terms: 'Non-transferable. Valid for 30 days from purchase.',
      category: 'specialized',
    });

    setIsAddingPkg(false);
    setNewTitle('');
    setNewInclusions('');
  };

  // 7-day promise: the suggested refund is what was paid, minus consultations used since the purchase and
  // the processing charges the payment gateway keeps. The clinic can adjust the amount.
  const refundingPayment = payments.find((p) => p.id === refundingPaymentId);
  const refundBreakdown = (() => {
    if (!refundingPayment) return undefined;
    const used = appointments.filter(
      (a) => a.patientId === refundingPayment.patientId && a.status === 'completed' && a.date >= refundingPayment.createdAt
    );
    const usedInr = used.reduce((sum, a) => sum + (a.consultationFeeInr || 0), 0);
    const withinPromise = refundingPayment.createdAt >= addDays(today, -REFUND_PROMISE_DAYS);
    return { ...suggestedRefund(refundingPayment.amountInr, usedInr), usedCount: used.length, withinPromise };
  })();
  const [refundAmount, setRefundAmount] = useState('');

  const startRefund = (paymentId: string) => {
    setRefundingPaymentId(paymentId);
    setRefundAmount('');
  };

  const handleProcessRefund = () => {
    if (!refundingPaymentId || !refundBreakdown) return;
    const amount = refundAmount.trim() === '' ? refundBreakdown.refundInr : Math.round(Number(refundAmount));
    if (!Number.isFinite(amount) || amount < 0 || amount > (refundingPayment?.amountInr ?? 0)) return;
    refundPayment(refundingPaymentId, refundReason, amount);
    setRefundingPaymentId(null);
  };

  return (
    <div className="flex-1 pb-16 space-y-5 px-4 pt-4 md:px-8 md:pt-6 max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto w-full">
      
      {/* Header Banner */}
      <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-200 p-5 md:p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#3E6553]">
              {isDietitian ? 'Nutrifacts Pricing & Packages' : 'My Plans'}
            </span>
            <h1 className="text-lg sm:text-xl font-serif font-bold text-slate-900">
              {isDietitian ? 'Personalized Nutrition Care Plans' : 'Your Nutrition Care Plan'}
            </h1>
            <p className="text-xs text-slate-500">
              {isDietitian
                ? 'Transparent, flexible pricing in Indian Rupees (₹) with zero hidden fees'
                : 'Upgrade any time (unused days are credited), or switch to a smaller plan when yours ends.'}
            </p>
          </div>

          {/* Tab Selector */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs font-medium self-start sm:self-auto max-w-full overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('packages')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'packages'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Available Plans
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'history'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isDietitian ? 'All Transactions' : 'My Purchases'}
            </button>
            {isDietitian && (
              <button
                type="button"
                onClick={() => setActiveTab('admin')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'admin'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Manage Pricing
              </button>
            )}
          </div>
        </div>

        {/* Patient: current plan, and any scheduled change */}
        {!isDietitian && (
          <section aria-label="Current plan" className={`p-4 rounded-xl border text-xs space-y-3 ${planRunning ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
            {activePlan ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold shrink-0 ${planRunning ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-200 text-slate-600'}`}>
                    {planRunning ? '✓' : <Clock className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900">
                      {planRunning ? 'Current plan' : 'Plan ended'}: {activePlan.packageTitle}
                      {planRunning && (
                        <span className="ml-2 align-middle text-[10px] font-semibold bg-white text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                          {daysLeft(activePlan, today)} {daysLeft(activePlan, today) === 1 ? 'day' : 'days'} left
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-slate-600 break-words">
                      {planRunning ? 'Valid until' : 'Ended on'} <strong>{activePlan.validUntil}</strong> · Ref: {activePlan.transactionRef}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onViewReceipt(activePlan)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white font-medium text-xs flex items-center gap-1 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>View Invoice</span>
                </button>
              </div>
            ) : (
              <p className="text-slate-600">
                <strong className="text-slate-900">No plan yet.</strong> Choose a plan below to start your nutrition care.
              </p>
            )}

            {scheduled && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-emerald-200/70">
                <p className="text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  {planRunning ? (
                    <span>
                      Switching to <strong>{scheduled.packageTitle}</strong> on <strong>{scheduled.effectiveDate}</strong>.
                    </span>
                  ) : (
                    <span>
                      Your next plan is <strong>{scheduled.packageTitle}</strong>. Activate it below to continue.
                    </span>
                  )}
                </p>
                <button type="button" onClick={cancelScheduledPlanChange} className="font-semibold text-slate-600 hover:text-red-700 hover:underline">
                  Cancel change
                </button>
              </div>
            )}
          </section>
        )}

        {/* Revenue KPI Strip for Dietitian */}
        {isDietitian && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-[#F7F9F7] border border-emerald-900/5">
              <span className="text-[11px] text-slate-500 block">Total Revenue</span>
              <span className="text-xl font-bold font-mono text-slate-900">₹{totalRevenue}</span>
              <span className="text-[10px] text-emerald-800 block">Verified orders</span>
            </div>
            <div className="p-3 rounded-xl bg-[#F7F9F7] border border-emerald-900/5">
              <span className="text-[11px] text-slate-500 block">Active Subscriptions</span>
              <span className="text-xl font-bold font-mono text-slate-900">
                {payments.filter((p) => p.status === 'successful').length}
              </span>
              <span className="text-[10px] text-emerald-800 block">Current patients</span>
            </div>
            <div className="p-3 rounded-xl bg-[#F7F9F7] border border-emerald-900/5">
              <span className="text-[11px] text-slate-500 block">Average Order Value</span>
              <span className="text-xl font-bold font-mono text-slate-900">₹1,749</span>
              <span className="text-[10px] text-slate-500 block">INR / patient</span>
            </div>
            <div className="p-3 rounded-xl bg-[#F7F9F7] border border-emerald-900/5">
              <span className="text-[11px] text-slate-500 block">Gateway Status</span>
              <span className="text-xs font-bold text-emerald-800 block mt-1">UPI & Cards Active</span>
              <span className="text-[10px] text-slate-400 block">Demo Gateway Mode</span>
            </div>
          </div>
        )}
      </div>

      {/* Tab 1: Available Plans */}
      {activeTab === 'packages' && (
        <div className="space-y-4">
          {!isDietitian && <WinWinStrip />}

          {!isDietitian && planRunning && currentCreditInFull && (
            <div role="status" className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <Gift className="w-4.5 h-4.5" aria-hidden="true" />
              </div>
              <p className="leading-relaxed">
                <strong className="block text-sm">You have ₹{activePlan.amountInr.toLocaleString('en-IN')} credit</strong>
                Your {activePlan.packageTitle} counts in full towards any bigger plan until <strong>{activePlan.validUntil}</strong>.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-3">
            {planFamilies(visiblePlans).map((family) => {
              const pkg = chosenLength(family);
              const change = planChange(activePlan, pkg, today);
              const isScheduled = scheduled?.packageId === pkg.id;
              const quote = upgradeQuote(activePlan, pkg.priceInr, today, { inFull: currentCreditInFull });
              // Early renewal is for ongoing care; one-time plans are simply bought again.
              const renewable = canRenewEarly(activePlan, today) && pkg.category === 'monthly_care';
              const primary = 'w-full py-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all bg-[#3E6553] hover:bg-[#2D4C3C] text-white';
              const secondary = 'w-full py-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-all bg-white hover:bg-slate-50 text-slate-800 border border-slate-300';
              const status = 'w-full py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 text-center px-2';

              let footer: React.ReactNode;
              let priceNote: React.ReactNode;
              if (isDietitian) {
                footer = (
                  <>
                    <p className="flex items-center justify-between gap-2 text-[11px] text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                      <span className="flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5 text-[#3E6553]" aria-hidden="true" /> You receive</span>
                      <strong className="text-slate-900">₹{netAmount(pkg.priceInr).toLocaleString('en-IN')}</strong>
                    </p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => handleStartEdit(pkg)} className="flex-1 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-xs flex items-center justify-center gap-1">
                        <Edit2 className="w-3.5 h-3.5" aria-hidden="true" /> <span>Edit Price</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => togglePackageActive(pkg.id)}
                        className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${pkg.isActive ? 'bg-amber-100 text-amber-900 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200'}`}
                      >
                        {pkg.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                    {!pkg.isActive && <p className="text-[11px] text-slate-500 text-center">Inactive · hidden from patients</p>}
                  </>
                );
              } else if (change === 'current') {
                footer = renewable ? (
                  <>
                    <button type="button" onClick={() => onSelectPackageToBuy(pkg, { renew: true })} className={primary}>
                      <CalendarPlus className="w-4 h-4" aria-hidden="true" />
                      <span>Renew early · get {RENEWAL_BONUS_DAYS} days free</span>
                    </button>
                    <p className="text-[11px] text-center text-emerald-800">Starts after {activePlan!.validUntil}, nothing is lost</p>
                  </>
                ) : (
                  <>
                    <div className={`${status} bg-emerald-100 text-emerald-900 border border-emerald-200`}>
                      <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> Your current plan
                    </div>
                    {pkg.category === 'monthly_care' && (
                      <p className="text-[11px] text-center text-slate-500">
                        Early renewal (+{RENEWAL_BONUS_DAYS} days free) opens on {addDays(activePlan!.validUntil, 1 - EARLY_RENEWAL_WINDOW_DAYS)}
                      </p>
                    )}
                  </>
                );
              } else if (change === 'upgrade') {
                if (quote.creditInr > 0) {
                  priceNote = (
                    <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-800">
                      <Gift className="w-3.5 h-3.5" aria-hidden="true" />
                      Pay ₹{quote.amountDueInr.toLocaleString('en-IN')} today after ₹{quote.creditInr.toLocaleString('en-IN')} credit
                    </span>
                  );
                }
                footer = (
                  <button type="button" onClick={() => onSelectPackageToBuy(pkg, { upgrade: true })} className={primary}>
                    <TrendingUp className="w-4 h-4" aria-hidden="true" />
                    <span>Upgrade · pay ₹{quote.amountDueInr.toLocaleString('en-IN')}</span>
                  </button>
                );
              } else if (change === 'downgrade' || change === 'switch') {
                footer = isScheduled ? (
                  renewable ? (
                    <button type="button" onClick={() => onSelectPackageToBuy(pkg, { renew: true })} className={primary}>
                      <CalendarPlus className="w-4 h-4" aria-hidden="true" />
                      <span>Confirm now · get {RENEWAL_BONUS_DAYS} days free</span>
                    </button>
                  ) : (
                    <div className={`${status} bg-slate-100 text-slate-700 border border-slate-200`}>
                      <Calendar className="w-4 h-4 shrink-0" aria-hidden="true" /> Starts {scheduled!.effectiveDate}
                    </div>
                  )
                ) : (
                  <button type="button" onClick={() => setConfirmingChange(pkg)} className={secondary}>
                    <RotateCcw className="w-4 h-4" aria-hidden="true" />
                    <span>{change === 'downgrade' ? 'Switch to this when my plan ends' : 'Switch when my plan ends'}</span>
                  </button>
                );
              } else {
                footer = (
                  <button type="button" onClick={() => onSelectPackageToBuy(pkg)} className={pkg.isPopular || pkg.isBestValue || isScheduled ? primary : secondary}>
                    <CreditCard className="w-4 h-4" aria-hidden="true" />
                    <span>{isScheduled ? 'Start your next plan' : activePlan?.packageId === pkg.id ? 'Renew this plan' : 'Choose this plan'}</span>
                  </button>
                );
              }

              return (
                <PlanCard
                  key={family[0].id}
                  pkg={pkg}
                  all={visiblePlans}
                  family={family}
                  onSelectLength={(p) => setLengthChoice((c) => ({ ...c, [family[0].id]: p.id }))}
                  footer={footer}
                  priceNote={priceNote}
                  showTerms
                  className={!pkg.isActive ? 'opacity-70' : ''}
                />
              );
            })}
          </div>

          {/* Payment Guarantee Notice */}
          <div className="p-4 rounded-2xl bg-[#FAFBF9] border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0" />
              <span>
                <strong>Supported Payment Gateways:</strong> Instant checkout via UPI (Google Pay, PhonePe, Paytm), Debit/Credit Cards (Visa, MasterCard, RuPay), and Net Banking.
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium shrink-0">
              No automatic debits without consent
            </span>
          </div>
        </div>
      )}

      {confirmingChange && activePlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" onClick={() => setConfirmingChange(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="plan-change-title"
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 p-5 space-y-4 text-sm"
          >
            <h3 id="plan-change-title" className="font-bold text-slate-900 text-base">
              Switch to {confirmingChange.title}?
            </h3>
            <p className="text-slate-600 text-xs leading-relaxed">
              You keep everything in <strong>{activePlan.packageTitle}</strong> until <strong>{activePlan.validUntil}</strong>. From{' '}
              <strong>{addDays(activePlan.validUntil, 1)}</strong> your plan becomes <strong>{confirmingChange.title}</strong> (₹{confirmingChange.priceInr}),
              which you activate with a payment then. Nothing is charged now, and you can cancel this any time before.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmingChange(null)} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-medium">
                Keep my plan
              </button>
              <button
                type="button"
                onClick={() => {
                  schedulePlanChange(confirmingChange);
                  setConfirmingChange(null);
                }}
                className="px-4 py-2 rounded-xl bg-[#3E6553] hover:bg-[#2D4C3C] text-white text-xs font-semibold"
              >
                Confirm change
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Transaction History */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                {isDietitian ? 'All Clinic Patient Transactions' : 'My Purchases & Receipts'}
              </h3>
              <p className="text-xs text-slate-500">
                Itemized bills, validities, and verified GST tax invoices
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {isDietitian ? payments.length : myPayments.length} records
            </span>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {(isDietitian ? payments : myPayments).length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <FileText className="w-10 h-10 mx-auto stroke-1 mb-2 text-slate-300" />
                <p>No transactions recorded yet.</p>
              </div>
            ) : (
              (isDietitian ? payments : myPayments).map((pay) => (
                <div
                  key={pay.id}
                  className="p-4 hover:bg-slate-50/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{pay.packageTitle}</span>
                      <span className="text-slate-300">·</span>
                      <span className="font-mono font-bold text-emerald-800">₹{pay.amountInr}</span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          pay.status === 'successful'
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-rose-100 text-rose-900'
                        }`}
                      >
                        {pay.status}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500">
                      Invoice: <strong className="text-slate-700">{pay.invoiceNumber}</strong> · Ref: {pay.transactionRef}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
                      <span>Date: {pay.createdAt}</span>
                      <span>·</span>
                      <span>Valid until: <strong>{pay.validUntil}</strong></span>
                      {isDietitian && (
                        <>
                          <span>·</span>
                          <span className="text-slate-800 font-medium">Patient: {pay.patientName}</span>
                        </>
                      )}
                    </div>

                    {pay.status === 'refunded' && pay.refundReason && (
                      <p className="text-[11px] text-rose-700 italic">
                        Refunded{pay.refundAmountInr != null ? ` ₹${pay.refundAmountInr}` : ''}: {pay.refundReason}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => onViewReceipt(pay)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium text-xs flex items-center gap-1 transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>View Receipt</span>
                    </button>

                    {isDietitian && pay.status === 'successful' && (
                      <button
                        type="button"
                        onClick={() => startRefund(pay.id)}
                        className="px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-medium"
                      >
                        Issue Refund
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Dietitian Admin Pricing Manager */}
      {isDietitian && activeTab === 'admin' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-200 p-5 md:p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Custom Package Creator
                </h3>
                <p className="text-xs text-slate-500">
                  Add specialized clinic programs (e.g., 90-Day PCOS Reset, Metabolic Detox)
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsAddingPkg(!isAddingPkg)}
                className="px-3.5 py-2 rounded-xl bg-[#3E6553] hover:bg-[#325243] text-white font-medium text-xs flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>{isAddingPkg ? 'Cancel' : 'Create New Package'}</span>
              </button>
            </div>

            {isAddingPkg && (
              <form onSubmit={handleAddNewPackage} className="space-y-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Package Title *</label>
                    <input
                      type="text"
                      required
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="e.g. 90-Day PCOS Reversal Program"
                      className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Price in INR (₹) *</label>
                    <input
                      type="number"
                      required
                      value={newPrice}
                      onChange={(e) => setNewPrice(Number(e.target.value))}
                      className="w-full p-2 rounded-lg border border-slate-300 bg-white font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Duration Tag</label>
                    <input
                      type="text"
                      value={newDuration}
                      onChange={(e) => setNewDuration(e.target.value)}
                      placeholder="e.g. 90-Day Transformation"
                      className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tagline</label>
                  <input
                    type="text"
                    value={newTagline}
                    onChange={(e) => setNewTagline(e.target.value)}
                    placeholder="Brief description of who this is ideal for..."
                    className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Inclusions (one per line)</label>
                  <textarea
                    rows={3}
                    value={newInclusions}
                    onChange={(e) => setNewInclusions(e.target.value)}
                    placeholder="Weekly Diet Plan Updates&#10;Unlimited WhatsApp Support&#10;Hormonal Seed Cycling Advisory"
                    className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                  />
                </div>

                <button
                  type="submit"
                  className="px-4 py-2 bg-[#3E6553] text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Publish New Package</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Edit Package Modal */}
      {editingPkg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900">Update Package Price & Info</h3>
              <button
                type="button"
                onClick={() => setEditingPkg(null)}
                className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Package Title</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Price (₹ INR)</label>
              <input
                type="number"
                value={editPrice}
                onChange={(e) => setEditPrice(Number(e.target.value))}
                className="w-full p-2 rounded-lg border border-slate-300 font-mono font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tagline</label>
              <input
                type="text"
                value={editTagline}
                onChange={(e) => setEditTagline(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingPkg(null)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-4 py-1.5 bg-[#3E6553] text-white rounded-lg font-medium"
              >
                Save Updates
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Confirmation Modal */}
      {refundingPaymentId && refundingPayment && refundBreakdown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div role="dialog" aria-modal="true" aria-labelledby="refund-title" className="bg-white w-full max-w-md max-h-[92dvh] overflow-y-auto rounded-2xl shadow-2xl border border-slate-200 flex flex-col p-5 space-y-4 text-xs">
            <h3 id="refund-title" className="font-bold text-sm text-rose-900">
              Confirm Patient Refund
            </h3>
            <p className="text-slate-600">
              {refundingPayment.patientName} · {refundingPayment.packageTitle} · paid {refundingPayment.createdAt}. The plan ends now and the
              patient is notified.
            </p>

            <div className={`flex items-start gap-2 rounded-lg px-3 py-2 ${refundBreakdown.withinPromise ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}>
              <ShieldCheck className="w-4 h-4 shrink-0 mt-px" aria-hidden="true" />
              <span>
                {refundBreakdown.withinPromise
                  ? `Within the ${REFUND_PROMISE_DAYS}-day promise.`
                  : `Outside the ${REFUND_PROMISE_DAYS}-day promise: any refund is at the clinic's discretion.`}
              </span>
            </div>

            <dl className="space-y-1.5 rounded-lg border border-slate-200 p-3">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-600">Paid</dt>
                <dd className="font-mono">₹{refundingPayment.amountInr}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-600">Consultations used ({refundBreakdown.usedCount})</dt>
                <dd className="font-mono">− ₹{refundBreakdown.consultationsUsedInr}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-600">Payment processing charges (kept by the gateway)</dt>
                <dd className="font-mono">− ₹{refundBreakdown.processingInr}</dd>
              </div>
              <div className="flex justify-between gap-2 pt-1.5 border-t border-slate-100 font-bold text-slate-900">
                <dt>Suggested refund</dt>
                <dd className="font-mono">₹{refundBreakdown.refundInr}</dd>
              </div>
            </dl>

            <div>
              <label htmlFor="refund-amount" className="block font-semibold text-slate-700 mb-1">
                Refund amount (₹)
              </label>
              <input
                id="refund-amount"
                type="number"
                inputMode="numeric"
                min={0}
                max={refundingPayment.amountInr}
                placeholder={String(refundBreakdown.refundInr)}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300"
              />
            </div>

            <div>
              <label htmlFor="refund-reason" className="block font-semibold text-slate-700 mb-1">
                Refund Reason / Notes
              </label>
              <input
                id="refund-reason"
                type="text"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRefundingPaymentId(null)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProcessRefund}
                className="px-4 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-lg font-medium"
              >
                Confirm Refund
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
