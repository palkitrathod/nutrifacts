import fs from 'node:fs';
import path from 'node:path';
import { expect, type APIRequestContext, type Page } from '@playwright/test';

// Without SMTP the server saves each email in this folder (set by the Playwright configs; a server
// started with `npm run dev` uses data/outbox).
const outboxDir = () => process.env.MAIL_OUTBOX_DIR ?? path.resolve('data', 'outbox');

/** The code in the newest verification email sent to this address. */
export async function emailedCode(email: string): Promise<string> {
  const to = `To: ${email.trim().toLowerCase()}\n`;
  let code: string | undefined;
  await expect
    .poll(() => {
      const dir = outboxDir();
      if (!fs.existsSync(dir)) return undefined;
      const latest = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.txt'))
        .sort()
        .reverse()
        .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
        .find((text) => text.startsWith(to));
      code = latest?.match(/email address: (\d{6})/)?.[1];
      return code;
    }, { message: `verification email to ${email}` })
    .toBeTruthy();
  return code!;
}

/** On the "Check your email" screen: enters the emailed code (it submits itself) and waits to leave. */
export async function verifyInBrowser(page: Page, email: string) {
  await expect(page).toHaveURL(/\/verify-email/);
  await page.getByLabel('Verification code').fill(await emailedCode(email));
  await expect(page).not.toHaveURL(/\/verify-email/);
}

/** Verifies the account signed in on this request context. */
export async function verifyViaApi(request: APIRequestContext, email: string) {
  const res = await request.post('/api/auth/verify-email', { data: { code: await emailedCode(email) } });
  expect(res.status(), await res.text()).toBe(200);
}
