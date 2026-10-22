import { expect, test } from '@playwright/test';

// Every section of the signed-in app fits the screen — no sideways scrolling — from a small phone to a wide monitor.
const WIDTHS = [320, 375, 768, 1024, 1440, 1920];
const ACCOUNTS = [
  { email: 'priya.sharma@example.com', sections: ['Home', 'Diet Chart', 'Track', 'Appointments', 'My Plans', 'My Profile'] },
  { email: 'anchaldewan380@gmail.com', sections: ['Home', 'Diet Plans', 'Progress', 'Appointments', 'Pricing', 'Admin'] },
];

// One run is enough: this test sets its own screen sizes.
test.skip(({ isMobile }) => isMobile, 'covered by the desktop project');

test('pop-ups fit a small phone, scroll inside when tall, and close with Escape', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.request.post('/api/auth/signin', { data: { email: 'priya.sharma@example.com', password: 'Demo@1234' } });
  await page.goto('/app');
  const nav = (label: string) => page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: label, exact: true }).click();
  const fits = async (name: string) => {
    const r = await page.evaluate(() => {
      const box = [...document.querySelectorAll('div.fixed.inset-0 > div')].map((d) => d.getBoundingClientRect()).find((b) => b.width > 0);
      return { box: box && { left: box.left, right: box.right, height: box.height }, vw: document.documentElement.clientWidth, vh: innerHeight, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    expect(r.box, `${name} is open`).toBeTruthy();
    expect(r.box!.left, `${name} left edge`).toBeGreaterThanOrEqual(0);
    expect(r.box!.right, `${name} right edge`).toBeLessThanOrEqual(r.vw);
    expect(r.box!.height, `${name} height`).toBeLessThanOrEqual(r.vh);
    expect(r.overflow, `${name} page overflow`).toBeLessThanOrEqual(0);
    await page.keyboard.press('Escape');
    await expect(page.locator('div.fixed.inset-0')).toHaveCount(0);
  };

  await page.getByRole('button', { name: 'View notifications' }).click();
  await fits('Notifications');
  await page.getByRole('button', { name: 'Book Consultation' }).first().click();
  await fits('Book consultation');
  await nav('Diet Chart');
  await page.getByRole('button', { name: /View & Download PDF/ }).click();
  await fits('Diet chart PDF');
  await nav('My Plans');
  await page.getByRole('button', { name: 'View Invoice' }).click();
  await fits('Receipt');
});

for (const { email, sections } of ACCOUNTS) {
  test(`no sideways scrolling at any width for ${email}`, async ({ page }) => {
    test.setTimeout(120_000);
    const res = await page.request.post('/api/auth/signin', { data: { email, password: 'Demo@1234' } });
    expect(res.status()).toBe(200);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/app');
      await expect(page.getByTitle(/Logged in as/)).toBeVisible();
      // Wide screens use the top bar, phones and tablets the bottom tab bar — never both.
      await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(1);
      for (const section of sections) {
        await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: section, exact: true }).click();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${section} at ${width}px scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(0);
      }
    }
  });
}
