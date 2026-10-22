import { expect, test, type Page } from '@playwright/test';
import { emailedCode, verifyInBrowser } from './mail';

const uniqueEmail = (tag: string) => `e2e.profile.${tag}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`;

async function signUp(page: Page, email: string) {
  await page.goto('/signup');
  await page.getByLabel('Full name').fill('Meera Iyer');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Mobile number (WhatsApp)').fill('9876543210');
  await page.getByLabel('Password', { exact: true }).fill('Healthy123');
  await page.getByLabel('Confirm password', { exact: true }).fill('Healthy123');
  await page.getByRole('checkbox', { name: /i agree/i }).check();
  await page.getByRole('button', { name: /create account/i }).click();
}

test('the home page offers no dashboard until sign-up is finished with the emailed code', async ({ page }) => {
  const email = uniqueEmail('home');
  await signUp(page, email);
  await expect(page).toHaveURL('/verify-email?next=%2Fapp');

  await page.goto('/');
  await expect(page.getByRole('link', { name: /open my dashboard/i })).toHaveCount(0);

  await page.goto('/verify-email');
  await verifyInBrowser(page, email);
  await page.goto('/');
  await expect(page.getByRole('link', { name: /open my dashboard/i }).first()).toBeVisible();
});

test('My profile: edit personal and health details, then change email with a code', async ({ page }) => {
  const email = uniqueEmail('edit');
  await signUp(page, email);
  await verifyInBrowser(page, email);

  // Account panel → My profile opens the edit form.
  await page.getByTitle(/Logged in as/).click();
  await page.getByRole('dialog', { name: 'Your account' }).getByRole('button', { name: 'My profile' }).click();
  const form = page.getByRole('form', { name: 'Edit profile' });
  await expect(form).toBeVisible();

  // Invalid input is caught on the field.
  await form.getByLabel('Height (cm)').fill('20');
  await form.getByRole('button', { name: 'Save changes' }).click();
  await expect(form.getByText('Enter 50–250 cm.')).toBeVisible();

  await form.getByLabel('Full name').fill('Meera Krishnan');
  await form.getByLabel('Mobile number (WhatsApp)').fill('98765 11111');
  await form.getByLabel('Date of birth').fill('1992-03-15');
  await form.getByLabel('Gender').selectOption('Female');
  await form.getByLabel('Height (cm)').fill('162');
  await form.getByLabel('Current weight (kg)').fill('68.5');
  await form.getByLabel('Target weight (kg)').fill('60');
  const saved = page.waitForResponse((r) => r.url().endsWith('/api/data/batch') && r.request().method() === 'POST');
  await form.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Your profile has been updated.' })).toBeVisible();
  expect((await saved).status()).toBe(200);

  // Survives a reload (stored on the server).
  await page.reload();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'My Profile', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Meera Krishnan' })).toBeVisible();
  await expect(page.getByText('+91 98765 11111')).toBeVisible();
  await expect(page.getByText(/15 Mar 1992 \(\d+ yrs\)/)).toBeVisible();
  await expect(page.getByText('162 cm')).toBeVisible();

  // Change email: password, then the code sent to the new address.
  const newEmail = uniqueEmail('moved');
  await page.getByRole('button', { name: 'Edit profile' }).click();
  await form.getByRole('button', { name: 'Change', exact: true }).click();
  await form.getByLabel('New email address').fill(newEmail);
  await form.getByLabel('Current password').fill('Healthy123');
  await form.getByRole('button', { name: 'Send verification code' }).click();
  await expect(form.getByText(`We sent a 6-digit code to ${newEmail}`)).toBeVisible();
  await form.getByLabel('Verification code').fill(await emailedCode(newEmail));
  await form.getByRole('button', { name: 'Confirm new email' }).click();
  await expect(form.getByText(`Your email is now ${newEmail}`)).toBeVisible();

  // The new address is the sign-in from now on.
  await page.getByTitle(/Logged in as/).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL('/');
  await page.goto('/signin');
  await page.getByLabel('Email address').fill(newEmail);
  await page.getByLabel('Password', { exact: true }).fill('Healthy123');
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page).toHaveURL('/app');
  await expect(page.getByText('Welcome back, Meera Krishnan')).toBeVisible();
});

test('My profile: add, change and remove a profile photo', async ({ page }) => {
  const email = uniqueEmail('photo');
  await signUp(page, email);
  await verifyInBrowser(page, email);
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'My Profile', exact: true }).click();

  // A 1×1 PNG: the app crops and shrinks whatever is chosen into a small square JPEG.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Add profile photo' }).click();
  const saved = page.waitForResponse((r) => r.url().endsWith('/api/data/batch') && r.request().method() === 'POST');
  await (await chooser).setFiles({ name: 'me.png', mimeType: 'image/png', buffer: png });
  expect((await saved).status()).toBe(200);
  await expect(page.getByText('Your profile photo has been updated.')).toBeVisible();
  const photo = page.getByRole('img', { name: "Meera Iyer's profile photo" });
  await expect(photo).toHaveAttribute('src', /^data:image\/jpeg;base64,/);

  // Shown in the top bar too, and kept after a reload.
  await expect(page.getByTitle(/Logged in as/).locator('img')).toHaveAttribute('src', /^data:image\/jpeg/);
  await page.reload();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'My Profile', exact: true }).click();
  await expect(photo).toBeVisible();

  // A file that isn't an image is refused with a message.
  const chooser2 = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Change profile photo' }).click();
  await (await chooser2).setFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  await expect(page.getByRole('alert').filter({ hasText: 'Choose a JPG, PNG or WebP photo.' })).toBeVisible();

  await page.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByText('Your profile photo has been removed.')).toBeVisible();
  await expect(photo).toHaveCount(0);
});
