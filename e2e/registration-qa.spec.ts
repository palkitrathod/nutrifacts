import { expect, test, type Locator, type Page } from '@playwright/test';
import { verifyInBrowser } from './mail';

// Detailed QA of the registration and sign-in forms: every validation rule, error behaviour,
// normalisation of what is stored, resilience (double submit, slow / failing / offline network),
// accessibility wiring and layout stability.

const unique = (tag: string) => `qa.${tag}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`;

const f = (page: Page) => ({
  name: page.getByLabel('Full name'),
  email: page.getByLabel('Email address'),
  phone: page.getByLabel('Mobile number (WhatsApp)'),
  password: page.getByLabel('Password', { exact: true }),
  confirm: page.getByLabel('Confirm password', { exact: true }),
  terms: page.getByRole('checkbox', { name: /i agree/i }),
  submit: page.getByRole('button', { name: /create account|creating your account/i }),
});

/** The field's error text ('' when it has none). */
async function messageFor(field: Locator) {
  const id = await field.getAttribute('id');
  const el = field.page().locator(`[id="${id}-error"]`);
  if (!(await el.count())) return '';
  return ((await el.textContent()) ?? '').trim();
}

async function fillValid(page: Page, email = unique('ok')) {
  const x = f(page);
  await x.name.fill('Meera Iyer');
  await x.email.fill(email);
  await x.phone.fill('9876543210');
  await x.password.fill('Healthy123');
  await x.confirm.fill('Healthy123');
  await x.terms.check();
  return email;
}

/** Document-relative Y, so scrolling doesn't count as movement. */
const docY = async (l: Locator) => {
  await l.page().evaluate(() => document.fonts.ready);
  const box = (await l.boundingBox())!;
  return Math.round(box.y + (await l.page().evaluate(() => window.scrollY)));
};

