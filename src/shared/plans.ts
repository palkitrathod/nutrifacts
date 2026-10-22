// Plan rules shared by the My Plans screen and the server, so both always agree on the amounts.
//
// - Upgrade (to a pricier plan): starts today. The unused days of the current plan count as credit
//   against the new plan's price, so nobody pays twice for the same days.
// - Downgrade (to a cheaper plan): scheduled for when the current plan ends; nothing is lost.

export interface PlanPurchase {
  status: string;
  /** What was paid. */
  amountInr: number;
  /** The plan's full price at purchase (differs from amountInr after an upgrade credit). */
  listPriceInr?: number;
  /** YYYY-MM-DD */
  createdAt: string;
  /** YYYY-MM-DD, last day of access. */
  validUntil: string;
}

const DAY_MS = 86_400_000;
const dayNumber = (isoDate: string) => Math.floor(Date.parse(`${isoDate.slice(0, 10)}T00:00:00Z`) / DAY_MS);

/** Today as YYYY-MM-DD (UTC, the same clock on browser and server). */
export const todayIso = (now = new Date()) => now.toISOString().slice(0, 10);

export const isPlanActive = (p: PlanPurchase | undefined, today = todayIso()): p is PlanPurchase =>
  !!p && p.status === 'successful' && p.validUntil.slice(0, 10) >= today;

/** Days of access left, counting today. */
export const daysLeft = (p: PlanPurchase, today = todayIso()) => Math.max(0, dayNumber(p.validUntil) - dayNumber(today) + 1);

/** The full price of the plan a purchase was for. */
export const listPrice = (p: PlanPurchase) => p.listPriceInr ?? p.amountInr;

/**
 * Value of the days not yet used, in whole rupees (rounded down). Plans marked "credit in full"
 * (the Starter Consultation) count for everything paid while they're still running.
 */
export function unusedCredit(p: PlanPurchase, today = todayIso(), opts: { inFull?: boolean } = {}): number {
  if (!isPlanActive(p, today)) return 0;
  if (opts.inFull) return p.amountInr;
  const total = Math.max(1, dayNumber(p.validUntil) - dayNumber(p.createdAt) + 1);
  const left = Math.min(total, daysLeft(p, today));
  return Math.floor((p.amountInr * left) / total);
}

/** What an upgrade costs today. */
export function upgradeQuote(current: PlanPurchase | undefined, newPriceInr: number, today = todayIso(), opts: { inFull?: boolean } = {}) {
  const creditInr = current ? Math.min(unusedCredit(current, today, opts), newPriceInr) : 0;
  return { creditInr, amountDueInr: newPriceInr - creditInr };
}

// ── Early renewal ───────────────────────────────────────────────────────────
/** Renewing in the last days of a plan... */
export const EARLY_RENEWAL_WINDOW_DAYS = 7;
/** ...adds these free days. */
export const RENEWAL_BONUS_DAYS = 7;

export const canRenewEarly = (p: PlanPurchase | undefined, today = todayIso()): p is PlanPurchase =>
  isPlanActive(p, today) && daysLeft(p, today) <= EARLY_RENEWAL_WINDOW_DAYS;

/**
 * Last day of a new plan bought today: `validityDays` from today, or, for an early renewal, starting the
 * day after the current plan ends, plus the bonus days.
 */
export function newPlanValidUntil(validityDays: number, today = todayIso(), renewalOf?: PlanPurchase): string {
  return renewalOf ? addDays(renewalOf.validUntil, validityDays + RENEWAL_BONUS_DAYS) : addDays(today, validityDays);
}

// ── Bundles ─────────────────────────────────────────────────────────────────
/** A multi-month bundle against buying the base plan month by month. */
export function bundleSavings(bundlePriceInr: number, basePriceInr: number, months: number) {
  return { perMonthInr: Math.round(bundlePriceInr / months), savingInr: Math.max(0, basePriceInr * months - bundlePriceInr) };
}

/** 'switch' = another plan at the same price; like a downgrade, it starts when the current plan ends. */
export type PlanChange = 'current' | 'upgrade' | 'downgrade' | 'switch' | 'new';

/** How choosing a plan relates to the active one. */
export function planChange(active: (PlanPurchase & { packageId: string }) | undefined, pkg: { id: string; priceInr: number }, today = todayIso()): PlanChange {
  if (!isPlanActive(active, today)) return 'new';
  if (active.packageId === pkg.id) return 'current';
  const current = listPrice(active);
  return pkg.priceInr > current ? 'upgrade' : pkg.priceInr < current ? 'downgrade' : 'switch';
}

/** YYYY-MM-DD + n days. */
export const addDays = (isoDate: string, n: number) => new Date((dayNumber(isoDate) + n) * DAY_MS).toISOString().slice(0, 10);
