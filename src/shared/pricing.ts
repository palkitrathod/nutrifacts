// The clinic's side of a payment: what the payment gateway keeps, and what a fair refund is.

/** Typical Indian gateway pricing (Razorpay / Cashfree standard plans): 2% per payment + 18% GST on that fee. */
export const GATEWAY_FEE_RATE = 0.02;
export const GST_ON_FEE = 0.18;

/** The gateway's charge on a payment, in rupees (it is not returned on refunds). */
export const gatewayFee = (amountInr: number) => Math.round(amountInr * GATEWAY_FEE_RATE * (1 + GST_ON_FEE));

/** What reaches the clinic. */
export const netAmount = (amountInr: number) => amountInr - gatewayFee(amountInr);

/** The refund promise applies within this many days of purchase. */
export const REFUND_PROMISE_DAYS = 7;

/**
 * The 7-day promise: everything paid, minus consultations already used (at their fees) and the payment
 * processing charges the gateway keeps. Never negative.
 */
export function suggestedRefund(paidInr: number, consultationsUsedInr: number) {
  const processingInr = gatewayFee(paidInr);
  return { processingInr, consultationsUsedInr, refundInr: Math.max(0, paidInr - consultationsUsedInr - processingInr) };
}