test.describe('registration — field validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/signup');
  });

  test('empty submit: every field reports, focus goes to the first, nothing is sent', async ({ page }) => {
    let posted = false;
    page.on('request', (r) => r.url().includes('/api/auth/signup') && (posted = true));
    const x = f(page);
    await x.submit.click();

    expect(await messageFor(x.name)).toBe('Enter your full name.');
    expect(await messageFor(x.email)).toBe('Enter your email address.');
    expect(await messageFor(x.phone)).toBe('Enter your mobile number.');
    expect(await messageFor(x.password)).toBe('Create a password.');
    expect(await messageFor(x.confirm)).toBe('Re-enter your password.');
    await expect(page.getByText('Please accept to continue.')).toBeVisible();
    await expect(x.name).toBeFocused();
    for (const field of [x.name, x.email, x.phone, x.password, x.confirm]) {
      await expect(field).toHaveAttribute('aria-invalid', 'true');
    }
    expect(posted).toBe(false);
  });

  test('errors appear only after leaving a field, not while first typing', async ({ page }) => {
    const x = f(page);
    await x.email.pressSequentially('meera@exa');
    expect(await messageFor(x.email)).toBe('');
    await x.phone.focus();
    expect(await messageFor(x.email)).toMatch(/valid email/);
    // …and disappear the moment the value becomes valid.
    await x.email.pressSequentially('mple.com');
    expect(await messageFor(x.email)).toBe('');
    await expect(x.email).not.toHaveAttribute('aria-invalid');
  });

  const nameCases: Array<[string, string]> = [
    ['   ', 'Enter your full name.'],
    ['A', ''], // single-character names exist (e.g. 李)
    ['李', ''],
    ['D’Souza', ''], // iPhone "smart" apostrophe
    ['R2D2', "Use letters only (spaces, . ' - allowed)."],
    ['<script>alert(1)</script>', "Use letters only (spaces, . ' - allowed)."],
    ['😀 Smiley', "Use letters only (spaces, . ' - allowed)."],
    ['Priya Sharma', ''],
    ['प्रिया शर्मा', ''],
    ["Anne-Marie D'Souza", ''],
    ['Dr. K. Rao', ''],
  ];
  for (const [value, expected] of nameCases) {
    test(`name ${JSON.stringify(value)} → ${expected || 'accepted'}`, async ({ page }) => {
      const x = f(page);
      await x.name.fill(value);
      await x.email.focus();
      expect(await messageFor(x.name)).toBe(expected);
    });
  }

  test('name is capped at 80 characters', async ({ page }) => {
    const x = f(page);
    await x.name.fill('A'.repeat(100));
    expect((await x.name.inputValue()).length).toBe(80);
  });

  const emailCases: Array<[string, boolean]> = [
    ['plainaddress', false],
    ['@example.com', false],
    ['meera@', false],
    ['meera@example', false],
    ['meera @example.com', false],
    ['meera@example.c', false],
    ['meera@example.com', true],
    ['  Meera.Iyer+diet@Example.CO.IN  ', true],
  ];
  for (const [value, ok] of emailCases) {
    test(`email ${JSON.stringify(value)} → ${ok ? 'accepted' : 'rejected'}`, async ({ page }) => {
      const x = f(page);
      await x.email.fill(value);
      await x.phone.focus();
      expect(await messageFor(x.email)).toBe(ok ? '' : 'Enter a valid email, like name@example.com.');
    });
  }

  const phoneCases: Array<[string, boolean]> = [
    ['9876543210', true],
    ['98765 43210', true],
    ['+91 98765-43210', true],
    ['098765 43210', true],
    ['+44 7911 123456', true],
    ['12345', false],
    ['5876543210', false], // Indian mobiles start with 6–9
    ['98765432101', false],
    ['abcdefghij', false],
  ];
  for (const [value, ok] of phoneCases) {
    test(`phone ${JSON.stringify(value)} → ${ok ? 'accepted' : 'rejected'}`, async ({ page }) => {
      const x = f(page);
      await x.phone.fill(value);
      await x.password.focus();
      expect(await messageFor(x.phone)).toBe(ok ? '' : 'Enter a 10-digit mobile, or add the country code.');
    });
  }

  const passwordCases: Array<[string, string]> = [
    ['abc1', 'Use at least 8 characters.'],
    ['abcdefgh', 'Include at least one letter and one number.'],
    ['12345678', 'Include at least one letter and one number.'],
    ['Healthy 12', ''],
    ['Healthy123', ''],
  ];
  for (const [value, expected] of passwordCases) {
    test(`password ${JSON.stringify(value)} → ${expected || 'accepted'}`, async ({ page }) => {
      const x = f(page);
      await x.password.fill(value);
      await x.confirm.focus();
      expect(await messageFor(x.password)).toBe(expected);
    });
  }

  test('password checklist stays visible and marks unmet rules', async ({ page }) => {
    const x = f(page);
    await x.password.fill('abc');
    await x.confirm.focus();
    const rules = page.getByRole('list').filter({ hasText: '8+ characters' });
    await expect(rules).toContainText('8+ characters (not met)');
    await expect(rules).toContainText('A letter (met)');
    await expect(rules).toContainText('A number (not met)');
    await x.password.fill('abc12345');
    await expect(rules).toContainText('8+ characters (met)');
    await expect(rules).toContainText('A number (met)');
  });

  test('password is capped at 128 characters', async ({ page }) => {
    const x = f(page);
    await x.password.fill('a1'.repeat(100));
    expect((await x.password.inputValue()).length).toBe(128);
  });

  test('confirm password must match, and clears once it does', async ({ page }) => {
    const x = f(page);
    await x.password.fill('Healthy123');
    await x.confirm.fill('Healthy124');
    await x.terms.focus();
    expect(await messageFor(x.confirm)).toBe('Passwords do not match.');
    await x.confirm.fill('Healthy123');
    expect(await messageFor(x.confirm)).toBe('');
  });

  test('show/hide toggles reveal each password independently', async ({ page }) => {
    const x = f(page);
    await page.getByRole('button', { name: 'Show password' }).click();
    await expect(x.password).toHaveAttribute('type', 'text');
    await expect(x.confirm).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Hide password' }).click();
    await expect(x.password).toHaveAttribute('type', 'password');
  });

  test('consent is required, and the error clears when ticked', async ({ page }) => {
    await fillValid(page);
    const x = f(page);
    await x.terms.uncheck();
    await x.submit.click();
    await expect(page.getByText('Please accept to continue.')).toBeVisible();
    await expect(x.terms).toBeFocused();
    await x.terms.check();
    await expect(page.getByText('Please accept to continue.')).toHaveCount(0);
  });
});

