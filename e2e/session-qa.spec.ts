import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { verifyInBrowser } from './mail';

// Session robustness: multiple tabs, flaky networks, insecure (LAN) origins, password change and
// clinic reset, redirects, layout stability on errors, and production security headers.

const DEMO_PASSWORD = 'Demo@1234';
const unique = (tag: string) => `qa.session.${tag}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`;

async function signIn(page: Page, email: string, password = DEMO_PASSWORD) {
  await page.goto('/signin');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page).toHaveURL('/app');
}

async function signUp(page: Page, email: string, password = 'Healthy123', name = 'Session Tester') {
  await page.goto('/signup');
  await page.getByLabel('Full name').fill(name);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Mobile number (WhatsApp)').fill('9876543210');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('checkbox', { name: /i agree/i }).check();
  await page.getByRole('button', { name: /create account/i }).click();
  await verifyInBrowser(page, email);
  await expect(page).toHaveURL('/app');
}

/** Simulates the person switching back to this tab. */
const focusTab = async (page: Page) => {
  await page.bringToFront();
  // The tab may already be reloading because the other tab told it about the change — fine.
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))).catch(() => undefined);
};

async function openAccount(page: Page) {
  await page.getByTitle(/Logged in as/).click();
  return page.getByRole('dialog', { name: 'Your account' });
}

test.describe('multiple tabs', () => {
  test('signing out in one tab removes the data from the other tab', async ({ context }) => {
    const a = await context.newPage();
    await signIn(a, 'priya.sharma@example.com');
    const b = await context.newPage();
    await b.goto('/app');
    await expect(b.getByText('Welcome back, Priya Sharma')).toBeVisible();

    await a.bringToFront();
    await (await openAccount(a)).getByRole('button', { name: 'Sign out' }).click();
    await expect(a).toHaveURL('/');

    await focusTab(b);
    await expect(b).toHaveURL(/\/signin/);
    await expect(b.getByText('Welcome back, Priya Sharma')).toHaveCount(0);
  });

  test('signing in as someone else in one tab switches the other tab to that account', async ({ context }) => {
    const a = await context.newPage();
    await signIn(a, 'priya.sharma@example.com');
    const b = await context.newPage();
    await b.goto('/app');
    await expect(b.getByText('Welcome back, Priya Sharma')).toBeVisible();

    await a.bringToFront();
    await (await openAccount(a)).getByRole('button', { name: 'Sign out' }).click();
    await signIn(a, 'rohan.verma@example.com');

    await focusTab(b);
    await expect(b.getByText('Welcome back, Rohan Verma')).toBeVisible();
    await expect(b.getByText('Priya Sharma')).toHaveCount(0);
  });

  test("a stale tab can never save under another account's session", async ({ context, page }) => {
    await signIn(page, 'priya.sharma@example.com');
    // Another tab replaces the cookie with Rohan's session, without this tab noticing.
    const res = await context.request.post('/api/auth/signin', { data: { email: 'rohan.verma@example.com', password: DEMO_PASSWORD } });
    expect(res.status()).toBe(200);
    const save = await context.request.post('/api/data/batch', {
      headers: { 'X-Nutrifacts-Account': 'patient-priya' },
      data: { ops: [{ collection: 'weightRecords', id: 'w-stale', data: { id: 'w-stale', patientId: 'patient-priya', weightKg: 1 } }] },
    });
    expect(save.status()).toBe(409);
  });
});

