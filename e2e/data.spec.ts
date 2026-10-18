import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const DEMO_PASSWORD = 'Demo@1234';

async function apiSignIn(request: APIRequestContext, email: string, password = DEMO_PASSWORD) {
  const res = await request.post('/api/auth/signin', { data: { email, password } });
  expect(res.status()).toBe(200);
}

async function signUpInBrowser(page: Page, email: string) {
  await page.goto('/signup');
  await page.getByLabel('Full name').fill('Arjun Rao');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Mobile number (WhatsApp)').fill('9811122233');
  await page.getByLabel('Password', { exact: true }).fill('Healthy123');
  await page.getByLabel('Confirm password', { exact: true }).fill('Healthy123');
  await page.getByRole('checkbox', { name: /i agree/i }).check();
  await page.getByRole('button', { name: /create account/i }).click();
  await expect(page).toHaveURL('/app');
}

const openTrackTab = (page: Page) => page.getByRole('button', { name: /^Track$/ }).first().click();

test('patient data is saved on the server: survives reload, follows the patient to another device, and stays private', async ({
  page,
  browser,
  playwright,
  baseURL,
}) => {
  const email = `e2e.data.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`;
  await signUpInBrowser(page, email);

  // Log a weight.
  await openTrackTab(page);
  await page.getByRole('button', { name: /record new weight/i }).click();
  await page.locator('input[type="number"]').first().fill('71.3');
  const saved = page.waitForResponse((r) => r.url().endsWith('/api/data/batch') && r.request().method() === 'POST');
  await page.getByRole('button', { name: /save weight log/i }).click();
  expect((await saved).status()).toBe(200);
  await expect(page.getByText('71.3').first()).toBeVisible();

  // Still there after a full reload…
  await page.reload();
  await openTrackTab(page);
  await expect(page.getByText('71.3').first()).toBeVisible();

  // …and on a different device (fresh browser profile).
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await otherPage.goto('/signin');
  await otherPage.getByLabel('Email address').fill(email);
  await otherPage.getByLabel('Password', { exact: true }).fill('Healthy123');
  await otherPage.getByRole('button', { name: /^sign in$/i }).click();
  await expect(otherPage).toHaveURL('/app');
  await openTrackTab(otherPage);
  await expect(otherPage.getByText('71.3').first()).toBeVisible();
  await other.close();

  // The dietitian can see the new patient and their weight; another patient cannot.
  const dietitian = await playwright.request.newContext({ baseURL });
  await apiSignIn(dietitian, 'anchaldewan380@gmail.com');
  const adminData = await (await dietitian.get('/api/data')).json();
  const patient = adminData.patients.find((p: { email: string }) => p.email === email);
  expect(patient).toBeTruthy();
  expect(adminData.weightRecords.some((w: { patientId: string; weightKg: number }) => w.patientId === patient.id && w.weightKg === 71.3)).toBe(true);
  await dietitian.dispose();

  const rohan = await playwright.request.newContext({ baseURL });
  await apiSignIn(rohan, 'rohan.verma@example.com');
  const rohanData = await (await rohan.get('/api/data')).json();
  expect(rohanData.patients.some((p: { email: string }) => p.email === email)).toBe(false);
  expect(rohanData.weightRecords.some((w: { weightKg: number }) => w.weightKg === 71.3)).toBe(false);
  await rohan.dispose();
});

test('a price change by the dietitian shows on the public home page', async ({ page, playwright, baseURL }) => {
  const dietitian = await playwright.request.newContext({ baseURL });
  await apiSignIn(dietitian, 'anchaldewan380@gmail.com');
  const { packages } = await (await dietitian.get('/api/data')).json();
  const pkg = packages.find((p: { isActive: boolean }) => p.isActive);
  const newPrice = pkg.priceInr + 1;
  const res = await dietitian.post('/api/data/batch', { data: { ops: [{ collection: 'packages', id: pkg.id, data: { ...pkg, priceInr: newPrice } }] } });
  expect(res.status()).toBe(200);

  await page.goto('/#pricing');
  await expect(page.getByText(`₹${newPrice.toLocaleString('en-IN')}`).first()).toBeVisible();

  // Put it back so other tests see the original price list.
  await dietitian.post('/api/data/batch', { data: { ops: [{ collection: 'packages', id: pkg.id, data: pkg }] } });
  await dietitian.dispose();
});

test('a demo patient sees only their own records in the app', async ({ page }) => {
  await page.goto('/signin');
  await page.getByLabel('Email address').fill('priya.sharma@example.com');
  await page.getByLabel('Password', { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page.getByText('Welcome back, Priya Sharma')).toBeVisible();
  // Nothing of the other sample patients is even in the page.
  await expect(page.getByText(/Rohan Verma|Kavita Mehta/)).toHaveCount(0);
});

for (const account of [
  { email: 'priya.sharma@example.com', tabs: ['Diet Chart', 'Plans', 'Track', 'Profile', 'Home'] },
  { email: 'anchaldewan380@gmail.com', tabs: ['Diet Plans', 'Pricing', 'Progress', 'Admin', 'Home'] },
]) {
  test(`every tab loads without errors for ${account.email}`, async ({ page }) => {
    const problems: string[] = [];
    page.on('pageerror', (e) => problems.push(e.message));
    page.on('console', (m) => m.type() === 'error' && !/401/.test(m.text()) && problems.push(m.text()));
    page.on('response', (r) => r.url().includes('/api/data') && r.status() >= 400 && problems.push(`${r.status()} ${r.url()}`));

    await page.goto('/signin');
    await page.getByLabel('Email address').fill(account.email);
    await page.getByLabel('Password', { exact: true }).fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await expect(page).toHaveURL('/app');

    for (const tab of account.tabs) {
      await page.getByRole('button', { name: new RegExp(`^${tab}$`) }).first().click();
      await page.waitForTimeout(400); // let any auto-save fire
    }
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(problems).toEqual([]);
  });
}
