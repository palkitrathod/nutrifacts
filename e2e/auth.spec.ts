import { expect, test, type Page } from '@playwright/test';
import { emailedCode, verifyInBrowser } from './mail';

const DEMO_PASSWORD = 'Demo@1234';
const uniqueEmail = (tag: string) => `e2e.${tag}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`;

/** Fails the test on any uncaught page error or console error. */
function watchConsole(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    // The deliberate 401 from the session check on a signed-out page load is expected.
    if (m.type() === 'error' && !/401/.test(m.text())) problems.push(`console: ${m.text()}`);
  });
  return problems;
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'page should not scroll sideways').toBeLessThanOrEqual(0);
}

async function signUp(page: Page, email: string, password = 'Healthy123') {
  await page.getByLabel('Full name').fill('Meera Iyer');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Mobile number (WhatsApp)').fill('98765 43210');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('checkbox', { name: /i agree/i }).check();
  await page.getByRole('button', { name: /create account/i }).click();
}

async function openNavCta(page: Page, name: 'Sign In' | 'Get Started') {
  if (await page.getByRole('button', { name: 'Open menu' }).isVisible()) await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('navigation').getByRole('link', { name, exact: true }).click();
}

test.describe('home page', () => {
  test('Sign In and Get Started open two different pages', async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto('/');

    await openNavCta(page, 'Sign In');
    await expect(page).toHaveURL('/signin');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sign in');

    await page.goto('/');
    await openNavCta(page, 'Get Started');
    await expect(page).toHaveURL('/signup');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Create your account');

    expect(problems).toEqual([]);
  });

  test('all images load in the production build', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const broken = await page.$$eval('img', (imgs) =>
      Promise.all(
        imgs.map(async (img) => {
          img.loading = 'eager';
          await img.decode().catch(() => undefined);
          return img.naturalWidth === 0 ? img.src : null;
        })
      ).then((r) => r.filter(Boolean))
    );
    expect(broken).toEqual([]);
  });

  test('no sideways scrolling on home and auth pages', async ({ page }) => {
    for (const path of ['/', '/signin', '/signup', '/forgot-password']) {
      await page.goto(path);
      await expectNoHorizontalScroll(page);
    }
  });

  test('nav links scroll to their sections', async ({ page, isMobile }) => {
    await page.goto('/');
    if (isMobile) await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('navigation').getByRole('button', { name: 'Pricing' }).click();
    await expect(page.getByRole('heading', { name: 'Simple, Affordable Plans' })).toBeInViewport();
  });
});

test.describe('sign up', () => {
  test('new patient signs up, stays signed in across reloads, signs out and back in', async ({ page }) => {
    const problems = watchConsole(page);
    const email = uniqueEmail('journey');

    await page.goto('/signup');
    await signUp(page, email);

    // The emailed code has to be entered before the dashboard opens.
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
    await verifyInBrowser(page, email);
    await expect(page).toHaveURL('/app');
    await expect(page.getByText('Welcome back, Meera Iyer')).toBeVisible();

    // Session survives a full reload (httpOnly cookie, not localStorage).
    await page.reload();
    await expect(page.getByText('Welcome back, Meera Iyer')).toBeVisible();

    // The home page now offers the dashboard instead of sign-in.
    await page.goto('/');
    await expect(page.getByRole('link', { name: /open my dashboard/i }).first()).toBeVisible();
    await page.goto('/signin');
    await expect(page).toHaveURL('/app');

    // Sign out from the account panel.
    await page.getByTitle(/Logged in as/).click();
    await expect(page.getByRole('dialog', { name: 'Your account' })).toContainText(email);
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL('/');

    // The app is closed after sign-out, including via the back button.
    await page.goto('/app');
    await expect(page).toHaveURL('/signin?next=%2Fapp');

    // And the same credentials work again.
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('Healthy123');
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await expect(page).toHaveURL('/app');
    await expect(page.getByText('Welcome back, Meera Iyer')).toBeVisible();

    expect(problems).toEqual([]);
  });

  test('blocks a duplicate email and offers sign-in', async ({ page }) => {
    await page.goto('/signup');
    await signUp(page, 'priya.sharma@example.com');
    await expect(page.getByText(/already has an account/i)).toBeVisible();
    await page.getByRole('link', { name: 'Sign in', exact: true }).first().click();
    await expect(page).toHaveURL('/signin');
  });

  test('shows validation errors and does not submit', async ({ page }) => {
    await page.goto('/signup');
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page.getByText('Enter your full name.')).toBeVisible();
    await expect(page.getByLabel('Full name')).toBeFocused();
    await expect(page).toHaveURL('/signup');
  });

  test('a plan picked on the home page carries through to the Plans screen', async ({ page }) => {
    await page.goto('/#pricing');
    await page.getByRole('link', { name: /choose this plan/i }).first().click();
    await expect(page).toHaveURL(/\/signup\?plan=/);
    await expect(page.getByText(/selected plan/i)).toBeVisible();

    const email = uniqueEmail('plan');
    await signUp(page, email);
    await verifyInBrowser(page, email);
    await expect(page.getByRole('heading', { name: 'Your Nutrition Care Plan' })).toBeVisible();
  });
});