test.describe('network trouble', () => {
  test('sign-out while offline keeps you signed in and says so; it works once back online', async ({ page, context }) => {
    await signIn(page, 'priya.sharma@example.com');
    const dialog = await openAccount(page);
    await context.setOffline(true);
    await dialog.getByRole('button', { name: 'Sign out' }).click();
    await expect(dialog.getByRole('alert')).toContainText(/couldn't sign out/i);
    await expect(page).toHaveURL('/app');
    await context.setOffline(false);
    await dialog.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL('/');
    // …and the session really is gone on the server.
    await page.goto('/app');
    await expect(page).toHaveURL(/\/signin/);
  });

  test('if the server cannot be reached on load, you are not treated as signed out', async ({ page }) => {
    await signIn(page, 'priya.sharma@example.com');
    let down = true;
    await page.route('**/api/auth/me', (route) => (down ? route.abort('connectionrefused') : route.continue()));
    await page.reload();
    await expect(page.getByRole('heading', { name: /can't reach nutrifacts/i })).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL('/app');
    down = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByText('Welcome back, Priya Sharma')).toBeVisible();
  });

  test('a session that ended elsewhere sends you to sign in with an explanation', async ({ page, context }) => {
    await signIn(page, 'priya.sharma@example.com');
    await context.request.post('/api/auth/signout', { data: {} });
    await focusTab(page);
    await expect(page).toHaveURL(/\/signin/);
    await expect(page.getByRole('status')).toContainText(/your session ended/i);
    // The notice is shown once.
    await page.reload();
    await expect(page.getByText(/your session ended/i)).toHaveCount(0);
  });
});

test('works when opened over plain http on a LAN address (no crypto.randomUUID)', async ({ page }) => {
  // Browsers only provide crypto.randomUUID on https/localhost; simulate a LAN IP like 192.168.x.x.
  await page.addInitScript(() => {
    Object.defineProperty(Crypto.prototype, 'randomUUID', { value: undefined, configurable: true });
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await signUp(page, unique('lan'));
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Track', exact: true }).click();
  await page.getByRole('button', { name: /record new weight/i }).click();
  await page.locator('input[type="number"]').first().fill('64.5');
  const saved = page.waitForResponse((r) => r.url().endsWith('/api/data/batch'));
  await page.getByRole('button', { name: /save weight log/i }).click();
  expect((await saved).status()).toBe(200);
  expect(errors).toEqual([]);
});

test.describe('passwords', () => {
  test('a patient changes their password; the old one stops working', async ({ page }) => {
    const email = unique('change');
    await signUp(page, email, 'Healthy123');
    const dialog = await openAccount(page);
    await dialog.getByRole('button', { name: 'Change password' }).click();
    await dialog.getByLabel('Current password').fill('wrong-one1');
    await dialog.getByLabel(/^New password/).fill('Fresh-2026x');
    await dialog.getByLabel('Confirm new password').fill('Fresh-2026x');
    await dialog.getByRole('button', { name: 'Change password' }).click();
    await expect(dialog.getByText('Your current password is incorrect.')).toBeVisible();

    await dialog.getByLabel('Current password').fill('Healthy123');
    await dialog.getByRole('button', { name: 'Change password' }).click();
    await expect(dialog.getByRole('status')).toContainText(/password changed/i);
    await dialog.getByRole('button', { name: 'Done' }).click();
    await dialog.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL('/');

    await page.goto('/signin');
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('Healthy123');
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await expect(page.getByText('Incorrect email or password.')).toBeVisible();
    await signIn(page, email, 'Fresh-2026x');
  });

  test('the dietitian resets a forgotten password; the patient signs in with the temporary one', async ({ page, browser }) => {
    const email = unique('reset');
    const patientCtx: BrowserContext = await browser.newContext();
    const patient = await patientCtx.newPage();
    const name = `Reset ${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${Date.now().toString(36).replace(/\d/g, (d) => 'abcdefghij'[Number(d)])}`;
    await signUp(patient, email, 'Healthy123', name);

    await signIn(page, 'anchaldewan380@gmail.com');
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Admin', exact: true }).click();
    await page.getByPlaceholder(/search patient/i).fill(name);
    await page.getByRole('button', { name: 'Reset Password' }).click();
    const dialog = page.getByRole('dialog', { name: 'Reset password' });
    await expect(dialog).toContainText(email);
    await dialog.getByRole('button', { name: 'Reset password' }).click();
    const temporary = (await dialog.getByLabel('Temporary password', { exact: true }).innerText()).trim();
    expect(temporary).toMatch(/^\w{4}-\w{4}-\w{4}$/);
    await expect(dialog.getByRole('link', { name: /send on whatsapp/i })).toHaveAttribute('href', /wa\.me\/919876543210/);

    // The patient's open session was ended…
    await focusTab(patient);
    await expect(patient).toHaveURL(/\/signin/);
    // …and the temporary password works.
    await signIn(patient, email, temporary);
    await patientCtx.close();
  });
});

test('"next" survives switching from sign-in to sign-up', async ({ page }) => {
  await page.goto('/signin?next=%2Fapp%3Ftab%3Dplans');
  await page.getByLabel('Email address').fill(unique('next'));
  await page.getByRole('link', { name: 'Create an account' }).click();
  await expect(page).toHaveURL('/signup?next=%2Fapp%3Ftab%3Dplans');
  // The email typed on sign-in is carried over.
  const email = await page.getByLabel('Email address').inputValue();
  expect(email).toMatch(/qa\.session\.next/);
  await page.getByLabel('Full name').fill('Next Tester');
  await page.getByLabel('Mobile number (WhatsApp)').fill('9876543210');
  await page.getByLabel('Password', { exact: true }).fill('Healthy123');
  await page.getByLabel('Confirm password', { exact: true }).fill('Healthy123');
  await page.getByRole('checkbox', { name: /i agree/i }).check();
  await page.getByRole('button', { name: /create account/i }).click();
  // …and through the email-verification step.
  await expect(page).toHaveURL('/verify-email?next=%2Fapp%3Ftab%3Dplans');
  await verifyInBrowser(page, email);
  await expect(page).toHaveURL('/app?tab=plans');
});

test('a crafted "next" can never leave the site', async ({ page }) => {
  for (const evil of ['//evil.example', '/\\evil.example', '/%09/evil.example', 'https://evil.example']) {
    await page.context().clearCookies();
    await page.goto(`/signin?next=${encodeURIComponent(evil)}`);
    await page.getByLabel('Email address').fill('priya.sharma@example.com');
    await page.getByLabel('Password', { exact: true }).fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/^http:\/\/localhost:\d+\//);
    expect(new URL(page.url()).hostname).toBe('localhost');
    await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
  }
});

test('wrong password: nothing on the page moves', async ({ page }) => {
  await page.goto('/signin');
  await page.evaluate(() => document.fonts.ready);
  const button = page.getByRole('button', { name: /^sign in$/i });
  const y = async () => (await button.boundingBox())!.y + (await page.evaluate(() => scrollY));
  const before = await y();
  await page.getByLabel('Email address').fill('priya.sharma@example.com');
  await page.getByLabel('Password', { exact: true }).fill('wrong-pass1');
  await button.click();
  await expect(page.getByText('Incorrect email or password.')).toBeVisible();
  expect(await y()).toBe(before);
});

test('production pages load fonts locally and break no security policy', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => {
    const host = new URL(r.url()).hostname;
    if (host !== 'localhost' && host !== 'images.unsplash.com') external.push(r.url());
  });
  await page.addInitScript(() => {
    (window as any).__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => (window as any).__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  for (const path of ['/', '/signin', '/signup', '/forgot-password']) {
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => (window as any).__csp), path).toEqual([]);
  }
  await signIn(page, 'priya.sharma@example.com');
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as any).__csp)).toEqual([]);
  expect(external).toEqual([]);
  const fontsOk = await page.evaluate(() => document.fonts.check("16px 'Plus Jakarta Sans'") && document.fonts.check("16px 'Playfair Display'"));
  expect(fontsOk).toBe(true);
});
