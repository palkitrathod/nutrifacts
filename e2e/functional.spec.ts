import { expect, test as base, type APIRequestContext, type Browser, type Locator, type Page } from '@playwright/test';
import { verifyViaApi } from './mail';

/**
 * Functional end-to-end tests of the signed-in app (patient + dietitian journeys).
 * Run with: npx playwright test -c playwright.functional.config.ts
 *
 * Tests marked test.fail() document confirmed app bugs (see the `// Regression test (fixed):` comment on each);
 * they pass while the bug exists and will start failing once it is fixed.
 */

const DEMO_PASSWORD = 'Demo@1234';
const PATIENT_PASSWORD = 'Healthy123';
const DIETITIAN = 'anchaldewan380@gmail.com';
const PRIYA = { email: 'priya.sharma@example.com', id: 'patient-priya', name: 'Priya Sharma' };


const letters = (n: number) => Array.from({ length: n }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join('');
const uniqueEmail = (tag: string) => `e2e.fn.${tag}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`;
const today = () => new Date().toISOString().split('T')[0];

// ── Global guard: page errors, console errors, failed data calls, sync-error banner ─────────────

class Guard {
  problems: string[] = [];
  pages: Page[] = [];
  private allowed: RegExp[] = [];

  /** Expected failures for this test (e.g. a deliberate server rejection). */
  allow(...patterns: RegExp[]) {
    this.allowed.push(...patterns);
  }

  unexpected() {
    return this.problems.filter((p) => !this.allowed.some((re) => re.test(p)));
  }

  watch(page: Page, label = 'page') {
    this.pages.push(page);
    page.on('pageerror', (e) => this.problems.push(`[${label}] pageerror: ${e.message}`));
    page.on('console', (m) => {
      // The deliberate 401 from the session check on a signed-out page load is expected.
      if (m.type() === 'error' && !/401/.test(m.text())) this.problems.push(`[${label}] console: ${m.text()}`);
    });
    page.on('response', (r) => {
      if (r.url().includes('/api/data') && r.status() >= 400) this.problems.push(`[${label}] ${r.status()} ${r.request().method()} ${r.url()}`);
    });
    return page;
  }

  /** Call at the end of each test: no red sync banner on any open page, and nothing went wrong. */
  async check() {
    for (const p of this.pages) {
      if (!p.isClosed()) await expect(p.getByRole('alert'), 'no red sync-error banner').toHaveCount(0);
    }
    expect(this.unexpected(), 'page errors / console errors / failed /api/data calls').toEqual([]);
  }
}

const test = base.extend<{ guard: Guard }>({
  guard: async ({}, use) => {
    const g = new Guard();
    await use(g);
    expect(g.unexpected(), 'page errors / console errors / failed /api/data calls').toEqual([]);
  },
  page: async ({ page, guard }, use) => {
    guard.watch(page, 'main');
    await use(page);
  },
});

// ── Helpers ─────────────────────────────────────────────────────────────────

interface Account {
  email: string;
  password: string;
  name: string;
  id: string;
}

/** Signs up a brand-new patient via the API (the auth pages are out of scope here) and opens the app. */
async function newPatient(page: Page, tag = 'p'): Promise<Account> {
  const name = `Meera ${letters(6).replace(/^./, (c) => c.toUpperCase())}`;
  const email = uniqueEmail(tag);
  const res = await page.request.post('/api/auth/signup', {
    data: { name, email, phone: '9876543210', password: PATIENT_PASSWORD, acceptedTerms: true },
  });
  expect(res.status(), await res.text()).toBe(201);
  const { user } = await res.json();
  await verifyViaApi(page.request, email);
  await page.goto('/app');
  await expect(page.getByText(`Welcome back, ${name}`)).toBeVisible();
  // The clinical profile is created on first sign-in and saved by the auto-save.
  await expect.poll(async () => (await appData(page)).patients.length).toBe(1);
  return { email, password: PATIENT_PASSWORD, name, id: user.id };
}

async function signIn(page: Page, email: string, password = DEMO_PASSWORD) {
  const res = await page.request.post('/api/auth/signin', { data: { email, password } });
  expect(res.status()).toBe(200);
  await page.goto('/app');
  await expect(page.getByTitle(/Logged in as/)).toBeVisible();
}

/** A fresh browser profile (another device / another person), signed in and watched by the guard. */
async function openAs(browser: Browser, guard: Guard, email: string, password = DEMO_PASSWORD, label = email) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = guard.watch(await ctx.newPage(), label);
  await signIn(p, email, password);
  return p;
}

async function apiAs(playwright: { request: { newContext: (o: { baseURL?: string }) => Promise<APIRequestContext> } }, baseURL: string | undefined, email: string, password = DEMO_PASSWORD) {
  const ctx = await playwright.request.newContext({ baseURL });
  const res = await ctx.post('/api/auth/signin', { data: { email, password } });
  expect(res.status()).toBe(200);
  return ctx;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Data = Record<string, any>;
const appData = async (page: Page | APIRequestContext): Promise<Data> => {
  const req = 'request' in page ? page.request : page;
  const res = await req.get('/api/data');
  expect(res.status()).toBe(200);
  return res.json();
};

/** Opens a section from the main navigation (top bar on wide screens, tab bar on phones). */
const tab = (page: Page, label: string) => page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: label, exact: true }).click();
/** The full-screen overlay of a modal, found by a piece of its text. */
const modal = (page: Page, text: string | RegExp) => page.locator('div.fixed.inset-0').filter({ hasText: text });

/** Pays in the (demo) checkout by UPI, then closes the receipt. */
async function payByUpi(page: Page, pay: string | RegExp) {
  const checkout = modal(page, 'Secure Payment Gateway');
  await checkout.getByRole('textbox').first().fill('meera@okhdfcbank');
  await checkout.getByRole('button', { name: pay }).click();
  await expect(checkout.getByText('Payment Successful!')).toBeVisible();
  await checkout.getByRole('button', { name: /Go to My Diet & Schedule/ }).click();
  await modal(page, 'Payment Receipt & Tax Invoice').locator('button').nth(2).click();
}
const nextSave = (page: Page) =>
  page.waitForResponse((r) => r.url().endsWith('/api/data/batch') && r.request().method() === 'POST');
