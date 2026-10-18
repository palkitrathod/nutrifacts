import { expect, test, type Page } from '@playwright/test';

// The marketing page must not jump, shift or "zoom" on refresh, and navigation must open pages at
// the right scroll position.

/** What is on screen: scroll position plus the text at three points down the viewport. */
const snapshot = (page: Page) =>
  page.evaluate(() => {
    const x = Math.min(720, innerWidth / 2);
    return {
      y: Math.round(scrollY),
      // Frames where nothing is drawn yet (hit-testing finds only <html>/<body>) count as "blank".
      blank: [150, 450, 750].every((y) => {
        const el = document.elementFromPoint(x, y);
        return !el || el === document.documentElement || el === document.body;
      }),
      text: [150, 450, 750]
        .filter((y) => y < innerHeight)
        .map((y) => (document.elementFromPoint(x, y)?.textContent ?? '').trim().slice(0, 30)),
    };
  });

for (const position of [900, 2600, 4200]) {
  test(`refresh at ${position}px returns to exactly the same view, without moving afterwards`, async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate((y) => window.scrollTo(0, y), position);
    await page.waitForTimeout(400);
    const before = await snapshot(page);

    // Realistic network: the price list arrives late.
    await page.route('**/api/packages', async (route) => {
      await new Promise((r) => setTimeout(r, 700));
      await route.continue();
    });
    await page.reload({ waitUntil: 'commit' });

    const seen = new Set<string>();
    for (let i = 0; i < 24; i++) {
      const s = await page.evaluate(() => document.querySelector('#services') !== null).catch(() => false);
      if (s) {
        const shot = await snapshot(page).catch(() => null);
        if (shot && !shot.blank && (await page.evaluate(() => document.documentElement.style.visibility !== 'hidden'))) {
          seen.add(JSON.stringify(shot));
        }
      }
      await page.waitForTimeout(50);
    }
    expect([...seen]).toEqual([JSON.stringify(before)]);
  });
}

test('first visit (nothing cached): the pricing area does not grow when plans arrive', async ({ page }) => {
  await page.route('**/api/packages', async (route) => {
    await new Promise((r) => setTimeout(r, 700));
    await route.continue();
  });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const below = page.getByRole('heading', { name: 'Real Results, Real People' });
  const yWhileLoading = await below.evaluate((el) => el.getBoundingClientRect().top + scrollY);
  await expect(page.getByRole('link', { name: /choose this plan/i }).first()).toBeAttached({ timeout: 5000 });
  const yLoaded = await below.evaluate((el) => el.getBoundingClientRect().top + scrollY);
  // Placeholders and real cards share the same minimum height.
  expect(yLoaded).toBe(yWhileLoading);
});

test('opening a page from the bottom of the home page starts at its top; Back returns to where you were', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const cta = page.locator('#cta-get-started');
  await cta.scrollIntoViewIfNeeded();
  const homeY = await page.evaluate(() => Math.round(scrollY));
  expect(homeY).toBeGreaterThan(2000);
  await cta.click();
  await expect(page).toHaveURL('/signup');
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeInViewport();

  await page.goBack();
  await expect(page).toHaveURL('/');
  await expect.poll(() => page.evaluate(() => Math.round(scrollY))).toBe(homeY);
});

test('the six services show icons that match what they are', async ({ page }) => {
  await page.goto('/');
  const expected: Record<string, string> = {
    'Weight Management': 'icon-weighing-scale',
    'PCOS & PCOD Care': 'lucide-venus',
    'Diabetes Nutrition': 'lucide-droplet',
    'Healthy Weight Gain': 'lucide-biceps-flexed',
    'Therapeutic Diets': 'lucide-stethoscope',
    'Personalized Meal Planning': 'lucide-salad',
  };
  for (const [title, iconClass] of Object.entries(expected)) {
    const card = page.locator('#services .grid > div').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
    await expect(card.locator(`svg.${iconClass}`)).toHaveCount(1);
  }
});
