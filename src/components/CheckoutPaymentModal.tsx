import React, { useState } from 'react';
import {
  X,
  CreditCard,
  QrCode,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Smartphone,
  Building,
  Check,
  ArrowRight,
  FileText,
  AlertCircle,
  Clock,
  CalendarPlus,
  Gift,
} from 'lucide-react';
import { useNutrition } from '../context/NutritionContext';
import { NutritionPackage, PaymentMethodType, PackagePayment } from '../types/nutrition';
import { newPlanValidUntil, RENEWAL_BONUS_DAYS, todayIso, upgradeQuote } from '../shared/plans';
import { useEscapeToClose } from './useEscapeToClose';

interface CheckoutPaymentModalProps {
  packageItem: NutritionPackage;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (payment: PackagePayment) => void;
  /** Upgrade from the current plan: the unused days are credited against the price. */
  upgrade?: boolean;
  /** Early renewal: starts after the current plan ends, with bonus days. */
  renew?: boolean;
  /** The goal chosen for a plan with goals (e.g. "Weight goal"). */
  goal?: string;
}

export const CheckoutPaymentModal: React.FC<CheckoutPaymentModalProps> = ({
  packageItem: packageAtOpen,
  isOpen,
  onClose,
  onSuccess,
  upgrade = false,
  renew = false,
  goal,
}) => {
  const { currentUser, packages, processPackagePurchase, getActivePackage } = useNutrition();
  // Always show the live price: it is refreshed if the clinic changes it while this is open.
  const packageItem = packages.find((p) => p.id === packageAtOpen.id) ?? packageAtOpen;
  const activePlan = getActivePackage(currentUser.id);
  const currentPlan = upgrade ? activePlan : undefined;
  const inFull = !!currentPlan && packages.find((p) => p.id === currentPlan.packageId)?.creditInFull === true;
  const { creditInr, amountDueInr } = upgradeQuote(currentPlan, packageItem.priceInr, todayIso(), { inFull });
  const renewalOf = renew ? activePlan : undefined;

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('upi');
  const [upiId, setUpiId] = useState('');
  const [selectedUpiApp, setSelectedUpiApp] = useState<'gpay' | 'phonepe' | 'paytm'>('gpay');

  // Card state
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState(currentUser.name);

  // Net banking state
  const [selectedBank, setSelectedBank] = useState('HDFC Bank');

  const [isProcessing, setIsProcessing] = useState(false);
  const [completedPayment, setCompletedPayment] = useState<PackagePayment | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  // Not while a payment is being processed; after success, closing shows the receipt as the button does.
  useEscapeToClose(isOpen && !isProcessing, () => {
    if (completedPayment) onSuccess(completedPayment);
    onClose();
  });

  if (!isOpen) return null;

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessing) return;
    setPayError(null);
    setIsProcessing(true);

    let details = '';
    if (paymentMethod === 'upi') {
      details = `${selectedUpiApp.toUpperCase()} (${upiId})`;
    } else if (paymentMethod === 'card') {
      details = `Card ending in ${cardNumber.replace(/\D/g, '').slice(-4)} (${cardName})`;
    } else {
      details = `Net Banking (${selectedBank})`;
    }

    try {
      setCompletedPayment(await processPackagePurchase(packageItem.id, paymentMethod, details, { upgrade, renew, goal }));
    } catch (err) {
      setPayError(
        err instanceof Error && err.message
          ? `Payment not completed: ${err.message} No money has been taken.`
          : 'Payment not completed. No money has been taken — please try again.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompleteAndClose = () => {
    if (completedPayment) {
      onSuccess(completedPayment);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Header */}
        <div className="bg-[#3E6553] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Secure Payment Gateway</h3>
              <p className="text-xs text-emerald-100 font-light">
                Nutrifacts with dt.Anchal · Encrypted 256-bit Checkout
              </p>
            </div>
          </div>
          {!completedPayment && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white/80 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {completedPayment ? (
          /* Payment Success State */
          <div className="p-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto ring-8 ring-emerald-50">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-1">
              <h4 className="text-lg font-bold text-slate-900">
                Payment Successful!
              </h4>
              <p className="text-xs text-slate-500">
                Transaction ID: <span className="font-mono font-bold text-slate-700">{completedPayment.transactionRef}</span>
              </p>
            </div>

            {/* Summary card */}
            <div className="p-4 rounded-xl bg-[#FAFBF9] border border-slate-200 text-left text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Package Purchased:</span>
                <span className="font-bold text-slate-900">{packageItem.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount Paid:</span>
                <span className="font-bold font-mono text-emerald-800">₹{completedPayment.amountInr}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Mode:</span>
                <span className="font-medium text-slate-700 capitalize">{completedPayment.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Service Validity:</span>
                <span className="font-mono text-slate-700">Until {completedPayment.validUntil}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Patient:</span>
                <span className="font-medium text-slate-800">{currentUser.name}</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              Your diet plan and consultation privileges have been activated. A receipt has been saved to your account.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleCompleteAndClose}
                className="w-full py-3 rounded-xl bg-[#3E6553] hover:bg-[#325243] text-white font-medium text-xs flex items-center justify-center gap-1.5 shadow-sm"
              >
                <span>Go to My Diet & Schedule</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* Checkout Form */
          <form onSubmit={handlePay} className="p-5 overflow-y-auto space-y-4 text-xs">
            
            {/* Package Summary */}
            <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                    {upgrade ? 'Upgrade to' : renew ? 'Renew early' : 'Selected Nutrition Package'}
                  </span>
                  <h4 className="font-bold text-sm text-slate-900">{packageItem.title}</h4>
                  <p className="text-[11px] text-slate-600 mt-0.5">{packageItem.durationLabel}</p>
                  {goal && <p className="text-[11px] font-semibold text-emerald-800 mt-0.5">Goal: {goal}</p>}
                </div>
                <div className="text-right">
                  <span className="text-base font-extrabold font-mono text-slate-900">
                    ₹{packageItem.priceInr}
                  </span>
                  <span className="block text-[10px] text-emerald-800 font-medium">All taxes incl.</span>
                </div>
              </div>

              {upgrade && currentPlan && (
                <dl className="pt-2 border-t border-emerald-200/60 space-y-1 text-[11px]">
                  <div className="flex justify-between gap-2 text-slate-600">
                    <dt>Plan price</dt>
                    <dd className="font-mono">₹{packageItem.priceInr}</dd>
                  </div>
                  <div className="flex justify-between gap-2 text-emerald-800">
                    <dt className="flex items-center gap-1">
                      <Gift className="w-3 h-3 shrink-0" aria-hidden="true" />
                      {inFull ? `Your ${currentPlan.packageTitle} (credited in full)` : `Credit for unused days of ${currentPlan.packageTitle}`}
                    </dt>
                    <dd className="font-mono shrink-0">− ₹{creditInr}</dd>
                  </div>
                  <div className="flex justify-between gap-2 font-bold text-slate-900 text-xs pt-1 border-t border-emerald-200/60">
                    <dt>To pay today</dt>
                    <dd className="font-mono">₹{amountDueInr}</dd>
                  </div>
                  <p className="text-[10px] text-slate-500">Your new plan starts today and runs for {packageItem.validityDays} days.</p>
                </dl>
              )}

              {renew && renewalOf && (
                <p className="pt-2 border-t border-emerald-200/60 flex items-start gap-1.5 text-[11px] text-emerald-900">
                  <CalendarPlus className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" />
                  <span>
                    Starts after your current plan ends on <strong>{renewalOf.validUntil}</strong>, and includes{' '}
                    <strong>{RENEWAL_BONUS_DAYS} extra days free</strong>: valid until{' '}
                    <strong>{newPlanValidUntil(packageItem.validityDays, todayIso(), renewalOf)}</strong>.
                  </span>
                </p>
              )}

              {/* Inclusions preview */}
              <ul className="pt-2 border-t border-emerald-200/60 space-y-1 text-[11px] text-slate-600">
                {packageItem.inclusions.slice(0, 3).map((inc, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-emerald-700 shrink-0" />
                    <span className="truncate">{inc}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Select Payment Method (India)
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('upi')}
                  className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                    paymentMethod === 'upi'
                      ? 'border-[#3E6553] bg-emerald-50/80 text-emerald-950 font-bold ring-2 ring-emerald-600/30'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Smartphone className="w-4 h-4 text-emerald-700" />
                  <span className="text-[11px]">UPI / QR</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                    paymentMethod === 'card'
                      ? 'border-[#3E6553] bg-emerald-50/80 text-emerald-950 font-bold ring-2 ring-emerald-600/30'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-emerald-700" />
                  <span className="text-[11px]">Card / RuPay</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('netbanking')}
                  className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                    paymentMethod === 'netbanking'
                      ? 'border-[#3E6553] bg-emerald-50/80 text-emerald-950 font-bold ring-2 ring-emerald-600/30'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Building className="w-4 h-4 text-emerald-700" />
                  <span className="text-[11px]">Net Banking</span>
                </button>
              </div>
            </div>

            {/* Method Details Form */}
            {paymentMethod === 'upi' && (
              <div className="space-y-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] font-semibold text-slate-700 block">
                  Choose Preferred UPI App
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => { setSelectedUpiApp('gpay'); setUpiId('priya@okhdfcbank'); }}
                    className={`py-2 px-1 rounded-lg border text-center transition-all ${
                      selectedUpiApp === 'gpay'
                        ? 'border-emerald-600 bg-white font-bold text-slate-900 shadow-2xs'
                        : 'border-slate-200 text-slate-600 bg-white/60'
                    }`}
                  >
                    Google Pay
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSelectedUpiApp('phonepe'); setUpiId('priya@ybl'); }}
                    className={`py-2 px-1 rounded-lg border text-center transition-all ${
                      selectedUpiApp === 'phonepe'
                        ? 'border-emerald-600 bg-white font-bold text-slate-900 shadow-2xs'
                        : 'border-slate-200 text-slate-600 bg-white/60'
                    }`}
                  >
                    PhonePe
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSelectedUpiApp('paytm'); setUpiId('priya@paytm'); }}
                    className={`py-2 px-1 rounded-lg border text-center transition-all ${
                      selectedUpiApp === 'paytm'
                        ? 'border-emerald-600 bg-white font-bold text-slate-900 shadow-2xs'
                        : 'border-slate-200 text-slate-600 bg-white/60'
                    }`}
                  >
                    Paytm UPI
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Virtual Payment Address (VPA / UPI ID)
                  </label>
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="mobilenumber@upi"
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                    required
                  />
                </div>
              </div>
            )}

            {paymentMethod === 'card' && (
              <div className="space-y-2.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Card Number
                  </label>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    required
                    inputMode="numeric"
                    autoComplete="cc-number"
                    pattern="[0-9 ]{12,23}"
                    title="12–19 digit card number"
                    placeholder="1234 5678 9012 3456"
                    className="w-full p-2 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Expiry Date
                    </label>
                    <input
                      type="text"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      required
                      autoComplete="cc-exp"
                      pattern="(0[1-9]|1[0-2])/[0-9]{2}"
                      title="MM/YY"
                      placeholder="MM/YY"
                      className="w-full p-2 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      CVV
                    </label>
                    <input
                      type="password"
                      maxLength={4}
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value)}
                      required
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      pattern="[0-9]{3,4}"
                      title="3 or 4 digits"
                      placeholder="123"
                      className="w-full p-2 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Name on Card
                  </label>
                  <input
                    type="text"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300 bg-white text-xs"
                  />
                </div>
              </div>
            )}

            {paymentMethod === 'netbanking' && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Select Popular Bank
                </label>
                <select
                  value={selectedBank}
                  onChange={(e) => setSelectedBank(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-xs"
                >
                  <option value="HDFC Bank">HDFC Bank</option>
                  <option value="State Bank of India">State Bank of India (SBI)</option>
                  <option value="ICICI Bank">ICICI Bank</option>
                  <option value="Axis Bank">Axis Bank</option>
                  <option value="Kotak Mahindra Bank">Kotak Mahindra Bank</option>
                  <option value="Punjab National Bank">Punjab National Bank</option>
                </select>
              </div>
            )}

            {/* Security Guarantee & Terms */}
            <div className="p-3 bg-[#FAFBF9] rounded-xl border border-slate-200 flex items-start gap-2 text-[11px] text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <span>
                <strong>100% Secure Checkout:</strong> Payments are processed via simulated Razorpay/Cashfree demo gateway. No automatic renewals without explicit consent.
              </span>
            </div>

            {payError && (
              <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700">
                {payError}
              </div>
            )}

            {/* Pay Button */}
            <button
              type="submit"
              disabled={isProcessing}
              className="w-full py-3.5 rounded-xl bg-[#3E6553] hover:bg-[#325243] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-60"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Processing Secure Transaction...</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Pay ₹{amountDueInr} & {upgrade ? 'Upgrade Plan' : renew ? 'Renew Plan' : 'Activate Package'}</span>
                </>
              )}
            </button>
          </form>
        )}

      </div>
    </div>
  );
};
