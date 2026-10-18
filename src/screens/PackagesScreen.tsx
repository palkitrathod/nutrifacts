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
} from 'lucide-react';
import { useNutrition } from '../context/NutritionContext';
import { NutritionPackage, PackagePayment } from '../types/nutrition';

interface PackagesScreenProps {
  onSelectPackageToBuy: (pkg: NutritionPackage) => void;
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
    updatePackage,
    addPackage,
    togglePackageActive,
    refundPayment,
    getPatientPayments,
    getActivePackage,
  } = useNutrition();

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

  const activePlan = getActivePackage(currentUser.id);
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

  const handleProcessRefund = () => {
    if (!refundingPaymentId) return;
    refundPayment(refundingPaymentId, refundReason);
    setRefundingPaymentId(null);
  };

  return (
    <div className="flex-1 pb-16 space-y-5 px-4 pt-4 md:px-8 md:pt-6 max-w-5xl mx-auto w-full">
      
      {/* Header Banner */}
      <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-200 p-5 md:p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#3E6553]">
              Nutrifacts Pricing & Packages
            </span>
            <h1 className="text-lg sm:text-xl font-serif font-bold text-slate-900">
              Personalized Nutrition Care Plans
            </h1>
            <p className="text-xs text-slate-500">
              Transparent, flexible pricing in Indian Rupees (₹) with zero hidden fees
            </p>
          </div>

          {/* Tab Selector */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs font-medium">
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

        {/* Active Plan Strip for Patient */}
        {!isDietitian && activePlan && (
          <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-200 text-emerald-900 flex items-center justify-center font-bold">
                ✓
              </div>
              <div>
                <p className="font-bold text-emerald-950">
                  Active Package: {activePlan.packageTitle}
                </p>
                <p className="text-[11px] text-emerald-800">
                  Valid until <strong>{activePlan.validUntil}</strong> · Ref: {activePlan.transactionRef}
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {packages
              .filter((p) => p.isActive || isDietitian)
              .map((pkg) => {
                const isCurrent = activePlan?.packageId === pkg.id;
                return (
                  <div
                    key={pkg.id}
                    className={`rounded-2xl bg-white border p-5 flex flex-col justify-between transition-all relative ${
                      pkg.isPopular
                        ? 'border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-emerald-300'
                    }`}
                  >
                    {pkg.isPopular && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#3E6553] text-white text-[10px] font-bold uppercase tracking-wider py-0.5 px-3 rounded-full shadow-xs">
                        Most Recommended
                      </span>
                    )}

                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                            {pkg.durationLabel}
                          </span>
                          {!pkg.isActive && (
                            <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                              Inactive
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-serif font-bold text-slate-900 mt-1">
                          {pkg.title}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">{pkg.tagline}</p>
                      </div>

                      {/* Price Tag */}
                      <div className="py-2 border-y border-slate-100 flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold font-mono text-slate-900">
                          ₹{pkg.priceInr}
                        </span>
                        <span className="text-xs text-slate-500">/ INR</span>
                      </div>

                      {/* Inclusions */}
                      <div className="space-y-2 text-xs">
                        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                          What&apos;s Included:
                        </span>
                        <ul className="space-y-1.5 text-slate-600">
                          {pkg.inclusions.map((inc, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                              <span className="leading-snug">{inc}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-4 mt-4 border-t border-slate-100 space-y-2">
                      <p className="text-[10px] text-slate-400 italic leading-tight">
                        {pkg.terms}
                      </p>

                      {isDietitian ? (
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(pkg)}
                            className="flex-1 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-xs flex items-center justify-center gap-1"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit Price</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => togglePackageActive(pkg.id)}
                            className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                              pkg.isActive
                                ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                                : 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200'
                            }`}
                          >
                            {pkg.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSelectPackageToBuy(pkg)}
                          className={`w-full py-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all ${
                            pkg.isPopular
                              ? 'bg-[#3E6553] hover:bg-[#325243] text-white'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200'
                          }`}
                        >
                          <CreditCard className="w-4 h-4" />
                          <span>{isCurrent ? 'Renew Plan (₹' + pkg.priceInr + ')' : 'Select & Pay Online'}</span>
                        </button>
                      )}
                    </div>
                  </div>
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
                        Refunded: {pay.refundReason}
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
                        onClick={() => setRefundingPaymentId(pay.id)}
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
      {refundingPaymentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col p-5 space-y-4 text-xs">
            <h3 className="font-bold text-sm text-slate-900 text-rose-900">
              Confirm Patient Refund
            </h3>
            <p className="text-slate-600">
              This will mark the payment as refunded, revoke active package validity, and generate a refund notification.
            </p>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Refund Reason / Notes
              </label>
              <input
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