test.describe('registration — submitting', () => {
  test('messy input is cleaned up before it is stored', async ({ page }) => {
    await page.goto('/signup');
    const x = f(page);
    const local = `qa.clean.${Date.now()}`;
    await x.name.fill('  Meera    Iyer ');
    await x.email.fill(`  ${local.toUpperCase()}@Example.COM `);
    await x.phone.fill('098765 43210');
    await x.password.fill('Healthy123');
    await x.confirm.fill('Healthy123');
    await x.terms.check();
    const resp = page.waitForResponse((r) => r.url().endsWith('/api/auth/signup'));
    await x.submit.click();
    const { user } = await (await resp).json();
    expect(user).toMatchObject({ name: 'Meera Iyer', email: `${local}@example.com`, phone: '+919876543210', role: 'patient' });

    await verifyInBrowser(page, user.email);
    await expect(page).toHaveURL('/app');
    expect(page.url()).not.toContain('Healthy123');
    await page.getByTitle(/Logged in as/).click();
    await expect(page.getByRole('dialog', { name: 'Your account' })).toContainText('+91 98765 43210');
  });

  test('duplicate email (any case) is reported on the email field, with a sign-in link, keeping the form', async ({ page }) => {
    await page.goto('/signup');
    await fillValid(page, 'PRIYA.Sharma@example.com');
    await f(page).submit.click();
    const x = f(page);
    await expect(page.getByText('This email already has an account.')).toBeVisible();
    await expect(x.email).toBeFocused();
    await expect(x.name).toHaveValue('Meera Iyer');
    await expect(x.password).toHaveValue('Healthy123');
    await page.getByRole('link', { name: 'Sign in', exact: true }).first().click();
    await expect(page).toHaveURL('/signin');
  });

  test('double-clicking "Create account" sends only one request', async ({ page }) => {
    await page.goto('/signup');
    await fillValid(page);
    let count = 0;
    await page.route('**/api/auth/signup', async (route) => {
      count++;
      await new Promise((r) => setTimeout(r, 400));
      await route.continue();
    });
    await f(page).submit.dblclick();
    await expect(page).toHaveURL('/verify-email?next=%2Fapp');
    expect(count).toBe(1);
  });

  test('pressing Enter submits the form', async ({ page }) => {
    await page.goto('/signup');
    await fillValid(page);
    await f(page).confirm.press('Enter');
    await expect(page).toHaveURL('/verify-email?next=%2Fapp');
  });

  test('while saving, the button is disabled and says so', async ({ page }) => {
    await page.goto('/signup');
    await fillValid(page);
    await page.route('**/api/auth/signup', async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    await f(page).submit.click();
    await expect(page.getByRole('button', { name: /creating your account/i })).toBeDisabled();
    await expect(page).toHaveURL('/verify-email?next=%2Fapp');
  });

  test('a server error shows a friendly message and keeps everything typed; retry works', async ({ page }) => {
    await page.goto('/signup');
    const email = await fillValid(page);
    let fail = true;
    await page.route('**/api/auth/signup', (route) =>
      fail
        ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { code: 'server_error', message: 'Something went wrong on our side. Please try again.' } }) })
        : route.continue()
    );
    await f(page).submit.click();
    await expect(page.getByRole('alert')).toHaveText(/something went wrong on our side/i);
    await expect(f(page).email).toHaveValue(email);
    fail = false;
    await f(page).submit.click();
    await expect(page).toHaveURL('/verify-email?next=%2Fapp');
  });

  test('offline: says the connection failed', async ({ page, context }) => {
    await page.goto('/signup');
    await fillValid(page);
    await context.setOffline(true);
    await f(page).submit.click();
    await expect(page.getByRole('alert')).toHaveText(/could not reach nutrifacts/i);
    await context.setOffline(false);
  });

  test('too many sign-ups from one network shows the limit message', async ({ page }) => {
    await page.goto('/signup');
    await fillValid(page);
    await page.route('**/api/auth/signup', (route) =>
      route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: { code: 'rate_limited', message: 'Too many accounts created from this network. Please try again later.' } }) })
    );
    await f(page).submit.click();
    await expect(page.getByRole('alert')).toHaveText(/too many accounts/i);
  });

  test('after signing up, Back does not return to the sign-up form', async ({ page }) => {
    await page.goto('/');
    await page.goto('/signup');
    await fillValid(page);
    await f(page).submit.click();
    await expect(page).toHaveURL('/verify-email?next=%2Fapp');
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Create your account' })).toHaveCount(0);
  });
});

