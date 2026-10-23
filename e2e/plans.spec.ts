import { expect, test, type Page } from '@playwright/test';
import { verifyInBrowser } from './mail';

const uniqueEmail = (tag: string) => `e2e.plans.${tag}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`;
const nav = (page: Page, label: string) => page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: label, exact: true }).click();
const planCard = (page: Page, title: string) => page.getByRole('article', { name: title, exact: true });
/** The "Nutrition Care" card, set to a length (1, 3 or 6 months). */
async function careFor(page: Page, months: 1 | 3 | 6) {
  const card = planCard(page, 'Nutrition Care');
  await card.getByRole('radio', { name: new RegExp(`^${months} months?,`) }).click();
  return card;
}

async function newVerifiedPatient(page: Page) {
  const email = uniqueEmail('p');
  await page.goto('/signup');
  await page.getByLabel('Full name').fill('Meera Iyer');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Mobile number (WhatsApp)').fill('9876543210');
  await page.getByLabel('Password', { exact: true }).fill('Healthy123');
  await page.getByLabel('Confirm password', { exact: true }).fill('Healthy123');
  await page.getByRole('checkbox', { name: /i agree/i }).check();
  await page.getByRole('button', { name: /create account/i }).click();
  await verifyInBrowser(page, email);
}

async function buy(page: Page, title: string, button: RegExp, pay: string, months?: 1 | 3 | 6) {
  const card = months ? await careFor(page, months) : planCard(page, title);
  await card.getByRole('button', { name: button }).click();
  const checkout = page.locator('div.fixed.inset-0').filter({ hasText: 'Secure Payment Gateway' });
  await checkout.getByRole('textbox').first().fill('meera@okhdfcbank');
  await checkout.getByRole('button', { name: pay }).click();
  await expect(checkout.getByText('Payment Successful!')).toBeVisible();
  await checkout.getByRole('button', { name: /Go to My Diet & Schedule/ }).click();
  await page.locator('div.fixed.inset-0').filter({ hasText: 'Payment Receipt & Tax Invoice' }).locator('button').nth(2).click();
}

test('My Plans: current plan, then a downgrade scheduled for when it ends (and cancelled)', async ({ page }) => {
  await newVerifiedPatient(page);
  await nav(page, 'My Plans');
  await expect(page.getByText('No plan yet.')).toBeVisible();

  await buy(page, 'Nutrition Care', /Choose this plan/, 'Pay ₹2499 & Activate Package', 1);
  await expect(page.getByText('Current plan: Monthly Nutrition Care')).toBeVisible();
  await expect(page.getByText(/\d+ days left/)).toBeVisible();
  // The card now opens on the patient's own length.
  await expect(planCard(page, 'Nutrition Care').getByRole('radio', { name: /^1 month,/ })).toHaveAttribute('aria-checked', 'true');
  await expect(planCard(page, 'Nutrition Care')).toContainText('Your current plan');

  // Cheaper plans are a downgrade at the end of the current plan; nothing is charged now.
  await planCard(page, 'First Consultation').getByRole('button', { name: 'Switch to this when my plan ends' }).click();
  const dialog = page.getByRole('dialog', { name: /Switch to First Consultation/ });
  await expect(dialog).toContainText('Nothing is charged now');
  await dialog.getByRole('button', { name: 'Confirm change' }).click();
  await expect(page.getByText(/Switching to First Consultation on \d{4}-\d{2}-\d{2}/)).toBeVisible();
  await expect(planCard(page, 'First Consultation')).toContainText(/Starts \d{4}-\d{2}-\d{2}/);

  // Survives a reload (saved on the profile), and can be cancelled.
  await page.reload();
  await nav(page, 'My Plans');
  await expect(page.getByText(/Switching to First Consultation/)).toBeVisible();
  await page.getByRole('button', { name: 'Cancel change' }).click();
  await expect(page.getByText(/Switching to/)).toHaveCount(0);
  await expect(planCard(page, 'First Consultation').getByRole('button', { name: 'Switch to this when my plan ends' })).toBeVisible();
});

test('First Consultation: ₹499 is credited in full when moving up to Monthly Nutrition Care', async ({ page }) => {
  await newVerifiedPatient(page);
  await nav(page, 'My Plans');
  // The promises are shown before anyone pays.
  await expect(page.getByRole('list', { name: 'Why choosing a plan is risk-free' })).toContainText('7-day promise');
  // Customers choose the length; each shows what it saves.
  const care = planCard(page, 'Nutrition Care');
  await expect(care.getByRole('radio', { name: /^3 months,/ })).toHaveAttribute('aria-checked', 'true');
  await expect(care).toContainText('You save 20% · ₹1,498');
  await (await careFor(page, 6)).getByText('You save 27% · ₹3,995').waitFor();
  await careFor(page, 1);
  await expect(care).toContainText('Choose 6 months and save 27%');

  await buy(page, 'First Consultation', /Choose this plan/, 'Pay ₹499 & Activate Package');
  await expect(page.getByText('You have ₹499 credit')).toBeVisible();
  await expect(await careFor(page, 1)).toContainText('Pay ₹2,000 today after ₹499 credit');

  await (await careFor(page, 1)).getByRole('button', { name: /Upgrade · pay ₹2,000/ }).click();
  const checkout = page.locator('div.fixed.inset-0').filter({ hasText: 'Secure Payment Gateway' });
  await expect(checkout).toContainText('Your First Consultation (credited in full)');
  await checkout.getByRole('textbox').first().fill('meera@okhdfcbank');
  await checkout.getByRole('button', { name: 'Pay ₹2000 & Upgrade Plan' }).click();
  await expect(checkout.getByText('Payment Successful!')).toBeVisible();
  await checkout.getByRole('button', { name: /Go to My Diet & Schedule/ }).click();
  await page.locator('div.fixed.inset-0').filter({ hasText: 'Payment Receipt & Tax Invoice' }).locator('button').nth(2).click();
  await expect(page.getByText('Current plan: Monthly Nutrition Care')).toBeVisible();
});

test('Home sends someone with a running plan to My Plans instead of a full-price checkout', async ({ page }) => {
  await newVerifiedPatient(page);
  await nav(page, 'My Plans');
  await buy(page, 'Personalised Diet Plan', /Choose this plan/, 'Pay ₹999 & Activate Package');
  await nav(page, 'Home');
  await page.getByRole('button', { name: /Select & Pay Online/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Your Nutrition Care Plan' })).toBeVisible();
  await expect(page.getByText('Secure Payment Gateway')).toHaveCount(0);
});