/** Enters a UPI id (checkout has no pre-filled sample details) — no-op for other methods. */
async function fillUpi(checkout: Locator) {
  const upi = checkout.getByPlaceholder('mobilenumber@upi');
  if (await upi.isVisible()) await upi.fill('patient@okaxis');
}
const bell = (page: Page) => page.getByRole('button', { name: 'View notifications' });
const unreadBadge = (page: Page) => bell(page).locator('span');
/** Nearest ancestor <div> of `inner` whose class list contains `cls`. */
const ancestor = (inner: Locator, cls: string) => inner.locator(`xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' ${cls} ')][1]`);

async function badgeCount(page: Page) {
  if ((await unreadBadge(page).count()) === 0) return 0;
  return Number(await unreadBadge(page).innerText());
}

// ═══════════════════════════════════════════════════════════════════════════
// PATIENT JOURNEY
// ═══════════════════════════════════════════════════════════════════════════

test.describe('patient', () => {
  test('1. book an online consultation: confirmed, meeting link, notification, persists', async ({ page, guard }) => {
    const me = await newPatient(page, 'book');

    await page.getByRole('button', { name: 'Book Consultation' }).first().click();
    const book = modal(page, 'Book Consultation with Dt. Anchal');
    await expect(book).toBeVisible();
    await book.getByRole('button', { name: /Online Telehealth/ }).click();
    const date = new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0];
    await book.locator('input[type="date"]').fill(date);
    await book.locator('select').nth(1).selectOption('04:00 PM – 04:30 PM');
    await book.locator('textarea').fill('E2E: irregular cycles, want PCOS plan');

    // No plan yet: the First Consultation is paid online first (₹499), and booked once paid.
    await book.getByRole('button', { name: /Continue to Pay ₹499/ }).click();
    await expect(book).toBeHidden({ timeout: 5000 });
    await payByUpi(page, 'Pay ₹499 & Activate Package');

    // Server has it: confirmed, video link, notification.
    await expect.poll(async () => (await appData(page)).appointments.length).toBe(1);
    const data = await appData(page);
    expect(data.payments.filter((p: Data) => p.patientId === me.id)).toEqual([expect.objectContaining({ packageId: 'pkg-basic-consultation', amountInr: 499 })]);
    const appt = data.appointments[0];
    expect(appt).toMatchObject({ patientId: me.id, status: 'confirmed', consultationType: 'online_video', date, timeSlot: '04:00 PM – 04:30 PM' });
    expect(appt.meetingLink).toMatch(/^https:\/\/meet\.google\.com\//);
    expect(data.notifications.some((n: Data) => n.title === 'Consultation Scheduled!' && n.message.includes(date))).toBe(true);

    // In the UI (after a reload): the bell has it, and it leads to the appointment with a Join link.
    await page.reload();
    await bell(page).click();
    await modal(page, 'Notifications & Reminders').getByText('Consultation Scheduled!').click();
    await expect(page.getByRole('heading', { name: 'Diet Consultations & Follow-ups' })).toBeVisible();
    await expect(page.getByText(date)).toBeVisible();
    await expect(page.getByText('confirmed', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /Join Video Call/ })).toHaveAttribute('href', appt.meetingLink);
    await guard.check();
  });

  test('2. buy a package: receipt, My Purchases, program updated, dietitian notified', async ({ page, guard, playwright, baseURL }) => {
    const me = await newPatient(page, 'buy');
    await tab(page, 'My Plans');
    await expect(page.getByRole('heading', { name: 'Your Nutrition Care Plan' })).toBeVisible();
    await expect(page.getByText('No plan yet.')).toBeVisible();

    const card = ancestor(page.getByRole('heading', { name: 'Personalised Diet Plan', exact: true }), 'rounded-2xl');
    await card.getByRole('button', { name: /Choose this plan/ }).click();
    const checkout = modal(page, 'Secure Payment Gateway');
    await expect(checkout.getByRole('heading', { name: 'Personalised Diet Plan' })).toBeVisible();
    await checkout.getByRole('button', { name: /Net Banking/ }).click();
    await checkout.locator('select').selectOption('ICICI Bank');

    const saved = nextSave(page);
    await checkout.getByRole('button', { name: 'Pay ₹999 & Activate Package' }).click();
    await expect(checkout.getByText('Payment Successful!')).toBeVisible();
    expect((await saved).status()).toBe(200);
    await expect(checkout.getByText('₹999', { exact: true })).toBeVisible();
    await checkout.getByRole('button', { name: /Go to My Diet & Schedule/ }).click();

    const receipt = modal(page, 'Payment Receipt & Tax Invoice');
    await expect(receipt).toBeVisible();
    await expect(receipt).toContainText('Personalised Diet Plan');
    await expect(receipt).toContainText('₹999.00');
    await expect(receipt).toContainText(me.name);
    await expect(receipt).toContainText('Net Banking (ICICI Bank)');
    await receipt.locator('button').nth(2).click(); // close (X)
    await expect(receipt).toBeHidden();

    await expect(page.getByText('Current plan: Personalised Diet Plan')).toBeVisible();
    await page.getByRole('button', { name: 'My Purchases' }).click();
    const row = ancestor(page.getByText('Personalised Diet Plan', { exact: true }).last(), 'justify-between');
    await expect(row).toContainText('₹999');
    await expect(row).toContainText('successful');

    // Persisted, and the profile's program changed.
    await page.reload();
    await tab(page, 'My Profile');
    await expect(page.getByText('Personalised Diet Plan').first()).toBeVisible();
    const data = await appData(page);
    expect(data.payments).toHaveLength(1);
    expect(data.payments[0]).toMatchObject({ packageId: 'pkg-personalized-diet-plan', amountInr: 999, status: 'successful', patientId: me.id });
    expect(data.patients[0].assignedProgram).toBe('Personalised Diet Plan');

    // The dietitian got the order notification.
    const dt = await apiAs(playwright, baseURL, DIETITIAN);
    const dtData = await appData(dt);
    expect(dtData.notifications.some((n: Data) => n.title === 'New Package Order Received' && n.message.includes(me.name) && n.message.includes('999'))).toBe(true);
    await dt.dispose();
    await guard.check();
  });

  test('2b. upgrading credits the unused days, and the new plan is the current one after reload', async ({ page, guard }) => {
    // Regression test (fixed): getActivePackage() returns payments[0]; locally new payments are prepended, but GET /api/data
    // returns records in insertion order (oldest first), so after a reload the OLDEST package shows as active.
    // NutritionContext.tsx:695-698 (and no ordering in server/data.ts loadFor / dataApi).
    await newPatient(page, 'buy2');
    await tab(page, 'My Plans');
    // ₹999 plan bought today, then upgraded the same day: all of it is credited, ₹2499 − ₹999 = ₹1500.
    for (const [title, button, pay] of [
      ['Personalised Diet Plan', /Choose this plan/, 'Pay ₹999 & Activate Package'],
      ['Monthly Nutrition Care', /Upgrade · pay ₹1,500/, 'Pay ₹1500 & Upgrade Plan'],
    ] as const) {
      const card = title === 'Monthly Nutrition Care' ? page.getByRole('article', { name: 'Nutrition Care', exact: true }) : ancestor(page.getByRole('heading', { name: title, exact: true }), 'rounded-2xl');
      if (title === 'Monthly Nutrition Care') await card.getByRole('radio', { name: /^1 month,/ }).click();
      await card.getByRole('button', { name: button }).click();
      const checkout = modal(page, 'Secure Payment Gateway');
      const saved = nextSave(page);
      await fillUpi(checkout);
      if (title === 'Monthly Nutrition Care') await expect(checkout).toContainText('Credit for unused days of Personalised Diet Plan');
      await checkout.getByRole('button', { name: pay }).click();
      await expect(checkout.getByText('Payment Successful!')).toBeVisible();
      await saved;
      await checkout.getByRole('button', { name: /Go to My Diet & Schedule/ }).click();
      await modal(page, 'Payment Receipt & Tax Invoice').locator('button').nth(2).click();
    }
    await expect(page.getByText('Current plan: Monthly Nutrition Care')).toBeVisible();
    await page.reload();
    await tab(page, 'My Plans');
    await expect(page.getByText('Current plan: Monthly Nutrition Care')).toBeVisible({ timeout: 3000 });
    const upgrade = (await appData(page)).payments.find((p: Data) => p.packageId === 'pkg-monthly-nutrition-care');
    expect(upgrade).toMatchObject({ amountInr: 1500, listPriceInr: 2499, creditInr: 999 });
    await guard.check();
  });

  test('3. track: record a weight, current weight updates and persists', async ({ page, guard }) => {
    await newPatient(page, 'weight');
    await tab(page, 'Track');
    await page.getByRole('button', { name: 'Record New Weight' }).click();
    const form = modal(page, 'Record Fasting Weight');
    await form.locator('input[type="number"]').first().fill('74.6');
    const saved = nextSave(page);
    await form.getByRole('button', { name: 'Save Weight Log' }).click();
    expect((await saved).status()).toBe(200);

    const currentKpi = ancestor(page.getByText('Current Weight', { exact: true }), 'rounded-xl');
    await expect(currentKpi).toContainText('74.6');

    await page.reload();
    await expect(page.getByText('74.6 kg recorded')).toBeVisible(); // Home quick-action tile
    await tab(page, 'Track');
    await expect(ancestor(page.getByText('Current Weight', { exact: true }), 'rounded-xl')).toContainText('74.6');
    const data = await appData(page);
    expect(data.weightRecords.map((w: Data) => w.weightKg)).toEqual([74.6]);
    expect(data.patients[0].currentWeightKg).toBe(74.6);
    await guard.check();
  });

  test('4. diet chart (Priya): record a consumed and a skipped meal; skipping notifies the dietitian', async ({ page, guard, playwright, baseURL }) => {
    await signIn(page, PRIYA.email);
    const chart = (await appData(page)).dietCharts[0];
    const meals: Data[] = chart.weeklyPlan?.Tuesday ?? chart.meals;
    await tab(page, 'Diet Chart');
    await page.getByRole('button', { name: /^Tuesday/ }).click();

    const mealCard = (title: string) => ancestor(page.getByRole('heading', { name: title, exact: true }), 'p-4');

    // Consumed in full.
    await mealCard(meals[0].title).getByRole('button', { name: /Record Intake|Update Log/ }).click();
    let logger = modal(page, 'Did you follow this prescribed meal?');
    await logger.getByRole('button', { name: /100% Full/ }).click();
    let saved = nextSave(page);
    await logger.getByRole('button', { name: 'Save Food Record' }).click();
    expect((await saved).status()).toBe(200);
    await expect(mealCard(meals[0].title).getByText('Followed (100%)')).toBeVisible();

    // Skipped, with a reason.
    await mealCard(meals[1].title).getByRole('button', { name: /Record Intake|Update Log/ }).click();
    logger = modal(page, 'Did you follow this prescribed meal?');
    await logger.getByRole('button', { name: /Skipped/ }).click();
    await logger.locator('select').selectOption('Traveling or commuting');
    saved = nextSave(page);
    await logger.getByRole('button', { name: 'Save Food Record' }).click();
    expect((await saved).status()).toBe(200);
    await expect(mealCard(meals[1].title).getByText('Skipped Meal')).toBeVisible();

    // Persists.
    await page.reload();
    await tab(page, 'Diet Chart');
    await page.getByRole('button', { name: /^Tuesday/ }).click();
    await expect(mealCard(meals[0].title).getByText('Followed (100%)')).toBeVisible();
    await expect(mealCard(meals[1].title).getByText('Skipped Meal')).toBeVisible();

    // The dietitian is alerted about the skip.
    const dt = await apiAs(playwright, baseURL, DIETITIAN);
    const dtData = await appData(dt);
    expect(
      dtData.notifications.some((n: Data) => n.title === 'Meal Skipped: Priya Sharma' && n.message.includes('Traveling or commuting'))
    ).toBe(true);
    expect(dtData.adherenceRecords.some((r: Data) => r.patientId === PRIYA.id && r.dayOfWeek === 'Tuesday' && r.status === 'skipped')).toBe(true);
    await dt.dispose();
    await guard.check();
  });

  test('4b. updating a meal log keeps the latest status after reload', async ({ page, guard }) => {
    // Regression test (fixed): "Update Log" appends a new adherence record; the screen shows the first match
    // (adherenceHistory.find). Locally the newest is first, but after a reload the server returns the
    // oldest first, so the OLD status reappears. DietChartScreen.tsx:454-456 + NutritionContext.tsx:709.
    await signIn(page, PRIYA.email);
    const chart = (await appData(page)).dietCharts[0];
    const meal: Data = (chart.weeklyPlan?.Wednesday ?? chart.meals)[0];
    await tab(page, 'Diet Chart');
    await page.getByRole('button', { name: /^Wednesday/ }).click();
    const card = ancestor(page.getByRole('heading', { name: meal.title, exact: true }), 'p-4');

    await card.getByRole('button', { name: /Record Intake|Update Log/ }).click();
    let saved = nextSave(page);
    await modal(page, 'Did you follow this prescribed meal?').getByRole('button', { name: 'Save Food Record' }).click();
    await saved;
    await card.getByRole('button', { name: 'Update Log' }).click();
    const logger = modal(page, 'Did you follow this prescribed meal?');
    await logger.getByRole('button', { name: /Skipped/ }).click();
    saved = nextSave(page);
    await logger.getByRole('button', { name: 'Save Food Record' }).click();
    await saved;
    await expect(card.getByText('Skipped Meal')).toBeVisible();

    await page.reload();
    await tab(page, 'Diet Chart');
    await page.getByRole('button', { name: /^Wednesday/ }).click();
    await expect(card.getByText('Skipped Meal')).toBeVisible({ timeout: 3000 });
    await guard.check();
  });

  test('5. hydration tracker: + / − capped at 0 and 16, persists', async ({ page, guard }) => {
    await newPatient(page, 'water');
    const count = page.locator('span.text-3xl.tabular-nums');
    const minus = page.getByTitle('Remove 1 glass');
    const plus = page.getByTitle('Add 1 glass');

    await expect(count).toHaveText('0');
    await expect(minus).toBeDisabled();

    for (let i = 0; i < 18; i++) await plus.click();
    await expect(count).toHaveText('16');
    await minus.click();
    await expect(count).toHaveText('15');
    for (let i = 0; i < 3; i++) await plus.click();
    await expect(count).toHaveText('16');

    await expect.poll(async () => (Object.values((await appData(page)).dailyTrackers)[0] as Data | undefined)?.waterGlasses).toBe(16);
    await page.reload();
    await expect(page.locator('span.text-3xl.tabular-nums')).toHaveText('16');
    await guard.check();
  });

  test('5b. hydration: first "+" on a new account continues from the count shown', async ({ page, guard }) => {
    // Regression test (fixed): with no tracker yet, Home shows a made-up 6 glasses (HomeScreen.tsx:57 fallback `waterGlasses: 6`)
    // but updateWaterIntake starts from 0 (NutritionContext.tsx:499-506), so tapping + jumps 6 -> 1.
    await newPatient(page, 'water2');
    const count = page.locator('span.text-3xl.tabular-nums');
    const shown = Number(await count.innerText());
    await page.getByTitle('Add 1 glass').click();
    await expect(count).toHaveText(String(shown + 1), { timeout: 2000 });
    await guard.check();
  });

  test('5c. hydration: yesterday\'s glasses do not carry over to today', async ({ page, guard }) => {
    // Regression test (fixed): the tracker stores a date but it is never compared with today (HomeScreen.tsx:55,
    // NutritionContext.tsx:499), so the count never resets for a new day.
    const me = await newPatient(page, 'water3');
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const res = await page.request.post('/api/data/batch', {
      data: { ops: [{ collection: 'dailyTrackers', id: me.id, data: { date: yesterday, waterGlasses: 10, mealsChecked: {}, activityMinutes: 0 } }] },
    });
    expect(res.status()).toBe(200);
    await page.reload();
    await expect(page.locator('span.text-3xl.tabular-nums')).toHaveText('0', { timeout: 3000 });
    await guard.check();
  });

  test('6. notifications: reading one / all lowers the unread badge, and it persists', async ({ page, guard }) => {
    await signIn(page, PRIYA.email);
    const start = await badgeCount(page);
    expect(start).toBeGreaterThan(0);

    await bell(page).click();
    const panel = modal(page, 'Notifications & Reminders');
    const unreadItems = panel.locator('div.cursor-pointer:has(span.bg-emerald-600)');
    await expect(unreadItems).toHaveCount(start);
    let saved = nextSave(page);
    await unreadItems.first().click();
    expect((await saved).status()).toBe(200);
    await expect(unreadBadge(page)).toHaveText(String(start - 1));

    await page.reload();
    expect(await badgeCount(page)).toBe(start - 1);

    if (start > 1) {
      await bell(page).click();
      saved = nextSave(page);
      await modal(page, 'Notifications & Reminders').getByRole('button', { name: 'Mark all read' }).click();
      expect((await saved).status()).toBe(200);
      await expect(unreadBadge(page)).toHaveCount(0);
      await page.reload();
      await expect(page.getByTitle(/Logged in as/)).toBeVisible();
      await expect(unreadBadge(page)).toHaveCount(0);
    }
    const data = await appData(page);
    expect(data.notifications.filter((n: Data) => n.userId === PRIYA.id && !n.read)).toHaveLength(0);
    await guard.check();
  });

  test('7. profile: patient edits health details; they save and persist', async ({ page, guard }) => {
    await newPatient(page, 'profile');
    await tab(page, 'My Profile');
    await page.getByRole('button', { name: 'Edit profile' }).click();
    const form = page.getByRole('form', { name: 'Edit profile' });
    // Age is worked out from the date of birth: born 1 January, 34 years ago → 34 all year.
    const year = new Date().getFullYear() - 34;
    await form.getByLabel('Date of birth').fill(`${year}-01-01`);
    await form.getByLabel('Height (cm)').fill('170');
    await form.getByLabel('Current weight (kg)').fill('80.5');
    await form.getByLabel('Target weight (kg)').fill('70');
    await form.getByLabel('Dietary preference').selectOption('Vegan');
    await form.getByLabel('Daily water goal (litres)').fill('2.5');
    await form.getByLabel('Medical conditions (comma-separated)').fill('PCOS, Hypothyroidism');
    await form.getByLabel('Food allergies or intolerances').fill('Peanuts');
    const saved = nextSave(page);
    await form.getByRole('button', { name: 'Save changes' }).click();
    expect((await saved).status()).toBe(200);

    const verify = async () => {
      await expect(page.getByText('80.5 kg', { exact: true })).toBeVisible();
      await expect(page.getByText('70 kg', { exact: true })).toBeVisible();
      await expect(page.getByText('170 cm', { exact: true })).toBeVisible();
      await expect(page.getByText('Vegan', { exact: true })).toBeVisible();
      await expect(page.getByText('Hypothyroidism', { exact: true })).toBeVisible();
      await expect(page.getByText('Peanuts', { exact: true })).toBeVisible();
    };
    await verify();
    await page.reload();
    await expect(page.getByText('Goal: 2.5 Litres')).toBeVisible(); // Home hydration card uses the new goal
    await expect(page.getByText('/ 10 glasses')).toBeVisible();
    await tab(page, 'My Profile');
    await verify();
    const p = (await appData(page)).patients[0];
    expect(p).toMatchObject({ age: 34, dateOfBirth: `${year}-01-01`, heightCm: 170, currentWeightKg: 80.5, targetWeightKg: 70, dietaryPreference: 'Vegan', waterGoalLitres: 2.5, medicalConditions: ['PCOS', 'Hypothyroidism'], allergies: ['Peanuts'] });
    await guard.check();
  });

  test('7b. profile: a new patient\'s edit form is not pre-filled with made-up biometrics', async ({ page, guard }) => {
    // Regression test (fixed): for a patient with no data yet, the edit form is pre-filled with invented values
    // (age 28, height 165, weight 68, target 58 — ProfileScreen.tsx:103-110), so changing only e.g.
    // allergies and saving writes those fake numbers into the clinical record. The header also shows " kg".
    await newPatient(page, 'profile2');
    await tab(page, 'My Profile');
    await page.getByRole('button', { name: 'Edit profile' }).click();
    const form = page.getByRole('form', { name: 'Edit profile' });
    await expect(form.getByLabel('Date of birth')).toHaveValue('', { timeout: 2000 });
    await expect(form.getByLabel('Height (cm)')).toHaveValue('');
    await expect(form.getByLabel('Current weight (kg)')).toHaveValue('');
    await guard.check();
  });

  test('8. diet chart PDF/print modal opens, prints and downloads without errors', async ({ page, guard }) => {
    await page.addInitScript(() => {
      (window as unknown as { __printed: number }).__printed = 0;
      window.print = () => {
        (window as unknown as { __printed: number }).__printed++;
      };
    });
    await signIn(page, PRIYA.email);
    await tab(page, 'Diet Chart');
    await page.getByRole('button', { name: /View & Download PDF/ }).click();
    const pdf = modal(page, 'Official Clinical Diet Chart (PDF Preview)');
    await expect(pdf).toBeVisible();
    await expect(pdf).toContainText('Priya Sharma');
    await expect(pdf).toContainText('Daily Calorie Target');

    await pdf.getByRole('button', { name: 'Print or save as PDF' }).click();
    expect(await page.evaluate(() => (window as unknown as { __printed: number }).__printed)).toBe(1);

    const download = page.waitForEvent('download');
    await pdf.getByRole('button', { name: 'Download diet chart' }).click();
    expect((await download).suggestedFilename()).toMatch(/^Nutrifacts_DietChart_Priya_Sharma_v.+\.txt$/);

    await pdf.locator('button').nth(2).click();
    await expect(pdf).toBeHidden();

    // Same modal from the Home "Print / Save PDF" link.
    await tab(page, 'Home');
    await page.getByRole('button', { name: 'Print / Save PDF' }).click();
    await expect(modal(page, 'Official Clinical Diet Chart (PDF Preview)')).toBeVisible();
    await guard.check();
  });

  test('8b. Home "Print / Save PDF" is not offered to a patient without a chart', async ({ page, guard }) => {
    // Regression test (fixed): the link is always shown, but App.tsx:153 only renders the modal when a chart exists, so for a
    // new patient the click silently does nothing (HomeScreen.tsx:390-396).
    await newPatient(page, 'nochart');
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Print / Save PDF' })).toHaveCount(0);
    await guard.check();
  });

  test('booking from a service card pre-selects that service', async ({ page, guard }) => {
    // Regression test (fixed): BookAppointmentModal is always mounted and used to copy `preselectedService` into state
    // only once, so the service chosen on Home was ignored. Medical programs start with a First Consultation booking.
    await newPatient(page, 'svc');
    await page.getByRole('tab', { name: /^Medical Nutrition Support/ }).click();
    await page.getByRole('article', { name: 'Oncology Nutrition Support' }).getByRole('button', { name: /Details/ }).click();
    await page.getByRole('dialog', { name: 'Oncology Nutrition Support' }).getByRole('button', { name: 'Book first consultation' }).click();
    const book = modal(page, 'Book Consultation with Dt. Anchal');
    await expect(book.locator('select').first()).toHaveValue('Oncology Nutrition Support', { timeout: 2000 });
    await guard.check();
  });

  test('a condition program is chosen and paid online for the picked length', async ({ page, guard }) => {
    await newPatient(page, 'prog');
    await page.getByRole('tab', { name: /^Lifestyle Conditions/ }).click();
    const card = page.getByRole('article', { name: 'Lifestyle Diseases' });
    await card.getByRole('radio', { name: /^6 months/ }).click();
    await card.getByRole('button', { name: /^Choose · ₹/ }).click();
    await expect(modal(page, 'Secure Payment Gateway')).toContainText('Lifestyle Diseases (6 months)');
    await payByUpi(page, /^Pay ₹[\d,]+ & Activate Package$/);
    await expect.poll(async () => (await appData(page)).payments.map((p: Data) => p.packageId)).toContain('prog-lifestyle-diseases-6m');
    await guard.check();
  });

  test('second booking in the same session defaults to the follow-up, included in the plan', async ({ page, guard }) => {
    // Regression test (fixed): the first/follow-up default used to be computed once when the modal mounted,
    // so after a first booking the next one still defaulted to the first consultation.
    await newPatient(page, 'book2');
    await page.getByRole('button', { name: 'Book Consultation' }).first().click();
    let book = modal(page, 'Book Consultation with Dt. Anchal');
    await expect(book.getByRole('button', { name: /Continue to Pay ₹499/ })).toBeVisible();
    // Without paying, a follow-up is ₹300.
    await book.getByRole('button', { name: /Follow-up Session/ }).click();
    await expect(book.getByRole('button', { name: /Payable: ₹300/ })).toBeVisible();
    await book.getByRole('button', { name: /First Consultation/ }).click();
    await book.getByRole('button', { name: /Continue to Pay ₹499/ }).click();
    await payByUpi(page, 'Pay ₹499 & Activate Package');
    await expect.poll(async () => (await appData(page)).appointments.length).toBe(1);
    await page.getByRole('button', { name: 'Book Consultation' }).first().click();
    book = modal(page, 'Book Consultation with Dt. Anchal');
    await expect(book.getByRole('button', { name: /Confirm Booking \(Included in your plan\)/ })).toBeVisible({ timeout: 2000 });
    await guard.check();
  });

  test('top navigation: My Plans and My Profile open their pages', async ({ page, guard }) => {
    await signIn(page, PRIYA.email);
    await page.locator('header nav').getByRole('button', { name: 'My Plans' }).click();
    await expect(page.getByRole('heading', { name: 'Your Nutrition Care Plan' })).toBeVisible({ timeout: 2000 });
    await page.locator('header nav').getByRole('button', { name: 'My Profile' }).click();
    await expect(page.getByRole('button', { name: 'Edit profile' })).toBeVisible({ timeout: 2000 });
    await guard.check();
  });

  test('a purchase is not reported as successful when the server rejects it (price changed meanwhile)', async ({ page, guard, playwright, baseURL }) => {
    // Regression test (fixed): CheckoutPaymentModal shows "Payment Successful!" and a receipt purely from local state
    // (CheckoutPaymentModal.tsx:58-62, NutritionContext.tsx:569-635). If the dietitian changed the price after
    // the patient loaded the app, the server rejects the payment ("The amount does not match the current
    // price.") but the patient has already been told the payment succeeded.
    await newPatient(page, 'stale');
    await tab(page, 'My Plans');
    const dt = await apiAs(playwright, baseURL, DIETITIAN);
    const pkg = (await appData(dt)).packages.find((p: Data) => p.id === 'pkg-basic-consultation');
    await dt.post('/api/data/batch', { data: { ops: [{ collection: 'packages', id: pkg.id, data: { ...pkg, priceInr: pkg.priceInr + 50 } }] } });
    try {
      await ancestor(page.getByRole('heading', { name: 'First Consultation', exact: true }), 'rounded-2xl').getByRole('button', { name: /Choose this plan/ }).click();
      const checkout = modal(page, 'Secure Payment Gateway');
      await fillUpi(checkout);
      guard.allow(/400 POST .*\/api\/data\/batch/, /status of 400/);
      await checkout.getByRole('button', { name: /^Pay ₹/ }).click();
      await expect(checkout.getByRole('alert')).toContainText('The amount does not match the current price');
      await expect(page.getByText('Payment Successful!')).toHaveCount(0);
      // The modal now shows the current price, so a retry charges what the patient sees.
      await expect(checkout.getByRole('button', { name: `Pay ₹${pkg.priceInr + 50} & Activate Package` })).toBeVisible();
    } finally {
      await dt.post('/api/data/batch', { data: { ops: [{ collection: 'packages', id: pkg.id, data: pkg }] } });
      await dt.dispose();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DIETITIAN JOURNEY
// ═══════════════════════════════════════════════════════════════════════════

test.describe('dietitian', () => {
  test('9. sees all patients including a newly signed-up one, and can select them', async ({ page, guard, browser }) => {
    const ctx = await browser.newContext();
    const patientPage = guard.watch(await ctx.newPage(), 'patient');
    const me = await newPatient(patientPage, 'roster');
    await ctx.close();

    await signIn(page, DIETITIAN);
    await tab(page, 'Admin');
    for (const name of ['Priya Sharma', 'Rohan Verma', 'Kavita Mehta', me.name]) {
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
    }
    // Select the new patient for diet planning.
    const row = ancestor(page.getByText(me.name, { exact: true }).first(), 'p-5');
    await row.getByRole('button', { name: 'Create Chart' }).click();
    await expect(page.locator('select').first()).toHaveValue(me.id);
    await expect(page.getByRole('heading', { name: 'No Diet Chart Available' })).toBeVisible();
    // Progress screen follows the selection.
    await tab(page, 'Progress');
    await expect(page.getByText(`Reviewing body weight metrics for ${me.name}`)).toBeVisible();
    // And can switch to another patient.
    await page.locator('select').first().selectOption(PRIYA.id);
    await expect(page.getByText('Reviewing body weight metrics for Priya Sharma')).toBeVisible();
    await guard.check();
  });

  test('10a. edits Priya\'s diet chart; Priya sees it after reload', async ({ page, guard, browser }) => {
    await signIn(page, DIETITIAN);
    await tab(page, 'Diet Plans');
    await page.locator('select').first().selectOption(PRIYA.id);
    await page.getByRole('button', { name: 'Edit Plan Details' }).click();
    const newTitle = `PCOS Phase 3 E2E ${letters(5)}`;
    await page.locator('input[type="text"]').first().fill(newTitle);
    await page.locator('input[type="number"]').first().fill('1650');
    const saved = nextSave(page);
    await page.getByRole('button', { name: 'Save Plan Updates' }).click();
    expect((await saved).status()).toBe(200);
    await expect(page.getByRole('heading', { name: newTitle })).toBeVisible();

    const priya = await openAs(browser, guard, PRIYA.email);
    await tab(priya, 'Diet Chart');
    await expect(priya.getByRole('heading', { name: newTitle })).toBeVisible();
    await expect(priya.getByText('1650')).toBeVisible();
    await bell(priya).click();
    await expect(modal(priya, 'Notifications & Reminders').getByText(`Your diet chart "${newTitle}" is updated`)).toBeVisible();
    await guard.check();
    await priya.context().close();
  });

  test('10b. assigns a clinical protocol to a new patient; the patient sees it after reload', async ({ page, guard, browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const patient = guard.watch(await ctx.newPage(), 'patient');
    const me = await newPatient(patient, 'protocol');

    await signIn(page, DIETITIAN);
    await tab(page, 'Admin');
    await ancestor(page.getByText(me.name, { exact: true }).first(), 'p-5').getByRole('button', { name: 'Assign Clinical Plan' }).click();
    await page.getByRole('button', { name: 'Assign to Patient' }).first().click();
    const dialog = modal(page, 'Assign Clinical Protocol');
    await expect(dialog.locator('select')).toHaveValue(me.id);
    const protocol = (await dialog.locator('p.text-emerald-100').innerText()).trim();
    const saved = nextSave(page);
    await dialog.getByRole('button', { name: 'Confirm Assignment' }).click();
    expect((await saved).status()).toBe(200);
    await expect(page.getByText(`Successfully assigned "${protocol}" to ${me.name}.`)).toBeVisible();

    await patient.reload();
    await tab(patient, 'Diet Chart');
    await expect(patient.getByRole('heading', { name: `${protocol} Specialized Protocol` })).toBeVisible();
    await bell(patient).click();
    await expect(modal(patient, 'Notifications & Reminders').getByText('New Clinical Diet Protocol Assigned')).toBeVisible();
    await guard.check();
    await ctx.close();
  });

  test('10c. PDF preview opened by the dietitian shows the selected patient, not the dietitian', async ({ page, guard }) => {
    // Regression test (fixed): App.tsx:155 passes patient={currentUser}; for the dietitian that is Dt. Anchal, so the chart PDF
    // (and its downloaded file) carry the dietitian's name/biometrics instead of the patient's.
    await signIn(page, DIETITIAN);
    await tab(page, 'Diet Plans');
    await page.locator('select').first().selectOption('patient-rohan');
    await page.getByRole('button', { name: /View & Download PDF/ }).click();
    const pdf = modal(page, 'Official Clinical Diet Chart (PDF Preview)');
    await expect(pdf.getByText(/Rohan Verma · Version/)).toBeVisible({ timeout: 2000 });
    await guard.check();
  });

  test('10d. assigned protocol\'s modification-history entry has the chart\'s version', async ({ page, guard }) => {
    // Regression test (fixed): assignClinicalConditionDiet hard-codes version '3.0' in the history entry
    // (NutritionContext.tsx:784) while the chart itself gets version+0.5, so the audit trail is wrong.
    await signIn(page, DIETITIAN);
    await tab(page, 'Admin');
    await ancestor(page.getByText('Kavita Mehta', { exact: true }).first(), 'p-5').getByRole('button', { name: 'Assign Clinical Plan' }).click();
    await page.getByRole('button', { name: 'Assign to Patient' }).first().click();
    const saved = nextSave(page);
    await modal(page, 'Assign Clinical Protocol').getByRole('button', { name: 'Confirm Assignment' }).click();
    await saved;
    const chart = (await appData(page)).dietCharts.find((c: Data) => c.patientId === 'patient-kavita');
    expect(chart.modificationHistory[0].version).toBe(chart.version);
    await guard.check();
  });

  test('11. changes an appointment status; the patient is notified', async ({ page, guard, browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const patient = guard.watch(await ctx.newPage(), 'patient');
    const me = await newPatient(patient, 'apptstatus');
    await patient.getByRole('button', { name: 'Book Consultation' }).first().click();
    // Without a plan, the First Consultation is paid online, then booked.
    await modal(patient, 'Book Consultation with Dt. Anchal').getByRole('button', { name: /Continue to Pay ₹499/ }).click();
    await payByUpi(patient, 'Pay ₹499 & Activate Package');
    await expect.poll(async () => (await appData(patient)).appointments.length).toBe(1);

    await signIn(page, DIETITIAN);
    await tab(page, 'Admin');
    await page.getByRole('button', { name: 'Consultations' }).click();
    await ancestor(page.getByText(me.name, { exact: true }).first(), 'p-4').getByRole('button', { name: 'Manage' }).click();
    await expect(page.getByRole('heading', { name: 'Diet Consultations & Follow-ups' })).toBeVisible();
    const card = ancestor(page.getByText(me.name, { exact: true }), 'p-5');
    const saved2 = nextSave(page);
    await card.getByRole('button', { name: 'Mark as Completed' }).click();
    expect((await saved2).status()).toBe(200);
    await page.getByRole('button', { name: 'Completed', exact: true }).click();
    await expect(ancestor(page.getByText(me.name, { exact: true }), 'p-5')).toContainText('completed');

    await patient.reload();
    await expect(badgeCount(patient)).resolves.toBeGreaterThan(0);
    await bell(patient).click();
    const n = modal(patient, 'Notifications & Reminders');
    await expect(n.getByText('Appointment Completed')).toBeVisible();
    await n.getByText('Appointment Completed').click();
    await patient.getByRole('button', { name: 'All', exact: true }).click();
    await expect(patient.getByText('completed', { exact: true })).toBeVisible();
    await guard.check();
    await ctx.close();
  });

  test('12. manage pricing: a price change and a deactivated plan show on the public page', async ({ page, guard, browser }) => {
    await signIn(page, DIETITIAN);
    await tab(page, 'Pricing');
    const card = () => ancestor(page.getByRole('heading', { name: 'First Consultation', exact: true }), 'rounded-2xl');
    const originalPrice = 499;
    await expect(card()).toContainText(`₹${originalPrice}`);

    const setPrice = async (price: number) => {
      await card().getByRole('button', { name: 'Edit Price' }).click();
      const edit = modal(page, 'Update Package Price & Info');
      await edit.locator('input[type="number"]').fill(String(price));
      const saved = nextSave(page);
      await edit.getByRole('button', { name: 'Save Updates' }).click();
      expect((await saved).status()).toBe(200);
      await expect(card()).toContainText(`₹${price}`);
    };

    const publicCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const pub = guard.watch(await publicCtx.newPage(), 'public');
    const publicCard = () => ancestor(pub.locator('#pricing').getByRole('heading', { name: 'First Consultation', exact: true }), 'rounded-2xl');
    try {
      await setPrice(549);
      await pub.goto('/#pricing');
      await expect(publicCard()).toContainText('₹549');

      // Deactivate → gone from the public page and from patients' Plans.
      let saved = nextSave(page);
      await card().getByRole('button', { name: 'Deactivate' }).click();
      expect((await saved).status()).toBe(200);
      await expect(card()).toContainText('Inactive');
      await pub.reload();
      await expect(pub.locator('#pricing').getByRole('heading', { name: 'Personalised Diet Plan', exact: true })).toBeVisible();
      await expect(pub.locator('#pricing').getByRole('heading', { name: 'First Consultation', exact: true })).toHaveCount(0);

      // Restore.
      saved = nextSave(page);
      await card().getByRole('button', { name: 'Activate' }).click();
      expect((await saved).status()).toBe(200);
      await setPrice(originalPrice);
      await pub.reload();
      await expect(publicCard()).toContainText(`₹${originalPrice}`);
      await guard.check();
    } finally {
      // Make sure the shared price list is back to normal even if an assertion failed.
      const pkg = (await appData(page)).packages.find((p: Data) => p.id === 'pkg-basic-consultation');
      if (pkg.priceInr !== originalPrice || !pkg.isActive) {
        await page.request.post('/api/data/batch', { data: { ops: [{ collection: 'packages', id: pkg.id, data: { ...pkg, priceInr: originalPrice, isActive: true } }] } });
      }
      await publicCtx.close();
    }
  });

  test('13. refunds a payment; the patient sees "refunded" and a notification', async ({ page, guard, browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const patient = guard.watch(await ctx.newPage(), 'patient');
    const me = await newPatient(patient, 'refund');
    await tab(patient, 'My Plans');
    await ancestor(patient.getByRole('heading', { name: 'First Consultation', exact: true }), 'rounded-2xl').getByRole('button', { name: /Choose this plan/ }).click();
    const checkout = modal(patient, 'Secure Payment Gateway');
    const paid = nextSave(patient);
    await fillUpi(checkout);
    await checkout.getByRole('button', { name: 'Pay ₹499 & Activate Package' }).click();
    expect((await paid).status()).toBe(200);
    await checkout.getByRole('button', { name: /Go to My Diet & Schedule/ }).click();
    await modal(patient, 'Payment Receipt & Tax Invoice').locator('button').nth(2).click();

    await signIn(page, DIETITIAN);
    await tab(page, 'Pricing');
    await page.getByRole('button', { name: 'All Transactions' }).click();
    const row = () => ancestor(page.getByText(`Patient: ${me.name}`), 'justify-between');
    await expect(row()).toContainText('successful');
    await row().getByRole('button', { name: 'Issue Refund' }).click();
    const confirm = modal(page, 'Confirm Patient Refund');
    await confirm.getByLabel('Refund Reason / Notes').fill('E2E duplicate order');
    const saved = nextSave(page);
    await confirm.getByRole('button', { name: 'Confirm Refund' }).click();
    expect((await saved).status()).toBe(200);
    await expect(row()).toContainText('refunded');
    await expect(row()).toContainText(/Refunded ₹\d+: E2E duplicate order/);

    await patient.reload();
    await tab(patient, 'My Plans');
    await expect(patient.getByText(/Current plan:/)).toHaveCount(0);
    await patient.getByRole('button', { name: 'My Purchases' }).click();
    await expect(patient.getByText('refunded', { exact: true })).toBeVisible();
    await bell(patient).click();
    await expect(modal(patient, 'Notifications & Reminders').getByText('Refund Processed')).toBeVisible();
    await guard.check();
    await ctx.close();
  });
});