test.describe('registration — layout & accessibility', () => {
  test('nothing moves when errors appear or clear', async ({ page }) => {
    await page.goto('/signup');
    const x = f(page);
    const marks = [x.name, x.email, x.phone, x.password, x.confirm, x.submit];
    const before = await Promise.all(marks.map(docY));
    await x.submit.click();
    expect(await Promise.all(marks.map(docY))).toEqual(before);
    await x.email.fill('meera@example.com');
    await x.password.fill('abc');
    expect(await Promise.all(marks.map(docY))).toEqual(before);
  });

  test('inputs use at least 16px text on phones (prevents iOS zoom-in on focus)', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'phone-only check');
    for (const path of ['/signup', '/signin', '/forgot-password']) {
      await page.goto(path);
      const sizes = await page.locator('input:not([type=checkbox])').evaluateAll((els) =>
        els.map((e) => parseFloat(getComputedStyle(e).fontSize))
      );
      expect(Math.min(...sizes), path).toBeGreaterThanOrEqual(16);
    }
  });

  test('keyboard-only: fields are reachable in order and the form can be submitted', async ({ page, browserName }) => {
    await page.goto('/signup');
    const x = f(page);
    // Browsers differ on whether Tab stops at buttons (Safari skips them by default), so press Tab
    // until the next *field* is reached — and fail if it takes more than two presses.
    const tabTo = async (target: Locator) => {
      for (let i = 0; i < 3; i++) {
        if (await target.evaluate((el) => el === document.activeElement)) return;
        await page.keyboard.press('Tab');
      }
      await expect(target).toBeFocused();
    };
    await expect(x.name).toBeFocused(); // autofocus
    await page.keyboard.type('Meera Iyer');
    await page.keyboard.press('Tab');
    await tabTo(x.email);
    await page.keyboard.type(unique('kbd'));
    await page.keyboard.press('Tab');
    await tabTo(x.phone);
    await page.keyboard.type('9876543210');
    await page.keyboard.press('Tab');
    await tabTo(x.password);
    await page.keyboard.type('Healthy123');
    await page.keyboard.press('Tab');
    await tabTo(x.confirm);
    await page.keyboard.type('Healthy123');
    await page.keyboard.press('Tab');
    if (browserName === 'webkit') {
      // Safari only tabs to checkboxes with macOS "Keyboard navigation" turned on.
      await x.terms.focus();
    } else {
      await tabTo(x.terms);
    }
    await page.keyboard.press('Space');
    await expect(x.terms).toBeChecked();
    await x.terms.press('Enter'); // Enter in a form field submits
    await expect(page).toHaveURL('/verify-email?next=%2Fapp');
  });

  test('sign-in: Tab goes from email straight to password', async ({ page }) => {
    await page.goto('/signin');
    await page.getByLabel('Email address').focus();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Password', { exact: true })).toBeFocused();
  });
});

test.describe('sign-in — validation & behaviour', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/signin');
  });
  const email = (page: Page) => page.getByLabel('Email address');
  const password = (page: Page) => page.getByLabel('Password', { exact: true });
  const submit = (page: Page) => page.getByRole('button', { name: /^sign in$|signing in/i });

  test('empty and malformed input is caught before sending', async ({ page }) => {
    let posted = false;
    page.on('request', (r) => r.url().includes('/api/auth/signin') && (posted = true));
    await submit(page).click();
    expect(await messageFor(email(page))).toBe('Enter your email address.');
    await email(page).fill('not-an-email');
    await password(page).fill('x');
    await submit(page).click();
    expect(await messageFor(email(page))).toMatch(/valid email/);
    expect(posted).toBe(false);
  });

  test('email is case- and space-insensitive', async ({ page }) => {
    await email(page).fill('  PRIYA.SHARMA@Example.com ');
    await password(page).fill('Demo@1234');
    await submit(page).click();
    await expect(page).toHaveURL('/app');
  });

  test('password is case-sensitive', async ({ page }) => {
    await email(page).fill('priya.sharma@example.com');
    await password(page).fill('demo@1234');
    await submit(page).click();
    await expect.poll(() => messageFor(password(page))).toBe('Incorrect email or password.');
  });

  test('lock-out message is shown when the server rate-limits', async ({ page }) => {
    await page.route('**/api/auth/signin', (route) =>
      route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: { code: 'rate_limited', message: 'Too many failed attempts. Try again in 15 minute(s).' } }) })
    );
    await email(page).fill('priya.sharma@example.com');
    await password(page).fill('whatever1');
    await submit(page).click();
    await expect(page.getByRole('alert')).toHaveText(/too many failed attempts/i);
  });

  test('without "keep me signed in", the cookie ends with the browser session', async ({ page, context }) => {
    await page.getByLabel(/keep me signed in/i).uncheck();
    await email(page).fill('priya.sharma@example.com');
    await password(page).fill('Demo@1234');
    await submit(page).click();
    await expect(page).toHaveURL('/app');
    const cookie = (await context.cookies()).find((c) => c.name === 'nf_session')!;
    expect(cookie.expires).toBe(-1);
    expect(cookie.httpOnly).toBe(true);
  });

  test('nothing moves when the error banner is not involved and field errors appear', async ({ page }) => {
    const before = await docY(submit(page));
    await submit(page).click();
    expect(await docY(submit(page))).toBe(before);
  });
});