test.describe('email verification', () => {
  const codeInput = (page: Page) => page.getByLabel('Verification code');

  test('the app stays locked until the code is entered; a wrong code is explained', async ({ page }) => {
    const email = uniqueEmail('verify');
    await page.goto('/signup');
    await signUp(page, email);
    await expect(page).toHaveURL('/verify-email?next=%2Fapp');

    // Going straight to the app (or reloading) comes back to the code screen.
    await page.goto('/app');
    await expect(page).toHaveURL('/verify-email?next=%2Fapp');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

    const code = await emailedCode(email);
    const wrong = code === '000000' ? '111111' : '000000';
    await codeInput(page).fill(wrong);
    await expect(page.getByRole('alert')).toContainText("That code isn't right. 4 tries left.");
    await expect(codeInput(page)).toHaveValue('');
    await expect(codeInput(page)).toBeFocused();

    await codeInput(page).fill(code);
    await expect(page.getByRole('heading', { name: 'Email verified!' })).toBeVisible();
    await expect(page).toHaveURL('/app');
    await expect(page.getByText('Welcome back, Meera Iyer')).toBeVisible();

    // Once verified, the code screen just forwards to the app.
    await page.goto('/verify-email');
    await expect(page).toHaveURL('/app');
  });

  test('"Send a new code" is held for a minute after sign-up, and the server enforces the wait too', async ({ page }) => {
    const email = uniqueEmail('resend');
    await page.goto('/signup');
    await signUp(page, email);
    const resend = page.getByRole('button', { name: /send a new code/i });
    await expect(resend).toBeDisabled();
    await expect(resend).toHaveText(/in \d+s/);

    // After a reload the page no longer knows when the code went out; the server still refuses.
    const first = await emailedCode(email);
    await page.reload();
    await expect(resend).toBeEnabled();
    await resend.click();
    await expect(page.getByRole('alert')).toContainText(/please wait \d+ seconds/i);
    expect(await emailedCode(email)).toBe(first);
  });

  test('signing in to an unverified account goes to the code screen', async ({ page, context }) => {
    const email = uniqueEmail('later');
    await page.goto('/signup');
    await signUp(page, email);
    await expect(page).toHaveURL('/verify-email?next=%2Fapp');
    await context.clearCookies();

    await page.goto('/signin');
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('Healthy123');
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await verifyInBrowser(page, email);
    await expect(page).toHaveURL('/app');
  });

  test('"Sign up again" signs out, and the unverified email can be signed up afresh', async ({ page }) => {
    const email = uniqueEmail('again');
    await page.goto('/signup');
    await signUp(page, email);
    await page.getByRole('button', { name: 'Sign up again' }).click();
    await expect(page).toHaveURL('/signup');
    await page.goto('/app');
    await expect(page).toHaveURL('/signin?next=%2Fapp');

    await page.goto('/signup');
    await signUp(page, email, 'Another123');
    await verifyInBrowser(page, email);
    await expect(page).toHaveURL('/app');
  });
});

test.describe('sign in', () => {
  test('wrong password shows an error and keeps the email', async ({ page }) => {
    await page.goto('/signin');
    await page.getByLabel('Email address').fill('priya.sharma@example.com');
    await page.getByLabel('Password', { exact: true }).fill('not-the-password1');
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await expect(page.getByText('Incorrect email or password.')).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeFocused();
    await expect(page.getByLabel('Email address')).toHaveValue('priya.sharma@example.com');
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
  });

  test('dietitian signs in as admin', async ({ page }) => {
    await page.goto('/signin');
    await page.getByLabel('Email address').fill('anchaldewan380@gmail.com');
    await page.getByLabel('Password', { exact: true }).fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await expect(page).toHaveURL('/app');
    await page.getByTitle(/Logged in as/).click();
    await expect(page.getByRole('dialog', { name: 'Your account' })).toContainText('Admin');
  });

  test('the development sample-account panel is not shipped to production', async ({ page }) => {
    await page.goto('/signin');
    await expect(page.getByText('Development sample accounts')).toHaveCount(0);
  });

  test('forgot password leads to a WhatsApp reset request', async ({ page, context }) => {
    await page.goto('/signin');
    await page.getByLabel('Email address').fill('priya.sharma@example.com');
    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await expect(page).toHaveURL('/forgot-password');
    await expect(page.getByLabel('Email address')).toHaveValue('priya.sharma@example.com');

    const popupPromise = context.waitForEvent('page');
    await page.getByRole('button', { name: /request reset on whatsapp/i }).click();
    const popup = await popupPromise;
    expect(decodeURIComponent(popup.url())).toContain('priya.sharma@example.com');
    await popup.close();
  });

  test('unknown URLs show a 404 page', async ({ page }) => {
    await page.goto('/this/does/not/exist');
    await expect(page.getByRole('heading', { name: /doesn't exist/i })).toBeVisible();
  });
});

test('visual snapshots for review', async ({ page }, info) => {
  for (const [name, path] of [['home', '/'], ['signin', '/signin'], ['signup', '/signup']] as const) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `test-results/screens/${info.project.name}-${name}.png` });
  }
});
