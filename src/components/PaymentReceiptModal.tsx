import React, { useRef } from 'react';
import { X, Printer, Download, CheckCircle, Shield, Award, FileText } from 'lucide-react';
import { PackagePayment } from '../types/nutrition';
import { useEscapeToClose } from './useEscapeToClose';

interface PaymentReceiptModalProps {
  payment: PackagePayment;
  onClose: () => void;
}

export const PaymentReceiptModal: React.FC<PaymentReceiptModalProps> = ({ payment, onClose }) => {
  useEscapeToClose(true, onClose);
  const receiptRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadText = () => {
    let receiptText = `TAX INVOICE & PAYMENT RECEIPT\n`;
    receiptText += `Nutrifacts with dt.Anchal - Clinical Nutrition Care\n`;
    receiptText += `Dietitian: Dt. Anchal Dewan (M.Sc. Clinical Nutrition, CDE)\n`;
    receiptText += `Reg No. MED-NUTRI/2018/8841\n`;
    receiptText += `------------------------------------------------------\n`;
    receiptText += `Invoice No: ${payment.invoiceNumber}\n`;
    receiptText += `Transaction Ref: ${payment.transactionRef}\n`;
    receiptText += `Date: ${payment.createdAt}\n`;
    receiptText += `Patient Name: ${payment.patientName}\n`;
    receiptText += `Patient Phone: ${payment.patientPhone}\n`;
    receiptText += `------------------------------------------------------\n`;
    receiptText += `Package: ${payment.packageTitle}\n`;
    receiptText += `Payment Mode: ${payment.paymentMethod.toUpperCase()} (${payment.paymentDetails})\n`;
    receiptText += `Status: ${payment.status.toUpperCase()}\n`;
    receiptText += `Valid Until: ${payment.validUntil}\n`;
    if (payment.creditInr) {
      receiptText += `Plan Price: INR ₹${payment.listPriceInr}.00\n`;
      receiptText += `Upgrade Credit (unused days): -INR ₹${payment.creditInr}.00\n`;
    }
    receiptText += `Total Amount Paid: INR ₹${payment.amountInr}.00\n`;
    receiptText += `------------------------------------------------------\n`;
    receiptText += `Thank you for trusting Nutrifacts. Nourish Better. Live Healthier.\n`;

    const blob = new Blob([receiptText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Nutrifacts_Receipt_${payment.invoiceNumber}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-2xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Bar */}
        <div className="no-print bg-[#3E6553] text-white px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 shrink-0" />
            <h3 className="font-semibold text-sm truncate">
              <span className="sm:hidden">Receipt</span>
              <span className="hidden sm:inline">Payment Receipt & Tax Invoice</span>
            </h3>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePrint}
              aria-label="Print invoice"
              className="py-1 px-3 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print Invoice</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadText}
              aria-label="Download receipt"
              className="py-1 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center text-white/90 ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Invoice Printable Sheet */}
        <div ref={receiptRef} className="flex-1 overflow-y-auto p-4 sm:p-8 bg-white text-slate-800 space-y-6 text-xs print:p-0 print:space-y-4">
          
          {/* Clinic Letterhead */}
          <div className="border-b-2 border-[#3E6553] pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">🥗</span>
                <span className="text-2xl font-serif font-bold text-[#3E6553]">Nutrifacts</span>
                <span className="text-xs text-slate-500 font-medium">with dt.Anchal</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Clinical Nutrition Practice · Reg: MED-NUTRI/2018/8841
              </p>
              <p className="text-[11px] text-slate-500">
                GSTIN: 07AAECN8841M1ZF · Healthcare Exempt under Sec 12AA
              </p>
            </div>

            <div className="sm:text-right text-[11px] text-slate-600 space-y-0.5">
              <p className="font-bold text-slate-900">TAX INVOICE</p>
              <p className="font-mono"><strong>Invoice #:</strong> {payment.invoiceNumber}</p>
              <p className="font-mono"><strong>Date:</strong> {payment.createdAt}</p>
              <p className="font-mono text-emerald-800"><strong>Status:</strong> {payment.status.toUpperCase()}</p>
            </div>
          </div>

          {/* Billed To / Patient Info */}
          <div className="bg-[#FAFBF9] rounded-xl p-4 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs break-words">
            <div>
              <span className="text-[11px] text-slate-400 block">Billed To (Patient):</span>
              <p className="font-bold text-slate-900">{payment.patientName}</p>
              <p className="text-slate-600">{payment.patientPhone}</p>
              <p className="text-slate-600">{payment.patientEmail}</p>
            </div>

            <div className="sm:text-right">
              <span className="text-[11px] text-slate-400 block">Transaction Reference:</span>
              <p className="font-mono font-bold text-slate-800">{payment.transactionRef}</p>
              <p className="text-slate-600 mt-1">Payment: {payment.paymentDetails}</p>
              <p className="text-emerald-800 font-medium">Valid Through: {payment.validUntil}</p>
              {!!payment.bonusDays && (
                <p className="text-emerald-700">Includes {payment.bonusDays} bonus days (early renewal)</p>
              )}
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="py-2.5 px-3 sm:px-4 font-semibold">Service Description</th>
                  <th className="py-2.5 px-4 font-semibold text-center hidden sm:table-cell">Duration</th>
                  <th className="py-2.5 px-3 sm:px-4 font-semibold text-right">Amount (INR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-3 px-3 sm:px-4">
                    <p className="font-bold text-slate-900">{payment.packageTitle}</p>
                    {payment.goal && <p className="text-[11px] font-semibold text-emerald-800">Goal: {payment.goal}</p>}
                    <p className="text-[11px] text-slate-600 font-mono sm:hidden">Until {payment.validUntil}</p>
                    <p className="text-[11px] text-slate-500">
                      Personalized clinical diet care, scheduled consultations, and biometric tracking.
                    </p>
                  </td>
                  <td className="py-3 px-4 text-center text-slate-600 font-mono hidden sm:table-cell">
                    Until {payment.validUntil}
                  </td>
                  <td className="py-3 px-3 sm:px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap align-top">
                    ₹{payment.listPriceInr ?? payment.amountInr}.00
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="bg-slate-50/70 p-4 border-t border-slate-200 flex flex-col items-end space-y-1 text-xs">
              <div className="w-full max-w-64 flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-mono">₹{payment.listPriceInr ?? payment.amountInr}.00</span>
              </div>
              {!!payment.creditInr && (
                <div className="w-full max-w-64 flex justify-between gap-2 text-emerald-800">
                  <span>Upgrade credit (unused days):</span>
                  <span className="font-mono">− ₹{payment.creditInr}.00</span>
                </div>
              )}
              <div className="w-full max-w-64 flex justify-between text-slate-600">
                <span>Healthcare Exemption (GST 0%):</span>
                <span className="font-mono">₹0.00</span>
              </div>
              <div className="w-full max-w-64 flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-200">
                <span>Total Amount Paid:</span>
                <span className="font-mono text-[#3E6553]">₹{payment.amountInr}.00</span>
              </div>
            </div>
          </div>

          {/* Refund Notice if applicable */}
          {payment.status === 'refunded' && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs">
              <strong>Refund Notice:</strong> {payment.refundAmountInr != null ? `₹${payment.refundAmountInr} was refunded` : 'This transaction was refunded'} on {payment.refundedAt}.
              {payment.refundReason && <span className="block mt-0.5">Reason: {payment.refundReason}</span>}
            </div>
          )}

          {/* Signoff */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-xs">
            <div className="text-[11px] text-slate-500 max-w-sm">
              <p className="font-medium text-slate-700">Payment Terms:</p>
              <p>
                Fees are non-transferable. Subscriptions do not auto-renew without patient consent.
              </p>
            </div>

            <div className="text-right">
              <div className="font-serif italic text-base text-[#3E6553] font-bold">
                Anchal Dewan
              </div>
              <p className="font-semibold text-slate-800 text-[11px]">Dt. Anchal Dewan</p>
              <p className="text-[10px] text-slate-500">Founder & Chief Clinical Dietitian</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
