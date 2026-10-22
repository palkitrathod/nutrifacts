import { describe, expect, it } from 'vitest';
import { addDays, bundleSavings, canRenewEarly, daysLeft, isPlanActive, newPlanValidUntil, planChange, unusedCredit, upgradeQuote } from './plans';
import { gatewayFee, netAmount, suggestedRefund } from './pricing';

// ₹2499 for 2026-10-10 → 2026-11-10: 32 days of access.
const monthly = { status: 'successful', packageId: 'monthly', amountInr: 2499, createdAt: '2026-10-10', validUntil: '2026-11-10' };

describe('plans', () => {
  it('a plan runs through its last day', () => {
    expect(isPlanActive(monthly, '2026-11-10')).toBe(true);
    expect(isPlanActive(monthly, '2026-11-11')).toBe(false);
    expect(isPlanActive({ ...monthly, status: 'refunded' }, '2026-10-22')).toBe(false);
    expect(daysLeft(monthly, '2026-10-22')).toBe(20);
    expect(daysLeft(monthly, '2026-11-10')).toBe(1);
  });

  it('credits the unused days, rounded down, and nothing once ended', () => {
    expect(unusedCredit(monthly, '2026-10-10')).toBe(2499);
    expect(unusedCredit(monthly, '2026-10-22')).toBe(1561);
    expect(unusedCredit(monthly, '2026-11-11')).toBe(0);
  });

  it('an upgrade costs the new price minus the credit', () => {
    expect(upgradeQuote(monthly, 4999, '2026-10-22')).toEqual({ creditInr: 1561, amountDueInr: 3438 });
    expect(upgradeQuote(undefined, 4999, '2026-10-22')).toEqual({ creditInr: 0, amountDueInr: 4999 });
  });

  it('credit is based on what was actually paid', () => {
    const upgraded = { ...monthly, amountInr: 1000, listPriceInr: 2499 };
    expect(unusedCredit(upgraded, '2026-10-10')).toBe(1000);
  });

  it('classifies a plan choice against the current plan (by its full price)', () => {
    const today = '2026-10-22';
    expect(planChange(monthly, { id: 'monthly', priceInr: 2499 }, today)).toBe('current');
    expect(planChange(monthly, { id: 'premium', priceInr: 4999 }, today)).toBe('upgrade');
    expect(planChange(monthly, { id: 'basic', priceInr: 499 }, today)).toBe('downgrade');
    expect(planChange(monthly, { id: 'other', priceInr: 2499 }, today)).toBe('switch');
    expect(planChange({ ...monthly, amountInr: 900, listPriceInr: 2499 }, { id: 'mid', priceInr: 999 }, today)).toBe('downgrade');
    expect(planChange(monthly, { id: 'premium', priceInr: 4999 }, '2026-12-01')).toBe('new');
    expect(planChange(undefined, { id: 'basic', priceInr: 499 }, today)).toBe('new');
  });

  it('adds days across month ends', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('credits a "credit in full" plan for everything paid while it runs', () => {
    const starter = { ...monthly, amountInr: 499, validUntil: '2026-10-24' };
    expect(upgradeQuote(starter, 2499, '2026-10-20', { inFull: true })).toEqual({ creditInr: 499, amountDueInr: 2000 });
    expect(upgradeQuote(starter, 2499, '2026-10-25', { inFull: true })).toEqual({ creditInr: 0, amountDueInr: 2499 });
  });

  it('opens early renewal in the last 7 days, starting after the plan with 7 days free', () => {
    expect(canRenewEarly(monthly, '2026-11-03')).toBe(false); // 8 days left
    expect(canRenewEarly(monthly, '2026-11-04')).toBe(true); // 7 days left
    expect(canRenewEarly(monthly, '2026-11-11')).toBe(false); // ended
    expect(newPlanValidUntil(30, '2026-11-05', monthly)).toBe('2026-12-17');
    expect(newPlanValidUntil(30, '2026-11-05')).toBe('2026-12-05');
  });

  it('shows a bundle per month and its saving', () => {
    expect(bundleSavings(5999, 2499, 3)).toEqual({ perMonthInr: 2000, savingInr: 1498 });
  });
});

describe('pricing', () => {
  it('works out the gateway fee (2% + 18% GST on it) and what the clinic keeps', () => {
    expect(gatewayFee(2499)).toBe(59);
    expect(netAmount(2499)).toBe(2440);
    expect(netAmount(5999)).toBe(5857);
  });

  it('suggests a refund: paid − consultations used − processing charges, never negative', () => {
    expect(suggestedRefund(2499, 500)).toEqual({ processingInr: 59, consultationsUsedInr: 500, refundInr: 1940 });
    expect(suggestedRefund(499, 500).refundInr).toBe(0);
  });
});
